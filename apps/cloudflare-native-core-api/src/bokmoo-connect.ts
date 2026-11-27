import { authenticateNativeAdmin, authenticateNativeUser, type NativeAuthEnv } from './auth';
import { isNativePluginEnabled } from './plugin-enabled';

type Env = NativeAuthEnv & { DB: D1Database };

interface CardRow {
  id: string;
  mid: string;
  eid: string | null;
  iccid: string | null;
  sku: string | null;
  batch: string | null;
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

interface ImportRunRow {
  id: string;
  total: number;
  imported: number;
  updated: number;
  conflicts: number;
  operator: string | null;
  created_at: string;
}

interface ProfileRow {
  eid: string;
  iccid: string;
  enabled: number;
  name: string;
  provider: string;
  source: string | null;
  synced_at: string;
}

/** An order line that put a plan on an ICCID: a new eSIM, or a plan added to one. */
interface CustomerOrder {
  orderId: string;
  orderNumber: string;
  productId: string | null;
  productName: string;
  quantity: number;
  createdAt: string | null;
  status: string | null;
  paymentStatus: string | null;
  kind: 'new' | 'top-up';
}

const CARD_LIFECYCLE_BLOCKS = ['frozen', 'lost', 'retired'];

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
  // The list is already scoped to the caller's own cards, so the EID must
  // come back — the apps match a detected card against the bound EID to
  // show "verified"; without it every card reads as 待确认.
  const items = rows.results.map((row) => publicCard(row, true));
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

/** PRD 0002 plug-and-play: silent EID sighting. No claim, no gate —
 * support-trace only. Upserts a 'seen' card row keyed by EID for the caller. */
async function recordCardSighting(request: Request, env: Env): Promise<Response> {
  const user = await requireUser(request, env);
  if (!user) return error('UNAUTHORIZED', 'Login required', 401);
  const body = await request.json<{ eid?: unknown; iccid?: unknown; readerCount?: unknown }>().catch(() => null);
  const eid = typeof body?.eid === 'string' ? body.eid.trim().toUpperCase() : '';
  if (!/^[0-9]{32}$/.test(eid)) return error('VALIDATION_ERROR', 'A 32-digit EID is required', 400);
  const iccid = typeof body?.iccid === 'string' && body.iccid.trim() ? body.iccid.trim() : null;
  const readerCount = typeof body?.readerCount === 'number' && Number.isFinite(body.readerCount) ? body.readerCount : null;
  const existing = await env.DB.prepare(
    'SELECT id, status FROM native_bokmoo_cards WHERE user_id = ?1 AND eid = ?2 LIMIT 1',
  ).bind(user.id, eid).first<CardRow>();
  const now = new Date().toISOString();
  if (existing) {
    await env.DB.prepare(
      'UPDATE native_bokmoo_cards SET last_seen_at = ?2, iccid = COALESCE(?3, iccid) WHERE id = ?1',
    ).bind(existing.id, now, iccid).run();
    return response({ result: 'recorded', eid });
  }
  const id = `card-seen-${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
  await env.DB.prepare(
    `INSERT INTO native_bokmoo_cards (id, mid, eid, iccid, status, verification_status, user_id, last_seen_at, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, 'seen', 'seen', ?5, ?6, ?6, ?6)`,
  ).bind(id, eid, eid, iccid, user.id, now).run();
  return response({ result: 'recorded', eid, id }, 201);
}

function parsedJson(text: unknown): Record<string, unknown> {
  if (typeof text !== 'string' || !text) return {};
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

/** An ICCID as digits, without the filler an odd-length one ends with. */
function iccidDigits(value: unknown): string {
  return typeof value === 'string' ? value.replace(/[^0-9]/g, '') : '';
}

/** Whether two ICCIDs name the same eSIM. The issuer's asset number can be
 *  the tail of the ICCID the card reports, so a shorter one matches when it
 *  is how the longer one ends. */
function sameIccid(left: string, right: string): boolean {
  if (!left || !right) return false;
  if (left === right) return true;
  const [short, long] = left.length <= right.length ? [left, right] : [right, left];
  return short.length >= 6 && long.endsWith(short);
}

/** The app read a card: record the card under the caller's account and the
 *  plans on it. A card nobody owns is bound to the caller; a card another
 *  account owns is left alone. */
async function syncCard(request: Request, env: Env): Promise<Response> {
  const user = await requireUser(request, env);
  if (!user) return error('UNAUTHORIZED', 'Login required', 401);
  const body = await request.json<{ eid?: unknown; profiles?: unknown; source?: unknown }>().catch(() => null);
  const eid = typeof body?.eid === 'string' ? body.eid.trim().toUpperCase() : '';
  if (!/^[0-9]{32}$/.test(eid)) return error('VALIDATION_ERROR', 'A 32-digit EID is required', 400);
  const input = Array.isArray(body?.profiles) ? body.profiles : [];
  if (input.length > 32) return error('VALIDATION_ERROR', 'A card has at most 32 profiles', 400);
  const profiles: Array<{ iccid: string; enabled: number; name: string; provider: string }> = [];
  for (const raw of input) {
    const item = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const iccid = iccidDigits(item.iccid);
    if (iccid.length < 6 || iccid.length > 22 || profiles.some((profile) => profile.iccid === iccid)) continue;
    profiles.push({
      iccid,
      enabled: item.enabled === true ? 1 : 0,
      name: optionalText(item.name, 64) ?? '',
      provider: optionalText(item.provider, 64) ?? '',
    });
  }
  const source = optionalText(body?.source, 32);
  const now = new Date().toISOString();

  const card = await env.DB.prepare('SELECT * FROM native_bokmoo_cards WHERE eid = ?1 LIMIT 1')
    .bind(eid).first<CardRow>();
  if (card && CARD_LIFECYCLE_BLOCKS.includes(card.status)) {
    return error('CARD_LIFECYCLE_BLOCKED', `Card is ${card.status}`, 409, { status: card.status });
  }
  if (card?.user_id && card.user_id !== user.id) {
    return error('CARD_POLICY_FAILURE', 'Card is already bound to another account', 409, { policy: 'bound_to_other' });
  }

  const statements: D1PreparedStatement[] = [];
  if (card) {
    statements.push(env.DB.prepare(`UPDATE native_bokmoo_cards SET user_id = ?1, bound_at = COALESCE(bound_at, ?2), last_seen_at = ?2,
      status = CASE WHEN status IN ('unbound', 'seen') THEN 'seen' ELSE status END,
      verification_status = CASE WHEN verification_status IN ('pending', 'seen') THEN 'seen' ELSE verification_status END,
      updated_at = ?2 WHERE id = ?3`).bind(user.id, now, card.id));
  } else {
    statements.push(env.DB.prepare(`INSERT INTO native_bokmoo_cards
      (id, mid, eid, status, verification_status, user_id, bound_at, last_seen_at, created_at, updated_at)
      VALUES (?1, ?2, ?3, 'seen', 'seen', ?4, ?5, ?5, ?5, ?5)`)
      .bind(`card-seen-${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`, eid, eid, user.id, now));
  }
  statements.push(env.DB.prepare('DELETE FROM native_bokmoo_card_profiles WHERE eid = ?1').bind(eid));
  for (const profile of profiles) {
    statements.push(env.DB.prepare(`INSERT INTO native_bokmoo_card_profiles (eid, iccid, enabled, name, provider, source, synced_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`)
      .bind(eid, profile.iccid, profile.enabled, profile.name, profile.provider, source, now));
  }
  try {
    await env.DB.batch(statements);
  } catch (failure) {
    // Two accounts reading the same new card at once: the second insert meets the EID's uniqueness.
    if (!card && /UNIQUE/i.test(String(failure))) {
      return error('CARD_POLICY_FAILURE', 'Card is already bound to another account', 409, { policy: 'bound_to_other' });
    }
    throw failure;
  }
  return response({ result: 'recorded', eid, profiles: profiles.length }, card ? 200 : 201);
}

async function createClaim(request: Request, env: Env): Promise<Response> {
  const user = await requireUser(request, env);
  if (!user) return error('UNAUTHORIZED', 'Login required', 401);
  const body = await request.json<{ mid?: unknown; verificationMethod?: unknown }>().catch(() => null);
  const mid = normalizeIdentifier(body?.mid);
  if (mid.length < 8 || mid.length > 64) return error('MID_REQUIRED', 'The MID printed on the card is required', 400);

  const existing = await env.DB.prepare('SELECT * FROM native_bokmoo_cards WHERE mid = ?1 LIMIT 1')
    .bind(mid).first<CardRow>();
  if (existing && CARD_LIFECYCLE_BLOCKS.includes(existing.status)) {
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
  if (CARD_LIFECYCLE_BLOCKS.includes(card.status)) return error('CARD_LIFECYCLE_BLOCKED', `Card is ${card.status}`, 409);
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

function adminCard(row: CardRow) {
  return { ...publicCard(row, true), sku: row.sku ?? null, batch: row.batch ?? null, userId: row.user_id };
}

function optionalText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

async function requireAdmin(request: Request, env: Env) {
  return authenticateNativeAdmin(request, env);
}

const ADMIN_PREFIX = '/api/v1/extensions/plugin/bokmoo-connect/api/admin';

function adminPath(pathname: string): string | null {
  if (!pathname.startsWith(`${ADMIN_PREFIX}/`)) return null;
  const suffix = pathname.slice(ADMIN_PREFIX.length);
  const customerCards = suffix.match(/^\/customers\/[^/]+\/cards$/);
  if (customerCards) return customerCards[0];
  return suffix === '/cards' || suffix === '/cards/import' || suffix === '/cards/imports' ? suffix : null;
}

type ImportOutcome = { mid: string; result: 'imported' | 'updated' | 'conflict'; reason?: string };

async function importCards(request: Request, env: Env): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (!admin) return error('UNAUTHORIZED', 'Admin authentication required', 401);
  const body = await request.json<{ cards?: unknown }>().catch(() => null);
  const rows = Array.isArray(body?.cards) ? body.cards : null;
  if (!rows || rows.length === 0) return error('IMPORT_CARDS_REQUIRED', 'A non-empty cards array is required', 400);
  if (rows.length > 1000) return error('IMPORT_CARDS_TOO_LARGE', 'Import at most 1000 cards per run', 400);

  const now = new Date().toISOString();
  const items: ImportOutcome[] = [];
  let imported = 0;
  let updated = 0;
  let conflicts = 0;

  for (const raw of rows) {
    const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const mid = normalizeIdentifier(input.mid);
    const eid = normalizeIdentifier(input.eid);
    const iccid = normalizeIdentifier(input.iccid);
    const sku = optionalText(input.sku, 64);
    const batch = optionalText(input.batch, 64);
    if (mid.length < 8 || mid.length > 64) {
      conflicts += 1;
      items.push({ mid: typeof input.mid === 'string' ? input.mid : '', result: 'conflict', reason: 'invalid_mid' });
      continue;
    }
    const existing = await env.DB.prepare('SELECT * FROM native_bokmoo_cards WHERE mid = ?1 LIMIT 1')
      .bind(mid).first<CardRow>();
    if (existing) {
      if (existing.user_id) {
        conflicts += 1;
        items.push({ mid, result: 'conflict', reason: 'card_bound_to_user' });
        continue;
      }
      if (CARD_LIFECYCLE_BLOCKS.includes(existing.status)) {
        conflicts += 1;
        items.push({ mid, result: 'conflict', reason: `card_${existing.status}` });
        continue;
      }
      if (eid && existing.eid && normalizeIdentifier(existing.eid) !== eid) {
        conflicts += 1;
        items.push({ mid, result: 'conflict', reason: 'eid_mismatch' });
        continue;
      }
      if (iccid && existing.iccid && normalizeIdentifier(existing.iccid) !== iccid) {
        conflicts += 1;
        items.push({ mid, result: 'conflict', reason: 'iccid_mismatch' });
        continue;
      }
    }
    if (eid || iccid) {
      const owner = await env.DB.prepare(`SELECT mid FROM native_bokmoo_cards
        WHERE mid <> ?1 AND ((?2 <> '' AND eid = ?2) OR (?3 <> '' AND iccid = ?3)) LIMIT 1`)
        .bind(mid, eid, iccid).first<{ mid: string }>();
      if (owner) {
        conflicts += 1;
        items.push({ mid, result: 'conflict', reason: 'identifier_already_registered' });
        continue;
      }
    }
    if (existing) {
      await env.DB.prepare(`UPDATE native_bokmoo_cards
        SET sku = COALESCE(?1, sku), batch = COALESCE(?2, batch), eid = COALESCE(?3, eid), iccid = COALESCE(?4, iccid),
        updated_at = ?5 WHERE id = ?6`)
        .bind(sku, batch, eid || null, iccid || null, now, existing.id).run();
      updated += 1;
      items.push({ mid, result: 'updated' });
    } else {
      await env.DB.prepare(`INSERT INTO native_bokmoo_cards
        (id, mid, eid, iccid, sku, batch, status, verification_status, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'unbound', 'pending', ?7, ?7)`)
        .bind(`bokmoo_card_${crypto.randomUUID()}`, mid, eid || null, iccid || null, sku, batch, now).run();
      imported += 1;
      items.push({ mid, result: 'imported' });
    }
  }

  const runId = `bokmoo_import_${crypto.randomUUID()}`;
  const operator = admin.email ?? admin.id;
  await env.DB.prepare(`INSERT INTO native_bokmoo_card_import_runs
    (id, total, imported, updated, conflicts, operator, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`)
    .bind(runId, rows.length, imported, updated, conflicts, operator, now).run();
  return response({
    result: 'completed',
    run: { id: runId, total: rows.length, imported, updated, conflicts, operator, createdAt: now },
    items,
  }, 201);
}

async function listAdminCards(request: Request, env: Env): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (!admin) return error('UNAUTHORIZED', 'Admin authentication required', 401);
  const url = new URL(request.url);
  const limitParam = Number(url.searchParams.get('limit') || '200');
  const limit = Number.isFinite(limitParam) && limitParam > 0 && limitParam <= 1000 ? Math.floor(limitParam) : 200;
  const rows = await env.DB.prepare('SELECT * FROM native_bokmoo_cards ORDER BY created_at DESC LIMIT ?1')
    .bind(limit).all<CardRow>();
  const totals = await env.DB.prepare(
    'SELECT status, COUNT(*) AS count FROM native_bokmoo_cards GROUP BY status',
  ).all<{ status: string; count: number }>();
  return response({
    items: rows.results.map(adminCard),
    summary: totals.results.map((row) => ({ status: row.status, count: row.count })),
    total: rows.results.length,
    limit,
  });
}

async function listImportRuns(request: Request, env: Env): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (!admin) return error('UNAUTHORIZED', 'Admin authentication required', 401);
  const rows = await env.DB.prepare(
    'SELECT * FROM native_bokmoo_card_import_runs ORDER BY created_at DESC LIMIT 50',
  ).all<ImportRunRow>();
  return response({ items: rows.results, total: rows.results.length });
}

/** The caller's order lines that put a plan on an ICCID, with what the order
 *  says about them. Only the named JSON paths are read: the stored answers
 *  also hold install credentials, which never leave the database. */
async function customerOrders(env: Env, userId: string): Promise<Array<{ iccids: string[]; order: CustomerOrder }>> {
  type LineRow = { order_id: string; product_id: string | null; quantity: number; payload_json: string };
  type TopUpRow = { order_id: string; product_id: string | null; quantity: number; iccid: string };
  type SnapshotRow = { id: string; order_number: string | null; payload: string };
  const lines = await env.DB.prepare(
    'SELECT order_id, product_id, quantity, payload_json FROM native_boss_order_lines WHERE user_id = ?1',
  ).bind(userId).all<LineRow>();
  const topUps = await env.DB.prepare(`SELECT i.order_id, i.product_id, i.quantity,
    json_extract(i.payload, '$.fulfillmentData.esimIccid') AS iccid
    FROM native_order_items i JOIN native_order_metadata m ON m.order_id = i.order_id
    WHERE m.user_id = ?1 AND json_extract(i.payload, '$.fulfillmentData.esimIccid') IS NOT NULL`)
    .bind(userId).all<TopUpRow>();

  const entries: Array<{ iccids: string[]; orderId: string; productId: string | null; quantity: number; kind: CustomerOrder['kind'] }> = [];
  for (const line of lines.results) {
    const payload = parsedJson(line.payload_json);
    const bossOrder = payload.bossOrder as Record<string, unknown> | undefined;
    const record = payload.lastStatusRecord as Record<string, unknown> | undefined;
    const listed = Array.isArray(record?.iccids) ? record.iccids : [];
    const iccids = [bossOrder?.iccid, record?.iccid, ...listed].map(iccidDigits).filter(Boolean);
    if (iccids.length) {
      entries.push({ iccids: [...new Set(iccids)], orderId: line.order_id, productId: line.product_id, quantity: line.quantity, kind: 'new' });
    }
  }
  for (const row of topUps.results) {
    const iccid = iccidDigits(row.iccid);
    if (iccid) entries.push({ iccids: [iccid], orderId: row.order_id, productId: row.product_id, quantity: row.quantity, kind: 'top-up' });
  }
  if (!entries.length) return [];

  const orderIds = [...new Set(entries.map((entry) => entry.orderId))];
  const snapshots = await env.DB.prepare(
    `SELECT id, order_number, payload FROM native_order_snapshots WHERE id IN (${orderIds.map((_, index) => `?${index + 1}`).join(', ')})`,
  ).bind(...orderIds).all<SnapshotRow>();
  const byId = new Map(snapshots.results.map((row) => [row.id, row]));
  return entries.map((entry) => {
    const snapshot = byId.get(entry.orderId);
    const payload = parsedJson(snapshot?.payload);
    const items = Array.isArray(payload.items) ? payload.items as Array<Record<string, unknown>> : [];
    const item = items.find((candidate) => candidate.productId === entry.productId) ?? items[0];
    return {
      iccids: entry.iccids,
      order: {
        orderId: entry.orderId,
        orderNumber: snapshot?.order_number ?? (typeof payload.orderNumber === 'string' ? payload.orderNumber : entry.orderId),
        productId: entry.productId,
        productName: typeof item?.productName === 'string' ? item.productName : '',
        quantity: entry.quantity,
        createdAt: typeof payload.createdAt === 'string' ? payload.createdAt : null,
        status: typeof payload.status === 'string' ? payload.status : null,
        paymentStatus: typeof payload.paymentStatus === 'string' ? payload.paymentStatus : null,
        kind: entry.kind,
      },
    };
  });
}

/** Support's view of one customer: the cards bound to the account, the plans
 *  on each of them as the app last read it, and the orders that put a plan
 *  on an ICCID. */
async function listCustomerCards(request: Request, env: Env, userId: string): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (!admin) return error('UNAUTHORIZED', 'Admin authentication required', 401);
  const cards = await env.DB.prepare(
    'SELECT * FROM native_bokmoo_cards WHERE user_id = ?1 ORDER BY created_at DESC',
  ).bind(userId).all<CardRow>();
  if (!cards.results.length) return response({ items: [] });

  const orders = await customerOrders(env, userId);
  const items = [];
  for (const card of cards.results) {
    const rows = card.eid
      ? (await env.DB.prepare(
        'SELECT * FROM native_bokmoo_card_profiles WHERE eid = ?1 ORDER BY enabled DESC, iccid',
      ).bind(card.eid).all<ProfileRow>()).results
      : [];
    items.push({
      ...adminCard(card),
      profiles: rows.map((row) => ({
        iccid: row.iccid,
        enabled: row.enabled === 1,
        name: row.name,
        provider: row.provider,
        source: row.source,
        syncedAt: row.synced_at,
        orders: orders
          .filter((entry) => entry.iccids.some((iccid) => sameIccid(iccid, row.iccid)))
          .map((entry) => entry.order),
      })),
    });
  }
  return response({ items });
}

export async function tryNativeBokmooConnect(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const admin = adminPath(url.pathname);
  if (admin !== null) {
    if (!(await isNativePluginEnabled(env, 'bokmoo-connect'))) {
      return error('PLUGIN_NOT_ENABLED', 'BOKMOO Connect plugin is not installed and enabled', 404);
    }
    if (request.method === 'POST' && admin === '/cards/import') return importCards(request, env);
    if (request.method === 'GET' && admin === '/cards') return listAdminCards(request, env);
    if (request.method === 'GET' && admin === '/cards/imports') return listImportRuns(request, env);
    const customerCards = admin.match(/^\/customers\/([^/]+)\/cards$/);
    if (request.method === 'GET' && customerCards) {
      return listCustomerCards(request, env, decodeURIComponent(customerCards[1]));
    }
    return null;
  }
  const path = normalizedPath(url.pathname);
  if (path === null) return null;
  if (!(await isNativePluginEnabled(env, 'bokmoo-connect'))) {
    return error('PLUGIN_NOT_ENABLED', 'BOKMOO Connect plugin is not installed and enabled', 404);
  }
  if (request.method === 'GET' && path === '/cards') return listCards(request, env);
  if (request.method === 'POST' && path === '/cards/sightings') return recordCardSighting(request, env);
  if (request.method === 'POST' && path === '/cards/sync') return syncCard(request, env);
  if (request.method === 'POST' && path === '/cards/claim-sessions') return createClaim(request, env);
  const sessionVerify = path.match(/^\/cards\/claim-sessions\/([^/]+)\/verify$/);
  if (request.method === 'POST' && sessionVerify) return verifyClaim(request, env, decodeURIComponent(sessionVerify[1]));
  const session = path.match(/^\/cards\/claim-sessions\/([^/]+)$/);
  if (request.method === 'GET' && session) return getClaim(request, env, decodeURIComponent(session[1]));
  const card = path.match(/^\/cards\/([^/]+)$/);
  if (request.method === 'GET' && card) return cardDetail(request, env, decodeURIComponent(card[1]));
  return null;
}
