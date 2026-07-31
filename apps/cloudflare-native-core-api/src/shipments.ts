import { authenticateNativeUser, type NativeAuthEnv } from './auth';

export interface ShipmentRow {
  id: string;
  order_id: string;
  carrier: string;
  tracking_number: string;
  tracking_url: string | null;
  status: string;
  shipped_at: string | null;
  delivered_at: string | null;
  estimated_delivery_at: string | null;
  last_checked_at: string | null;
}

export function mapShipment(row: ShipmentRow, events: Array<Record<string, unknown>> = []) {
  return {
    id: row.id,
    carrier: row.carrier,
    trackingNumber: row.tracking_number,
    trackingUrl: row.tracking_url,
    status: row.status,
    shippedAt: row.shipped_at,
    deliveredAt: row.delivered_at,
    estimatedDeliveryAt: row.estimated_delivery_at,
    lastCheckedAt: row.last_checked_at,
    events,
  };
}

export async function shipmentsForOrder(db: D1Database, orderId: string) {
  const rows = await db.prepare(
    'SELECT * FROM native_shipments WHERE order_id = ?1 ORDER BY created_at DESC',
  ).bind(orderId).all<ShipmentRow>();
  const result = [];
  for (const row of rows.results) {
    const events = await db.prepare(
      `SELECT status, description, occurred_at AS occurredAt
       FROM native_shipment_events WHERE shipment_id = ?1 ORDER BY occurred_at DESC`,
    ).bind(row.id).all<Record<string, unknown>>();
    result.push(mapShipment(row, events.results));
  }
  return result;
}

export async function attachShipments(db: D1Database, order: Record<string, unknown>) {
  const orderId = typeof order.id === 'string' ? order.id : null;
  if (orderId) order.shipments = await shipmentsForOrder(db, orderId);
  return order;
}

interface ShipmentEnv extends NativeAuthEnv { DB: D1Database }

export async function tryNativeShipmentRead(request: Request, env: ShipmentEnv): Promise<Response | null> {
  const match = new URL(request.url).pathname.match(/^\/api\/v1\/shipping\/tracking\/([^/]+)$/);
  if (request.method !== 'GET' || !match) return null;
  const user = await authenticateNativeUser(request, env);
  if (!user) return Response.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication is required' } }, { status: 401, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-shipping' } });
  const owned = await env.DB.prepare('SELECT id FROM native_order_snapshots WHERE id = ?1 AND user_id = ?2').bind(match[1], user.id).first();
  if (!owned) return Response.json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } }, { status: 404, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-shipping' } });
  return Response.json({ success: true, data: await shipmentsForOrder(env.DB, match[1]!) }, { headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-shipping' } });
}
