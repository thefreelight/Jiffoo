import { authenticateNativeAdmin, type NativeAuthEnv } from './auth';
import { attachShipments } from './shipments';
import { getNativeStripeSecret } from './plugin-settings';

interface AdminWriteEnv extends NativeAuthEnv { DB: D1Database; STRIPE_SECRET_KEY: SecretsStoreSecret }
type Status = 'PENDING' | 'PAID' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
const transitions: Record<Status, readonly Status[]> = {
  PENDING: ['PAID', 'PROCESSING', 'CANCELLED'], PAID: ['PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED'],
  PROCESSING: ['SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED'], SHIPPED: ['DELIVERED', 'COMPLETED', 'REFUNDED'],
  DELIVERED: ['COMPLETED', 'REFUNDED'], COMPLETED: ['REFUNDED'], CANCELLED: [], REFUNDED: [],
};

function result(data: unknown): Response { return Response.json({ success: true, data }, { headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-orders' } }); }
function error(status: number, code: string, message: string): Response { return Response.json({ success: false, error: { code, message } }, { status, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-orders' } }); }

interface NativeOrder { payload: string; status: Status; payment_status: string }
async function loadNativeOrder(env: AdminWriteEnv, orderId: string): Promise<NativeOrder | null> {
  return env.DB.prepare(
    `SELECT snapshots.payload, snapshots.status, metadata.payment_status
     FROM native_order_snapshots snapshots JOIN native_order_metadata metadata ON metadata.order_id = snapshots.id
     WHERE snapshots.id = ?1`,
  ).bind(orderId).first<NativeOrder>();
}

function itemsFrom(order: Record<string, unknown>): Array<Record<string, unknown>> {
  return Array.isArray(order.items) ? order.items as Array<Record<string, unknown>> : [];
}

async function stripePaymentIntent(env: AdminWriteEnv, sessionId: string, storedIntent: string | null): Promise<string | null> {
  if (storedIntent) return storedIntent;
  const secret = (await getNativeStripeSecret(env, 'secretKey', env.STRIPE_SECRET_KEY)).value;
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { authorization: `Bearer ${secret}` },
  });
  if (!response.ok) return null;
  const session = await response.json<{ payment_intent?: string | null }>();
  return session.payment_intent ?? null;
}

async function persist(
  env: AdminWriteEnv,
  adminId: string,
  orderId: string,
  native: NativeOrder,
  order: Record<string, unknown>,
  next: Status,
  action: string,
  auditPayload: Record<string, unknown>,
): Promise<Response> {
  const now = new Date().toISOString();
  Object.assign(order, { status: next, updatedAt: now });
  await env.DB.batch([
    env.DB.prepare('UPDATE native_order_snapshots SET status = ?1, payload = ?2, source_updated_at = ?3 WHERE id = ?4').bind(next, JSON.stringify(order), now, orderId),
    env.DB.prepare('INSERT INTO native_order_audit (id, order_id, actor_id, action, from_status, to_status, payload, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)').bind(crypto.randomUUID(), orderId, adminId, action, native.status, next, JSON.stringify(auditPayload), now),
  ]);
  return result(order);
}

export async function tryNativeAdminWrites(request: Request, env: AdminWriteEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const statusMatch = url.pathname.match(/^\/api\/v1\/admin\/orders\/([^/]+)\/status$/);
  const shipMatch = url.pathname.match(/^\/api\/v1\/admin\/orders\/([^/]+)\/ship$/);
  const cancelMatch = url.pathname.match(/^\/api\/v1\/admin\/orders\/([^/]+)\/cancel$/);
  const refundMatch = url.pathname.match(/^\/api\/v1\/admin\/orders\/([^/]+)\/refund$/);
  const itemMatch = url.pathname.match(/^\/api\/v1\/admin\/orders\/([^/]+)\/items\/([^/]+)\/fulfillment$/);
  if (!(request.method === 'PUT' && (statusMatch || itemMatch)) && !(request.method === 'POST' && (shipMatch || cancelMatch || refundMatch))) return null;
  const admin = await authenticateNativeAdmin(request, env);
  if (!admin) return null;
  const orderId = (statusMatch ?? shipMatch ?? cancelMatch ?? refundMatch ?? itemMatch)![1]!;
  const native = await loadNativeOrder(env, orderId);
  if (!native) return null;

  if (shipMatch) {
    const body = await request.json<{ carrier?: unknown; trackingNumber?: unknown; trackingUrl?: unknown; items?: unknown }>().catch(() => null);
    if (!body || typeof body.carrier !== 'string' || !body.carrier.trim() || typeof body.trackingNumber !== 'string' || !body.trackingNumber.trim()) return error(400, 'VALIDATION_ERROR', 'Carrier and tracking number are required');
    if (native.status === 'CANCELLED' || native.status === 'REFUNDED') return error(409, 'INVALID_STATUS_TRANSITION', `Cannot ship order with status: ${native.status}`);
    if (native.payment_status !== 'PAID') return error(409, 'ORDER_NOT_PAID', 'Order must be paid before fulfillment can advance');
    const order = JSON.parse(native.payload) as Record<string, unknown>;
    const items = itemsFrom(order);
    const requested = Array.isArray(body.items) ? new Set(body.items.flatMap((entry) => entry && typeof entry === 'object' && 'orderItemId' in entry && typeof entry.orderItemId === 'string' ? [entry.orderItemId] : [])) : null;
    const shippedAt = new Date().toISOString();
    const shipmentId = crypto.randomUUID();
    const trackingNumber = body.trackingNumber.trim();
    const trackingUrl = typeof body.trackingUrl === 'string' && body.trackingUrl.trim() ? body.trackingUrl.trim() : null;
    if (trackingUrl) {
      try {
        if (new URL(trackingUrl).protocol !== 'https:') return error(400, 'VALIDATION_ERROR', 'Tracking URL must use HTTPS');
      } catch {
        return error(400, 'VALIDATION_ERROR', 'Tracking URL is invalid');
      }
    }
    const existingShipment = await env.DB.prepare(
      'SELECT id FROM native_shipments WHERE order_id = ?1 AND tracking_number = ?2',
    ).bind(orderId, trackingNumber).first<{ id: string }>();
    if (existingShipment) {
      return result(await attachShipments(env.DB, order));
    }
    for (const item of items) {
      if (requested && (typeof item.id !== 'string' || !requested.has(item.id))) continue;
      item.fulfillmentStatus = 'shipped';
      item.fulfillmentData = { carrier: body.carrier.trim(), trackingNumber, shippedAt };
    }
    order.items = items;
    order.shipments = await attachShipments(env.DB, order).then((value) => value.shipments);
    order.shipments = [...(Array.isArray(order.shipments) ? order.shipments : []), { id: shipmentId, carrier: body.carrier.trim(), trackingNumber, trackingUrl, status: 'SHIPPED', shippedAt, deliveredAt: null, estimatedDeliveryAt: null, lastCheckedAt: shippedAt, events: [{ status: 'SHIPPED', description: null, occurredAt: shippedAt }] }];
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO native_shipments (id, order_id, carrier, tracking_number, tracking_url, status, shipped_at, last_checked_at, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, 'SHIPPED', ?6, ?6, ?6, ?6)`).bind(shipmentId, orderId, body.carrier.trim(), trackingNumber, trackingUrl, shippedAt),
      env.DB.prepare(`INSERT INTO native_shipment_events (id, shipment_id, status, description, occurred_at, created_at) VALUES (?1, ?2, 'SHIPPED', NULL, ?3, ?3)`).bind(crypto.randomUUID(), shipmentId, shippedAt),
    ]);
    return persist(env, admin.id, orderId, native, order, 'SHIPPED', 'order.ship', { carrier: body.carrier.trim(), trackingNumber, trackingUrl, itemIds: requested ? [...requested] : items.map((item) => item.id) });
  }

  if (cancelMatch) {
    const body = await request.json<{ cancelReason?: unknown }>().catch(() => null);
    if (!body || typeof body.cancelReason !== 'string' || !body.cancelReason.trim()) return error(400, 'VALIDATION_ERROR', 'Cancellation reason is required');
    if (native.status === 'SHIPPED' || native.status === 'DELIVERED') return error(409, 'INVALID_STATUS_TRANSITION', `Cannot cancel order with status: ${native.status}`);
    if (native.status === 'CANCELLED') return error(409, 'INVALID_STATUS_TRANSITION', 'Order is already cancelled');
    const order = JSON.parse(native.payload) as Record<string, unknown>;
    const now = new Date().toISOString();
    Object.assign(order, { status: 'CANCELLED', cancelReason: body.cancelReason.trim(), cancelledAt: now, updatedAt: now });
    const inventory = await env.DB.prepare(
      'SELECT product_id, variant_id, quantity FROM native_order_items WHERE order_id = ?1',
    ).bind(orderId).all<{ product_id: string; variant_id: string; quantity: number }>();
    const statements: D1PreparedStatement[] = native.payment_status === 'PAID'
      ? inventory.results.map((item) => env.DB.prepare(
        'UPDATE native_inventory SET source_stock = source_stock + ?1, refreshed_at = ?2 WHERE product_id = ?3 AND variant_id = ?4',
      ).bind(item.quantity, now, item.product_id, item.variant_id))
      : [];
    statements.push(
      env.DB.prepare('UPDATE native_inventory_reservations SET active = 0 WHERE order_id = ?1').bind(orderId),
      env.DB.prepare('UPDATE native_order_metadata SET cancelled_at = ?1, cancel_reason = ?2 WHERE order_id = ?3').bind(now, body.cancelReason.trim(), orderId),
      env.DB.prepare("UPDATE native_order_snapshots SET status = 'CANCELLED', payload = ?1, source_updated_at = ?2 WHERE id = ?3").bind(JSON.stringify(order), now, orderId),
      env.DB.prepare("INSERT INTO native_order_audit (id, order_id, actor_id, action, from_status, to_status, payload, created_at) VALUES (?1, ?2, ?3, 'order.cancel', ?4, 'CANCELLED', ?5, ?6)").bind(crypto.randomUUID(), orderId, admin.id, native.status, JSON.stringify({ cancelReason: body.cancelReason.trim() }), now),
      env.DB.prepare("INSERT INTO native_checkout_outbox (id, event_type, aggregate_id, payload, created_at) VALUES (?1, 'order.cancelled', ?2, ?3, ?4)").bind(crypto.randomUUID(), orderId, JSON.stringify({ orderId, actorId: admin.id }), now),
    );
    await env.DB.batch(statements);
    return result(order);
  }

  if (refundMatch) {
    const body = await request.json<{ idempotencyKey?: unknown; amount?: unknown; reason?: unknown }>().catch(() => null);
    if (!body || typeof body.idempotencyKey !== 'string' || !body.idempotencyKey.trim()) return error(400, 'VALIDATION_ERROR', 'Idempotency key is required');
    const existing = await env.DB.prepare('SELECT status FROM native_refunds WHERE idempotency_key = ?1').bind(body.idempotencyKey.trim()).first<{ status: string }>();
    if (existing?.status === 'COMPLETED') return result(JSON.parse(native.payload));
    if (existing?.status === 'PENDING') return error(502, 'PAYMENT_REFUND_PENDING', 'Payment provider has not confirmed the refund');
    if (native.payment_status !== 'PAID' && native.payment_status !== 'PARTIALLY_REFUNDED') return error(409, 'ORDER_NOT_PAID', 'Order is not paid, cannot refund');
    const metadata = await env.DB.prepare('SELECT total_amount, currency FROM native_order_metadata WHERE order_id = ?1').bind(orderId).first<{ total_amount: number; currency: string }>();
    const payment = await env.DB.prepare("SELECT id, payment_intent_id FROM native_payment_sessions WHERE order_id = ?1 AND status = 'SUCCEEDED' ORDER BY updated_at DESC LIMIT 1").bind(orderId).first<{ id: string; payment_intent_id: string | null }>();
    if (!metadata || !payment) return error(409, 'PAYMENT_REFUND_FAILED', 'No successful payment found for this order');
    const totalRefunded = await env.DB.prepare("SELECT COALESCE(SUM(amount), 0) AS amount FROM native_refunds WHERE order_id = ?1 AND status IN ('PENDING', 'COMPLETED')").bind(orderId).first<{ amount: number }>();
    const remaining = metadata.total_amount - (totalRefunded?.amount ?? 0);
    const amount = body.amount === undefined ? remaining : Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > remaining) return error(400, 'INVALID_REFUND_AMOUNT', `Invalid refund amount. Remaining refundable amount is ${remaining} ${metadata.currency}.`);
    const refundId = crypto.randomUUID();
    const now = new Date().toISOString();
    try {
      await env.DB.prepare("INSERT INTO native_refunds (id, order_id, payment_session_id, idempotency_key, amount, currency, status, reason, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'PENDING', ?7, ?8)").bind(refundId, orderId, payment.id, body.idempotencyKey.trim(), amount, metadata.currency, typeof body.reason === 'string' ? body.reason : null, now).run();
    } catch {
      const duplicate = await env.DB.prepare('SELECT status FROM native_refunds WHERE idempotency_key = ?1').bind(body.idempotencyKey.trim()).first<{ status: string }>();
      if (duplicate) return result(JSON.parse(native.payload));
      throw new Error('Unable to reserve refund');
    }
    const intent = await stripePaymentIntent(env, payment.id, payment.payment_intent_id);
    if (!intent) {
      await env.DB.prepare("DELETE FROM native_refunds WHERE id = ?1 AND status = 'PENDING'").bind(refundId).run();
      return error(502, 'PAYMENT_REFUND_FAILED', 'Stripe payment intent is unavailable');
    }
    const secret = (await getNativeStripeSecret(env, 'secretKey', env.STRIPE_SECRET_KEY)).value;
    const form = new URLSearchParams({ payment_intent: intent, amount: String(Math.round(amount * 100)), 'metadata[orderId]': orderId });
    const stripe = await fetch('https://api.stripe.com/v1/refunds', { method: 'POST', headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/x-www-form-urlencoded', 'idempotency-key': body.idempotencyKey.trim() }, body: form });
    const provider = await stripe.json<{ id?: string; status?: string; error?: { message?: string } }>();
    if (!stripe.ok || !provider.id || (provider.status !== 'succeeded' && provider.status !== 'pending')) {
      await env.DB.prepare("DELETE FROM native_refunds WHERE id = ?1 AND status = 'PENDING'").bind(refundId).run();
      return error(502, 'PAYMENT_REFUND_FAILED', provider.error?.message ?? 'Payment provider rejected the refund');
    }
    if (provider.status === 'pending') return error(502, 'PAYMENT_REFUND_PENDING', 'Payment provider has not confirmed the refund');
    const completed = (totalRefunded?.amount ?? 0) + amount;
    const fullyRefunded = completed + 0.000001 >= metadata.total_amount;
    const order = JSON.parse(native.payload) as Record<string, unknown>;
    Object.assign(order, { paymentStatus: fullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED', ...(fullyRefunded ? { status: 'REFUNDED' } : {}), updatedAt: now });
    const statements: D1PreparedStatement[] = [];
    if (fullyRefunded) {
      const inventory = await env.DB.prepare('SELECT product_id, variant_id, quantity FROM native_order_items WHERE order_id = ?1').bind(orderId).all<{ product_id: string; variant_id: string; quantity: number }>();
      statements.push(...inventory.results.map((item) => env.DB.prepare('UPDATE native_inventory SET source_stock = source_stock + ?1, refreshed_at = ?2 WHERE product_id = ?3 AND variant_id = ?4').bind(item.quantity, now, item.product_id, item.variant_id)));
    }
    statements.push(
      env.DB.prepare("UPDATE native_refunds SET status = 'COMPLETED', provider_refund_id = ?1, completed_at = ?2 WHERE id = ?3").bind(provider.id, now, refundId),
      env.DB.prepare('UPDATE native_order_metadata SET payment_status = ?1 WHERE order_id = ?2').bind(fullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED', orderId),
      env.DB.prepare('UPDATE native_order_snapshots SET status = ?1, payload = ?2, source_updated_at = ?3 WHERE id = ?4').bind(fullyRefunded ? 'REFUNDED' : native.status, JSON.stringify(order), now, orderId),
      env.DB.prepare("INSERT INTO native_order_audit (id, order_id, actor_id, action, from_status, to_status, payload, created_at) VALUES (?1, ?2, ?3, 'order.refund', ?4, ?5, ?6, ?7)").bind(crypto.randomUUID(), orderId, admin.id, native.status, fullyRefunded ? 'REFUNDED' : native.status, JSON.stringify({ amount, currency: metadata.currency, providerRefundId: provider.id }), now),
      env.DB.prepare("INSERT INTO native_checkout_outbox (id, event_type, aggregate_id, payload, created_at) VALUES (?1, 'order.refunded', ?2, ?3, ?4)").bind(crypto.randomUUID(), orderId, JSON.stringify({ orderId, amount, currency: metadata.currency, fullyRefunded, reason: typeof body.reason === 'string' ? body.reason : null }), now),
    );
    await env.DB.batch(statements);
    return result(order);
  }

  if (itemMatch) {
    const body = await request.json<{ fulfillmentStatus?: unknown; fulfillmentData?: unknown }>().catch(() => null);
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'failed'];
    if (!body || (body.fulfillmentStatus !== undefined && (typeof body.fulfillmentStatus !== 'string' || !validStatuses.includes(body.fulfillmentStatus)))) return error(400, 'VALIDATION_ERROR', 'A valid fulfillment status is required');
    if (body.fulfillmentStatus === undefined && body.fulfillmentData === undefined) return error(400, 'VALIDATION_ERROR', 'Fulfillment status or data is required');
    if (typeof body.fulfillmentStatus === 'string' && ['processing', 'shipped', 'delivered'].includes(body.fulfillmentStatus) && native.payment_status !== 'PAID') return error(409, 'ORDER_NOT_PAID', 'Order must be paid before fulfillment can advance');
    const order = JSON.parse(native.payload) as Record<string, unknown>;
    const items = itemsFrom(order);
    const item = items.find((candidate) => candidate.id === itemMatch[2]);
    if (!item) return error(404, 'NOT_FOUND', 'Order item not found');
    if (body.fulfillmentStatus !== undefined) item.fulfillmentStatus = body.fulfillmentStatus;
    if (body.fulfillmentData !== undefined) item.fulfillmentData = body.fulfillmentData;
    order.items = items;
    const statuses = items.map((candidate) => candidate.fulfillmentStatus);
    const next: Status = statuses.length > 0 && statuses.every((status) => status === 'delivered') ? 'DELIVERED'
      : statuses.some((status) => ['processing', 'shipped', 'delivered'].includes(String(status))) ? 'PROCESSING'
        : statuses.length > 0 && statuses.every((status) => status === 'failed') ? 'PAID' : native.status;
    return persist(env, admin.id, orderId, native, order, next, 'item.fulfillment.update', { itemId: itemMatch[2], fulfillmentStatus: body.fulfillmentStatus ?? null });
  }

  const body = await request.json<{ status?: unknown }>().catch(() => null);
  if (!body || typeof body.status !== 'string' || !Object.prototype.hasOwnProperty.call(transitions, body.status)) return error(400, 'VALIDATION_ERROR', 'A valid order status is required');
  const next = body.status as Status;
  if (native.status !== next && !transitions[native.status].includes(next)) return error(409, 'INVALID_STATUS_TRANSITION', `Invalid order status transition from ${native.status} to ${next}`);
  if (['PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED'].includes(next) && native.payment_status !== 'PAID') return error(409, 'ORDER_NOT_PAID', 'Order must be paid before fulfillment can advance');
  const order = JSON.parse(native.payload) as Record<string, unknown>;
  return persist(env, admin.id, orderId, native, order, next, 'status.update', {});
}
