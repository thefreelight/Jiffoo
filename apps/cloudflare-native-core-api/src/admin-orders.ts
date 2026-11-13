import { type NativeAuthEnv } from './auth';
import { ADMIN_PERMISSIONS } from './native-rbac';
import { requireAdminPermission } from './admin-access';
import { attachShipments, upsertSupplierShipment } from './shipments';

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

// The admin order page renders shippingAddress.recipientName/street/zipCode,
// but the checkout payload stores name/line1/postalCode. Alias the display
// names on the response (payload keeps the checkout shape on disk).
// Admin list/detail projection: the page renders per-order item chips, so
// expose the count plus a small summary instead of demo placeholders.
function applyItemsSummary(order: AdminOrder): void {
  const items = Array.isArray(order.items) ? order.items as Array<Record<string, unknown>> : [];
  order.itemsCount = items.length;
  order.itemsSummary = items.slice(0, 3).map((item) => ({
    name: typeof item.productName === 'string' ? item.productName : null,
    quantity: Number(item.quantity ?? 1) || 1,
  }));
}

function applyShippingAddressDisplay(order: AdminOrder): void {
  const addr = order.shippingAddress;
  if (!addr || typeof addr !== 'object' || Array.isArray(addr)) return;
  const source = addr as Record<string, unknown>;
  order.shippingAddress = {
    ...source,
    recipientName: source.recipientName ?? source.name,
    street: source.street ?? source.line1,
    street2: source.street2 ?? source.line2,
    zipCode: source.zipCode ?? source.postalCode,
  };
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
  const isShipPost = /^\/api\/v1\/admin\/orders\/[^/]+\/ship$/.test(url.pathname) && request.method === 'POST';
  if (request.method !== 'GET' && !isShipPost) return null;
  if (!/^\/api\/v1\/admin\/orders(?:\/[^/]+(?:\/ship)?)?$/.test(url.pathname)) return null;
  const gate = await requireAdminPermission(request, env, ADMIN_PERMISSIONS.ORDERS_READ);
  if (!gate.ok) return gate.response;
  const admin = gate.admin;
  const detail = url.pathname.match(/^\/api\/v1\/admin\/orders\/([^/]+)$/);
  if (detail) {
    const row = await env.DB.prepare('SELECT payload FROM native_order_snapshots WHERE id = ?1')
      .bind(detail[1]).first<{ payload: string }>();
    if (!row) {
      return Response.json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } }, { status: 404, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-orders' } });
    }
    const order = await attachCustomer(env.DB, await attachShipments(env.DB, JSON.parse(row.payload) as AdminOrder));
    applyShippingAddressDisplay(order);
    applyItemsSummary(order);
    return response(order);
  }

  // Admin manual fulfilment: record a carrier + tracking shipment, advance
  // the order to SHIPPED, and notify the customer. Provider-based label
  // creation (kuaidi100/4PX) plugs into the same shipments table later.
  const shipMatch = url.pathname.match(/^\/api\/v1\/admin\/orders\/([^/]+)\/ship$/);
  if (shipMatch && request.method === 'POST') {
    const orderId = decodeURIComponent(shipMatch[1]);
    const body = await request.json<Record<string, unknown>>().catch(() => null);
    const trackingNumber = typeof body?.trackingNumber === 'string' ? body.trackingNumber.trim() : '';
    const carrier = typeof body?.carrier === 'string' ? body.carrier.trim() : '';
    if (!trackingNumber || !carrier) {
      return Response.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'carrier and trackingNumber are required' } }, { status: 400, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-orders' } });
    }
    const row = await env.DB.prepare('SELECT payload, user_id FROM native_order_snapshots WHERE id = ?1').bind(orderId).first<{ payload: string; user_id: string }>();
    if (!row) {
      return Response.json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } }, { status: 404, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-orders' } });
    }
    const order = JSON.parse(row.payload) as Record<string, unknown>;
    if (String(order.status) === 'CANCELLED') {
      return Response.json({ success: false, error: { code: 'ORDER_CANCELLED', message: 'Cancelled orders cannot be shipped' } }, { status: 409, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-orders' } });
    }
    // Default the scope from the delivery country when the caller omits it.
    const shipTo = order.shippingAddress as Record<string, unknown> | null | undefined;
    const country = shipTo && typeof shipTo === 'object' ? String((shipTo as Record<string, unknown>).country ?? '') : '';
    const scope = body?.scope === 'international' || body?.scope === 'domestic'
      ? String(body?.scope)
      : country.toUpperCase() === 'CN' ? 'domestic' : 'international';
    const created = await upsertSupplierShipment(env.DB, {
      orderId,
      carrierName: carrier,
      carrierCode: typeof body?.carrierCode === 'string' && body.carrierCode.trim() ? body.carrierCode.trim() : scope,
      trackingNumber,
      trackingUrl: typeof body?.trackingUrl === 'string' && body.trackingUrl.trim() ? body.trackingUrl.trim() : null,
      status: 'SHIPPED',
    });
    if (!created) {
      return Response.json({ success: false, error: { code: 'SHIPMENT_FAILED', message: 'Shipment could not be recorded' } }, { status: 500, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-orders' } });
    }
    const now = new Date().toISOString();
    Object.assign(order, { status: 'SHIPPED', updatedAt: now });
    const trackingUrl = typeof body?.trackingUrl === 'string' && body.trackingUrl.trim() ? body.trackingUrl.trim() : null;
    await env.DB.batch([
      env.DB.prepare('UPDATE native_order_snapshots SET status = ?, payload = ?, source_updated_at = ? WHERE id = ?')
        .bind('SHIPPED', JSON.stringify(order), now, orderId),
      env.DB.prepare(
        `INSERT INTO native_bokmoo_notifications (id, user_id, type, title, body, metadata_json, created_at)
         VALUES (?1, ?2, 'order', ?3, ?4, ?5, ?6)`,
      ).bind(
        crypto.randomUUID(),
        row.user_id,
        'Order shipped',
        `Order ${orderId} has shipped via ${carrier}. Tracking: ${trackingNumber}${trackingUrl ? ` (${trackingUrl})` : ''}`,
        JSON.stringify({ orderId, trackingNumber, carrier, scope, provider: 'manual' }),
        now,
      ),
    ]);
    const refreshed = await attachCustomer(env.DB, await attachShipments(env.DB, order));
    applyShippingAddressDisplay(refreshed);
    applyItemsSummary(refreshed);
    return response(refreshed);
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
  items.forEach(applyItemsSummary);
  await attachCustomers(env.DB, items);
  return response({ items, page, limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / limit) });
}
