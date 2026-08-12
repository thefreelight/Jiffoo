import { authenticateNativeUser, type NativeAuthEnv, type NativeSessionUser } from './auth';
import { isNativePluginEnabled } from './plugin-enabled';

interface AffiliateEnv extends NativeAuthEnv { DB: D1Database }
type AffiliateDataEnv = Pick<Cloudflare.Env, 'DB'>;

interface PartnerRow {
  id: string; user_id: string; code: string; status: string; display_name: string | null;
  email: string | null; commission_rate: number; currency: string; organization_id: string | null;
  member_role: string | null; created_at: string; updated_at: string;
}

interface OrganizationRow {
  id: string; owner_user_id: string; code: string; name: string; status: string;
  commission_rate: number; currency: string; created_at: string; updated_at: string;
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
    organizationId: row.organization_id,
    memberRole: row.member_role,
    currency: row.currency, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function organization(row: OrganizationRow, members: Array<Record<string, unknown>> = []): Record<string, unknown> {
  return {
    id: row.id, ownerUserId: row.owner_user_id, code: row.code, name: row.name,
    status: row.status, commissionRate: row.commission_rate, currency: row.currency,
    members, createdAt: row.created_at, updatedAt: row.updated_at,
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

function organizationCode(): string {
  return `ORG-${crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`;
}

async function organizationForUser(env: AffiliateEnv, userId: string): Promise<OrganizationRow | null> {
  return env.DB.prepare(
    `SELECT organizations.* FROM native_affiliate_organizations organizations
     LEFT JOIN native_affiliate_org_members members
       ON members.organization_id = organizations.id AND members.user_id = ?1 AND members.status = 'active'
     WHERE organizations.status = 'active'
       AND (organizations.owner_user_id = ?1 OR members.user_id IS NOT NULL)
     ORDER BY organizations.created_at DESC LIMIT 1`,
  ).bind(userId).first<OrganizationRow>();
}

async function organizationMembers(env: AffiliateEnv, organizationId: string): Promise<Array<Record<string, unknown>>> {
  const rows = await env.DB.prepare(
    `SELECT members.id, members.user_id AS userId, members.role, members.status, members.joined_at AS joinedAt,
            users.username, users.email, partners.id AS partnerId, partners.code AS partnerCode
     FROM native_affiliate_org_members members
     JOIN native_users users ON users.id = members.user_id
     LEFT JOIN native_affiliate_partners partners ON partners.user_id = members.user_id
     WHERE members.organization_id = ?1 ORDER BY members.joined_at ASC`,
  ).bind(organizationId).all<Record<string, unknown>>();
  return rows.results;
}

async function createOrganization(request: Request, env: AffiliateEnv, user: NativeSessionUser): Promise<Response> {
  const body = await request.json<{ name?: unknown; commissionRate?: unknown }>().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 120) : '';
  if (!name) return failure(400, 'VALIDATION_ERROR', 'Organization name is required');
  const rate = body?.commissionRate === undefined ? 2.5 : Number(body.commissionRate);
  if (!Number.isFinite(rate) || rate < 0 || rate > 90) return failure(400, 'VALIDATION_ERROR', 'commissionRate must be between 0 and 90');
  const existing = await organizationForUser(env, user.id);
  if (existing) {
    if (existing.owner_user_id !== user.id) return failure(409, 'USER_ALREADY_ORGANIZED', 'Leave the current organization before creating another');
    return success(organization(existing, await organizationMembers(env, existing.id)));
  }
  const now = new Date().toISOString();
  const row: OrganizationRow = {
    id: crypto.randomUUID(), owner_user_id: user.id, code: organizationCode(), name,
    status: 'active', commission_rate: rate, currency: 'USD', created_at: now, updated_at: now,
  };
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO native_affiliate_organizations
       (id, owner_user_id, code, name, status, commission_rate, currency, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, 'active', ?5, 'USD', ?6, ?6)`,
    ).bind(row.id, row.owner_user_id, row.code, row.name, row.commission_rate, now),
    env.DB.prepare(
      `INSERT INTO native_affiliate_org_members (id, organization_id, user_id, role, status, joined_at)
       VALUES (?1, ?2, ?3, 'OWNER', 'active', ?4)`,
    ).bind(crypto.randomUUID(), row.id, user.id, now),
  ]);
  return success(organization(row, await organizationMembers(env, row.id)), 201);
}

async function addOrganizationMember(request: Request, env: AffiliateEnv, user: NativeSessionUser, organizationId: string): Promise<Response> {
  const organizationRow = await env.DB.prepare(
    'SELECT * FROM native_affiliate_organizations WHERE id = ?1 AND owner_user_id = ?2 AND status = \'active\'',
  ).bind(organizationId, user.id).first<OrganizationRow>();
  if (!organizationRow) return failure(404, 'ORGANIZATION_NOT_FOUND', 'Organization not found');
  const body = await request.json<{ userId?: unknown; email?: unknown; role?: unknown }>().catch(() => null);
  const role = body?.role === 'MANAGER' ? 'MANAGER' : 'INFLUENCER';
  const userId = typeof body?.userId === 'string' && body.userId.trim()
    ? body.userId.trim()
    : typeof body?.email === 'string' && body.email.trim()
      ? (await env.DB.prepare('SELECT id FROM native_users WHERE email = ?1').bind(body.email.trim().toLowerCase()).first<{ id: string }>())?.id
      : null;
  if (!userId) return failure(400, 'VALIDATION_ERROR', 'An existing userId or email is required');
  const member = await env.DB.prepare('SELECT id FROM native_users WHERE id = ?1').bind(userId).first<{ id: string }>();
  if (!member) return failure(404, 'USER_NOT_FOUND', 'User not found');
  if (userId === organizationRow.owner_user_id) return failure(409, 'OWNER_ROLE_IMMUTABLE', 'Organization owner role cannot be changed');
  const existing = await env.DB.prepare(
    'SELECT id, organization_id FROM native_affiliate_org_members WHERE user_id = ?1 AND status = \'active\' LIMIT 1',
  ).bind(userId).first<{ id: string; organization_id: string }>();
  if (existing && existing.organization_id !== organizationId) return failure(409, 'USER_ALREADY_ORGANIZED', 'User already belongs to another organization');
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO native_affiliate_org_members (id, organization_id, user_id, role, status, joined_at)
       VALUES (?1, ?2, ?3, ?4, 'active', ?5)
       ON CONFLICT(organization_id, user_id) DO UPDATE SET role = excluded.role, status = 'active'`,
    ).bind(existing?.id ?? crypto.randomUUID(), organizationId, userId, role, now),
    env.DB.prepare(
      `UPDATE native_affiliate_partners SET organization_id = ?1, member_role = ?2, updated_at = ?3
       WHERE user_id = ?4`,
    ).bind(organizationId, role, now, userId),
  ]);
  return success({ organizationId, userId, role });
}

