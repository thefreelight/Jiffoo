import { authenticateNativeAdmin, type NativeAuthEnv } from './auth';
import { buildNativeCatalogResponse, type NativeCatalogItem, type NativeThemeInstallState } from './marketplace-mapping';

type Env = NativeAuthEnv & { DB: D1Database; MARKET_API_URL?: string; PLATFORM_API_BASE_URL?: string };

function baseUrl(env: Env): string {
  return (env.PLATFORM_API_BASE_URL?.trim() || env.MARKET_API_URL?.trim() || 'https://platform-api.jiffoo.com/api').replace(/\/+$/, '');
}

async function platformCatalog(env: Env): Promise<NativeCatalogItem[]> {
  const response = await fetch(`${baseUrl(env)}/marketplace/official/catalog`, {
    headers: { accept: 'application/json' },
  });
  const body = await response.json().catch(() => null) as { data?: { items?: NativeCatalogItem[] }; error?: { message?: string } } | null;
  if (!response.ok || !Array.isArray(body?.data?.items)) {
    throw new Error(body?.error?.message || `Official marketplace request failed (${response.status})`);
  }
  return body.data.items;
}

async function installedPluginStates(env: Env): Promise<Map<string, boolean>> {
  const result = await env.DB.prepare(
    "SELECT plugin_slug, enabled FROM native_plugin_instances WHERE instance_key = 'default'",
  ).all<{ plugin_slug: string; enabled: number }>();
  return new Map(result.results.map((row) => [row.plugin_slug, row.enabled === 1]));
}

async function installedThemeStates(env: Env): Promise<Map<string, NativeThemeInstallState>> {
  const row = await env.DB.prepare("SELECT value FROM runtime_metadata WHERE key = 'native_theme_state_shop'").first<{ value: string }>();
  if (!row?.value) return new Map();
  try {
    const state = JSON.parse(row.value) as { active?: string | null; installed?: Array<{ slug?: string; version?: string }> };
    return new Map((state.installed || [])
      .filter((theme): theme is { slug: string; version: string } => typeof theme.slug === 'string' && typeof theme.version === 'string')
      .map((theme) => [theme.slug, { version: theme.version, active: theme.slug === state.active }]));
  } catch {
    return new Map();
  }
}

function failure(error: unknown): Response {
  return Response.json({ success: false, error: {
    code: 'NATIVE_MARKETPLACE_UNAVAILABLE',
    message: error instanceof Error ? error.message : 'Official marketplace is unavailable',
  } }, { status: 503, headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-marketplace' } });
}

export async function tryNativeMarketplace(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (request.method !== 'GET' || (path !== '/api/v1/admin/market/official-catalog' && path !== '/api/v1/admin/market/health')) return null;
  if (!(await authenticateNativeAdmin(request, env))) {
    return Response.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Administrator authentication is required' } }, { status: 401 });
  }
  const startedAt = Date.now();
  try {
    const [items, installed, themes] = await Promise.all([platformCatalog(env), installedPluginStates(env), installedThemeStates(env)]);
    if (path.endsWith('/health')) {
      return Response.json({ success: true, data: {
        officialMarketOnly: true,
        signatureMode: 'platform-managed',
        officialKeyPresent: true,
        marketApiUrl: baseUrl(env),
        marketOnline: true,
        marketLatencyMs: Date.now() - startedAt,
        marketStatus: 200,
      } }, { headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-marketplace' } });
    }
    return Response.json({ success: true, data: buildNativeCatalogResponse(items, installed, themes) }, {
      headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-marketplace' },
    });
  } catch (error) {
    return failure(error);
  }
}
