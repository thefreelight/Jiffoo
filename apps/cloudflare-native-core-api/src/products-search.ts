// Dynamic product search over the imported catalog snapshot.
//
// The native core keeps public catalog reads D1-authoritative through
// core_api_snapshots, which cannot answer arbitrary text queries (a snapshot
// key is a full path+query). Search therefore filters the canonical imported
// list snapshot in memory: the store imports its full catalog at
// `/api/v1/products`, and this adapter narrows that catalog to the requested
// query without reintroducing a fallback origin.

interface ProductsSearchEnv {
  DB: D1Database;
}

interface SnapshotRow {
  payload: string;
  status_code: number;
  content_type: string;
}

interface SearchableProduct {
  name?: string;
  description?: string;
  category?: { name?: string } | null;
  tags?: string[];
  price?: number;
  rating?: number;
  createdAt?: string;
}

interface CatalogEnvelope {
  data?: { items?: SearchableProduct[] };
}

const CATALOG_SNAPSHOT_KEY = 'core:snapshot:/api/v1/products';
const SEARCH_RUNTIME = 'cloudflare-native-d1-products-search';

export function matchesQuery(product: SearchableProduct, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const haystack = [
    product.name,
    product.description,
    product.category?.name,
    ...(Array.isArray(product.tags) ? product.tags : []),
  ]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' ')
    .toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

function compareProducts(
  a: SearchableProduct,
  b: SearchableProduct,
  sortBy: string,
  direction: 1 | -1,
): number {
  if (sortBy === 'price') {
    return ((a.price ?? 0) - (b.price ?? 0)) * direction;
  }
  if (sortBy === 'rating') {
    return ((a.rating ?? 0) - (b.rating ?? 0)) * direction;
  }
  if (sortBy === 'name') {
    return (a.name ?? '').localeCompare(b.name ?? '') * direction;
  }
  const aTime = Date.parse(a.createdAt ?? '') || 0;
  const bTime = Date.parse(b.createdAt ?? '') || 0;
  return (aTime - bTime) * direction;
}

function snapshotUnavailable(): Response {
  return Response.json({
    success: false,
    error: {
      code: 'NATIVE_SNAPSHOT_UNAVAILABLE',
      message: 'Product search is not available until the catalog list snapshot has been imported',
      details: { path: '/api/v1/products' },
    },
  }, {
    status: 503,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'retry-after': '60',
      'x-jiffoo-runtime': SEARCH_RUNTIME,
    },
  });
}

export async function tryNativeProductsSearch(
  request: Request,
  env: ProductsSearchEnv,
): Promise<Response | null> {
  if (request.method !== 'GET') return null;
  const url = new URL(request.url);
  const isDedicated = url.pathname === '/api/v1/products/search';
  const searchTerm = (url.searchParams.get('q') ?? url.searchParams.get('search') ?? '').trim();
  if (!isDedicated && !(url.pathname === '/api/v1/products' && searchTerm)) return null;

  const row = await env.DB.prepare(
    'SELECT payload, status_code, content_type FROM core_api_snapshots WHERE cache_key = ?1',
  ).bind(CATALOG_SNAPSHOT_KEY).first<SnapshotRow>();
  if (!row || row.status_code !== 200) return snapshotUnavailable();

  let items: SearchableProduct[];
  try {
    const envelope = JSON.parse(row.payload) as CatalogEnvelope;
    items = Array.isArray(envelope.data?.items) ? envelope.data.items : [];
  } catch {
    return snapshotUnavailable();
  }

  const tokens = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = items.filter((product) => matchesQuery(product, tokens));

  const sortBy = url.searchParams.get('sortBy') ?? 'createdAt';
  const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 1 : -1;
  filtered.sort((a, b) => compareProducts(a, b, sortBy, sortOrder));

  const page = Math.max(Number(url.searchParams.get('page')) || 1, 1);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 12, 1), 100);
  const total = filtered.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;

  return Response.json({
    success: true,
    data: {
      items: filtered.slice(start, start + limit),
      page,
      limit,
      total,
      totalPages,
    },
  }, {
    headers: {
      'cache-control': 'public, max-age=30, stale-while-revalidate=120',
      'x-jiffoo-runtime': SEARCH_RUNTIME,
    },
  });
}
