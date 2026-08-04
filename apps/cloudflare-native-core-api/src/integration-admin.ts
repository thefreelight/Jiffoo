import { authenticateNativeAdmin, type NativeAuthEnv } from './auth';
import { testNativeOdooConnection } from './odoo';
import { getNativePluginConfig, getNativePluginSecret } from './plugin-settings';
import { sendSmtpEmail } from './smtp';

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

function renderTemplate(value: unknown, fallback: string, variables: Record<string, string>): string {
  let rendered = typeof value === 'string' && value.trim() ? value : fallback;
  for (const [name, replacement] of Object.entries(variables)) {
    rendered = rendered.replaceAll(`{{${name}}}`, replacement);
  }
  return rendered;
}

async function getSiteName(env: IntegrationAdminEnv): Promise<string> {
  const row = await env.DB.prepare("SELECT value FROM runtime_metadata WHERE key = 'site_name'")
    .first<{ value: string }>();
  return row?.value?.trim() || 'Jiffoo';
}

export async function tryNativeIntegrationAdmin(request: Request, env: IntegrationAdminEnv): Promise<Response | null> {
  const match = new URL(request.url).pathname.match(/^\/api\/v1\/extensions\/plugin\/(smtp-email|stripe|odoo)\/api\/admin\/test$/);
  if (!match || request.method !== 'POST') return null;
  const admin = await authenticateNativeAdmin(request, env);
  if (!admin) return result({ code: 'UNAUTHORIZED', message: 'Admin authentication required' }, 401);
  try {
    if (match[1] === 'smtp-email') {
      const body = await request.json<{ to?: unknown }>().catch(() => ({} as { to?: unknown }));
      const to = typeof body.to === 'string' ? body.to.trim() : '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return result({ code: 'VALIDATION_ERROR', message: 'A valid recipient email is required' }, 400);
      const [siteName, stored] = await Promise.all([
        getSiteName(env),
        getNativePluginConfig(env, 'smtp-email'),
      ]);
      const variables = { siteName, recipient: to };
      await sendSmtpEmail(env, {
        to,
        subject: renderTemplate(stored?.config.smtpTestSubject, '{{siteName}} SMTP connection test', variables),
        text: renderTemplate(stored?.config.smtpTestText, 'Your {{siteName}} SMTP configuration is working.', variables),
        html: renderTemplate(stored?.config.smtpTestHtml, '<p>Your {{siteName}} SMTP configuration is working.</p>', variables),
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
