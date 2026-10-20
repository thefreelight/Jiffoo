import { authenticateNativeAdmin, type NativeAuthEnv } from './auth';

type ThemesEnv = NativeAuthEnv & { DB: D1Database };

const READ_ONLY_MESSAGE = 'Native instances activate themes through the deployment pipeline (R2 runtime + D1 version pointers). Theme activation, rollback, config edits, and install/uninstall are not available from the admin console.';

interface ActiveThemeSnapshot {
  slug?: string;
  version?: string;
  source?: string;
  type?: string;
  config?: Record<string, unknown> | null;
}

function toIsoTimestamp(value: string | null | undefined): string {
  if (!value) return new Date(0).toISOString();
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  return /[zZ]|[+-]\d{2}:\d{2}$/.test(normalized) ? normalized : `${normalized}Z`;
}

async function loadActiveTheme(env: ThemesEnv): Promise<{ theme: ActiveThemeSnapshot; activatedAt: string } | null> {
  const row = await env.DB.prepare(
    "SELECT payload, refreshed_at FROM core_api_snapshots WHERE request_path = '/api/v1/themes/active' LIMIT 1",
  ).first<{ payload: string; refreshed_at: string }>();
  if (!row?.payload) return null;
  try {
    const envelope = JSON.parse(row.payload) as { data?: ActiveThemeSnapshot };
    if (!envelope?.data || typeof envelope.data !== 'object') return null;
    return { theme: envelope.data, activatedAt: toIsoTimestamp(row.refreshed_at) };
  } catch {
    return null;
  }
}

export async function tryNativeAdminThemes(request: Request, env: ThemesEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!/^\/api\/v1\/admin\/themes(?:\/|$)/.test(url.pathname)) return null;

  if (request.method !== 'GET') {
    // Writes must not silently fall through to the fallback origin: on native
    // instances that would mutate a different deployment's theme state, which
    // is how the storefront version pointers drifted in the past.
    return Response.json(
      { success: false, error: { code: 'NATIVE_THEMES_READ_ONLY', message: READ_ONLY_MESSAGE } },
      { status: 501, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-themes' } },
    );
  }

  // The admin-target active read keeps its dedicated snapshot route handling.
  if (url.pathname === '/api/v1/admin/themes/admin/active') return null;

  if (!await authenticateNativeAdmin(request, env)) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Administrator authentication is required' } },
      { status: 401, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-themes' } },
    );
  }

  if (/^\/api\/v1\/admin\/themes\/?$/.test(url.pathname)) {
    return Response.json(
      { success: true, data: { targets: ['shop'] } },
      { headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-themes' } },
    );
  }

  const active = await loadActiveTheme(env);

  if (/^\/api\/v1\/admin\/themes\/shop\/active\/?$/.test(url.pathname)) {
    if (!active) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'No active shop theme snapshot' } },
        { status: 404, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-themes' } },
      );
    }
    return Response.json({ success: true, data: {
      slug: active.theme.slug,
      version: active.theme.version,
      source: active.theme.source,
      type: active.theme.type,
      config: active.theme.config ?? {},
      activatedAt: active.activatedAt,
    } }, { headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-themes' } });
  }

  if (/^\/api\/v1\/admin\/themes\/shop\/installed\/?$/.test(url.pathname)) {
    const items = active?.theme.slug ? [{
      slug: active.theme.slug,
      name: active.theme.slug.charAt(0).toUpperCase() + active.theme.slug.slice(1),
      version: active.theme.version,
      source: 'installed',
      type: active.theme.type ?? 'pack',
      target: 'shop',
    }] : [];
    return Response.json({ success: true, data: {
      items, page: 1, limit: 20, total: items.length, totalPages: items.length === 0 ? 0 : 1,
    } }, { headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-themes' } });
  }

  return null;
}
