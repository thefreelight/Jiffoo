import { authenticateNativeUser, type NativeAuthEnv, type NativeSessionUser } from './auth';

interface AffiliateEnv extends NativeAuthEnv { DB: D1Database }
type AffiliateDataEnv = Pick<Cloudflare.Env, 'DB'>;

interface PartnerRow {
  id: string; user_id: string; code: string; status: string; display_name: string | null;
  email: string | null; commission_rate: number; currency: string; created_at: string; updated_at: string;
}

function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  const result = new Headers(headers);
  result.set('content-type', 'application/json; charset=utf-8');
  result.set('cache-control', 'no-store');
  result.set('x-jiffoo-runtime', 'cloudflare-native-d1-affiliate');
  return new Response(JSON.stringify(data), { status, headers: result });
}

function success(data: unknown, status = 200, headers?: HeadersInit): Response {
  return json({ success: true, data }, status, headers);
}

function failure(status: number, code: string, message: string): Response {
  return json({ success: false, error: { code, message } }, status);
}

function partner(row: PartnerRow): Record<string, unknown> {
  return {
    id: row.id, userId: row.user_id, code: row.code, status: row.status,
    displayName: row.display_name, email: row.email,
    commissionType: 'percentage', commissionRate: row.commission_rate,
    currency: row.currency, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

async function currentUser(request: Request, env: AffiliateEnv): Promise<NativeSessionUser | null> {
  return authenticateNativeUser(request, env);
}

async function me(env: AffiliateEnv, userId: string): Promise<PartnerRow | null> {
  return env.DB.prepare('SELECT * FROM native_affiliate_partners WHERE user_id = ?1').bind(userId).first<PartnerRow>();
}

function code(): string {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
}

async function register(request: Request, env: AffiliateEnv, user: NativeSessionUser): Promise<Response> {
  const body = await request.json<{ displayName?: string; email?: string }>().catch(() => null);
  const existing = await me(env, user.id);
  if (existing) return success(partner(existing));
  const now = new Date().toISOString();
  const row: PartnerRow = {
    id: crypto.randomUUID(), user_id: user.id, code: code(), status: 'active',
    display_name: typeof body?.displayName === 'string' ? body.displayName.trim().slice(0, 120) || null : user.username,
    email: typeof body?.email === 'string' ? body.email.trim().toLowerCase() || user.email : user.email,
    commission_rate: 10, currency: 'USD', created_at: now, updated_at: now,
  };
  await env.DB.prepare(
    `INSERT INTO native_affiliate_partners
      (id, user_id, code, status, display_name, email, commission_rate, currency, created_at, updated_at)
     VALUES (?1, ?2, ?3, 'active', ?4, ?5, 10, 'USD', ?6, ?6)`,
  ).bind(row.id, row.user_id, row.code, row.display_name, row.email, now).run();
  return success(partner(row), 201);
}

function visitorId(request: Request, supplied: string | null): string {
  if (supplied && /^[A-Za-z0-9._:-]{8,128}$/.test(supplied)) return supplied;
  const cookie = request.headers.get('cookie')?.match(/(?:^|;\s*)bokmoo_affiliate_visitor=([^;]+)/)?.[1];
  return cookie && /^[A-Za-z0-9._:-]{8,128}$/.test(cookie) ? cookie : crypto.randomUUID();
}

async function recordReferral(request: Request, env: AffiliateEnv, codeValue: string): Promise<Response> {
  const partnerRow = await env.DB.prepare(
    `SELECT * FROM native_affiliate_partners WHERE code = ?1 AND status = 'active'`,
  ).bind(codeValue).first<PartnerRow>();
  if (!partnerRow) return failure(404, 'AFFILIATE_CODE_NOT_FOUND', 'Affiliate code not found');
  const visitor = visitorId(request, new URL(request.url).searchParams.get('visitorId'));
  const landingUrl = new URL(request.url).searchParams.get('url')?.slice(0, 1000) ?? null;
  const expires = new Date(Date.now() + 30 * 86400000).toISOString();
  await env.DB.prepare(
    `INSERT INTO native_affiliate_attributions
      (id, partner_id, code, visitor_id, status, landing_url, expires_at)
     VALUES (?1, ?2, ?3, ?4, 'clicked', ?5, ?6)`,
  ).bind(crypto.randomUUID(), partnerRow.id, partnerRow.code, visitor, landingUrl, expires).run();
  const headers = new Headers({ 'set-cookie': `bokmoo_affiliate_visitor=${encodeURIComponent(visitor)}; Path=/; Max-Age=2592000; Secure; SameSite=Lax` });
  return success({ code: partnerRow.code, visitorId: visitor, landingUrl, expiresAt: expires }, 200, headers);
}

async function associate(request: Request, env: AffiliateEnv, user: NativeSessionUser): Promise<Response> {
  const body = await request.json<{ visitorId?: string }>().catch(() => null);
  const suppliedVisitorId = body?.visitorId;
  if (!suppliedVisitorId || suppliedVisitorId.length > 128) return failure(400, 'VALIDATION_ERROR', 'visitorId is required');
  const updated = await env.DB.prepare(
    `UPDATE native_affiliate_attributions SET user_id = ?1, status = 'associated', associated_at = CURRENT_TIMESTAMP
     WHERE id = (SELECT id FROM native_affiliate_attributions WHERE visitor_id = ?2
       AND expires_at > CURRENT_TIMESTAMP AND user_id IS NULL ORDER BY created_at DESC LIMIT 1)`,
  ).bind(user.id, suppliedVisitorId).run();
  if (!updated.meta.changes) return failure(404, 'ATTRIBUTION_NOT_FOUND', 'Attribution not found');
  return success({ visitorId: suppliedVisitorId, userId: user.id });
}

async function commissions(request: Request, env: AffiliateEnv, user: NativeSessionUser): Promise<Response> {
  const partnerRow = await me(env, user.id);
  if (!partnerRow) return failure(404, 'AFFILIATE_PARTNER_NOT_FOUND', 'Affiliate partner not found');
  const rows = await env.DB.prepare(
    `SELECT id, partner_id, order_id, order_amount, commission_rate, amount, currency, status, created_at
     FROM native_affiliate_commissions WHERE partner_id = ?1 ORDER BY created_at DESC LIMIT 100`,
  ).bind(partnerRow.id).all<Record<string, unknown>>();
  return success({ items: rows.results, page: 1, limit: 100, total: rows.results.length, totalPages: rows.results.length ? 1 : 0 });
}

export async function tryNativeAffiliate(request: Request, env: AffiliateEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const route = url.pathname.match(/^\/api\/v1\/plugins\/affiliate\/store\/r\/([^/]+)$/);
  if (request.method === 'GET' && route) return recordReferral(request, env, decodeURIComponent(route[1]!));
  if (!url.pathname.startsWith('/api/v1/plugins/affiliate/store/')) return null;
  const user = await currentUser(request, env);
  if (!user) return failure(401, 'UNAUTHORIZED', 'Login required');
  if (request.method === 'POST' && url.pathname.endsWith('/partners/register')) return register(request, env, user);
  if (request.method === 'GET' && url.pathname.endsWith('/partners/me')) {
    const row = await me(env, user.id);
    return row ? success(partner(row)) : failure(404, 'AFFILIATE_PARTNER_NOT_FOUND', 'Affiliate partner not found');
  }
  if (request.method === 'POST' && url.pathname.endsWith('/attributions/associate')) return associate(request, env, user);
  if (request.method === 'GET' && url.pathname.endsWith('/commissions')) return commissions(request, env, user);
  return null;
}

export interface NativeAffiliateCommissionResult {
  commissionId: string;
  partnerId: string;
  orderId: string;
  amount: number;
  currency: string;
}

export async function createNativeAffiliateCommission(env: AffiliateDataEnv, order: Record<string, unknown>): Promise<NativeAffiliateCommissionResult | null> {
  const userId = typeof order.userId === 'string' ? order.userId : null;
  const orderId = typeof order.id === 'string' ? order.id : null;
  const amount = typeof order.totalAmount === 'number' ? order.totalAmount : 0;
  if (!userId || !orderId || amount <= 0) return null;
  const attribution = await env.DB.prepare(
    `SELECT partner_id FROM native_affiliate_attributions
     WHERE user_id = ?1 AND status IN ('associated', 'converted') ORDER BY created_at DESC LIMIT 1`,
  ).bind(userId).first<{ partner_id: string }>();
  if (!attribution) return null;
  const existing = await env.DB.prepare(
    'SELECT id, partner_id, amount, currency FROM native_affiliate_commissions WHERE order_id = ?1',
  ).bind(orderId).first<{ id: string; partner_id: string; amount: number; currency: string }>();
  if (existing) return { commissionId: existing.id, partnerId: existing.partner_id, orderId, amount: existing.amount, currency: existing.currency };
  const row = await env.DB.prepare('SELECT commission_rate, currency FROM native_affiliate_partners WHERE id = ?1 AND status = \'active\'').bind(attribution.partner_id).first<{ commission_rate: number; currency: string }>();
  if (!row) return null;
  const commission = Math.round(amount * row.commission_rate) / 100;
  const commissionId = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO native_affiliate_commissions
      (id, partner_id, order_id, order_amount, commission_rate, amount, currency, status)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending')`)
      .bind(commissionId, attribution.partner_id, orderId, amount, row.commission_rate, commission, row.currency),
    env.DB.prepare(`UPDATE native_affiliate_attributions SET status = 'converted' WHERE user_id = ?1 AND status = 'associated'`)
      .bind(userId),
  ]);
  return { commissionId, partnerId: attribution.partner_id, orderId, amount: commission, currency: row.currency };
}
