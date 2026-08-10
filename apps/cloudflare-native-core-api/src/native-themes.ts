import { authenticateNativeAdmin, type NativeAuthEnv } from './auth';
import type { NativeCatalogItem } from './marketplace-mapping';
import { inflateThemeZip } from './theme-zip';

const STATE_KEY = 'native_theme_state_shop';
const MAX_ARTIFACT_BYTES = 8 * 1024 * 1024;

type ThemeManifest = {
  slug: string;
  name?: string;
  version: string;
  target: 'shop';
  description?: string;
  author?: string;
  category?: string;
  thumbnail?: string;
  defaultConfig?: Record<string, unknown>;
  entry?: Record<string, unknown>;
};

export type NativeInstalledTheme = {
  slug: string;
  version: string;
  name: string;
  description: string;
  author: string;
  category: string;
  thumbnail?: string;
  config: Record<string, unknown>;
  installedAt: string;
};

type ThemeState = { installed: NativeInstalledTheme[]; active: string | null; previous: string | null };
type Env = NativeAuthEnv & { DB: D1Database; ASSETS: R2Bucket; MARKET_API_URL?: string; PLATFORM_API_BASE_URL?: string };

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-themes' } });
}

function marketBaseUrl(env: Env): string {
  return (env.PLATFORM_API_BASE_URL?.trim() || env.MARKET_API_URL?.trim() || 'https://platform-api.jiffoo.com/api').replace(/\/+$/, '');
}

