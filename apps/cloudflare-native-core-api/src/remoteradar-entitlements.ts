import { authenticateNativeUser, type NativeAuthEnv } from './auth';
import { nativeWalletMutate } from './native-wallet';

type EntitlementEnv = Pick<Cloudflare.Env, 'DB'>;
type EntitlementRouteEnv = EntitlementEnv & NativeAuthEnv;

export const REMOTERADAR_PRODUCTS = {
  STARTER_MONTHLY: 'remoteradar-starter-monthly',
  STARTER_QUARTERLY: 'remoteradar-starter-quarterly',
  STARTER_ANNUAL: 'remoteradar-starter-annual',
  PRO_MONTHLY: 'remoteradar-pro-monthly',
  PRO_QUARTERLY: 'remoteradar-pro-quarterly',
  PRO_ANNUAL: 'remoteradar-pro-annual',
  POWER_MONTHLY: 'remoteradar-power-monthly',
  POWER_QUARTERLY: 'remoteradar-power-quarterly',
  POWER_ANNUAL: 'remoteradar-power-annual',
} as const;

// Tiered pricing follows the published tsenta-style plan card: every tier is
// the full product and differs only by application volume per 30-day cycle.
export const REMOTERADAR_PRICING_USD = {
  [REMOTERADAR_PRODUCTS.STARTER_MONTHLY]: 19,
  [REMOTERADAR_PRODUCTS.STARTER_QUARTERLY]: 51,
  [REMOTERADAR_PRODUCTS.STARTER_ANNUAL]: 190,
  [REMOTERADAR_PRODUCTS.PRO_MONTHLY]: 39,
  [REMOTERADAR_PRODUCTS.PRO_QUARTERLY]: 105,
  [REMOTERADAR_PRODUCTS.PRO_ANNUAL]: 390,
  [REMOTERADAR_PRODUCTS.POWER_MONTHLY]: 99,
  [REMOTERADAR_PRODUCTS.POWER_QUARTERLY]: 267,
  [REMOTERADAR_PRODUCTS.POWER_ANNUAL]: 990,
} as const;

// Applications credited per 30-day cycle for each tier's monthly grant.
export const REMOTERADAR_TIER_CREDITS = {
  starter: 600,
  pro_beta: 1500,
  power: 4500,
  free: 25,
} as const;

type RemoteRadarProductCode = typeof REMOTERADAR_PRODUCTS[keyof typeof REMOTERADAR_PRODUCTS];

interface OrderItemRow {
  product_id: string;
  quantity: number;
  unit_price: number;
}

interface OrderRow {
  user_id: string;
  payment_status: string;
}

interface EntitlementRow {
  plan_code: 'starter' | 'pro_beta' | 'power';
  billing_interval: 'month' | 'quarter' | 'year';
  starts_at: string;
  ends_at: string;
}

interface GrantRow {
  grant_type: 'free_monthly' | 'pro_monthly' | 'credit_pack';
  credits_total: number;
  credits_remaining: number;
  expires_at: string;
}

export interface RemoteRadarAllowanceStatus {
  plan: 'free' | 'starter' | 'pro_beta' | 'power';
  billingInterval: 'month' | 'quarter' | 'year' | null;
  periodKey: string;
  includedCredits: number;
  includedRemaining: number;
  purchasedRemaining: number;
  totalRemaining: number;
  entitlementEndsAt: string | null;
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

function period(value: Date): { key: string; startsAt: string; endsAt: string } {
  const start = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
  const end = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 1));
  return { key: start.toISOString().slice(0, 7), startsAt: start.toISOString(), endsAt: end.toISOString() };
}

function entitlementId(userId: string, orderId: string): string {
  return `rr_ent_${userId}_${orderId}`;
}

function grantId(userId: string, kind: string, discriminator: string): string {
  return `rr_grant_${userId}_${kind}_${discriminator}`;
}

function supportedProduct(value: string): value is RemoteRadarProductCode {
  return Object.values(REMOTERADAR_PRODUCTS).includes(value as RemoteRadarProductCode);
}

function productTier(product: RemoteRadarProductCode): PaidTier {
  if (product.startsWith('remoteradar-starter-')) return 'starter';
  if (product.startsWith('remoteradar-pro-')) return 'pro_beta';
  if (product.startsWith('remoteradar-power-')) return 'power';
  throw new Error('REMOTERADAR_ORDER_NOT_ELIGIBLE');
}

function productInterval(product: RemoteRadarProductCode): 'month' | 'quarter' | 'year' {
  if (product.endsWith('-quarterly')) return 'quarter';
  if (product.endsWith('-annual')) return 'year';
  return 'month';
}

type PaidTier = 'starter' | 'pro_beta' | 'power';

function tierCredits(tier: PaidTier): number {
  return REMOTERADAR_TIER_CREDITS[tier];
}

