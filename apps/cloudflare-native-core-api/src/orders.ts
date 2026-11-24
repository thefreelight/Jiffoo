import { authenticateNativeUser, type NativeAuthEnv } from './auth';
import { attachOrderNumbers, type OrderNumberEnv } from './order-numbers';
import { attachShipments } from './shipments';

type NativeOrderEnv = NativeAuthEnv & OrderNumberEnv;

interface OrderRow {
  id: string;
  status: string;
  payload: string;
  source_updated_at: string;
  order_number: string | null;
  imported_at: string;
}

type ProxyRequest = (request: Request) => Promise<Response>;

function nativeResponse(data: unknown): Response {
  return Response.json({ success: true, data }, {
    headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-orders' },
  });
}

function integerParam(value: string | null, fallback: number, maximum: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

export async function tryNativeOrderRead(
  request: Request,
  env: NativeOrderEnv,
  _proxyRequest: ProxyRequest,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method !== 'GET' || !/^\/api\/v1\/orders(?:\/[^/]+)?$/.test(url.pathname)) return null;
  const user = await authenticateNativeUser(request, env);
  if (!user) {
    return Response.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication is required' } }, {
      status: 401,
      headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-orders' },
    });
  }

  const detail = url.pathname.match(/^\/api\/v1\/orders\/([^/]+)$/);
  if (detail) {
    const row = await env.DB.prepare(
      'SELECT id, payload, order_number, imported_at FROM native_order_snapshots WHERE id = ?1 AND user_id = ?2',
    ).bind(detail[1], user.id).first<OrderRow>();
    if (!row) {
      return Response.json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } }, {
        status: 404,
        headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-orders' },
      });
    }
    const order = JSON.parse(row.payload) as Record<string, unknown>;
    await attachOrderNumbers(env, [row], [order]);
    return nativeResponse(await attachShipments(env.DB, order));
  }

  const page = integerParam(url.searchParams.get('page'), 1, 1_000_000);
  const limit = integerParam(url.searchParams.get('limit'), 10, 100);
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('search')?.trim().toLowerCase();
  const clauses = ['user_id = ?1'];
  const bindings: Array<string | number> = [user.id];
  if (status) {
    bindings.push(status);
    clauses.push(`status = ?${bindings.length}`);
  }
  if (search) {
    bindings.push(`%${search}%`);
    clauses.push(`searchable_text LIKE ?${bindings.length}`);
  }
  const where = clauses.join(' AND ');
  const totalRow = await env.DB.prepare(`SELECT COUNT(*) AS total FROM native_order_snapshots WHERE ${where}`)
    .bind(...bindings).first<{ total: number }>();
  const total = totalRow?.total ?? 0;
  bindings.push(limit, (page - 1) * limit);
  const rows = await env.DB.prepare(
    `SELECT id, status, payload, source_updated_at, order_number, imported_at FROM native_order_snapshots
     WHERE ${where} ORDER BY json_extract(payload, '$.createdAt') DESC LIMIT ?${bindings.length - 1} OFFSET ?${bindings.length}`,
  ).bind(...bindings).all<OrderRow>();
  const orders = rows.results.map((row) => JSON.parse(row.payload) as Record<string, unknown>);
  await attachOrderNumbers(env, rows.results, orders);
  return nativeResponse({
    items: await Promise.all(orders.map((order) => attachShipments(env.DB, order))),
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  });
}
