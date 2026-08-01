import { authenticateNativeAdmin, type NativeAuthEnv } from './auth';

type ProductEnv = NativeAuthEnv & { DB: D1Database };

function emptyPage(page: number, limit: number) {
  return { items: [], page, limit, total: 0, totalPages: 0 };
}

export async function tryNativeAdminProducts(request: Request, env: ProductEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method !== 'GET' || !/^\/api\/v1\/admin\/products(?:\/stats)?\/?$/.test(url.pathname)) return null;
  if (!await authenticateNativeAdmin(request, env)) {
    return Response.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Administrator authentication is required' } }, { status: 401 });
  }
  if (/\/stats\/?$/.test(url.pathname)) {
    return Response.json({ success: true, data: { metrics: {
      totalProducts: 0, activeProducts: 0, lowStockProducts: 0, outOfStockProducts: 0,
      totalProductsTrend: 0, activeProductsTrend: 0, lowStockProductsTrend: 0, outOfStockProductsTrend: 0,
    } } }, { headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-products' } });
  }
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 10) || 10));
  return Response.json({ success: true, data: emptyPage(page, limit) }, {
    headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-products' },
  });
}