function cycleEndsAt(at: Date, interval: 'month' | 'quarter' | 'year'): string {
  const ends = new Date(at);
  if (interval === 'month') ends.setUTCMonth(ends.getUTCMonth() + 1);
  else if (interval === 'quarter') ends.setUTCMonth(ends.getUTCMonth() + 3);
  else ends.setUTCFullYear(ends.getUTCFullYear() + 1);
  return ends.toISOString();
}

async function ensureMonthlyGrant(
  env: EntitlementEnv,
  userId: string,
  now: Date,
  active: EntitlementRow | null,
): Promise<void> {
  const current = period(now);
  const kind = active ? 'pro_monthly' : 'free_monthly';
  const credits = active ? tierCredits(active.plan_code) : REMOTERADAR_TIER_CREDITS.free;
  await env.DB.prepare(
    `INSERT OR IGNORE INTO remoteradar_credit_grants
     (id, user_id, grant_type, credits_total, credits_remaining, period_key, source_order_id,
      expires_at, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?4, ?5, NULL, ?6, ?7, ?7)`,
  ).bind(grantId(userId, kind, current.key), userId, kind, credits, current.key, current.endsAt, now.toISOString()).run();
}

export async function remoteRadarAllowanceStatus(
  env: EntitlementEnv,
  userId: string,
  at = new Date(),
): Promise<RemoteRadarAllowanceStatus> {
  const now = at.toISOString();
  const active = await env.DB.prepare(
    `SELECT plan_code, billing_interval, starts_at, ends_at
     FROM remoteradar_entitlements
     WHERE user_id = ?1 AND status = 'active' AND starts_at <= ?2 AND ends_at > ?2
     ORDER BY ends_at DESC LIMIT 1`,
  ).bind(userId, now).first<EntitlementRow>();
  await ensureMonthlyGrant(env, userId, at, active);
  const current = period(at);
  const grants = await env.DB.prepare(
    `SELECT grant_type, credits_total, credits_remaining, expires_at
     FROM remoteradar_credit_grants
     WHERE user_id = ?1 AND credits_remaining > 0 AND expires_at > ?2
       AND (grant_type = 'credit_pack' OR period_key = ?3)`,
  ).bind(userId, now, current.key).all<GrantRow>();
  const includedType = active ? 'pro_monthly' : 'free_monthly';
  const includedRemaining = grants.results
    .filter((grant) => grant.grant_type === includedType)
    .reduce((sum, grant) => sum + grant.credits_remaining, 0);
  const purchasedRemaining = grants.results
    .filter((grant) => grant.grant_type === 'credit_pack')
    .reduce((sum, grant) => sum + grant.credits_remaining, 0);
  return {
    plan: active ? 'pro_beta' : 'free',
    billingInterval: active?.billing_interval ?? null,
    periodKey: current.key,
    includedCredits: active ? tierCredits(active.plan_code) : REMOTERADAR_TIER_CREDITS.free,
    includedRemaining,
    purchasedRemaining,
    totalRemaining: includedRemaining + purchasedRemaining,
    entitlementEndsAt: active?.ends_at ?? null,
  };
}

