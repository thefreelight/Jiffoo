import { authenticateNativeUser, type NativeAuthEnv } from './auth';
import { isNativePluginEnabled } from './plugin-enabled';

type Env = NativeAuthEnv & { DB: D1Database };

export interface NativeSubscriptionRedemption {
  id: string;
  code: string;
  planSlug: string;
  planName: string;
  durationDays: number;
}

function response(data: unknown, status = 200): Response {
  return Response.json(status < 400 ? { success: true, data } : { success: false, error: data }, {
    status,
    headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-subscription' },
  });
}

export async function applyNativeSubscriptionRedemption(env: Env, userId: string, redemption: NativeSubscriptionRedemption): Promise<{ userId: string; appliedAt: string | null; subscriptionPeriodEnd: string | null } | null> {
  await env.DB.batch([
    env.DB.prepare(`INSERT OR IGNORE INTO native_subscription_redemption_claims
      (code_id, user_id, claimed_at) VALUES (?1, ?2, ?3)`).bind(redemption.id, userId, new Date().toISOString()),
    env.DB.prepare(`INSERT INTO native_subscription_records
      (user_id, plan_name, plan_slug, status, current_period_end, lifetime_credits_debited, updated_at)
      SELECT ?1, ?2, ?3, 'active', datetime('now', '+' || ?4 || ' days'), 0, CURRENT_TIMESTAMP
      WHERE EXISTS (SELECT 1 FROM native_subscription_redemption_claims WHERE code_id = ?5 AND user_id = ?1 AND applied_at IS NULL)
      ON CONFLICT(user_id) DO UPDATE SET
        plan_name = excluded.plan_name,
        plan_slug = excluded.plan_slug,
        status = 'active',
        current_period_end = datetime(
          CASE WHEN native_subscription_records.current_period_end > CURRENT_TIMESTAMP
            THEN native_subscription_records.current_period_end ELSE CURRENT_TIMESTAMP END,
          '+' || ?4 || ' days'
        ),
        updated_at = CURRENT_TIMESTAMP`).bind(userId, redemption.planName, redemption.planSlug, redemption.durationDays, redemption.id),
    env.DB.prepare(`UPDATE native_subscription_redemption_claims
      SET applied_at = COALESCE(applied_at, CURRENT_TIMESTAMP),
          subscription_period_end = COALESCE(subscription_period_end,
            (SELECT current_period_end FROM native_subscription_records WHERE user_id = ?1))
      WHERE code_id = ?2 AND user_id = ?1`).bind(userId, redemption.id),
  ]);
  return env.DB.prepare(`SELECT user_id AS userId, applied_at AS appliedAt, subscription_period_end AS subscriptionPeriodEnd
    FROM native_subscription_redemption_claims WHERE code_id = ?1`).bind(redemption.id)
    .first<{ userId: string; appliedAt: string | null; subscriptionPeriodEnd: string | null }>();
}

export async function tryNativeSubscription(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const activePath = '/api/v1/extensions/plugin/subscription/api/api/store/subscriptions/active';
  if (request.method !== 'GET' || url.pathname !== activePath) return null;
  if (!(await isNativePluginEnabled(env, 'subscription'))) return response({ code: 'PLUGIN_NOT_ENABLED', message: 'Subscription plugin is not installed and enabled' }, 404);
  const user = await authenticateNativeUser(request, env);
  if (!user) return response({ code: 'UNAUTHORIZED', message: 'Login required' }, 401);
  const row = await env.DB.prepare(`SELECT plan_name AS planName, plan_slug AS planSlug, status,
      current_period_end AS currentPeriodEnd, lifetime_credits_debited AS lifetimeCreditsDebited
      FROM native_subscription_records WHERE user_id = ?1`).bind(user.id).first<Record<string, unknown>>();
  return response(row
    ? { ...row, active: row.status === 'active' }
    : { active: false, planName: 'Free', planSlug: 'free', status: 'inactive', currentPeriodEnd: null, lifetimeCreditsDebited: 0 });
}
