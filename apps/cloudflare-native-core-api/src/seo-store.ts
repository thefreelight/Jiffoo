/**
 * Native SEO storefront surfaces for Cloudflare-native instances.
 *
 * Public (unauthenticated) reads consumed by the Shop host to enforce
 * admin-configured redirects and to build sitemap product URLs:
 * - GET /api/v1/plugins/seo/store/redirects                 (active list, capped)
 * - GET /api/v1/plugins/seo/store/redirects/resolve?path=…  (match + hit_count)
 * - GET /api/v1/plugins/seo/store/sitemap                   (product id + lastmod)
 *
 * These mirror the Node core aliases at /api/seo/store/* so the shop host
 * runs one consumption contract per runtime. Redirects live in
 * native_seo_redirects (0061); the product catalog exists only inside the
 * /api/v1/products snapshot payload (native instances keep no product
 * table), so the sitemap surface projects that JSON.
 */

import type { NativeAuthEnv } from './auth';

type SeoStoreEnv = NativeAuthEnv & { DB: D1Database };

const RUNTIME = 'cloudflare-native-d1-seo-store';
const MAX_REDIRECTS = 500;
const MAX_SITEMAP_ITEMS = 5000;
const ALLOWED_STATUS_CODES = new Set([301, 302, 307, 308]);

function json(data: unknown, status = 200): Response {
  return Response.json(
    { success: true, data },
    { status, headers: { 'x-jiffoo-runtime': RUNTIME, 'cache-control': 'no-store' } },
  );
}

function fail(code: string, message: string, status: number): Response {
  return Response.json(
    { success: false, error: { code, message } },
    { status, headers: { 'x-jiffoo-runtime': RUNTIME, 'cache-control': 'no-store' } },
  );
}

// Snapshot timestamps look like "2026-08-24 10:13:56" (UTC, space-separated)
// — same normalization as admin-products.ts toIsoTimestamp.
function toIsoTimestamp(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const withZone = /[zZ]|[+-]\d{2}:\d{2}$/.test(normalized) ? normalized : `${normalized}Z`;
  return Number.isNaN(Date.parse(withZone)) ? undefined : withZone;
}

interface SnapshotProduct {
  id?: unknown;
  isActive?: unknown;
  sourceUpdatedAt?: unknown;
}

// The native catalog is the deployed snapshot of /api/v1/products, kept
// fresh by snapshot import / Odoo catalog sync.
async function loadCatalogItems(db: D1Database): Promise<SnapshotProduct[]> {
  const row = await db.prepare(
    "SELECT payload FROM core_api_snapshots WHERE request_path = '/api/v1/products' LIMIT 1",
  ).first<{ payload: string }>();
  if (!row?.payload) return [];
  try {
    const envelope = JSON.parse(row.payload) as { data?: unknown };
    const data = envelope?.data;
    if (Array.isArray(data)) return data as SnapshotProduct[];
    const items = (data as { items?: unknown } | null)?.items;
    return Array.isArray(items) ? items as SnapshotProduct[] : [];
  } catch {
    return [];
  }
}

async function listRedirects(env: SeoStoreEnv, url: URL): Promise<Response> {
  const rawLimit = Number(url.searchParams.get('limit'));
  const limit = Number.isInteger(rawLimit) && rawLimit >= 1
    ? Math.min(rawLimit, MAX_REDIRECTS)
    : MAX_REDIRECTS;
  const rows = await env.DB.prepare(
    `SELECT from_path, to_path, status_code FROM native_seo_redirects
     WHERE is_active = 1 ORDER BY from_path LIMIT ?1`,
  ).bind(limit).all<{ from_path: string; to_path: string; status_code: number }>();
  const items = (rows.results ?? [])
    .filter((row) => ALLOWED_STATUS_CODES.has(row.status_code))
    .map((row) => ({
      fromPath: row.from_path,
      toPath: row.to_path,
      statusCode: row.status_code,
    }));
  return json({ items });
}

async function resolveRedirect(env: SeoStoreEnv, url: URL): Promise<Response> {
  const path = url.searchParams.get('path');
  if (!path || !path.startsWith('/') || path.length > 2000) {
    return fail('BAD_REQUEST', 'path must start with /', 400);
  }
  const row = await env.DB.prepare(
    `SELECT id, from_path, to_path, status_code FROM native_seo_redirects
     WHERE from_path = ?1 AND is_active = 1 LIMIT 1`,
  ).bind(path).first<{
    id: string; from_path: string; to_path: string; status_code: number;
  }>();
  if (!row) return json({ match: false });
  try {
    await env.DB.prepare(
      'UPDATE native_seo_redirects SET hit_count = hit_count + 1 WHERE id = ?1',
    ).bind(row.id).run();
  } catch {
    // Hit accounting must never fail the resolution.
  }
  return json({
    match: true,
    fromPath: row.from_path,
    toPath: row.to_path,
    statusCode: row.status_code,
  });
}

async function sitemapItems(env: SeoStoreEnv): Promise<Response> {
  const catalog = await loadCatalogItems(env.DB);
  const items: Array<{ id: string; lastmod?: string }> = [];
  for (const item of catalog) {
    if (typeof item.id !== 'string' || item.id.length === 0) continue;
    if (item.isActive === false) continue;
    const entry: { id: string; lastmod?: string } = { id: item.id };
    const lastmod = toIsoTimestamp(typeof item.sourceUpdatedAt === 'string' ? item.sourceUpdatedAt : undefined);
    if (lastmod) entry.lastmod = lastmod;
    items.push(entry);
    if (items.length >= MAX_SITEMAP_ITEMS) break;
  }
  // Truncated means the response hit the cap (set is partial relative to
  // the real catalog), not that inactive rows were filtered out.
  return json({ items, truncated: items.length >= MAX_SITEMAP_ITEMS });
}

export async function tryNativeSeoStore(request: Request, env: SeoStoreEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const prefix = '/api/v1/plugins/seo/store';
  if (!url.pathname.startsWith(prefix)) return null;
  if (request.method !== 'GET') {
    return fail('METHOD_NOT_ALLOWED', 'Method not allowed', 405);
  }

  const rest = url.pathname.slice(prefix.length);
  try {
    if (rest === '/redirects') return await listRedirects(env, url);
    if (rest === '/redirects/resolve') return await resolveRedirect(env, url);
    if (rest === '/sitemap') return await sitemapItems(env);
    return null;
  } catch (error) {
    return fail('INTERNAL_SERVER_ERROR', error instanceof Error ? error.message : 'SEO store operation failed', 500);
  }
}
