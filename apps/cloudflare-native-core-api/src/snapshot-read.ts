import { localizeBossProduct } from './boss-upstream';
import { applyProductCopyOverrides, loadProductCopyOverrides, productCopyPathKind } from './product-copy';
import { snapshotFallbackKey, snapshotKey } from './snapshot-key';

interface SnapshotEnv {
  DB: D1Database;
}

export interface Snapshot {
  payload: string;
  status_code: number;
  content_type: string;
}

// Reads are D1-snapshot-authoritative: an exact path+query key first, then
// the canonical fallback for product lists and product detail.
export async function readSnapshot(url: URL, env: SnapshotEnv): Promise<Snapshot | null> {
  const key = snapshotKey(url);
  const exact = await env.DB.prepare(
    'SELECT payload, status_code, content_type FROM core_api_snapshots WHERE cache_key = ?1',
  ).bind(key).first<Snapshot>();
  if (exact) return exact;

  const fallbackKey = snapshotFallbackKey(url);
  if (!fallbackKey) return null;
  const fallback = await env.DB.prepare(
    'SELECT payload, status_code, content_type FROM core_api_snapshots WHERE cache_key = ?1',
  ).bind(fallbackKey).first<Snapshot>();
  return fallback ?? null;
}

// Storefront copy overrides (admin-edited product descriptions) apply to the
// served snapshot payload; the sync snapshot itself stays untouched. BOSS
// plan descriptions also follow the requested storefront locale, because the
// snapshot stores a single (Chinese) copy per product.
export async function readSnapshotWithProductCopy(url: URL, env: SnapshotEnv): Promise<Snapshot | null> {
  const snapshot = await readSnapshot(url, env);
  if (!snapshot || snapshot.status_code !== 200) return snapshot;
  if (productCopyPathKind(url.pathname) === null) return snapshot;
  const locale = url.searchParams.get('locale') || undefined;
  try {
    const overrides = await loadProductCopyOverrides(env.DB);
    if (overrides.size === 0 && !locale) return snapshot;
    return {
      ...snapshot,
      payload: applyProductCopyOverrides(snapshot.payload, overrides, (item) => localizeBossProduct(item, locale)),
    };
  } catch {
    return snapshot;
  }
}
