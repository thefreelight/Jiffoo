import { createNativeBootstrapAdmin, type NativeAuthEnv } from './auth';

interface InstallEnv extends NativeAuthEnv { DB: D1Database }

async function status(env: InstallEnv) {
  const [admin, site] = await Promise.all([
    env.DB.prepare("SELECT 1 AS found FROM native_users WHERE role IN ('ADMIN', 'SUPER_ADMIN') LIMIT 1").first<{ found: number }>(),
    env.DB.prepare("SELECT value FROM runtime_metadata WHERE key = 'site_name'").first<{ value: string }>(),
  ]);
  return { isInstalled: Boolean(admin), version: '0.0.1', siteName: site?.value ?? 'Bokmoo' };
}

function error(message: string, code = 400): Response {
  return Response.json({ success: false, error: message }, {
    status: code,
    headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-d1-install' },
  });
}

export async function tryNativeInstall(request: Request, env: InstallEnv): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (request.method === 'GET' && path === '/api/v1/install/status') {
    return Response.json(await status(env), { headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-d1-install' } });
  }
  if (request.method === 'GET' && path === '/api/v1/install/check-database') {
    await env.DB.prepare('SELECT 1').first();
    return Response.json({ connected: true }, { headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-d1-install' } });
  }
  if (request.method !== 'POST' || path !== '/api/v1/install/complete') return null;

  if ((await status(env)).isInstalled) return error('System is already installed', 409);
  const body = await request.json<Record<string, unknown>>().catch(() => null);
  const siteName = typeof body?.siteName === 'string' ? body.siteName.trim() : '';
  const email = typeof body?.adminEmail === 'string' ? body.adminEmail.trim().toLowerCase() : '';
  const password = typeof body?.adminPassword === 'string' ? body.adminPassword : '';
  const requestedUsername = typeof body?.adminUsername === 'string' ? body.adminUsername.trim() : '';
  const username = requestedUsername || email.split('@')[0] || '';
  if (!siteName || siteName.length > 120) return error('Site name must contain 1 to 120 characters');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error('A valid admin email is required');
  if (username.length < 2 || username.length > 64) return error('Admin username must contain 2 to 64 characters');
  if (password.length < 8 || password.length > 128) return error('Admin password must contain 8 to 128 characters');

  const created = await createNativeBootstrapAdmin(env, { email, username, password });
  if (!created) return error('System is already installed', 409);
  await env.DB.prepare(
    `INSERT INTO runtime_metadata (key, value, updated_at) VALUES ('site_name', ?1, ?2)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).bind(siteName, new Date().toISOString()).run();
  return Response.json({ success: true }, {
    headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-d1-install' },
  });
}