export async function processRemoteRadarPaidOrder(
  env: EntitlementEnv,
  orderId: string,
  providerEventId: string,
  at = new Date(),
): Promise<{ applied: boolean; productCode: RemoteRadarProductCode | null }> {
  const prior = await env.DB.prepare(
    'SELECT product_code FROM remoteradar_paid_order_grants WHERE order_id = ?1 OR provider_event_id = ?2 LIMIT 1',
  ).bind(orderId, providerEventId).first<{ product_code: string }>();
  if (prior) return { applied: false, productCode: supportedProduct(prior.product_code) ? prior.product_code : null };

  const order = await env.DB.prepare(
    'SELECT user_id, payment_status FROM native_order_metadata WHERE order_id = ?1',
  ).bind(orderId).first<OrderRow>();
  if (!order) throw new Error('REMOTERADAR_ORDER_NOT_FOUND');
  if (order.payment_status !== 'PAID') throw new Error('REMOTERADAR_ORDER_NOT_PAID');
  const items = await env.DB.prepare(
    'SELECT product_id, quantity, unit_price FROM native_order_items WHERE order_id = ?1 ORDER BY id',
  ).bind(orderId).all<OrderItemRow>();
  const item = items.results[0];
  if (items.results.length !== 1 || !item || !supportedProduct(item.product_id) || item.quantity !== 1) {
    throw new Error('REMOTERADAR_ORDER_NOT_ELIGIBLE');
  }
  const productCode = item.product_id;
  if (Math.abs(item.unit_price - REMOTERADAR_PRICING_USD[productCode]) > 0.000001) {
    throw new Error('REMOTERADAR_ORDER_PRICE_MISMATCH');
  }
  const now = at.toISOString();
  const statements: D1PreparedStatement[] = [];

  const tier = productTier(productCode);
  const interval = productInterval(productCode);
  if (tier) {
    // A paid tier order opens the entitlement and credits the first 30-day cycle.
    const endsAt = cycleEndsAt(at, interval);
    statements.push(env.DB.prepare(
      `INSERT OR IGNORE INTO remoteradar_entitlements
       (id, user_id, plan_code, billing_interval, status, starts_at, ends_at, source_order_id, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, 'active', ?5, ?6, ?7, ?5, ?5)`,
    ).bind(entitlementId(order.user_id, orderId), order.user_id, tier, interval, now, endsAt, orderId));
    const firstCycleEndsAt = addDays(at, 30).toISOString();
    statements.push(env.DB.prepare(
      `INSERT OR IGNORE INTO remoteradar_credit_grants
       (id, user_id, grant_type, credits_total, credits_remaining, period_key, source_order_id,
        expires_at, created_at, updated_at)
       VALUES (?1, ?2, 'pro_monthly', ?3, ?3, NULL, ?4, ?5, ?6, ?6)`,
    ).bind(grantId(order.user_id, 'pro_monthly', orderId), order.user_id, tierCredits(tier), orderId, firstCycleEndsAt, now));
  }
  statements.push(env.DB.prepare(
    `INSERT OR IGNORE INTO remoteradar_paid_order_grants
     (order_id, user_id, product_code, provider_event_id, processed_at)
     VALUES (?1, ?2, ?3, ?4, ?5)`,
  ).bind(orderId, order.user_id, productCode, providerEventId, now));
  try {
    await env.DB.batch(statements);
  } catch (error) {
    const concurrent = await env.DB.prepare(
      'SELECT product_code FROM remoteradar_paid_order_grants WHERE order_id = ?1 OR provider_event_id = ?2 LIMIT 1',
    ).bind(orderId, providerEventId).first<{ product_code: string }>();
    if (concurrent) {
      return { applied: false, productCode: supportedProduct(concurrent.product_code) ? concurrent.product_code : null };
    }
    throw error;
  }

  const recorded = await env.DB.prepare(
    'SELECT product_code, provider_event_id FROM remoteradar_paid_order_grants WHERE order_id = ?1',
  ).bind(orderId).first<{ product_code: string; provider_event_id: string }>();
  if (!recorded) throw new Error('REMOTERADAR_GRANT_NOT_RECORDED');
  if (recorded.product_code !== productCode || recorded.provider_event_id !== providerEventId) {
    throw new Error('REMOTERADAR_GRANT_IDEMPOTENCY_CONFLICT');
  }
  return { applied: true, productCode };
}

export async function expireRemoteRadarCreditGrants(env: EntitlementEnv, limit = 100): Promise<{ expired: number; debited: number }> {
  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
  const now = new Date().toISOString();
  const grants = await env.DB.prepare(`SELECT id, user_id, credits_remaining
    FROM remoteradar_credit_grants
    WHERE credits_remaining > 0 AND expires_at <= ?1
    ORDER BY expires_at ASC LIMIT ?2`).bind(now, boundedLimit).all<{ id: string; user_id: string; credits_remaining: number }>();
  let expired = 0;
  let debited = 0;
  for (const grant of grants.results) {
    const remaining = Number(grant.credits_remaining);
    if (remaining > 0) {
      await nativeWalletMutate(env, {
        userId: grant.user_id,
        amount: remaining,
        operation: 'debit',
        idempotencyKey: `remoteradar-grant-expiry:${grant.id}`,
        type: 'remoteradar_credit_expiry',
        description: 'Expired RemoteRadar application credits',
        sourcePlugin: 'remoteradar',
        referenceId: grant.id,
      });
      debited += remaining;
    }
    const result = await env.DB.prepare(`UPDATE remoteradar_credit_grants
      SET credits_remaining = 0, updated_at = ?1
      WHERE id = ?2 AND credits_remaining = ?3 AND expires_at <= ?1`).bind(now, grant.id, remaining).run();
    expired += Number(result.meta?.changes ?? 0);
  }
  return { expired, debited };
}

function response(data: unknown, status = 200): Response {
  return Response.json({ success: status < 400, ...(status < 400 ? { data } : { error: data }) }, {
    status,
    headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-remoteradar-entitlements' },
  });
}

export async function tryNativeRemoteRadarEntitlements(
  request: Request,
  env: EntitlementRouteEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== '/api/v1/remoteradar/entitlements') return null;
  if (request.method !== 'GET') return response({ code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' }, 405);
  const user = await authenticateNativeUser(request, env);
  if (!user) return response({ code: 'UNAUTHORIZED', message: 'Login required' }, 401);
  return response(await remoteRadarAllowanceStatus(env, user.id));
}
