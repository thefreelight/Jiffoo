import { authenticateNativeAdmin, type NativeAuthEnv } from './auth';

type DashboardEnv = NativeAuthEnv & { DB: D1Database };

export async function tryNativeAdminDashboard(request: Request, env: DashboardEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.pathname !== '/api/v1/admin/dashboard') return null;
  if (!await authenticateNativeAdmin(request, env)) {
    return Response.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Administrator authentication is required' } }, { status: 401 });
  }

  const [users, orders, products] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS count FROM native_users WHERE role = 'USER'").first<{ count: number }>(),
    env.DB.prepare('SELECT COUNT(*) AS count FROM native_order_snapshots').first<{ count: number }>(),
    env.DB.prepare("SELECT payload FROM core_api_snapshots WHERE request_path = '/api/v1/products' LIMIT 1").first<{ payload: string }>(),
  ]);
  let productCount = 0;
  if (products?.payload) {
    try {
      const envelope = JSON.parse(products.payload) as { data?: unknown[] | { items?: unknown[] } };
      productCount = Array.isArray(envelope.data) ? envelope.data.length : Array.isArray(envelope.data?.items) ? envelope.data.items.length : 0;
    } catch { productCount = 0; }
  }
  const recent = await env.DB.prepare('SELECT payload FROM native_order_snapshots ORDER BY source_updated_at DESC LIMIT 5').all<{ payload: string }>();
  return Response.json({ success: true, data: {
    metrics: {
      totalRevenue: 0, totalOrders: Number(orders?.count ?? 0), totalProducts: productCount,
      totalUsers: Number(users?.count ?? 0), currency: 'USD', totalRevenueTrend: 0,
      totalOrdersTrend: 0, totalProductsTrend: 0, totalUsersTrend: 0,
    },
    ordersByStatus: {},
    recentOrders: recent.results.flatMap((row) => { try { return [JSON.parse(row.payload)]; } catch { return []; } }),
  } }, { headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-dashboard' } });
}
