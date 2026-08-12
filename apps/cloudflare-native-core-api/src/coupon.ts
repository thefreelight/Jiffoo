import { authenticateNativeAdmin, authenticateNativeUser, type NativeAuthEnv } from './auth';
import { isNativePluginEnabled } from './plugin-enabled';
import { applyNativeSubscriptionRedemption } from './native-subscription';

type CouponEnv = NativeAuthEnv & { DB: D1Database };

function reply(data: unknown, status = 200): Response {
  return Response.json(status < 400 ? { success: true, data } : { success: false, error: data }, { status, headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-coupon' } });
}

interface RedemptionCodeRow {
  id: string;
  code: string;
  plan_slug: string;
  plan_name: string;
  duration_days: number;
}

async function createRedemptionCode(request: Request, env: CouponEnv): Promise<Response> {
  if (!(await authenticateNativeAdmin(request, env))) return reply({ code: 'UNAUTHORIZED', message: 'Administrator authentication is required' }, 401);
  const body = await request.json<{ code?: string; planSlug?: string; planName?: string; durationDays?: number; expiresAt?: string }>().catch(() => null);
  const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
  const planSlug = typeof body?.planSlug === 'string' ? body.planSlug.trim().toLowerCase() : '';
  const planName = typeof body?.planName === 'string' ? body.planName.trim() : '';
  const durationDays = Number(body?.durationDays);
  if (!/^[A-Z0-9_-]{3,64}$/.test(code) || !/^[a-z0-9][a-z0-9_-]{1,63}$/.test(planSlug) || !planName || !Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650) {
    return reply({ code: 'VALIDATION_ERROR', message: 'Valid code, planSlug, planName, and durationDays are required' }, 400);
  }
  await env.DB.prepare(`INSERT INTO native_subscription_redemption_codes
    (id, code, plan_slug, plan_name, duration_days, expires_at, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`)
    .bind(crypto.randomUUID(), code, planSlug, planName, durationDays, body?.expiresAt ?? null, new Date().toISOString()).run();
  return reply({ code, planSlug, planName, durationDays, expiresAt: body?.expiresAt ?? null });
}

async function redeemSubscription(request: Request, env: CouponEnv): Promise<Response> {
  const user = await authenticateNativeUser(request, env);
  if (!user) return reply({ code: 'UNAUTHORIZED', message: 'Login required' }, 401);
  if (!(await isNativePluginEnabled(env, 'subscription'))) return reply({ code: 'PLUGIN_NOT_ENABLED', message: 'Subscription plugin is not installed and enabled' }, 404);
  const body = await request.json<{ code?: string }>().catch(() => null);
  const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
  if (!code) return reply({ code: 'VALIDATION_ERROR', message: 'A redemption code is required' }, 400);
  const redemption = await env.DB.prepare(`SELECT id, code, plan_slug, plan_name, duration_days
    FROM native_subscription_redemption_codes
    WHERE code = ?1 AND active = 1 AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`)
    .bind(code).first<RedemptionCodeRow>();
  if (!redemption) return reply({ code: 'REDEMPTION_CODE_INVALID', message: 'Redemption code is invalid or expired' }, 400);

  const claim = await applyNativeSubscriptionRedemption(env, user.id, {
    id: redemption.id,
    code: redemption.code,
    planSlug: redemption.plan_slug,
    planName: redemption.plan_name,
    durationDays: redemption.duration_days,
  });
  if (claim?.userId !== user.id) return reply({ code: 'REDEMPTION_CODE_ALREADY_CLAIMED', message: 'Redemption code has already been claimed' }, 409);
  if (!claim.appliedAt || !claim.subscriptionPeriodEnd) return reply({ code: 'REDEMPTION_FAILED', message: 'Subscription benefit could not be applied' }, 500);
  return reply({ code: redemption.code, planSlug: redemption.plan_slug, planName: redemption.plan_name, currentPeriodEnd: claim.subscriptionPeriodEnd, active: true });
}

export async function tryNativeCoupon(request: Request, env: CouponEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/v1/plugins/coupon/')) return null;
  if (!(await isNativePluginEnabled(env, 'coupon'))) return reply({ code: 'PLUGIN_NOT_ENABLED', message: 'Coupon plugin is not installed and enabled' }, 404);
  if (request.method === 'POST' && url.pathname === '/api/v1/plugins/coupon/admin/redemption-codes') return createRedemptionCode(request, env);
  if (request.method === 'POST' && url.pathname === '/api/v1/plugins/coupon/api/redeem') return redeemSubscription(request, env);
  if (request.method === 'POST' && url.pathname === '/api/v1/plugins/coupon/admin/codes') {
    if (!(await authenticateNativeAdmin(request, env))) return reply({ code: 'UNAUTHORIZED', message: 'Administrator authentication is required' }, 401);
    const body = await request.json<{ code?: string; discountType?: string; discountValue?: number; usageLimit?: number; expiresAt?: string }>().catch(() => null);
    const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
    const value = Number(body?.discountValue);
    const type = body?.discountType === 'fixed_amount' ? 'fixed_amount' : 'percentage';
    if (!/^[A-Z0-9_-]{3,64}$/.test(code) || !Number.isFinite(value) || value <= 0 || (type === 'percentage' && value > 100)) return reply({ code: 'VALIDATION_ERROR', message: 'Valid code and discountValue are required' }, 400);
    const now = new Date().toISOString();
    await env.DB.prepare(`INSERT INTO native_coupon_codes (id, code, discount_type, discount_value, usage_limit, expires_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`).bind(crypto.randomUUID(), code, type, value, body?.usageLimit ?? null, body?.expiresAt ?? null, now).run();
    return reply({ code, discountType: type, discountValue: value });
  }
  if (request.method !== 'POST' || url.pathname !== '/api/v1/plugins/coupon/api/validate') return null;
  if (!(await authenticateNativeUser(request, env))) return reply({ code: 'UNAUTHORIZED', message: 'Login required' }, 401);
  const body = await request.json<{ codes?: string[]; subtotal?: number }>().catch(() => null);
  const code = body?.codes?.[0]?.trim().toUpperCase();
  if (!code) return reply({ code: 'VALIDATION_ERROR', message: 'At least one discount code is required' }, 400);
  const row = await env.DB.prepare(`SELECT * FROM native_coupon_codes WHERE code = ?1 AND active = 1 AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP) AND (usage_limit IS NULL OR usage_count < usage_limit)`).bind(code).first<{ code: string; discount_type: string; discount_value: number }>();
  if (!row) return reply({ code: 'COUPON_INVALID', message: 'Coupon code is invalid or expired' }, 400);
  const subtotal = Math.max(0, Number(body?.subtotal) || 0);
  const discountAmount = Number((row.discount_type === 'percentage' ? subtotal * row.discount_value / 100 : Math.min(subtotal, row.discount_value)).toFixed(2));
  return reply({ discountAmount, appliedDiscounts: [{ code: row.code, type: row.discount_type, value: row.discount_value, amount: discountAmount }], subtotal, finalTotal: Number((subtotal - discountAmount).toFixed(2)) });
}
