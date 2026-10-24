interface CopyEnv {
  DB: D1Database;
}

// Storefront copy overrides live in their own table, deliberately outside the
// Odoo catalog sync: sync keeps refreshing core_api_snapshots, and these rows
// win at read time so operators edit copy in the Jiffoo admin (the shared Odoo
// backend serves several B-ends and must not become a per-store copy editor).

export function productCopyPathKind(pathname: string): 'list' | 'detail' | null {
  if (pathname === '/api/v1/products') return 'list';
  if (/^\/api\/v1\/products\/[^/]+$/.test(pathname)) return 'detail';
  return null;
}

export async function loadProductCopyOverrides(db: CopyEnv['DB']): Promise<Map<string, string>> {
  const { results } = await db.prepare('SELECT product_id, description FROM native_product_copy_overrides').all<{
    product_id: string;
    description: string;
  }>();
  const overrides = new Map<string, string>();
  for (const row of results ?? []) overrides.set(row.product_id, row.description);
  return overrides;
}

// Rewrites a snapshot payload ({"success":true,"data":...}) so overridden
// products carry the admin copy in `description`. Malformed payloads pass
// through untouched — snapshot serving must stay fail-open.
export function applyProductCopyOverrides(payload: string, overrides: Map<string, string>): string {
  if (overrides.size === 0) return payload;
  let envelope: { success?: boolean; data?: unknown };
  try {
    envelope = JSON.parse(payload) as { success?: boolean; data?: unknown };
  } catch {
    return payload;
  }
  const data = envelope?.data;
  if (Array.isArray(data)) {
    envelope.data = data.map((item) => applyToProduct(item, overrides));
    return JSON.stringify(envelope);
  }
  const items = (data as { items?: unknown[] } | null)?.items;
  if (Array.isArray(items)) {
    envelope.data = { ...data, items: items.map((item) => applyToProduct(item, overrides)) };
    return JSON.stringify(envelope);
  }
  envelope.data = applyToProduct(data, overrides);
  return JSON.stringify(envelope);
}

function applyToProduct(item: unknown, overrides: Map<string, string>): unknown {
  if (!item || typeof item !== 'object') return item;
  const product = item as { id?: string; description?: string | null };
  const override = product.id ? overrides.get(product.id) : undefined;
  return override === undefined ? item : { ...product, description: override };
}