async function organizationCommissions(request: Request, env: AffiliateEnv, user: NativeSessionUser): Promise<Response> {
  const organizationRow = await env.DB.prepare(
    'SELECT * FROM native_affiliate_organizations WHERE owner_user_id = ?1 AND status = \'active\' LIMIT 1',
  ).bind(user.id).first<OrganizationRow>();
  if (!organizationRow) return failure(404, 'ORGANIZATION_NOT_FOUND', 'Organization not found');
  const rows = await env.DB.prepare(
    `SELECT id, organization_id AS organizationId, partner_id AS partnerId, order_id AS orderId,
            beneficiary_user_id AS beneficiaryUserId, order_amount AS orderAmount,
            commission_rate AS commissionRate, amount, currency, status, parent_commission_id AS parentCommissionId, created_at AS createdAt
     FROM native_affiliate_org_commissions WHERE organization_id = ?1 ORDER BY created_at DESC LIMIT 100`,
  ).bind(organizationRow.id).all<Record<string, unknown>>();
  return success({ items: rows.results, page: 1, limit: 100, total: rows.results.length, totalPages: rows.results.length ? 1 : 0 });
}

async function register(request: Request, env: AffiliateEnv, user: NativeSessionUser): Promise<Response> {
  const body = await request.json<{ displayName?: string; email?: string; organizationId?: string; organizationCode?: string }>().catch(() => null);
  let organizationId: string | null = null;
  let memberRole: string | null = null;
  const requestedOrganization = typeof body?.organizationId === 'string' ? body.organizationId.trim() : '';
  const requestedCode = typeof body?.organizationCode === 'string' ? body.organizationCode.trim().toUpperCase() : '';
  if (requestedOrganization || requestedCode) {
    const org = await env.DB.prepare(
      `SELECT organizations.* FROM native_affiliate_organizations organizations
       LEFT JOIN native_affiliate_org_members members ON members.organization_id = organizations.id AND members.user_id = ?1 AND members.status = 'active'
       WHERE organizations.status = 'active' AND (?2 = organizations.id OR ?3 = organizations.code)
         AND (organizations.owner_user_id = ?1 OR members.user_id IS NOT NULL) LIMIT 1`,
    ).bind(user.id, requestedOrganization, requestedCode).first<OrganizationRow & { member_role?: string }>();
    if (!org) return failure(403, 'ORGANIZATION_MEMBERSHIP_REQUIRED', 'Join the organization before registering as its affiliate');
    organizationId = org.id;
    const membership = await env.DB.prepare(
      'SELECT role FROM native_affiliate_org_members WHERE organization_id = ?1 AND user_id = ?2 AND status = \'active\'',
    ).bind(org.id, user.id).first<{ role: string }>();
    memberRole = membership?.role ?? 'OWNER';
  }
  const existing = await me(env, user.id);
  if (existing) {
    if (organizationId && existing.organization_id && existing.organization_id !== organizationId) return failure(409, 'USER_ALREADY_ORGANIZED', 'User already belongs to another organization');
    if (organizationId && !existing.organization_id) {
      await env.DB.prepare('UPDATE native_affiliate_partners SET organization_id = ?1, member_role = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?3').bind(organizationId, memberRole, existing.id).run();
      existing.organization_id = organizationId;
      existing.member_role = memberRole;
    }
    return success(partner(existing));
  }
  const now = new Date().toISOString();
  const row: PartnerRow = {
    id: crypto.randomUUID(), user_id: user.id, code: code(), status: 'active',
    display_name: typeof body?.displayName === 'string' ? body.displayName.trim().slice(0, 120) || null : user.username,
    email: typeof body?.email === 'string' ? body.email.trim().toLowerCase() || user.email : user.email,
    commission_rate: 10, currency: 'USD', organization_id: organizationId, member_role: memberRole, created_at: now, updated_at: now,
  };
  await env.DB.prepare(
    `INSERT INTO native_affiliate_partners
      (id, user_id, code, status, display_name, email, commission_rate, currency, organization_id, member_role, created_at, updated_at)
     VALUES (?1, ?2, ?3, 'active', ?4, ?5, 10, 'USD', ?6, ?7, ?8, ?8)`,
  ).bind(row.id, row.user_id, row.code, row.display_name, row.email, row.organization_id, row.member_role, now).run();
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
  const path = url.pathname
    .replace('/api/v1/extensions/plugin/affiliate/api/api/store/affiliate', '/api/v1/plugins/affiliate/store')
    .replace('/api/v1/extensions/plugin/affiliate/api/store/affiliate', '/api/v1/plugins/affiliate/store');
  const route = path.match(/^\/api\/v1\/plugins\/affiliate\/store\/r\/([^/]+)$/);
  if (!route && !path.startsWith('/api/v1/plugins/affiliate/store/')) return null;
  if (!(await isNativePluginEnabled(env, 'affiliate'))) return failure(404, 'PLUGIN_NOT_ENABLED', 'Affiliate plugin is not installed and enabled');
  if (request.method === 'GET' && route) return recordReferral(request, env, decodeURIComponent(route[1]!));
  const user = await currentUser(request, env);
  if (!user) return failure(401, 'UNAUTHORIZED', 'Login required');
  if (request.method === 'POST' && path === '/api/v1/plugins/affiliate/store/organizations') return createOrganization(request, env, user);
  if (request.method === 'GET' && path === '/api/v1/plugins/affiliate/store/organizations/me') {
    const row = await organizationForUser(env, user.id);
    return row ? success(organization(row, await organizationMembers(env, row.id))) : failure(404, 'ORGANIZATION_NOT_FOUND', 'Organization not found');
  }
  const memberMatch = path.match(/^\/api\/v1\/plugins\/affiliate\/store\/organizations\/([^/]+)\/members$/);
  if (request.method === 'POST' && memberMatch) return addOrganizationMember(request, env, user, decodeURIComponent(memberMatch[1]!));
  if (request.method === 'GET' && path === '/api/v1/plugins/affiliate/store/organizations/commissions') return organizationCommissions(request, env, user);
  if (request.method === 'POST' && path.endsWith('/partners/register')) return register(request, env, user);
  if (request.method === 'GET' && path.endsWith('/partners/me')) {
    const row = await me(env, user.id);
    return row ? success(partner(row)) : failure(404, 'AFFILIATE_PARTNER_NOT_FOUND', 'Affiliate partner not found');
  }
  if (request.method === 'POST' && path.endsWith('/attributions/associate')) return associate(request, env, user);
  if (request.method === 'GET' && path.endsWith('/commissions')) return commissions(request, env, user);
  return null;
}

