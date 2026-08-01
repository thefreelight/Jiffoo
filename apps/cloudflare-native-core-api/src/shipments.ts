import { authenticateNativeUser, type NativeAuthEnv } from './auth';

export interface ShipmentRow {
  id: string;
  order_id: string;
  carrier: string;
  carrier_code: string | null;
  carrier_name: string | null;
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
    carrierCode: row.carrier_code,
    carrierName: row.carrier_name ?? row.carrier,
    carrier: row.carrier_name ?? row.carrier,
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

const shipmentStatuses = new Set([
  'PENDING', 'READY_TO_SHIP', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY',
  'DELIVERED', 'EXCEPTION', 'CANCELLED',
]);

export function normalizeShipmentStatus(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase().replaceAll('-', '_').replaceAll(' ', '_') : '';
  if (normalized === 'FAILED' || normalized === 'ERROR') return 'EXCEPTION';
  return shipmentStatuses.has(normalized) ? normalized : 'PENDING';
}

const shipmentRank: Record<string, number> = {
  PENDING: 0,
  READY_TO_SHIP: 1,
  SHIPPED: 2,
  IN_TRANSIT: 3,
  OUT_FOR_DELIVERY: 4,
  DELIVERED: 5,
};

function nextShipmentStatus(current: string | null | undefined, incoming: string): string {
  if (!current || current === incoming) return incoming;
  if (current === 'DELIVERED') return current;
  if (incoming === 'EXCEPTION') return current === 'CANCELLED' ? current : incoming;
  if (incoming === 'CANCELLED') return (shipmentRank[current] ?? 0) < shipmentRank.SHIPPED! ? incoming : current;
  if (current === 'EXCEPTION') return incoming;
  return (shipmentRank[incoming] ?? 0) >= (shipmentRank[current] ?? 0) ? incoming : current;
}

export interface SupplierShipmentInput {
  orderId: string;
  shipmentId?: string | null;
  carrierCode?: string | null;
  carrierName?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  status?: string | null;
  shippedAt?: string | null;
  estimatedDeliveryAt?: string | null;
  lastCheckedAt?: string | null;
  events?: Array<Record<string, unknown>> | null;
}

export async function upsertSupplierShipment(db: D1Database, input: SupplierShipmentInput) {
  const trackingNumber = input.trackingNumber?.trim() || input.shipmentId?.trim();
  if (!trackingNumber) return null;
  const now = new Date().toISOString();
  const incomingStatus = normalizeShipmentStatus(input.status);
  const existing = await db.prepare(
    'SELECT * FROM native_shipments WHERE order_id = ?1 AND tracking_number = ?2',
  ).bind(input.orderId, trackingNumber).first<ShipmentRow>();
  const carrierCode = input.carrierCode?.trim() || existing?.carrier_code || null;
  const carrierName = input.carrierName?.trim() || existing?.carrier_name || null;
  const carrier = carrierName || carrierCode || existing?.carrier || 'Unknown carrier';
  const status = nextShipmentStatus(existing?.status, incomingStatus);
  const id = existing?.id ?? input.shipmentId?.trim() ?? crypto.randomUUID();
  const shippedAt = input.shippedAt?.trim() || existing?.shipped_at || (['SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(status) ? now : null);
  const deliveredAt = status === 'DELIVERED' ? input.lastCheckedAt?.trim() || now : existing?.delivered_at || null;
  const lastCheckedAt = input.lastCheckedAt?.trim() || now;
  await db.prepare(
    `INSERT INTO native_shipments
      (id, order_id, carrier, carrier_code, carrier_name, tracking_number, tracking_url, status,
       shipped_at, delivered_at, estimated_delivery_at, last_checked_at, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?13)
     ON CONFLICT(order_id, tracking_number) DO UPDATE SET carrier = excluded.carrier,
       carrier_code = COALESCE(excluded.carrier_code, native_shipments.carrier_code),
       carrier_name = COALESCE(excluded.carrier_name, native_shipments.carrier_name),
       tracking_url = excluded.tracking_url, status = excluded.status,
       shipped_at = COALESCE(excluded.shipped_at, native_shipments.shipped_at),
       delivered_at = COALESCE(excluded.delivered_at, native_shipments.delivered_at),
       estimated_delivery_at = COALESCE(excluded.estimated_delivery_at, native_shipments.estimated_delivery_at),
       last_checked_at = excluded.last_checked_at, updated_at = excluded.updated_at`,
  ).bind(id, input.orderId, carrier, carrierCode, carrierName, trackingNumber, input.trackingUrl?.trim() || null, status, shippedAt, deliveredAt, input.estimatedDeliveryAt?.trim() || null, lastCheckedAt, now).run();
  if (!existing || existing.status !== status) {
    await db.prepare(
      `INSERT INTO native_shipment_events (id, shipment_id, status, description, occurred_at, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    ).bind(crypto.randomUUID(), id, status, null, lastCheckedAt, now).run();
  }
  for (const event of input.events ?? []) {
    const eventStatus = normalizeShipmentStatus(event.status);
    const occurredAt = typeof event.occurredAt === 'string' ? event.occurredAt : typeof event.timestamp === 'string' ? event.timestamp : lastCheckedAt;
    const description = typeof event.description === 'string' ? event.description.slice(0, 1000) : null;
    const duplicate = await db.prepare(
      'SELECT id FROM native_shipment_events WHERE shipment_id = ?1 AND status = ?2 AND occurred_at = ?3',
    ).bind(id, eventStatus, occurredAt).first<{ id: string }>();
    if (duplicate) {
      if (description) await db.prepare(
        'UPDATE native_shipment_events SET description = COALESCE(description, ?1) WHERE id = ?2',
      ).bind(description, duplicate.id).run();
    } else await db.prepare(
      `INSERT INTO native_shipment_events (id, shipment_id, status, description, occurred_at, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    ).bind(crypto.randomUUID(), id, eventStatus, description, occurredAt, now).run();
  }
  return id;
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
