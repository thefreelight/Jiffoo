import { authenticateNativeAdmin, type NativeAuthEnv } from './auth';
import { testNativeOdooConnection } from './odoo';
import { getNativePluginSecret } from './plugin-settings';
import { sendSmtpEmail } from './smtp';
import { nativeSiteName } from './site-name';

interface IntegrationAdminEnv extends NativeAuthEnv {
  DB: D1Database;
  STRIPE_SECRET_KEY: SecretsStoreSecret;
}

function result(data: unknown, status = 200): Response {
  return Response.json({ success: status < 400, ...(status < 400 ? { data } : { error: data }) }, {
    status,
    headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-integration-admin' },
  });
}

export async function tryNativeIntegrationAdmin(request: Request, env: IntegrationAdminEnv): Promise<Response | null> {
  const match = new URL(request.url).pathname.match(/^\/api\/v1\/extensions\/plugin\/(smtp-email|stripe|odoo)\/api\/admin\/test$/);
  if (!match || request.method !== 'POST') return null;
  const admin = await authenticateNativeAdmin(request, env);
  if (!admin) return result({ code: 'UNAUTHORIZED', message: 'Admin authentication required' }, 401);
  try {
    if (match[1] === 'smtp-email') {
      const siteName = await nativeSiteName(env);
      const body = await request.json<{ to?: unknown }>().catch(() => ({} as { to?: unknown }));
      const to = typeof body.to === 'string' ? body.to.trim() : '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return result({ code: 'VALIDATION_ERROR', message: 'A valid recipient email is required' }, 400);
      await sendSmtpEmail(env, {
        to,
        subject: `${siteName} SMTP connection test`,
        text: `Your ${siteName} SMTP configuration is working.`,
        html: `<p>Your ${siteName} SMTP configuration is working.</p>`,
      });
      return result({ ok: true, recipient: to });
    }
    if (match[1] === 'stripe') {
      const secret = await getNativePluginSecret(env, 'stripe', 'secretKey', env.STRIPE_SECRET_KEY);
      if (!secret) throw new Error('Stripe plugin is not enabled or configured');
      const response = await fetch('https://api.stripe.com/v1/account', {
        headers: { authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(15_000),
      });
      const payload = await response.json<{ id?: string; country?: string; error?: { message?: string } }>()
        .catch(() => ({} as { id?: string; country?: string; error?: { message?: string } }));
      if (!response.ok || !payload.id) throw new Error(payload.error?.message || `Stripe returned HTTP ${response.status}`);
      return result({ ok: true, accountId: payload.id, country: payload.country ?? null });
    }
    return result({ ok: true, ...(await testNativeOdooConnection(env)) });
  } catch (error) {
    return result({ code: 'CONNECTION_TEST_FAILED', message: error instanceof Error ? error.message : 'Connection test failed' }, 400);
  }
}
