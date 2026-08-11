import { authenticateNativeAdmin, type NativeAuthEnv } from './auth';
import { buildNativeCatalogResponse, type NativeCatalogItem, type NativeThemeInstallState } from './marketplace-mapping';

type Env = NativeAuthEnv & { DB: D1Database; MARKET_API_URL?: string; PLATFORM_API_BASE_URL?: string };

const NATIVE_INSTALLABLE_PLUGINS = new Set(['wallet', 'subscription']);

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
  const install = path.match(/^\/api\/v1\/admin\/market\/extensions\/([a-z0-9][a-z0-9-]{0,63})\/install$/);
  if (request.method !== 'GET' && !(request.method === 'POST' && install)) return null;
  if (!install && path !== '/api/v1/admin/market/official-catalog' && path !== '/api/v1/admin/market/health') return null;
  if (!(await authenticateNativeAdmin(request, env))) {
    return Response.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Administrator authentication is required' } }, { status: 401 });
  }
  if (install && request.method === 'POST') {
    const body = await request.json().catch(() => null) as { kind?: string; version?: string } | null;
    if (body?.kind !== 'plugin') return Response.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Native marketplace installs require kind=plugin' } }, { status: 400 });
    if (!NATIVE_INSTALLABLE_PLUGINS.has(install[1])) {
      return Response.json({ success: false, error: { code: 'NATIVE_PLUGIN_NOT_IMPLEMENTED', message: `Native installation is not implemented for ${install[1]}` } }, { status: 501 });
    }
    try {
      const catalog = await platformCatalog(env);
      const item = catalog.find((candidate) => candidate.slug === install[1] && candidate.kind === 'plugin' && candidate.installable);
      if (!item) return Response.json({ success: false, error: { code: 'ARTIFACT_NOT_FOUND', message: `Official plugin "${install[1]}" is not installable` } }, { status: 404 });
      const version = body.version || item.sellableVersion || item.currentVersion || item.versions?.find((entry) => entry.isCurrent)?.version || '0.0.1';
      const now = new Date().toISOString();
      await env.DB.prepare(`INSERT INTO native_plugin_instances
        (id, plugin_slug, instance_key, enabled, config_json, encrypted_secrets_json, created_at, updated_at)
        VALUES (?1, ?2, 'default', 1, '{}', '{}', ?3, ?3)
        ON CONFLICT(plugin_slug, instance_key) DO UPDATE SET enabled = 1, updated_at = excluded.updated_at`)
        .bind(crypto.randomUUID(), install[1], now).run();
      return Response.json({ success: true, data: { slug: install[1], kind: 'plugin', version, source: 'official-market', installedAt: now } }, { headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-marketplace' } });
    } catch (error) {
      return failure(error);
    }
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