function artifactUrl(value: string): string {
  const normalized = value.replace(/^https:\/\/get\.jiffoo\.com\//, 'https://artifacts.jiffoo.com/');
  const parsed = new URL(normalized);
  if (parsed.protocol !== 'https:' || !['artifacts.jiffoo.com', 'platform-api.jiffoo.com', 'market.jiffoo.com'].includes(parsed.hostname)) {
    throw new Error('Official theme artifact URL is not on an approved Jiffoo host');
  }
  return parsed.toString();
}

async function verifyChecksum(packageUrl: string, bytes: ArrayBuffer): Promise<void> {
  const response = await fetch(`${packageUrl}.sha256`, { headers: { accept: 'text/plain' } });
  if (!response.ok) throw new Error(`Official theme checksum request failed (${response.status})`);
  const expected = (await response.text()).trim().split(/\s+/)[0]?.toLowerCase();
  if (!expected || !/^[a-f0-9]{64}$/.test(expected)) throw new Error('Official theme checksum sidecar is invalid');
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const actual = Array.from(digest, (value) => value.toString(16).padStart(2, '0')).join('');
  if (actual !== expected) throw new Error('Official theme artifact checksum does not match the published release');
}

function contentType(path: string): string {
  if (path.endsWith('.json')) return 'application/json; charset=utf-8';
  if (path.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (path.endsWith('.css')) return 'text/css; charset=utf-8';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  if (path.endsWith('.webp')) return 'image/webp';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

async function readState(env: Env): Promise<ThemeState> {
  const row = await env.DB.prepare('SELECT value FROM runtime_metadata WHERE key = ?1').bind(STATE_KEY).first<{ value: string }>();
  if (!row?.value) return { installed: [], active: null, previous: null };
  try {
    const parsed = JSON.parse(row.value) as Partial<ThemeState>;
    return { installed: Array.isArray(parsed.installed) ? parsed.installed : [], active: parsed.active ?? null, previous: parsed.previous ?? null };
  } catch {
    return { installed: [], active: null, previous: null };
  }
}

async function writeState(env: Env, state: ThemeState): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO runtime_metadata (key, value, updated_at) VALUES (?1, ?2, ?3)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).bind(STATE_KEY, JSON.stringify(state), new Date().toISOString()).run();
}

function activeTheme(state: ThemeState): Record<string, unknown> | null {
  const theme = state.installed.find((item) => item.slug === state.active);
  if (!theme) return null;
  return {
    slug: theme.slug,
    version: theme.version,
    source: 'official-market',
    type: 'pack',
    config: theme.config,
    activatedAt: theme.installedAt,
    previousSlug: state.previous,
  };
}

async function writeActiveSnapshots(env: Env, active: Record<string, unknown>): Promise<void> {
  const now = new Date().toISOString();
  const payload = JSON.stringify({ success: true, data: active });
  const statement = env.DB.prepare(
    `INSERT INTO core_api_snapshots (cache_key, request_path, payload, status_code, content_type, source_updated_at, refreshed_at)
     VALUES (?1, ?2, ?3, 200, 'application/json; charset=utf-8', ?4, ?4)
     ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload, status_code = excluded.status_code,
       content_type = excluded.content_type, source_updated_at = excluded.source_updated_at, refreshed_at = excluded.refreshed_at`,
  );
  await env.DB.batch([
    statement.bind('core:snapshot:/api/v1/themes/active', '/api/v1/themes/active', payload, now),
    statement.bind('core:snapshot:/api/v1/themes/active?target=shop', '/api/v1/themes/active?target=shop', payload, now),
  ]);
}

async function officialTheme(env: Env, slug: string, requestedVersion?: string): Promise<{ manifest: ThemeManifest; packageUrl: string }> {
  const response = await fetch(`${marketBaseUrl(env)}/marketplace/official/catalog`, { headers: { accept: 'application/json' } });
  const body = await response.json().catch(() => null) as { data?: { items?: NativeCatalogItem[] } } | null;
  const item = body?.data?.items?.find((candidate) => candidate.slug === slug && candidate.kind === 'theme');
  if (!response.ok || !item) throw new Error(`Official theme "${slug}" was not found in the marketplace`);
  const version = requestedVersion || item.sellableVersion || item.currentVersion || item.versions?.find((candidate) => candidate.isCurrent)?.version;
  const release = item.versions?.find((candidate) => candidate.version === version);
  if (!version || !release?.packageUrl) throw new Error(`Official theme "${slug}" has no installable package`);
  return { manifest: { slug, version, target: 'shop' }, packageUrl: artifactUrl(release.packageUrl) };
}

function installedResponse(state: ThemeState): Record<string, unknown> {
  return {
    items: state.installed.map((theme) => ({ ...theme, source: 'official-market', type: 'pack', target: 'shop', isActive: theme.slug === state.active })),
    pagination: { page: 1, limit: state.installed.length || 20, total: state.installed.length, totalPages: 1 },
  };
}

async function requireAdmin(request: Request, env: Env): Promise<Response | null> {
  return (await authenticateNativeAdmin(request, env)) ? null : json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Administrator authentication is required' } }, 401);
}

export async function tryNativeThemes(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const target = url.searchParams.get('target') || 'shop';
  if (target !== 'shop') return null;
  if (request.method === 'GET' && path === '/api/v1/themes/active') {
    const active = activeTheme(await readState(env));
    return active ? json({ success: true, data: active }) : null;
  }
  if (request.method === 'GET' && path === '/api/v1/themes/installed') return json({ success: true, data: installedResponse(await readState(env)) });
  if (path === '/api/v1/admin/themes/shop/installed' && request.method === 'GET') {
    const denied = await requireAdmin(request, env); if (denied) return denied;
    return json({ success: true, data: installedResponse(await readState(env)) });
  }
  if (path === '/api/v1/admin/themes/shop/active' && request.method === 'GET') {
    const denied = await requireAdmin(request, env); if (denied) return denied;
    const active = activeTheme(await readState(env));
    return active ? json({ success: true, data: active }) : json({ success: false, error: { code: 'NOT_FOUND', message: 'No active shop theme' } }, 404);
  }
  const activate = path.match(/^\/api\/v1\/admin\/themes\/shop\/([a-z0-9][a-z0-9-]{0,63})\/activate$/);
  if (activate && request.method === 'POST') {
    const denied = await requireAdmin(request, env); if (denied) return denied;
    const state = await readState(env);
    if (!state.installed.some((theme) => theme.slug === activate[1])) return json({ success: false, error: { code: 'NOT_FOUND', message: `Theme "${activate[1]}" is not installed` } }, 404);
    state.previous = state.active;
    state.active = activate[1];
    await writeState(env, state);
    const active = activeTheme(state)!;
    await writeActiveSnapshots(env, active);
    return json({ success: true, data: active });
  }
  const install = path.match(/^\/api\/v1\/admin\/market\/extensions\/([a-z0-9][a-z0-9-]{0,63})\/install$/);
  if (!install || request.method !== 'POST') return null;
  const denied = await requireAdmin(request, env); if (denied) return denied;
  const body = await request.json().catch(() => null) as { kind?: string; version?: string; activate?: boolean } | null;
  if (body?.kind !== 'theme-shop') return null;
  try {
    const official = await officialTheme(env, install[1], body.version);
    const artifact = await fetch(official.packageUrl);
    if (!artifact.ok) throw new Error(`Official theme artifact request failed (${artifact.status})`);
    const bytes = await artifact.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_ARTIFACT_BYTES) throw new Error('Official theme artifact exceeds the download size limit');
    await verifyChecksum(official.packageUrl, bytes);
    const files = await inflateThemeZip(bytes);
    const manifestFile = files.find((file) => file.path === 'theme.json');
    if (!manifestFile) throw new Error('Official theme artifact does not include theme.json');
    const manifest = JSON.parse(new TextDecoder().decode(manifestFile.data)) as ThemeManifest;
    if (manifest.slug !== install[1] || manifest.version !== official.manifest.version || manifest.target !== 'shop') throw new Error('Official theme artifact identity does not match the selected release');
    const prefix = `extensions/themes/shop/.versions/${manifest.slug}/${manifest.version}`;
    const writes: Promise<unknown>[] = [];
    for (const file of files) {
      writes.push(env.ASSETS.put(`${prefix}/${file.path}`, file.data, { httpMetadata: { contentType: contentType(file.path) } }));
    }
    await Promise.all(writes);
    const now = new Date().toISOString();
    const state = await readState(env);
    const installed: NativeInstalledTheme = {
      slug: manifest.slug, version: manifest.version, name: manifest.name || manifest.slug,
      description: manifest.description || '', author: manifest.author || 'Jiffoo', category: manifest.category || 'storefront',
      thumbnail: manifest.thumbnail, config: manifest.defaultConfig || {}, installedAt: now,
    };
    state.installed = [...state.installed.filter((theme) => theme.slug !== installed.slug), installed];
    if (body.activate || !state.active) { state.previous = state.active; state.active = installed.slug; }
    await writeState(env, state);
    const active = activeTheme(state);
    if (active) await writeActiveSnapshots(env, active);
    return json({ success: true, data: { kind: 'theme-shop', slug: installed.slug, version: installed.version, source: 'official-market' } });
  } catch (error) {
    return json({ success: false, error: { code: 'THEME_INSTALL_FAILED', message: error instanceof Error ? error.message : 'Theme installation failed' } }, 502);
  }
}
