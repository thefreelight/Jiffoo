import { authenticateNativeAdmin, authenticateNativeUser, type NativeAuthEnv, type NativeSessionUser } from './auth';
import { isNativePluginEnabled } from './plugin-enabled';
import { affiliateDiscountType, affiliateScopeAllows, affiliateScopeMode, affiliateScopeOf, MAX_FIXED_BUYER_DISCOUNT } from './order-discounts';

interface AffiliateEnv extends NativeAuthEnv { DB: D1Database }
type AffiliateDataEnv = Pick<Cloudflare.Env, 'DB'>;

interface PartnerRow {
  id: string; user_id: string; code: string; status: string; display_name: string | null;
  email: string | null; commission_rate: number; currency: string; organization_id: string | null;
  member_role: string | null; created_at: string; updated_at: string;
  /** Buyer discount of the promo code; `discount_rate` is the value for both types. */
  discount_rate?: number; discount_type?: string | null;
  /** What the code applies to: everything, only the picked products, or everything but them. */
  scope_mode?: string | null;
}

interface OrganizationRow {
  id: string; owner_user_id: string; code: string; name: string; status: string;
  commission_rate: number; currency: string; created_at: string; updated_at: string;
}

interface ApplicationRow {
  id: string; user_id: string; organization_name: string; contact_name: string | null; email: string;
  phone: string | null; website: string | null; message: string | null;
  status: 'pending' | 'approved' | 'rejected'; review_note: string | null; reviewed_at: string | null;
  organization_id: string | null; created_at: string; updated_at: string;
}

const cents = (amount: number): number => Math.round(amount * 100) / 100;

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

