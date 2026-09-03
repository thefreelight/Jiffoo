import { authenticateNativeUser, type NativeAuthEnv } from './auth';
import { isNativePluginEnabled } from './plugin-enabled';

type Env = NativeAuthEnv & { DB: D1Database };

interface CardRow {
  id: string;
  mid: string;
  eid: string | null;
  iccid: string | null;
  status: string;
  verification_status: string;
  user_id: string | null;
  bound_at: string | null;
  verified_at: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ClaimRow {
  id: string;
  user_id: string;
  card_id: string;
  mid: string;
  status: string;
  verification_method: string | null;
  expires_at: string;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

function response(data: unknown, status = 200): Response {
  return Response.json(status < 400 ? { success: true, data } : { success: false, error: data }, {
    status,
    headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-bokmoo-connect' },
  });
}

function error(code: string, message: string, status: number, details?: unknown): Response {
  return response({ code, message, ...(details === undefined ? {} : { details }) }, status);
}

function normalizeIdentifier(value: unknown): string {
  return typeof value === 'string' ? value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';
}

function displayMid(mid: string): string {
  return mid.match(/.{1,4}/g)?.join(' ') ?? mid;
}

function publicCard(row: CardRow, includeHardware = false) {
  return {
    id: row.id,
    cardId: row.mid,
    mid: row.mid,
    displayCardId: displayMid(row.mid),
    status: row.status,
    bindingStatus: row.status,
    verificationStatus: row.verification_status,
    boundAt: row.bound_at,
    verifiedAt: row.verified_at,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(includeHardware ? { eid: row.eid, iccid: row.iccid } : {}),
  };
}

function publicSession(row: ClaimRow, card?: CardRow) {
  return {
    id: row.id,
    cardId: row.card_id,
    mid: row.mid,
    status: row.status,
    verificationMethod: row.verification_method,
    expiresAt: row.expires_at,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(card ? { card: publicCard(card, true) } : {}),
  };
}

function normalizedPath(pathname: string): string | null {
  const pluginPrefix = '/api/v1/plugins/bokmoo-connect/store';
  if (pathname.startsWith(`${pluginPrefix}/cards`)) return pathname.slice(pluginPrefix.length);
  if (pathname.startsWith('/api/v1/cards')) return pathname.slice('/api/v1'.length);
  return null;
}

async function requireUser(request: Request, env: Env) {
  return authenticateNativeUser(request, env);
}

async function listCards(request: Request, env: Env): Promise<Response> {
  const user = await requireUser(request, env);
  if (!user) return error('UNAUTHORIZED', 'Login required', 401);
  const rows = await env.DB.prepare(
    'SELECT * FROM native_bokmoo_cards WHERE user_id = ?1 ORDER BY created_at DESC',
  ).bind(user.id).all<CardRow>();
  const items = rows.results.map((row) => publicCard(row));
  return response({ items, page: 1, limit: items.length, total: items.length });
}

async function cardDetail(request: Request, env: Env, identifier: string): Promise<Response> {
  const user = await requireUser(request, env);
  if (!user) return error('UNAUTHORIZED', 'Login required', 401);
  const normalized = normalizeIdentifier(identifier);
  const card = await env.DB.prepare(
    'SELECT * FROM native_bokmoo_cards WHERE user_id = ?1 AND (id = ?2 OR mid = ?3) LIMIT 1',
  ).bind(user.id, identifier, normalized).first<CardRow>();
  return card ? response(publicCard(card, true)) : error('CARD_NOT_FOUND', 'Card not found', 404);
}

async function createClaim(request: Request, env: Env): Promise<Response> {
  const user = await requireUser(request, env);
  if (!user) return error('UNAUTHORIZED', 'Login required', 401);
  const body = await request.json<{ mid?: unknown; verificationMethod?: unknown }>().catch(() => null);
  const mid = normalizeIdentifier(body?.mid);
  if (mid.length < 8 || mid.length > 64) return error('MID_REQUIRED', 'The MID printed on the card is required', 400);

  const existing = await env.DB.prepare('SELECT * FROM native_bokmoo_cards WHERE mid = ?1 LIMIT 1')
    .bind(mid).first<CardRow>();
  if (existing && ['frozen', 'lost', 'retired'].includes(existing.status)) {
    return error('CARD_LIFECYCLE_BLOCKED', `Card is ${existing.status}`, 409, { status: existing.status });
  }
  if (existing?.user_id && existing.user_id !== user.id) {
    return error('CARD_POLICY_FAILURE', 'Card is already bound to another account', 409, { policy: 'bound_to_other' });
  }

  const now = new Date();
  const cardId = existing?.id ?? `bokmoo_card_${crypto.randomUUID()}`;
  if (!existing) {
    await env.DB.prepare(`INSERT INTO native_bokmoo_cards
      (id, mid, status, verification_status, created_at, updated_at)
      VALUES (?1, ?2, 'unbound', 'pending', ?3, ?3)`)
      .bind(cardId, mid, now.toISOString()).run();
  }
  const sessionId = `bokmoo_claim_${crypto.randomUUID()}`;
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
  await env.DB.prepare(`INSERT INTO native_bokmoo_card_claim_sessions
    (id, user_id, card_id, mid, status, verification_method, challenge_nonce, expires_at, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, 'pending', ?5, ?6, ?7, ?8, ?8)`)
    .bind(sessionId, user.id, cardId, mid,
      typeof body?.verificationMethod === 'string' ? body.verificationMethod : 'ios_qr',
      crypto.randomUUID(), expiresAt, now.toISOString()).run();
  const session = await env.DB.prepare('SELECT * FROM native_bokmoo_card_claim_sessions WHERE id = ?1')
    .bind(sessionId).first<ClaimRow>();
  return response({ result: 'pending_verification', session: publicSession(session!) }, 201);
}

async function getClaim(request: Request, env: Env, sessionId: string): Promise<Response> {
  const user = await requireUser(request, env);
  if (!user) return error('UNAUTHORIZED', 'Login required', 401);
  const now = new Date().toISOString();
  await env.DB.prepare(`UPDATE native_bokmoo_card_claim_sessions
    SET status = 'expired', updated_at = ?1
    WHERE id = ?2 AND user_id = ?3 AND status = 'pending' AND expires_at <= ?1`)
    .bind(now, sessionId, user.id).run();
  const session = await env.DB.prepare(
    'SELECT * FROM native_bokmoo_card_claim_sessions WHERE id = ?1 AND user_id = ?2 LIMIT 1',
  ).bind(sessionId, user.id).first<ClaimRow>();
  if (!session) return error('CARD_CLAIM_SESSION_NOT_FOUND', 'Card verification session not found', 404);
  const card = session.status === 'completed'
    ? await env.DB.prepare('SELECT * FROM native_bokmoo_cards WHERE id = ?1').bind(session.card_id).first<CardRow>()
    : null;
  return response(publicSession(session, card ?? undefined));
}

async function verifyClaim(request: Request, env: Env, sessionId: string): Promise<Response> {
  const user = await requireUser(request, env);
  if (!user) return error('UNAUTHORIZED', 'Login required', 401);
  const body = await request.json<{ eid?: unknown; iccid?: unknown; verificationMethod?: unknown }>().catch(() => null);
  const eid = normalizeIdentifier(body?.eid);
  const iccid = normalizeIdentifier(body?.iccid);
  if (!eid && !iccid) return error('CARD_IDENTIFIER_REQUIRED', 'EID or ICCID is required', 400);

  const session = await env.DB.prepare(
    'SELECT * FROM native_bokmoo_card_claim_sessions WHERE id = ?1 AND user_id = ?2 LIMIT 1',
  ).bind(sessionId, user.id).first<ClaimRow>();
  if (!session) return error('CARD_CLAIM_SESSION_NOT_FOUND', 'Card verification session not found', 404);
  if (session.status !== 'pending') return error('CARD_CLAIM_SESSION_NOT_PENDING', 'Card verification session is no longer pending', 409);
  const now = new Date().toISOString();
  if (session.expires_at <= now) {
    await env.DB.prepare("UPDATE native_bokmoo_card_claim_sessions SET status = 'expired', updated_at = ?1 WHERE id = ?2")
      .bind(now, session.id).run();
    return error('CARD_CLAIM_SESSION_EXPIRED', 'Card verification session has expired', 409);
  }

  const card = await env.DB.prepare('SELECT * FROM native_bokmoo_cards WHERE id = ?1 LIMIT 1')
    .bind(session.card_id).first<CardRow>();
  if (!card) return error('CARD_NOT_FOUND', 'Card record not found', 404);
  if (['frozen', 'lost', 'retired'].includes(card.status)) return error('CARD_LIFECYCLE_BLOCKED', `Card is ${card.status}`, 409);
  if (card.user_id && card.user_id !== user.id) return error('CARD_POLICY_FAILURE', 'Card is already bound to another account', 409);
  if (card.eid && eid && normalizeIdentifier(card.eid) !== eid) return error('CARD_EID_MISMATCH', 'Card EID does not match the MID record', 409);
  if (card.iccid && iccid && normalizeIdentifier(card.iccid) !== iccid) return error('CARD_ICCID_MISMATCH', 'Card ICCID does not match the MID record', 409);
  const conflict = await env.DB.prepare(`SELECT id FROM native_bokmoo_cards
    WHERE id <> ?1 AND ((?2 <> '' AND eid = ?2) OR (?3 <> '' AND iccid = ?3)) LIMIT 1`)
    .bind(card.id, eid, iccid).first<{ id: string }>();
  if (conflict) return error('CARD_IDENTIFIER_ALREADY_REGISTERED', 'The inserted card identifier is already registered', 409);

  const verificationMethod = typeof body?.verificationMethod === 'string' ? body.verificationMethod : 'android';
  await env.DB.batch([
    env.DB.prepare(`UPDATE native_bokmoo_cards SET eid = COALESCE(?1, eid), iccid = COALESCE(?2, iccid),
      user_id = ?3, status = 'bound', verification_status = 'verified', bound_at = COALESCE(bound_at, ?4),
      verified_at = ?4, last_seen_at = ?4, updated_at = ?4 WHERE id = ?5`)
      .bind(eid || null, iccid || null, user.id, now, card.id),
    env.DB.prepare(`UPDATE native_bokmoo_card_claim_sessions SET status = 'completed', verification_method = ?1,
      verified_at = ?2, updated_at = ?2 WHERE id = ?3 AND status = 'pending'`)
      .bind(verificationMethod, now, session.id),
  ]);
  const updatedCard = await env.DB.prepare('SELECT * FROM native_bokmoo_cards WHERE id = ?1')
    .bind(card.id).first<CardRow>();
  const updatedSession = await env.DB.prepare('SELECT * FROM native_bokmoo_card_claim_sessions WHERE id = ?1')
    .bind(session.id).first<ClaimRow>();
  return response({ result: 'verified', card: publicCard(updatedCard!, true), session: publicSession(updatedSession!, updatedCard!) });
}

export async function tryNativeBokmooConnect(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const path = normalizedPath(url.pathname);
  if (path === null) return null;
  if (!(await isNativePluginEnabled(env, 'bokmoo-connect'))) {
    return error('PLUGIN_NOT_ENABLED', 'BOKMOO Connect plugin is not installed and enabled', 404);
  }
  if (request.method === 'GET' && path === '/cards') return listCards(request, env);
  if (request.method === 'POST' && path === '/cards/claim-sessions') return createClaim(request, env);
  const sessionVerify = path.match(/^\/cards\/claim-sessions\/([^/]+)\/verify$/);
  if (request.method === 'POST' && sessionVerify) return verifyClaim(request, env, decodeURIComponent(sessionVerify[1]));
  const session = path.match(/^\/cards\/claim-sessions\/([^/]+)$/);
  if (request.method === 'GET' && session) return getClaim(request, env, decodeURIComponent(session[1]));
  const card = path.match(/^\/cards\/([^/]+)$/);
  if (request.method === 'GET' && card) return cardDetail(request, env, decodeURIComponent(card[1]));
  return null;
}