export interface NativeAffiliateCommissionResult {
  commissionId: string;
  partnerId: string;
  orderId: string;
  amount: number;
  currency: string;
}

export interface NativeOrganizationCommissionResult {
  commissionId: string;
  organizationId: string;
  beneficiaryUserId: string;
  orderId: string;
  amount: number;
  currency: string;
}

export interface NativeAffiliateSettlementResult {
  partner: NativeAffiliateCommissionResult;
  organization: NativeOrganizationCommissionResult | null;
}

export async function createNativeAffiliateCommission(env: AffiliateDataEnv, order: Record<string, unknown>): Promise<NativeAffiliateSettlementResult | null> {
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
  const row = await env.DB.prepare(
    `SELECT partners.commission_rate, partners.currency, partners.organization_id,
            organizations.owner_user_id, organizations.commission_rate AS organization_rate, organizations.currency AS organization_currency
     FROM native_affiliate_partners partners
     LEFT JOIN native_affiliate_organizations organizations ON organizations.id = partners.organization_id AND organizations.status = 'active'
     WHERE partners.id = ?1 AND partners.status = 'active'`,
  ).bind(attribution.partner_id).first<{ commission_rate: number; currency: string; organization_id: string | null; owner_user_id: string | null; organization_rate: number | null; organization_currency: string | null }>();
  if (!row) return null;
  const partnerCommission = existing
    ? { commissionId: existing.id, partnerId: existing.partner_id, orderId, amount: existing.amount, currency: existing.currency }
    : (() => {
      const commission = Math.round(amount * row.commission_rate) / 100;
      const commissionId = crypto.randomUUID();
      return { commissionId, partnerId: attribution.partner_id, orderId, amount: commission, currency: row.currency };
    })();
  const statements: D1PreparedStatement[] = [];
  if (!existing) statements.push(env.DB.prepare(`INSERT INTO native_affiliate_commissions
    (id, partner_id, order_id, order_amount, commission_rate, amount, currency, status)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending')`)
    .bind(partnerCommission.commissionId, attribution.partner_id, orderId, amount, row.commission_rate, partnerCommission.amount, row.currency));
  statements.push(env.DB.prepare(`UPDATE native_affiliate_attributions SET status = 'converted' WHERE user_id = ?1 AND status = 'associated'`).bind(userId));
  let organizationCommission: NativeOrganizationCommissionResult | null = null;
  if (row.organization_id && row.owner_user_id && row.organization_rate !== null) {
    const orgExisting = await env.DB.prepare(
      'SELECT id, amount, currency, beneficiary_user_id FROM native_affiliate_org_commissions WHERE organization_id = ?1 AND order_id = ?2',
    ).bind(row.organization_id, orderId).first<{ id: string; amount: number; currency: string; beneficiary_user_id: string }>();
    if (orgExisting) {
      organizationCommission = { commissionId: orgExisting.id, organizationId: row.organization_id, beneficiaryUserId: orgExisting.beneficiary_user_id, orderId, amount: orgExisting.amount, currency: orgExisting.currency };
    } else {
      const orgAmount = Math.round(amount * row.organization_rate) / 100;
      const orgId = crypto.randomUUID();
      organizationCommission = { commissionId: orgId, organizationId: row.organization_id, beneficiaryUserId: row.owner_user_id, orderId, amount: orgAmount, currency: row.organization_currency ?? row.currency };
      statements.push(env.DB.prepare(`INSERT INTO native_affiliate_org_commissions
        (id, organization_id, partner_id, order_id, beneficiary_user_id, order_amount, commission_rate, amount, currency, status, parent_commission_id)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'pending', ?10)`)
        .bind(orgId, row.organization_id, attribution.partner_id, orderId, row.owner_user_id, amount, row.organization_rate, orgAmount, organizationCommission.currency, partnerCommission.commissionId));
    }
  }
  await env.DB.batch(statements);
  return { partner: partnerCommission, organization: organizationCommission };
}