function partner(row: PartnerRow, scopeProductIds: string[] = []): Record<string, unknown> {
  return {
    id: row.id, userId: row.user_id, code: row.code, status: row.status,
    displayName: row.display_name, email: row.email,
    commissionType: 'percentage', commissionRate: row.commission_rate,
    organizationId: row.organization_id,
    memberRole: row.member_role,
    discountType: affiliateDiscountType(row.discount_type),
    discountValue: row.discount_rate ?? 0,
    scopeMode: affiliateScopeMode(row.scope_mode),
    scopeProductIds: scopeProductIds,
    currency: row.currency, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function application(row: ApplicationRow): Record<string, unknown> {
  return {
    id: row.id, organizationName: row.organization_name, contactName: row.contact_name, email: row.email,
    phone: row.phone, website: row.website, message: row.message, status: row.status,
    reviewNote: row.review_note, organizationId: row.organization_id,
    createdAt: row.created_at, reviewedAt: row.reviewed_at,
  };
}

function organization(row: OrganizationRow, members: Array<Record<string, unknown>> = []): Record<string, unknown> {
  return {
    id: row.id, ownerUserId: row.owner_user_id, code: row.code, name: row.name,
    status: row.status, commissionRate: row.commission_rate, currency: row.currency,
    members, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function currentUser(request: Request, env: AffiliateEnv): Promise<NativeSessionUser | null> {
  return authenticateNativeUser(request, env);
}

async function me(env: AffiliateEnv, userId: string): Promise<PartnerRow | null> {
  return env.DB.prepare('SELECT * FROM native_affiliate_partners WHERE user_id = ?1').bind(userId).first<PartnerRow>();
}

/** The products picked for a code, read only when the code does not apply to everything. */
async function scopeProductIds(env: Pick<AffiliateEnv, 'DB'>, partnerId: string): Promise<string[]> {
  const rows = await env.DB.prepare('SELECT product_id FROM native_affiliate_partner_scope WHERE partner_id = ?1 ORDER BY created_at ASC')
    .bind(partnerId).all<{ product_id: string }>();
  return rows.results.map((row) => row.product_id);
}

function code(): string {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
}

function organizationCode(): string {
  return `ORG-${crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`;
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

/** The organization a user belongs to right now, as owner or as an active member. */
async function organizationOfUser(env: AffiliateEnv, userId: string): Promise<OrganizationRow | null> {
  return env.DB.prepare(
    `SELECT organizations.* FROM native_affiliate_organizations organizations
     LEFT JOIN native_affiliate_org_members members
       ON members.organization_id = organizations.id AND members.user_id = ?1 AND members.status = 'active'
     WHERE organizations.status = 'active'
       AND (organizations.owner_user_id = ?1 OR members.user_id IS NOT NULL)
     ORDER BY organizations.created_at DESC LIMIT 1`,
  ).bind(userId).first<OrganizationRow>();
}

/**
 * Opens an organization with the given user as its owner. Organizations are opened by the store —
 * directly, or by approving the owner's application — never by the shopper alone.
 */
async function openOrganization(env: AffiliateEnv, input: { name: string; ownerId: string; commissionRate: number | undefined }): Promise<{ error: Response } | { row: OrganizationRow }> {
  const name = input.name.trim().slice(0, 120);
  if (name.length < 2) return { error: failure(400, 'VALIDATION_ERROR', 'Organization name is required') };
  const rate = input.commissionRate === undefined ? 2.5 : Number(input.commissionRate);
  if (!Number.isFinite(rate) || rate < 0 || rate > 90) return { error: failure(400, 'VALIDATION_ERROR', 'commissionRate must be between 0 and 90') };
  const owner = await env.DB.prepare('SELECT id FROM native_users WHERE id = ?1').bind(input.ownerId).first<{ id: string }>();
  if (!owner) return { error: failure(404, 'USER_NOT_FOUND', 'No account matches the owner given') };
  const organized = await organizationOfUser(env, owner.id);
  if (organized) return { error: failure(409, 'USER_ALREADY_ORGANIZED', 'This account already belongs to an organization') };
  const now = new Date().toISOString();
  const row: OrganizationRow = {
    id: crypto.randomUUID(), owner_user_id: owner.id, code: organizationCode(), name,
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
    ).bind(crypto.randomUUID(), row.id, owner.id, now),
  ]);
  return { row };
}

async function organizationApplicationOf(env: AffiliateEnv, userId: string): Promise<ApplicationRow | null> {
  return env.DB.prepare(
    'SELECT * FROM native_affiliate_org_applications WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 1',
  ).bind(userId).first<ApplicationRow>();
}

/** A shopper asks the store to open an organization for them; the store decides. */
async function applyForOrganization(request: Request, env: AffiliateEnv, user: NativeSessionUser): Promise<Response> {
  const body = await request.json<{ organizationName?: unknown; contactName?: unknown; email?: unknown; phone?: unknown; website?: unknown; message?: unknown }>().catch(() => null);
  const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
  const name = text(body?.organizationName, 120);
  if (name.length < 2) return failure(400, 'VALIDATION_ERROR', 'Organization name is required');
  const email = text(body?.email, 160).toLowerCase() || user.email;
  if (!/^\S+@\S+\.\S+$/.test(email)) return failure(400, 'VALIDATION_ERROR', 'A valid contact email is required');
  const contactName = text(body?.contactName, 120) || user.username;
  const phone = text(body?.phone, 40);
  const website = text(body?.website, 200);
  const message = text(body?.message, 1000);
  if (await organizationOfUser(env, user.id)) return failure(409, 'USER_ALREADY_ORGANIZED', 'This account already belongs to an organization');
  const pending = await env.DB.prepare(
    `SELECT id FROM native_affiliate_org_applications WHERE user_id = ?1 AND status = 'pending' LIMIT 1`,
  ).bind(user.id).first<{ id: string }>();
  if (pending) return failure(409, 'APPLICATION_PENDING', 'Your application is waiting for review');
  const now = new Date().toISOString();
  const row: ApplicationRow = {
    id: crypto.randomUUID(), user_id: user.id, organization_name: name, contact_name: contactName, email,
    phone: phone || null, website: website || null, message: message || null,
    status: 'pending', review_note: null, reviewed_at: null, organization_id: null, created_at: now, updated_at: now,
  };
  await env.DB.prepare(
    `INSERT INTO native_affiliate_org_applications
      (id, user_id, organization_name, contact_name, email, phone, website, message, status, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'pending', ?9, ?9)`,
  ).bind(row.id, row.user_id, row.organization_name, row.contact_name, row.email, row.phone, row.website, row.message, now).run();
  return success(application(row), 201);
}

/** The store approves or declines a shopper's application to open an organization. */
async function reviewOrganizationApplication(env: AffiliateEnv, applicationId: string, decision: 'approve' | 'reject', input: { commissionRate?: unknown; note?: unknown }): Promise<Response> {
  const existing = await env.DB.prepare('SELECT * FROM native_affiliate_org_applications WHERE id = ?1').bind(applicationId).first<ApplicationRow>();
  if (!existing) return failure(404, 'NOT_FOUND', 'Application not found');
  if (existing.status !== 'pending') return failure(409, 'APPLICATION_ALREADY_REVIEWED', 'This application was already reviewed');
  const note = typeof input.note === 'string' ? input.note.trim().slice(0, 500) : '';
  const now = new Date().toISOString();
  if (decision === 'reject') {
    await env.DB.prepare(
      `UPDATE native_affiliate_org_applications SET status = 'rejected', review_note = ?2, reviewed_at = ?3, updated_at = ?3 WHERE id = ?1`,
    ).bind(applicationId, note || null, now).run();
    return success(application({ ...existing, status: 'rejected', review_note: note || null, reviewed_at: now }));
  }
  const rate = input.commissionRate === undefined ? undefined : Number(input.commissionRate);
  if (rate !== undefined && (!Number.isFinite(rate) || rate < 0 || rate > 90)) return failure(400, 'VALIDATION_ERROR', 'commissionRate must be between 0 and 90');
  const opened = await openOrganization(env, { name: existing.organization_name, ownerId: existing.user_id, commissionRate: rate });
  if ('error' in opened) return opened.error;
  await env.DB.prepare(
    `UPDATE native_affiliate_org_applications SET status = 'approved', review_note = ?2, reviewed_at = ?3, updated_at = ?3, organization_id = ?4 WHERE id = ?1`,
  ).bind(applicationId, note || null, now, opened.row.id).run();
  return success({
    application: application({ ...existing, status: 'approved', review_note: note || null, reviewed_at: now, organization_id: opened.row.id }),
    organization: organization(opened.row, await organizationMembers(env, opened.row.id)),
  });
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

function affiliateCorsHeaders(origin: string | null, extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (origin) {
    headers['access-control-allow-origin'] = origin;
    headers.vary = 'Origin';
  }
  return headers;
}

function withAffiliateCors(origin: string | null, response: Response): Response {
  if (!origin) return response;
  const headers = new Headers(response.headers);
  headers.set('access-control-allow-origin', origin);
  headers.append('vary', 'Origin');
  return new Response(response.body, { status: response.status, headers });
}

export async function tryNativeAffiliate(request: Request, env: AffiliateEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const rawPath = url.pathname;
  const path = rawPath
    .replace('/api/v1/extensions/plugin/affiliate/api/api/store/affiliate', '/api/v1/plugins/affiliate/store')
    .replace('/api/v1/extensions/plugin/affiliate/api/store/affiliate', '/api/v1/plugins/affiliate/store');

  // Storefront themes legitimately call these routes cross-origin (e.g. an
  // older cached runtime that has not collapsed the API base to same-origin).
  // Bearer-token auth means any origin may preflight/GET safely, so answer
  // the preflight here and stamp every response with matching CORS headers.
  const isAffiliateRoute =
    path.startsWith('/api/v1/plugins/affiliate/store/') ||
    path.startsWith('/api/v1/plugins/affiliate/admin/') ||
    path.startsWith('/api/v1/extensions/plugin/affiliate/api/');
  if (isAffiliateRoute) {
    const origin = request.headers.get('origin');
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: affiliateCorsHeaders(origin, {
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': 'Authorization, Content-Type, X-App-Type, X-Client-Version',
          'access-control-max-age': '86400',
        }),
      });
    }
    const response = await handleNativeAffiliate(request, env, url, rawPath, path);
    return response ? withAffiliateCors(origin, response) : null;
  }

  return null;
}

async function handleNativeAffiliate(request: Request, env: AffiliateEnv, _url: URL, rawPath: string, path: string): Promise<Response | null> {
  // Admin workspace data for the native affiliate adapter. The platform
  // plugin runtime serves these through /extensions/plugin/affiliate/api/admin,
  // so keep the same prefix contract for the Cloudflare-native core.
  if (rawPath === '/api/v1/extensions/plugin/affiliate/api/admin/overview' && request.method === 'GET') {
    const admin = await authenticateNativeAdmin(request, env);
    if (!admin) return failure(401, 'UNAUTHORIZED', 'Administrator authentication is required');
    if (!(await isNativePluginEnabled(env, 'affiliate'))) return failure(404, 'PLUGIN_NOT_ENABLED', 'Affiliate plugin is not installed and enabled');
    const partners = await env.DB.prepare(
      `SELECT p.id, p.code, p.status, p.display_name, p.email, p.commission_rate, p.discount_rate, p.discount_type, p.currency,
              p.organization_id, p.scope_mode, p.created_at,
              COUNT(c.id) AS commission_count,
              COALESCE(SUM(c.amount), 0) AS commission_total,
              COALESCE(SUM(CASE WHEN c.status = 'pending' THEN c.amount ELSE 0 END), 0) AS commission_pending
       FROM native_affiliate_partners p
       LEFT JOIN native_affiliate_commissions c ON c.partner_id = p.id
       GROUP BY p.id ORDER BY p.created_at DESC LIMIT 200`,
    ).all<Record<string, unknown>>();
    // which products each limited code applies to
    const scopeRows = await env.DB.prepare('SELECT partner_id, product_id FROM native_affiliate_partner_scope ORDER BY created_at ASC')
      .all<{ partner_id: string; product_id: string }>();
    const scopeOf = new Map<string, string[]>();
    for (const row of scopeRows.results) scopeOf.set(row.partner_id, [...(scopeOf.get(row.partner_id) ?? []), row.product_id]);
    for (const row of partners.results) row.scope_product_ids = scopeOf.get(String(row.id)) ?? [];
    const commissions = await env.DB.prepare(
      `SELECT c.id, p.code AS partner_code, c.order_id, c.order_amount, c.commission_rate,
              c.amount, c.currency, c.status, c.created_at
       FROM native_affiliate_commissions c
       JOIN native_affiliate_partners p ON p.id = c.partner_id
       ORDER BY c.created_at DESC LIMIT 200`,
    ).all<Record<string, unknown>>();
    const attributions = await env.DB.prepare(
      `SELECT a.id, p.code AS partner_code, a.visitor_id, a.status, a.user_id,
              a.landing_url, a.created_at, a.expires_at, a.associated_at
       FROM native_affiliate_attributions a
       LEFT JOIN native_affiliate_partners p ON p.id = a.partner_id
       ORDER BY a.created_at DESC LIMIT 200`,
    ).all<Record<string, unknown>>();
    const totals = {
      partnerCount: partners.results.length,
      commissionCount: commissions.results.length,
      commissionTotal: commissions.results.reduce((sum, row) => sum + Number(row.amount || 0), 0),
      commissionPending: commissions.results
        .filter((row) => row.status === 'pending')
        .reduce((sum, row) => sum + Number(row.amount || 0), 0),
    };
    const organizations = await env.DB.prepare(
      `SELECT o.id, o.code, o.name, o.status, o.commission_rate, o.currency, o.created_at, o.owner_user_id,
              users.email AS owner_email, users.username AS owner_username,
              COUNT(p.id) AS member_count
       FROM native_affiliate_organizations o
       LEFT JOIN native_users users ON users.id = o.owner_user_id
       LEFT JOIN native_affiliate_partners p ON p.organization_id = o.id
       GROUP BY o.id ORDER BY o.created_at DESC LIMIT 200`,
    ).all<Record<string, unknown>>();
    const applications = await env.DB.prepare(
      `SELECT a.id, a.organization_name, a.contact_name, a.email, a.phone, a.website, a.message, a.status,
              a.review_note, a.reviewed_at, a.organization_id, a.created_at,
              users.username AS username
       FROM native_affiliate_org_applications a
       LEFT JOIN native_users users ON users.id = a.user_id
       ORDER BY CASE a.status WHEN 'pending' THEN 0 ELSE 1 END, a.created_at DESC LIMIT 200`,
    ).all<Record<string, unknown>>();
    return success({
      totals: {
        ...totals,
        organizationCount: organizations.results.length,
        applicationPending: applications.results.filter((row) => row.status === 'pending').length,
      },
      partners: partners.results,
      organizations: organizations.results,
      applications: applications.results,
      commissions: commissions.results,
      attributions: attributions.results,
    });
  }

  const adminAffiliateGuard = async () => {
    const admin = await authenticateNativeAdmin(request, env);
    if (!admin) return { error: failure(401, 'UNAUTHORIZED', 'Administrator authentication is required') };
    if (!(await isNativePluginEnabled(env, 'affiliate'))) {
      return { error: failure(404, 'PLUGIN_NOT_ENABLED', 'Affiliate plugin is not installed and enabled') };
    }
    return { admin };
  };

  const adminPartnerMatch = rawPath.match(/^\/api\/v1\/extensions\/plugin\/affiliate\/api\/admin\/partners\/([\w-]+)$/);
  if (adminPartnerMatch && request.method === 'PATCH') {
    const guard = await adminAffiliateGuard();
    if (guard.error) return guard.error;
    const body = await request.clone().json().catch(() => ({})) as {
      commissionRate?: unknown; status?: unknown; code?: unknown; discountRate?: unknown; discountType?: unknown;
      scope?: { mode?: unknown; productIds?: unknown } | null;
    };
    const updates: string[] = [];
    const bindings: unknown[] = [];
    // Which products the code applies to. `productIds` is the whole list: only these, or all but these.
    let scope: { mode: 'all' } | { mode: 'selected' | 'except'; productIds: string[] } | null = null;
    if (body.scope !== undefined) {
      const mode = affiliateScopeMode(body.scope?.mode);
      const productIds = Array.isArray(body.scope?.productIds)
        ? [...new Set((body.scope.productIds as unknown[])
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim())
          .filter((value) => /^[A-Za-z0-9_-]{1,64}$/.test(value)))]
        : [];
      if (mode !== 'all' && productIds.length === 0) {
        return failure(400, 'VALIDATION_ERROR', 'Pick at least one product for a code that does not apply to everything');
      }
      if (productIds.length > 500) return failure(400, 'VALIDATION_ERROR', 'A code can name at most 500 products');
      scope = mode === 'all' ? { mode: 'all' } : { mode, productIds };
      updates.push('scope_mode = ?');
      bindings.push(mode);
    }
    if (body.commissionRate !== undefined) {
      const rate = Number(body.commissionRate);
      if (!Number.isFinite(rate) || rate < 0 || rate > 90) {
        return failure(400, 'VALIDATION_ERROR', 'Commission rate must be between 0 and 90');
      }
      updates.push('commission_rate = ?');
      bindings.push(rate);
    }
    if (body.code !== undefined) {
      const code = String(body.code).trim().toUpperCase();
      if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code)) {
        return failure(400, 'VALIDATION_ERROR', 'Codes use 3-32 characters: letters, numbers, dash, underscore');
      }
      const clash = await env.DB.prepare('SELECT id FROM native_affiliate_partners WHERE code = ?1 AND id != ?2')
        .bind(code, adminPartnerMatch[1]!).first<{ id: string }>();
      if (clash) return failure(409, 'CONFLICT', 'That code is already taken');
      updates.push('code = ?');
      bindings.push(code);
    }
    if (body.discountType !== undefined || body.discountRate !== undefined) {
      // One column holds the value of both types, so its bounds depend on
      // the type in force, and changing the type requires a fresh value.
      const current = await env.DB.prepare('SELECT discount_type FROM native_affiliate_partners WHERE id = ?1')
        .bind(adminPartnerMatch[1]!).first<{ discount_type: string | null }>();
      if (!current) return failure(404, 'NOT_FOUND', 'Partner not found');
      const currentType = affiliateDiscountType(current.discount_type);
      if (body.discountType !== undefined && body.discountType !== 'percentage' && body.discountType !== 'fixed_amount') {
        return failure(400, 'VALIDATION_ERROR', 'Buyer discount type must be percentage or fixed_amount');
      }
      const type = body.discountType === undefined ? currentType : body.discountType;
      if (body.discountRate === undefined) {
        if (type !== currentType) return failure(400, 'VALIDATION_ERROR', 'Send discountRate together with the new discountType');
      } else {
        const value = Number(body.discountRate);
        const max = type === 'percentage' ? 90 : MAX_FIXED_BUYER_DISCOUNT;
        if (!Number.isFinite(value) || value < 0 || value > max) {
          return failure(400, 'VALIDATION_ERROR', type === 'percentage'
            ? 'Buyer discount rate must be between 0 and 90'
            : `Fixed buyer discount must be between 0 and ${MAX_FIXED_BUYER_DISCOUNT}`);
        }
        updates.push('discount_rate = ?');
        bindings.push(value);
      }
      updates.push('discount_type = ?');
      bindings.push(type);
    }
    if (body.status !== undefined) {
      const status = String(body.status);
      if (!['active', 'suspended'].includes(status)) {
        return failure(400, 'VALIDATION_ERROR', 'Partner status must be active or suspended');
      }
      updates.push('status = ?');
      bindings.push(status);
    }
    if (updates.length === 0) return failure(400, 'VALIDATION_ERROR', 'Nothing to update');
    updates.push('updated_at = CURRENT_TIMESTAMP');
    bindings.push(adminPartnerMatch[1]!);
    const partnerId = adminPartnerMatch[1]!;
    if (scope) {
      // the mode and its products move together
      if (!(await env.DB.prepare('SELECT id FROM native_affiliate_partners WHERE id = ?1').bind(partnerId).first<{ id: string }>())) {
        return failure(404, 'NOT_FOUND', 'Partner not found');
      }
      const now = new Date().toISOString();
      await env.DB.batch([
        env.DB.prepare(`UPDATE native_affiliate_partners SET ${updates.join(', ')} WHERE id = ?1`).bind(...bindings),
        env.DB.prepare('DELETE FROM native_affiliate_partner_scope WHERE partner_id = ?1').bind(partnerId),
        ...(scope.mode === 'all' ? [] : scope.productIds.map((productId) => env.DB.prepare(
          `INSERT INTO native_affiliate_partner_scope (id, partner_id, product_id, created_at) VALUES (?1, ?2, ?3, ?4)`,
        ).bind(crypto.randomUUID(), partnerId, productId, now))),
      ]);
    } else {
      const result = await env.DB.prepare(
        `UPDATE native_affiliate_partners SET ${updates.join(', ')} WHERE id = ?1`,
      ).bind(...bindings).run();
      if (!result.meta.changes) return failure(404, 'NOT_FOUND', 'Partner not found');
    }
    const row = await env.DB.prepare('SELECT * FROM native_affiliate_partners WHERE id = ?1').bind(partnerId).first<PartnerRow>();
    return success({ partner: row ? partner(row, await scopeProductIds(env, partnerId)) : null });
  }

  // Organizations are opened by the store: directly with an owner, or by approving a shopper's application.
  if (rawPath === '/api/v1/extensions/plugin/affiliate/api/admin/organizations' && request.method === 'POST') {
    const guard = await adminAffiliateGuard();
    if (guard.error) return guard.error;
    const body = await request.clone().json().catch(() => null) as { name?: unknown; ownerUserId?: unknown; ownerEmail?: unknown; commissionRate?: unknown } | null;
    const ownerEmail = typeof body?.ownerEmail === 'string' && body.ownerEmail.trim() ? body.ownerEmail.trim().toLowerCase() : null;
    const ownerId = typeof body?.ownerUserId === 'string' && body.ownerUserId.trim()
      ? body.ownerUserId.trim()
      : ownerEmail
        ? (await env.DB.prepare('SELECT id FROM native_users WHERE email = ?1').bind(ownerEmail).first<{ id: string }>())?.id ?? null
        : null;
    if (!ownerId) {
      return ownerEmail
        ? failure(404, 'USER_NOT_FOUND', 'No account matches the owner given')
        : failure(400, 'VALIDATION_ERROR', 'The owner is required: an account id or an e-mail address');
    }
    if (typeof body?.name !== 'string' || body.name.trim().length < 2) return failure(400, 'VALIDATION_ERROR', 'Organization name is required');
    const commissionRate = body?.commissionRate === undefined ? undefined : Number(body.commissionRate);
    const opened = await openOrganization(env, { name: body.name, ownerId, commissionRate });
    if ('error' in opened) return opened.error;
    return success({ organization: organization(opened.row, await organizationMembers(env, opened.row.id)) }, 201);
  }

  const adminApplicationMatch = rawPath.match(/^\/api\/v1\/extensions\/plugin\/affiliate\/api\/admin\/applications\/([\w-]+)\/(approve|reject)$/);
  if (adminApplicationMatch && request.method === 'POST') {
    const guard = await adminAffiliateGuard();
    if (guard.error) return guard.error;
    const body = await request.clone().json().catch(() => ({})) as { commissionRate?: unknown; note?: unknown };
    return reviewOrganizationApplication(env, adminApplicationMatch[1]!, adminApplicationMatch[2] === 'approve' ? 'approve' : 'reject', body);
  }

  const adminOrgMatch = rawPath.match(/^\/api\/v1\/extensions\/plugin\/affiliate\/api\/admin\/organizations\/([\w-]+)$/);
  if (adminOrgMatch && request.method === 'PATCH') {
    const guard = await adminAffiliateGuard();
    if (guard.error) return guard.error;
    const body = await request.clone().json().catch(() => ({})) as { commissionRate?: unknown; status?: unknown };
    const updates: string[] = [];
    const bindings: unknown[] = [];
    if (body.commissionRate !== undefined) {
      const rate = Number(body.commissionRate);
      if (!Number.isFinite(rate) || rate < 0 || rate > 90) {
        return failure(400, 'VALIDATION_ERROR', 'Commission rate must be between 0 and 90');
      }
      updates.push('commission_rate = ?');
      bindings.push(rate);
    }
    if (body.status !== undefined) {
      const status = String(body.status);
      if (!['active', 'suspended', 'closed'].includes(status)) {
        return failure(400, 'VALIDATION_ERROR', 'Organization status must be active, suspended, or closed');
      }
      updates.push('status = ?');
      bindings.push(status);
    }
    if (updates.length === 0) return failure(400, 'VALIDATION_ERROR', 'Nothing to update');
    updates.push('updated_at = CURRENT_TIMESTAMP');
    bindings.push(adminOrgMatch[1]!);
    const result = await env.DB.prepare(
      `UPDATE native_affiliate_organizations SET ${updates.join(', ')} WHERE id = ?1`,
    ).bind(...bindings).run();
    if (!result.meta.changes) return failure(404, 'NOT_FOUND', 'Organization not found');
    const row = await env.DB.prepare('SELECT * FROM native_affiliate_organizations WHERE id = ?1').bind(adminOrgMatch[1]!).first<Record<string, unknown>>();
    return success({ organization: row });
  }

  const adminCommissionMatch = rawPath.match(/^\/api\/v1\/extensions\/plugin\/affiliate\/api\/admin\/commissions\/([\w-]+)\/status$/);
  if (adminCommissionMatch && request.method === 'POST') {
    const guard = await adminAffiliateGuard();
    if (guard.error) return guard.error;
    const body = await request.clone().json().catch(() => ({})) as { status?: unknown };
    const status = String(body.status || '');
    if (!['pending', 'paid', 'reversed'].includes(status)) {
      return failure(400, 'VALIDATION_ERROR', 'Commission status must be pending, paid, or reversed');
    }
    const result = await env.DB.prepare(
      'UPDATE native_affiliate_commissions SET status = ?1 WHERE id = ?2',
    ).bind(status, adminCommissionMatch[1]!).run();
    if (!result.meta.changes) return failure(404, 'NOT_FOUND', 'Commission not found');
    const row = await env.DB.prepare('SELECT * FROM native_affiliate_commissions WHERE id = ?1').bind(adminCommissionMatch[1]!).first<Record<string, unknown>>();
    return success({ commission: row });
  }

  const route = path.match(/^\/api\/v1\/plugins\/affiliate\/store\/r\/([^/]+)$/);
  if (!route && !path.startsWith('/api/v1/plugins/affiliate/store/')) return null;
  if (!(await isNativePluginEnabled(env, 'affiliate'))) return failure(404, 'PLUGIN_NOT_ENABLED', 'Affiliate plugin is not installed and enabled');
  const promoRoute = path.match(/^\/api\/v1\/plugins\/affiliate\/store\/promo\/([A-Za-z0-9_-]{3,32})$/);
  if (request.method === 'GET' && promoRoute) {
    // Public: the checkout shows the buyer their discount before paying.
    const code = decodeURIComponent(promoRoute[1]!).toUpperCase();
    const partnerRow = await env.DB.prepare(
      `SELECT id, code, discount_rate, discount_type, display_name, scope_mode FROM native_affiliate_partners
       WHERE code = ?1 AND status = 'active' AND discount_rate > 0`,
    ).bind(code).first<{ id: string; code: string; discount_rate: number; discount_type?: string | null; display_name: string | null; scope_mode?: string | null }>();
    if (!partnerRow) return success({ valid: false }, 200);
    const discountType = affiliateDiscountType(partnerRow.discount_type);
    const scopeMode = affiliateScopeMode(partnerRow.scope_mode);
    return success({
      valid: true, code: partnerRow.code, partnerName: partnerRow.display_name,
      discountType, discountValue: partnerRow.discount_rate,
      // kept for callers written before discount types existed
      discountRate: discountType === 'percentage' ? partnerRow.discount_rate : 0,
      // which products the code acts on, so the checkout can price only those
      scopeMode,
      scopeProductIds: scopeMode === 'all' ? [] : await scopeProductIds(env, partnerRow.id),
    }, 200);
  }
  if (request.method === 'GET' && route) return recordReferral(request, env, decodeURIComponent(route[1]!));
  const user = await currentUser(request, env);
  if (!user) return failure(401, 'UNAUTHORIZED', 'Login required');
  // Organizations are opened by the store. A storefront that still offers "create organization"
  // (an older cached theme) is told to apply instead.
  if (request.method === 'POST' && path === '/api/v1/plugins/affiliate/store/organizations') {
    return failure(403, 'ORGANIZATION_APPLICATION_REQUIRED', 'Organizations are opened by the store. Apply to open one instead.');
  }
  if (request.method === 'POST' && path === '/api/v1/plugins/affiliate/store/organizations/applications') return applyForOrganization(request, env, user);
  if (request.method === 'GET' && path === '/api/v1/plugins/affiliate/store/organizations/applications/mine') {
    const row = await organizationApplicationOf(env, user.id);
    return row ? success(application(row)) : failure(404, 'APPLICATION_NOT_FOUND', 'No application found');
  }
  if (request.method === 'GET' && path === '/api/v1/plugins/affiliate/store/organizations/me') {
    const row = await organizationOfUser(env, user.id);
    return row ? success(organization(row, await organizationMembers(env, row.id))) : failure(404, 'ORGANIZATION_NOT_FOUND', 'Organization not found');
  }
  const memberMatch = path.match(/^\/api\/v1\/plugins\/affiliate\/store\/organizations\/([^/]+)\/members$/);
  if (request.method === 'POST' && memberMatch) return addOrganizationMember(request, env, user, decodeURIComponent(memberMatch[1]!));
  if (request.method === 'GET' && path === '/api/v1/plugins/affiliate/store/organizations/commissions') return organizationCommissions(request, env, user);
  if (request.method === 'POST' && path.endsWith('/partners/register')) return register(request, env, user);
  if (request.method === 'GET' && path.endsWith('/partners/me')) {
    const row = await me(env, user.id);
    return row ? success(partner(row, await scopeProductIds(env, row.id))) : failure(404, 'AFFILIATE_PARTNER_NOT_FOUND', 'Affiliate partner not found');
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
  let amount = typeof order.totalAmount === 'number' ? order.totalAmount : 0;
  if (!userId || !orderId || amount <= 0) return null;
  // A promo code used at checkout attributes the order directly, even when
  // the buyer never registered through a referral link.
  const promoPartner = await env.DB.prepare(
    `SELECT m.affiliate_partner_id AS partner_id FROM native_order_metadata m
     WHERE m.order_id = ?1 AND m.affiliate_partner_id IS NOT NULL`,
  ).bind(orderId).first<{ partner_id: string }>();
  const attribution = promoPartner?.partner_id
    ? { partner_id: promoPartner.partner_id }
    : await env.DB.prepare(
      `SELECT partner_id FROM native_affiliate_attributions
       WHERE user_id = ?1 AND status IN ('associated', 'converted') ORDER BY created_at DESC LIMIT 1`,
    ).bind(userId).first<{ partner_id: string }>();
  if (!attribution) return null;
  const existing = await env.DB.prepare(
    'SELECT id, partner_id, amount, currency FROM native_affiliate_commissions WHERE order_id = ?1',
  ).bind(orderId).first<{ id: string; partner_id: string; amount: number; currency: string }>();
  const row = await env.DB.prepare(
    `SELECT partners.commission_rate, partners.currency, partners.organization_id, partners.scope_mode,
            organizations.owner_user_id, organizations.commission_rate AS organization_rate, organizations.currency AS organization_currency
     FROM native_affiliate_partners partners
     LEFT JOIN native_affiliate_organizations organizations ON organizations.id = partners.organization_id AND organizations.status = 'active'
     WHERE partners.id = ?1 AND partners.status = 'active'`,
  ).bind(attribution.partner_id).first<{ commission_rate: number; currency: string; organization_id: string | null; owner_user_id: string | null; organization_rate: number | null; organization_currency: string | null; scope_mode?: string | null }>();
  if (!row) return null;
  // A code that is limited to certain products earns on those products alone: what they sold for
  // after the promotion, less the discount the code itself gave. Everything else earns on the order.
  const scopeMode = affiliateScopeMode(row.scope_mode);
  if (scopeMode !== 'all') {
    const scope = affiliateScopeOf(scopeMode, await scopeProductIds(env, attribution.partner_id));
    const items = Array.isArray(order.items) ? order.items as Array<Record<string, unknown>> : [];
    const gross = items
      .filter((item) => typeof item.productId === 'string' && affiliateScopeAllows(scope, item.productId))
      .reduce((sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 0), 0);
    const discounts = Array.isArray(order.appliedDiscounts) ? order.appliedDiscounts as Array<Record<string, unknown>> : [];
    const codeDiscount = discounts.find((discount) => discount.kind === 'affiliate');
    const codePartnerId = typeof codeDiscount?.id === 'string' ? codeDiscount.id : null;
    const givenOff = codePartnerId === attribution.partner_id ? Number(codeDiscount?.amount || 0) : 0;
    const scoped = cents(Math.max(0, cents(gross) - givenOff));
    if (scoped <= 0) return null;
    amount = scoped;
  }
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
