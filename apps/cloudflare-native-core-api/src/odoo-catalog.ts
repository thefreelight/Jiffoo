import { authenticateNativeAdmin, type NativeAuthEnv } from './auth';
import { isNativeOdooCatalogConfigured, readNativeOdooCatalog, type NativeOdooCatalogProduct } from './odoo';

type CatalogEnv = NativeAuthEnv & { DB: D1Database };

const LIST_PATH = '/api/v1/products';
const STATE_KEY = 'odoo';
const AUTO_SYNC_INTERVAL_MS = 15 * 60 * 1000;

type State = { product_ids_json: string; last_synced_at: string | null };

function payload(data: unknown) {
  return JSON.stringify({ success: true, data });
}

function snapshotStatement(env: CatalogEnv, path: string, body: string) {
  return env.DB.prepare(
    `INSERT INTO core_api_snapshots
      (cache_key, request_path, payload, status_code, content_type, source_updated_at, refreshed_at)
     VALUES (?1, ?2, ?3, 200, 'application/json; charset=utf-8', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload, status_code = excluded.status_code,
       content_type = excluded.content_type, source_updated_at = excluded.source_updated_at, refreshed_at = CURRENT_TIMESTAMP`,
  ).bind(`core:snapshot:${path}`, path, body);
}

function productPaths(products: NativeOdooCatalogProduct[]): string[] {
  return products.map((product) => `/api/v1/products/${encodeURIComponent(product.id)}`);
}

export async function syncNativeOdooCatalog(env: CatalogEnv): Promise<{ products: number; variants: number }> {
  const products = await readNativeOdooCatalog(env);
  const nextPaths = productPaths(products);
  const state = await env.DB.prepare(
    'SELECT product_ids_json, last_synced_at FROM native_catalog_sync_state WHERE provider = ?1',
  ).bind(STATE_KEY).first<State>();
  let previousPaths: string[] = [];
  try { previousPaths = state ? JSON.parse(state.product_ids_json) as string[] : []; } catch { previousPaths = []; }
  const stalePaths = previousPaths.filter((path) => !nextPaths.includes(path));
  const list = { items: products, page: 1, limit: products.length, total: products.length };
  const writes = [snapshotStatement(env, LIST_PATH, payload(list))];
  for (const product of products) writes.push(snapshotStatement(env, `/api/v1/products/${encodeURIComponent(product.id)}`, payload(product)));
  for (const path of stalePaths) writes.push(env.DB.prepare('DELETE FROM core_api_snapshots WHERE cache_key = ?1').bind(`core:snapshot:${path}`));
  const now = new Date().toISOString();
  writes.push(env.DB.prepare(
    `INSERT INTO native_catalog_sync_state (provider, product_ids_json, last_synced_at, last_error, updated_at)
     VALUES (?1, ?2, ?3, NULL, ?3)
     ON CONFLICT(provider) DO UPDATE SET product_ids_json = excluded.product_ids_json,
       last_synced_at = excluded.last_synced_at, last_error = NULL, updated_at = excluded.updated_at`,
  ).bind(STATE_KEY, JSON.stringify(nextPaths), now));
  await env.DB.batch(writes);
  return { products: products.length, variants: products.reduce((sum, product) => sum + product.variants.length, 0) };
}

export async function tryNativeOdooCatalogSync(request: Request, env: CatalogEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== '/api/v1/integrations/odoo/catalog/sync' || request.method !== 'POST') return null;
  if (!await authenticateNativeAdmin(request, env)) {
    return Response.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Administrator authentication is required' } }, { status: 401 });
  }
  try {
    const result = await syncNativeOdooCatalog(env);
    return Response.json({ success: true, data: result }, { headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-odoo-catalog' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Odoo catalog sync failed';
    await env.DB.prepare(
      `INSERT INTO native_catalog_sync_state (provider, product_ids_json, last_synced_at, last_error, updated_at)
       VALUES (?1, '[]', NULL, ?2, CURRENT_TIMESTAMP)
       ON CONFLICT(provider) DO UPDATE SET last_error = excluded.last_error, updated_at = CURRENT_TIMESTAMP`,
    ).bind(STATE_KEY, message.slice(0, 1000)).run();
    return Response.json({ success: false, error: { code: 'ODOO_CATALOG_SYNC_FAILED', message } }, { status: 502 });
  }
}

export async function processScheduledOdooCatalogSync(env: CatalogEnv): Promise<{ skipped?: string; products?: number; variants?: number }> {
  if (!await isNativeOdooCatalogConfigured(env)) return { skipped: 'odoo_not_configured' };
  const state = await env.DB.prepare(
    'SELECT last_synced_at FROM native_catalog_sync_state WHERE provider = ?1',
  ).bind(STATE_KEY).first<Pick<State, 'last_synced_at'>>();
  const lastSyncedAt = state?.last_synced_at ? Date.parse(state.last_synced_at) : 0;
  if (Number.isFinite(lastSyncedAt) && Date.now() - lastSyncedAt < AUTO_SYNC_INTERVAL_MS) return { skipped: 'fresh' };
  try { return await syncNativeOdooCatalog(env); }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Odoo catalog sync failed';
    await env.DB.prepare(
      `INSERT INTO native_catalog_sync_state (provider, product_ids_json, last_synced_at, last_error, updated_at)
       VALUES (?1, '[]', NULL, ?2, CURRENT_TIMESTAMP)
       ON CONFLICT(provider) DO UPDATE SET last_error = excluded.last_error, updated_at = CURRENT_TIMESTAMP`,
    ).bind(STATE_KEY, message.slice(0, 1000)).run();
    return { skipped: 'sync_failed' };
  }
}
