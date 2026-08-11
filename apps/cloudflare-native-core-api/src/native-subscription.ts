import { authenticateNativeUser, type NativeAuthEnv } from './auth';
import { isNativePluginEnabled } from './plugin-enabled';

type Env = NativeAuthEnv & { DB: D1Database };

function response(data: unknown, status = 200): Response {
  return Response.json(status < 400 ? { success: true, data } : { success: false, error: data }, {
    status,
    headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-subscription' },
  });
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
