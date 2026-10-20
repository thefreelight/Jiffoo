import { authenticateNativeAdmin, type NativeAuthEnv } from './auth';
import { attachShipments } from './shipments';

interface AdminOrderEnv extends NativeAuthEnv { DB: D1Database }
interface AdminOrderRow { id: string; status: string; payload: string; source_updated_at: string }
interface AdminCustomerRow { id: string; email: string; username: string | null; avatar: string | null }
type ProxyRequest = (request: Request) => Promise<Response>;
type AdminOrder = Record<string, unknown>;

function response(data: unknown): Response {
  return Response.json({ success: true, data }, { headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-orders' } });
}

function integer(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function applyCustomer(order: AdminOrder, user: AdminCustomerRow | null): void {
  if (order.customer && typeof order.customer === 'object') return;
  const payloadEmail = typeof order.customerEmail === 'string' ? order.customerEmail : null;
  order.customer = {
    id: user?.id ?? (typeof order.userId === 'string' ? order.userId : null),
    email: user?.email ?? payloadEmail,
    username: user?.username ?? null,
    ...(user?.avatar ? { avatar: user.avatar } : {}),
  };
}

// Native checkout payloads carry only a top-level customerEmail; the admin
// console (and the upstream API it mirrors) expects a nested customer object.
async function attachCustomer(db: D1Database, order: AdminOrder): Promise<AdminOrder> {
  if (order.customer && typeof order.customer === 'object') return order;
  const userId = typeof order.userId === 'string' ? order.userId : null;
  const user = userId
    ? await db.prepare('SELECT id, email, username, avatar FROM native_users WHERE id = ?1').bind(userId).first<AdminCustomerRow>()
    : null;
  applyCustomer(order, user ?? null);
  return order;
}

async function attachCustomers(db: D1Database, orders: AdminOrder[]): Promise<void> {
  const pending = orders.filter((order) => !(order.customer && typeof order.customer === 'object'));
  const ids = Array.from(new Set(
    pending
      .map((order) => (typeof order.userId === 'string' ? order.userId : null))
      .filter((userId): userId is string => userId !== null),
  ));
  const byId = new Map<string, AdminCustomerRow>();
  if (ids.length > 0) {
    const placeholders = ids.map((_, index) => `?${index + 1}`).join(',');
    const rows = await db.prepare(
      `SELECT id, email, username, avatar FROM native_users WHERE id IN (${placeholders})`,
    ).bind(...ids).all<AdminCustomerRow>();
    for (const row of rows.results) byId.set(row.id, row);
  }
  for (const order of pending) {
    const userId = typeof order.userId === 'string' ? order.userId : null;
    applyCustomer(order, userId ? byId.get(userId) ?? null : null);
  }
}

export async function tryNativeAdminOrders(request: Request, env: AdminOrderEnv, _proxy: ProxyRequest): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method !== 'GET' || !/^\/api\/v1\/admin\/orders(?:\/[^/]+)?$/.test(url.pathname)) return null;
  const admin = await authenticateNativeAdmin(request, env);
  if (!admin) {
    return Response.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Administrator authentication is required' } }, {
      status: 401,
      headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-orders' },
    });
  }
  const detail = url.pathname.match(/^\/api\/v1\/admin\/orders\/([^/]+)$/);
  if (detail) {
    const row = await env.DB.prepare('SELECT payload FROM native_order_snapshots WHERE id = ?1')
      .bind(detail[1]).first<{ payload: string }>();
    if (!row) {
      return Response.json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } }, { status: 404, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-orders' } });
    }
    const order = await attachCustomer(env.DB, await attachShipments(env.DB, JSON.parse(row.payload) as AdminOrder));
    return response(order);
  }
  const page = integer(url.searchParams.get('page'), 1, 1_000_000);
  const limit = integer(url.searchParams.get('limit'), 10, 100);
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('search')?.trim().toLowerCase();
  const clauses = ['1 = 1'];
  const bindings: Array<string | number> = [];
  if (status) { bindings.push(status); clauses.push(`status = ?${bindings.length}`); }
  if (search) { bindings.push(`%${search}%`); clauses.push(`searchable_text LIKE ?${bindings.length}`); }
  const where = clauses.join(' AND ');
  const totalRow = await env.DB.prepare(`SELECT COUNT(*) AS total FROM native_order_snapshots WHERE ${where}`).bind(...bindings).first<{ total: number }>();
  const total = totalRow?.total ?? 0;
  const rows = await env.DB.prepare(
    `SELECT id, status, payload, source_updated_at FROM native_order_snapshots
     WHERE ${where} ORDER BY source_updated_at DESC LIMIT ?${bindings.length + 1} OFFSET ?${bindings.length + 2}`,
  ).bind(...bindings, limit, (page - 1) * limit).all<AdminOrderRow>();
  const items = await Promise.all(rows.results.map((row) => attachShipments(env.DB, JSON.parse(row.payload) as AdminOrder)));
  await attachCustomers(env.DB, items);
  return response({ items, page, limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / limit) });
}
