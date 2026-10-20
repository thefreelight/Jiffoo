import { authenticateNativeAdmin, type NativeAuthEnv } from './auth';

type ProductEnv = NativeAuthEnv & { DB: D1Database };

const READ_ONLY_MESSAGE = 'Native instances manage the product catalog through deployment pipelines (e.g. Odoo catalog sync). Product mutations from the admin console are not available.';

interface SnapshotVariant {
  id?: string;
  name?: string | null;
  skuCode?: string | null;
  salePrice?: number;
  baseStock?: number;
  isActive?: boolean;
  attributes?: Record<string, unknown> | null;
}

interface SnapshotProduct {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
  productKind?: string;
  requiresShipping?: boolean;
  stock?: number;
  price?: number;
  isActive?: boolean;
  sourceUpdatedAt?: string;
  images?: string[];
  variants?: SnapshotVariant[];
}

// The native catalog is the deployed snapshot of /api/v1/products (kept fresh
// by snapshot import / Odoo catalog sync), so admin reads project that payload
// instead of querying tables that native instances do not maintain.
async function loadCatalogItems(env: ProductEnv): Promise<SnapshotProduct[]> {
  const row = await env.DB.prepare(
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

function toIsoTimestamp(value: string | undefined): string {
  if (!value) return new Date(0).toISOString();
  // Snapshot timestamps look like "2026-08-24 10:13:56" (UTC, space-separated).
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  return /[zZ]|[+-]\d{2}:\d{2}$/.test(normalized) ? normalized : `${normalized}Z`;
}

function primaryVariant(item: SnapshotProduct): SnapshotVariant | null {
  if (!item.variants || item.variants.length === 0) return null;
  return item.variants.find((variant) => variant.isActive) ?? item.variants[0];
}

function searchBlob(item: SnapshotProduct): string {
  const sku = primaryVariant(item)?.skuCode ?? '';
  return `${item.name} ${item.slug ?? ''} ${item.id} ${sku}`.toLowerCase();
}

export async function tryNativeAdminProducts(request: Request, env: ProductEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!/^\/api\/v1\/admin\/products(?:\/|$)/.test(url.pathname)) return null;

  if (request.method !== 'GET') {
    // Writes must not silently fall through to the fallback origin: on native
    // instances that would mutate a different deployment's catalog.
    return Response.json(
      { success: false, error: { code: 'NATIVE_CATALOG_READ_ONLY', message: READ_ONLY_MESSAGE } },
      { status: 501, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-products' } },
    );
  }

  if (!await authenticateNativeAdmin(request, env)) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Administrator authentication is required' } },
      { status: 401, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-products' } },
    );
  }

  const items = await loadCatalogItems(env);

  const statsMatch = url.pathname.match(/^\/api\/v1\/admin\/products\/stats\/?$/);
  if (statsMatch) {
    const threshold = Number(url.searchParams.get('lowStockThreshold') ?? 5) || 5;
    const active = items.filter((item) => item.isActive !== false);
    const stocks = items.map((item) => item.stock ?? 0);
    return Response.json({ success: true, data: { metrics: {
      totalProducts: items.length,
      activeProducts: active.length,
      lowStockProducts: stocks.filter((stock) => stock > 0 && stock <= threshold).length,
      outOfStockProducts: stocks.filter((stock) => stock === 0).length,
      totalProductsTrend: 0, activeProductsTrend: 0, lowStockProductsTrend: 0, outOfStockProductsTrend: 0,
    } } }, { headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-products' } });
  }

  const detailMatch = url.pathname.match(/^\/api\/v1\/admin\/products\/([^/]+)\/?$/);
  if (detailMatch) {
    const productId = decodeURIComponent(detailMatch[1]);
    const detailRow = await env.DB.prepare(
      'SELECT payload FROM core_api_snapshots WHERE request_path = ?1 LIMIT 1',
    ).bind(`/api/v1/products/${productId}`).first<{ payload: string }>();
    let item: SnapshotProduct | null = null;
    if (detailRow?.payload) {
      try {
        const envelope = JSON.parse(detailRow.payload) as { data?: SnapshotProduct };
        if (envelope?.data && typeof envelope.data === 'object') item = envelope.data;
      } catch { item = null; }
    }
    item = item ?? items.find((candidate) => candidate.id === productId) ?? null;
    if (!item) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } },
        { status: 404, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-products' } },
      );
    }
    const updatedAt = toIsoTimestamp(item.sourceUpdatedAt);
    const variant = primaryVariant(item);
    return Response.json({ success: true, data: {
      id: item.id,
      name: item.name,
      description: item.description ?? null,
      requiresShipping: item.requiresShipping,
      skuCode: variant?.skuCode ?? null,
      price: variant?.salePrice ?? item.price ?? null,
      stock: item.stock ?? 0,
      isActive: item.isActive ?? true,
      images: item.images ?? [],
      variants: item.variants ?? [],
      status: item.isActive === false ? 'DRAFT' : 'ACTIVE',
      productKind: item.productKind,
      createdAt: updatedAt,
      updatedAt,
    } }, { headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-products' } });
  }

  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 10) || 10));
  const search = url.searchParams.get('search')?.trim().toLowerCase();
  const productType = url.searchParams.get('productType')?.trim();

  let filtered = items;
  if (search) filtered = filtered.filter((item) => searchBlob(item).includes(search));
  if (productType && productType !== 'all') {
    filtered = filtered.filter((item) => item.productKind === productType);
  }

  const total = filtered.length;
  const start = (page - 1) * limit;
  const listItems = filtered.slice(start, start + limit).map((item) => {
    const variant = primaryVariant(item);
    const updatedAt = toIsoTimestamp(item.sourceUpdatedAt);
    return {
      id: item.id,
      name: item.name,
      description: item.description ?? null,
      skuCode: variant?.skuCode ?? null,
      price: variant?.salePrice ?? item.price ?? null,
      stock: item.stock ?? 0,
      isActive: item.isActive ?? true,
      variantsCount: item.variants?.length ?? 0,
      status: item.isActive === false ? 'DRAFT' : 'ACTIVE',
      createdAt: updatedAt,
      updatedAt,
    };
  });
  return Response.json({ success: true, data: {
    items: listItems, page, limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  } }, { headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-products' } });
}
