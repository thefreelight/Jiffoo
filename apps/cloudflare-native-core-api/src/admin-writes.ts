import { type NativeAuthEnv } from './auth';
import { ADMIN_PERMISSIONS } from './native-rbac';
import { requireAdminPermission } from './admin-access';
import { attachShipments } from './shipments';
import { getNativePluginConfig, getNativeStripeSecret } from './plugin-settings';
import { NativePaymentError, nativePaymentModule, type NativePaymentModule } from './native-plugin-modules/payments';
import { getCarrier, matchCarrierByName, trackingUrlFor } from './shipping-carriers';
import { subscribeKuaidi100Tracking } from './shipping';

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

function refundItemsFrom(raw: unknown, orderItems: Array<Record<string, unknown>>): Array<{ orderItemId: string; quantity: number }> | null {
  if (raw === undefined) return null;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const available = new Map(orderItems.map((item) => [typeof item.id === 'string' ? item.id : '', item]));
  const seen = new Set<string>();
  const result: Array<{ orderItemId: string; quantity: number }> = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') return null;
    const orderItemId = (entry as { orderItemId?: unknown }).orderItemId;
    const quantity = (entry as { quantity?: unknown }).quantity;
    if (typeof orderItemId !== 'string' || !orderItemId || seen.has(orderItemId) || typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) return null;
    const orderItem = available.get(orderItemId);
    if (!orderItem || typeof orderItem.quantity !== 'number' || quantity > orderItem.quantity) return null;
    seen.add(orderItemId);
    result.push({ orderItemId, quantity });
  }
  return result;
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

const RUNTIME_HEADERS = { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-orders' };

/** The refund is with the payment provider and not confirmed yet; the order is as it was until it is. */
function refundAccepted(order: unknown): Response {
  return Response.json({ success: true, data: { ...(order as Record<string, unknown>), refundPending: true } }, { status: 202, headers: RUNTIME_HEADERS });
}

/** Who completes a refund when the timer, not an administrator, finds the provider's answer. */
const REFUND_RECONCILER = 'system:refund-reconciliation';
/** Who completes a refund when the payment gateway's own webhook announces it. */
const REFUND_WEBHOOK = 'system:refund-webhook';

/** The payment session of a refund: which module took the money, and its number for the payment. */
interface RefundPaymentSession { id: string; payment_intent_id: string | null; provider: string }

/**
 * What a payment module's refund delivery means for the refund this store is
 * still waiting on. A delivery about a refund nobody asked for here — one
 * issued on the gateway's own dashboard — is nothing to write down.
 */
export async function applyModuleRefundNotice(
  env: AdminWriteEnv,
  notice: { status: 'succeeded' | 'failed'; paymentId: string | null; refundReference: string | null; refundId: string | null },
): Promise<'completed' | 'failed' | 'unknown'> {
  const select = 'SELECT id, order_id, amount, reason FROM native_refunds WHERE ';
  // By the reference this store gave the refund when it asked for it, else by the gateway's own refund id.
  const row = notice.refundReference
    ? await env.DB.prepare(`${select}id = ?1 AND status = 'PENDING'`).bind(notice.refundReference).first<Pick<RefundRow, 'id' | 'order_id' | 'amount' | 'reason'>>()
    : notice.refundId
      ? await env.DB.prepare(`${select}provider_refund_id = ?1 AND status = 'PENDING'`).bind(notice.refundId).first<Pick<RefundRow, 'id' | 'order_id' | 'amount' | 'reason'>>()
      : null;
  if (!row) return 'unknown';
  if (notice.status === 'succeeded') {
    await completeNativeRefund(env, { orderId: row.order_id, refundId: row.id, providerRefundId: notice.refundId ?? row.id, amount: row.amount, actorId: REFUND_WEBHOOK, reason: row.reason, items: null });
    return 'completed';
  }
  // a refund the provider gave up on is not a refund: the reservation goes, and the administrator can ask again
  await env.DB.prepare("DELETE FROM native_refunds WHERE id = ?1 AND status = 'PENDING'").bind(row.id).run();
  return 'failed';
}

/**
 * Asks a payment module to return the money. The module's answer decides on
 * the spot — done, or given up — or it has taken the refund and confirms
 * later, in which case the refund waits with the module's number on it for
 * its webhook or the timer.
 */
async function refundThroughModule(
  env: AdminWriteEnv,
  input: {
    module: NativePaymentModule; session: RefundPaymentSession; orderId: string; refundId: string;
    amount: number; currency: string; reason: string | null; items: Array<{ orderItemId: string; quantity: number }> | null;
    actorId: string; order: Record<string, unknown>;
  },
): Promise<Response> {
  const giveUp = async (message: string) => {
    await env.DB.prepare("DELETE FROM native_refunds WHERE id = ?1 AND status = 'PENDING'").bind(input.refundId).run();
    return error(502, 'PAYMENT_REFUND_FAILED', message);
  };
  if (!input.module.payments.createRefund) return giveUp('This payment method cannot return money by itself');
  const plugin = await getNativePluginConfig(env, input.module.id);
  if (!plugin?.enabled) return giveUp(`${input.module.id} is not enabled on this store`);
  try {
    const refund = await input.module.payments.createRefund(plugin.config, {
      paymentId: input.session.payment_intent_id ?? '', amountMinor: Math.round(input.amount * 100), currency: input.currency,
      reason: input.reason, reference: input.refundId,
    });
    if (refund.outcome === 'failed') return giveUp('The payment provider rejected the refund');
    if (refund.outcome === 'succeeded') {
      await completeNativeRefund(env, {
        orderId: input.orderId, refundId: input.refundId, providerRefundId: refund.providerRefundId ?? input.refundId,
        amount: input.amount, actorId: input.actorId, reason: input.reason, items: input.items,
      });
      return result(JSON.parse((await loadNativeOrder(env, input.orderId))?.payload ?? JSON.stringify(input.order)));
    }
    // Taken, not confirmed: the webhook or the timer finishes it.
    await env.DB.prepare("UPDATE native_refunds SET provider_refund_id = ?1 WHERE id = ?2 AND status = 'PENDING'")
      .bind(refund.providerRefundId ?? input.refundId, input.refundId).run();
    return refundAccepted(input.order);
  } catch (cause) {
    const message = cause instanceof NativePaymentError ? cause.message : 'The payment provider rejected the refund';
    return giveUp(message);
  }
}

/** Asks a payment module about a refund the store is still waiting on, and writes down what it says. */
async function settleModuleRefund(env: AdminWriteEnv, module: NativePaymentModule, row: RefundRow): Promise<'completed' | 'failed' | 'pending'> {
  if (!module.payments.refundOutcome) return 'pending';
  const plugin = await getNativePluginConfig(env, module.id);
  if (!plugin?.enabled) return 'pending';
  const outcome = await module.payments.refundOutcome(plugin.config, { reference: row.id, providerRefundId: row.provider_refund_id });
  if (outcome === 'succeeded') {
    await completeNativeRefund(env, { orderId: row.order_id, refundId: row.id, providerRefundId: row.provider_refund_id ?? row.id, amount: row.amount, actorId: REFUND_RECONCILER, reason: row.reason, items: null });
    return 'completed';
  }
  // a refund the provider gave up on is not a refund: the reservation goes, and the administrator can ask again
  if (outcome === 'failed') {
    await env.DB.prepare("DELETE FROM native_refunds WHERE id = ?1 AND status = 'PENDING'").bind(row.id).run();
    return 'failed';
  }
  return 'pending';
}

interface RefundRow { id: string; order_id: string; payment_session_id: string; amount: number; reason: string | null; provider_refund_id: string | null }

/**
 * What the store writes down once the payment provider has refunded: the refund completed, the order refunded in
 * full or in part, the stock back for a full refund, the audit, and the event the rest of the store follows — the
 * shopper's refund receipt, a referrer's commission reversed.
 */
export async function completeNativeRefund(env: AdminWriteEnv, input: {
  orderId: string; refundId: string; providerRefundId: string; amount: number; actorId: string; reason: string | null;
  items: Array<{ orderItemId: string; quantity: number }> | null;
}): Promise<Record<string, unknown> | null> {
  const native = await loadNativeOrder(env, input.orderId);
  const metadata = await env.DB.prepare('SELECT total_amount, currency, user_id FROM native_order_metadata WHERE order_id = ?1').bind(input.orderId).first<{ total_amount: number; currency: string; user_id: string }>();
  const payment = await env.DB.prepare("SELECT id FROM native_payment_sessions WHERE order_id = ?1 AND status = 'SUCCEEDED' ORDER BY updated_at DESC LIMIT 1").bind(input.orderId).first<{ id: string }>();
  if (!native || !metadata || !payment) return null;
  const refunded = await env.DB.prepare("SELECT COALESCE(SUM(amount), 0) AS amount FROM native_refunds WHERE order_id = ?1 AND status IN ('PENDING', 'COMPLETED')").bind(input.orderId).first<{ amount: number }>();
  const fullyRefunded = (refunded?.amount ?? 0) + 0.000001 >= metadata.total_amount;
  const order = JSON.parse(native.payload) as Record<string, unknown>;
  const now = new Date().toISOString();
  Object.assign(order, { paymentStatus: fullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED', ...(fullyRefunded ? { status: 'REFUNDED' } : {}), updatedAt: now });
  // The refund is marked completed first, and only if this call was the one to do so does the rest follow:
  // the provider's answer and an administrator's retry can arrive together, and the order is refunded once.
  const completed = await env.DB.prepare("UPDATE native_refunds SET status = 'COMPLETED', provider_refund_id = ?1, completed_at = ?2 WHERE id = ?3 AND status = 'PENDING'")
    .bind(input.providerRefundId, now, input.refundId).run();
  if (!completed.meta.changes) return order;
  const statements: D1PreparedStatement[] = [];
  if (fullyRefunded) {
    const inventory = await env.DB.prepare('SELECT product_id, variant_id, quantity FROM native_order_items WHERE order_id = ?1').bind(input.orderId).all<{ product_id: string; variant_id: string; quantity: number }>();
    statements.push(...inventory.results.map((item) => env.DB.prepare('UPDATE native_inventory SET source_stock = source_stock + ?1, refreshed_at = ?2 WHERE product_id = ?3 AND variant_id = ?4').bind(item.quantity, now, item.product_id, item.variant_id)));
  }
  statements.push(
    env.DB.prepare('UPDATE native_order_metadata SET payment_status = ?1 WHERE order_id = ?2').bind(fullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED', input.orderId),
    env.DB.prepare('UPDATE native_order_snapshots SET status = ?1, payload = ?2, source_updated_at = ?3 WHERE id = ?4').bind(fullyRefunded ? 'REFUNDED' : native.status, JSON.stringify(order), now, input.orderId),
    env.DB.prepare("INSERT INTO native_order_audit (id, order_id, actor_id, action, from_status, to_status, payload, created_at) VALUES (?1, ?2, ?3, 'order.refund', ?4, ?5, ?6, ?7)").bind(crypto.randomUUID(), input.orderId, input.actorId, native.status, fullyRefunded ? 'REFUNDED' : native.status, JSON.stringify({ amount: input.amount, currency: metadata.currency, providerRefundId: input.providerRefundId }), now),
    env.DB.prepare("INSERT INTO native_checkout_outbox (id, event_type, aggregate_id, payload, created_at) VALUES (?1, 'order.refunded', ?2, ?3, ?4)").bind(crypto.randomUUID(), input.orderId, JSON.stringify({ id: input.orderId, orderId: input.orderId, refundId: input.refundId, userId: metadata.user_id, paymentId: payment.id, providerRefundId: input.providerRefundId, amount: input.amount, currency: metadata.currency, fullyRefunded, reason: input.reason, ...(input.items ? { items: input.items } : fullyRefunded ? { items: itemsFrom(order).flatMap((item) => typeof item.id === 'string' && typeof item.quantity === 'number' ? [{ orderItemId: item.id, quantity: item.quantity }] : []) } : {}) }), now),
  );
  await env.DB.batch(statements);
  return order;
}

async function stripeRefundOf(env: AdminWriteEnv, refundId: string): Promise<{ id: string; status: string } | null> {
  const secret = (await getNativeStripeSecret(env, 'secretKey', env.STRIPE_SECRET_KEY)).value;
  const response = await fetch(`https://api.stripe.com/v1/refunds/${encodeURIComponent(refundId)}`, { headers: { authorization: `Bearer ${secret}` } });
  if (!response.ok) return null;
  return (await response.json<{ id?: string; status?: string }>()) as { id: string; status: string };
}

/** The refund the store asked for on a payment, found by the order it names (for one taken before its number was kept). */
async function stripeRefundForOrder(env: AdminWriteEnv, intent: string, orderId: string): Promise<{ id: string; status: string } | null> {
  const secret = (await getNativeStripeSecret(env, 'secretKey', env.STRIPE_SECRET_KEY)).value;
  const response = await fetch(`https://api.stripe.com/v1/refunds?payment_intent=${encodeURIComponent(intent)}&limit=20`, { headers: { authorization: `Bearer ${secret}` } });
  if (!response.ok) return null;
  const listed = await response.json<{ data?: Array<{ id?: string; status?: string; metadata?: { orderId?: string } }> }>();
  return (listed.data ?? []).find((refund) => refund.metadata?.orderId === orderId && refund.id && refund.status) as { id: string; status: string } ?? null;
}

/** Asks the payment provider about a refund the store is still waiting on, and writes down what it says. */
async function settleNativeRefund(env: AdminWriteEnv, refundId: string): Promise<'completed' | 'failed' | 'pending' | 'missing'> {
  const row = await env.DB.prepare('SELECT id, order_id, payment_session_id, amount, reason, provider_refund_id FROM native_refunds WHERE id = ?1 AND status = ?2')
    .bind(refundId, 'PENDING').first<RefundRow>();
  if (!row) return 'missing';
  const session = await env.DB.prepare('SELECT id, payment_intent_id, provider FROM native_payment_sessions WHERE id = ?1').bind(row.payment_session_id).first<RefundPaymentSession>();
  // The money goes back the way it came: a payment module is asked, Stripe is told.
  const module = session ? nativePaymentModule(session.provider) : null;
  if (module && session) return settleModuleRefund(env, module, row);
  const intent = session ? await stripePaymentIntent(env, session.id, session.payment_intent_id) : null;
  if (!intent) return 'pending';
  const provider = row.provider_refund_id ? await stripeRefundOf(env, row.provider_refund_id) : await stripeRefundForOrder(env, intent, row.order_id);
  if (!provider) return 'pending';
  if (provider.status === 'succeeded') {
    await completeNativeRefund(env, { orderId: row.order_id, refundId: row.id, providerRefundId: provider.id, amount: row.amount, actorId: REFUND_RECONCILER, reason: row.reason, items: null });
    return 'completed';
  }
  // a refund the provider gave up on is not a refund: the reservation goes, and the administrator can ask again
  if (provider.status === 'failed' || provider.status === 'canceled') {
    await env.DB.prepare("DELETE FROM native_refunds WHERE id = ?1 AND status = 'PENDING'").bind(row.id).run();
    return 'failed';
  }
  return 'pending';
}

/**
 * The refunds the payment provider had not confirmed when they were asked for — a card refund begins as pending and
 * is confirmed a moment later. A few at a time, none sooner than a minute after it was asked for.
 */
export async function processNativePendingRefunds(env: AdminWriteEnv): Promise<{ picked: number; completed: number; failed: number }> {
  const cutoff = new Date(Date.now() - 60_000).toISOString();
  const rows = await env.DB.prepare("SELECT id FROM native_refunds WHERE status = 'PENDING' AND created_at < ?1 ORDER BY created_at ASC LIMIT 25")
    .bind(cutoff).all<{ id: string }>();
  const tally = { picked: rows.results.length, completed: 0, failed: 0 };
  for (const row of rows.results) {
    try {
      const settled = await settleNativeRefund(env, row.id);
      if (settled === 'completed') tally.completed += 1;
      else if (settled === 'failed') tally.failed += 1;
    } catch (error) {
      console.error(JSON.stringify({ message: 'refund follow-up failed', refundId: row.id, error: error instanceof Error ? error.message : String(error) }));
    }
  }
  return tally;
}

export async function tryNativeAdminWrites(request: Request, env: AdminWriteEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const statusMatch = url.pathname.match(/^\/api\/v1\/admin\/orders\/([^/]+)\/status$/);
  const shipMatch = url.pathname.match(/^\/api\/v1\/admin\/orders\/([^/]+)\/ship$/);
  const cancelMatch = url.pathname.match(/^\/api\/v1\/admin\/orders\/([^/]+)\/cancel$/);
  const refundMatch = url.pathname.match(/^\/api\/v1\/admin\/orders\/([^/]+)\/refund$/);
  const itemMatch = url.pathname.match(/^\/api\/v1\/admin\/orders\/([^/]+)\/items\/([^/]+)\/fulfillment$/);
  if (!(request.method === 'PUT' && (statusMatch || itemMatch)) && !(request.method === 'POST' && (shipMatch || cancelMatch || refundMatch))) return null;
  const writeGate = await requireAdminPermission(request, env, ADMIN_PERMISSIONS.ORDERS_WRITE);
  if (!writeGate.ok) return writeGate.response;
  const admin = writeGate.admin;
  const orderId = (statusMatch ?? shipMatch ?? cancelMatch ?? refundMatch ?? itemMatch)![1]!;
  const native = await loadNativeOrder(env, orderId);
  if (!native) return null;

  if (shipMatch) {
    const body = await request.json<{ carrier?: unknown; carrierCode?: unknown; trackingNumber?: unknown; trackingUrl?: unknown; items?: unknown }>().catch(() => null);
    if (!body || typeof body.carrier !== 'string' || !body.carrier.trim() || typeof body.trackingNumber !== 'string' || !body.trackingNumber.trim()) return error(400, 'VALIDATION_ERROR', 'Carrier and tracking number are required');
    if (native.status === 'CANCELLED' || native.status === 'REFUNDED') return error(409, 'INVALID_STATUS_TRANSITION', `Cannot ship order with status: ${native.status}`);
    if (native.payment_status !== 'PAID') return error(409, 'ORDER_NOT_PAID', 'Order must be paid before fulfillment can advance');
    const order = JSON.parse(native.payload) as Record<string, unknown>;
    const items = itemsFrom(order);
    const requested = Array.isArray(body.items) ? new Set(body.items.flatMap((entry) => entry && typeof entry === 'object' && 'orderItemId' in entry && typeof entry.orderItemId === 'string' ? [entry.orderItemId] : [])) : null;
    const shippedAt = new Date().toISOString();
    const shipmentId = crypto.randomUUID();
    const trackingNumber = body.trackingNumber.trim();
    // Structured carrier identity: explicit carrierCode from the carrier
    // picker wins, otherwise resolve the typed carrier against the catalog.
    const carrierMatch = typeof body.carrierCode === 'string' && body.carrierCode.trim()
      ? getCarrier(body.carrierCode)
      : matchCarrierByName(body.carrier);
    const carrierCode = carrierMatch?.code ?? null;
    const carrierName = carrierMatch ? (carrierMatch.nameZh && carrierMatch.nameZh !== carrierMatch.name ? `${carrierMatch.name} / ${carrierMatch.nameZh}` : carrierMatch.name) : null;
    let trackingUrl = typeof body.trackingUrl === 'string' && body.trackingUrl.trim() ? body.trackingUrl.trim() : null;
    if (!trackingUrl && carrierCode) trackingUrl = trackingUrlFor(carrierCode, trackingNumber);
    if (trackingUrl) {
      try {
        if (new URL(trackingUrl).protocol !== 'https:') return error(400, 'VALIDATION_ERROR', 'Tracking URL must use HTTPS');
      } catch {
        return error(400, 'VALIDATION_ERROR', 'Tracking URL is invalid');
      }
    }
    const carrierLabel = body.carrier.trim();
    const existingShipment = await env.DB.prepare(
      'SELECT id FROM native_shipments WHERE order_id = ?1 AND tracking_number = ?2',
    ).bind(orderId, trackingNumber).first<{ id: string }>();
    if (existingShipment) {
      return result(await attachShipments(env.DB, order));
    }
    for (const item of items) {
      if (requested && (typeof item.id !== 'string' || !requested.has(item.id))) continue;
      item.fulfillmentStatus = 'shipped';
      item.fulfillmentData = { carrier: carrierLabel, trackingNumber, shippedAt };
    }
    order.items = items;
    order.shipments = await attachShipments(env.DB, order).then((value) => value.shipments);
    order.shipments = [...(Array.isArray(order.shipments) ? order.shipments : []), { id: shipmentId, carrier: carrierLabel, carrierCode, carrierName, trackingNumber, trackingUrl, status: 'SHIPPED', shippedAt, deliveredAt: null, estimatedDeliveryAt: null, lastCheckedAt: shippedAt, events: [{ status: 'SHIPPED', description: null, occurredAt: shippedAt }] }];
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO native_shipments (id, order_id, carrier, carrier_code, carrier_name, tracking_number, tracking_url, status, shipped_at, last_checked_at, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'SHIPPED', ?8, ?8, ?8, ?8)`).bind(shipmentId, orderId, carrierLabel, carrierCode, carrierName, trackingNumber, trackingUrl, shippedAt),
      env.DB.prepare(`INSERT INTO native_shipment_events (id, shipment_id, status, description, occurred_at, created_at) VALUES (?1, ?2, 'SHIPPED', NULL, ?3, ?3)`).bind(crypto.randomUUID(), shipmentId, shippedAt),
    ]);
    // Domestic shipments ride Kuaidi100 tracking push when the plugin and
    // callback are configured; a failed subscription never blocks shipping.
    try {
      const subscription = await subscribeKuaidi100Tracking(env, orderId, carrierCode ?? carrierLabel, trackingNumber);
      if (!subscription.subscribed && subscription.reason && subscription.reason !== 'PLUGIN_DISABLED' && subscription.reason !== 'KUAIDI100_NOT_CONFIGURED' && subscription.reason !== 'CARRIER_NOT_SUPPORTED') {
        console.warn(`kuaidi100 subscribe deferred for ${orderId}: ${subscription.reason}`);
      }
    } catch (subscriptionError) {
      console.warn(`kuaidi100 subscribe error for ${orderId}:`, subscriptionError instanceof Error ? subscriptionError.message : subscriptionError);
    }
    return persist(env, admin.id, orderId, native, order, 'SHIPPED', 'order.ship', { carrier: carrierLabel, carrierCode, trackingNumber, trackingUrl, itemIds: requested ? [...requested] : items.map((item) => item.id) });
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
    const body = await request.json<{ idempotencyKey?: unknown; amount?: unknown; reason?: unknown; items?: unknown }>().catch(() => null);
    if (!body || typeof body.idempotencyKey !== 'string' || !body.idempotencyKey.trim()) return error(400, 'VALIDATION_ERROR', 'Idempotency key is required');
    const key = body.idempotencyKey.trim();
    const existing = await env.DB.prepare('SELECT id, status FROM native_refunds WHERE idempotency_key = ?1').bind(key).first<{ id: string; status: string }>();
    if (existing?.status === 'COMPLETED') return result(JSON.parse(native.payload));
    // Asked again while the provider has not confirmed yet: the provider is asked now. Until it has, the answer is
    // that the refund is on its way — not, as it used to be, a failure repeated for good.
    if (existing?.status === 'PENDING') {
      if (await settleNativeRefund(env, existing.id) === 'completed') return result(JSON.parse((await loadNativeOrder(env, orderId))?.payload ?? native.payload));
      return refundAccepted(JSON.parse(native.payload));
    }
    if (native.payment_status !== 'PAID' && native.payment_status !== 'PARTIALLY_REFUNDED') return error(409, 'ORDER_NOT_PAID', 'Order is not paid, cannot refund');
    const metadata = await env.DB.prepare('SELECT total_amount, currency, user_id FROM native_order_metadata WHERE order_id = ?1').bind(orderId).first<{ total_amount: number; currency: string; user_id: string }>();
    const payment = await env.DB.prepare("SELECT id, payment_intent_id, provider FROM native_payment_sessions WHERE order_id = ?1 AND status = 'SUCCEEDED' ORDER BY updated_at DESC LIMIT 1").bind(orderId).first<RefundPaymentSession>();
    if (!metadata || !payment) return error(409, 'PAYMENT_REFUND_FAILED', 'No successful payment found for this order');
    const totalRefunded = await env.DB.prepare("SELECT COALESCE(SUM(amount), 0) AS amount FROM native_refunds WHERE order_id = ?1 AND status IN ('PENDING', 'COMPLETED')").bind(orderId).first<{ amount: number }>();
    const remaining = metadata.total_amount - (totalRefunded?.amount ?? 0);
    const amount = body.amount === undefined ? remaining : Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > remaining) return error(400, 'INVALID_REFUND_AMOUNT', `Invalid refund amount. Remaining refundable amount is ${remaining} ${metadata.currency}.`);
    const order = JSON.parse(native.payload) as Record<string, unknown>;
    const refundItems = refundItemsFrom(body.items, itemsFrom(order));
    if (body.items !== undefined && !refundItems) return error(400, 'INVALID_REFUND_ITEMS', 'Refund items must contain unique order item IDs and positive quantities within the purchased quantities.');
    const refundId = crypto.randomUUID();
    const now = new Date().toISOString();
    const reason = typeof body.reason === 'string' ? body.reason : null;
    try {
      await env.DB.prepare("INSERT INTO native_refunds (id, order_id, payment_session_id, idempotency_key, amount, currency, status, reason, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'PENDING', ?7, ?8)").bind(refundId, orderId, payment.id, key, amount, metadata.currency, reason, now).run();
    } catch {
      const duplicate = await env.DB.prepare('SELECT status FROM native_refunds WHERE idempotency_key = ?1').bind(key).first<{ status: string }>();
      if (duplicate) return result(JSON.parse(native.payload));
      throw new Error('Unable to reserve refund');
    }
    const module = nativePaymentModule(payment.provider);
    if (module) {
      return refundThroughModule(env, {
        module, session: payment, orderId, refundId, amount, currency: metadata.currency, reason,
        items: refundItems, actorId: admin.id, order,
      });
    }
    const intent = await stripePaymentIntent(env, payment.id, payment.payment_intent_id);
    if (!intent) {
      await env.DB.prepare("DELETE FROM native_refunds WHERE id = ?1 AND status = 'PENDING'").bind(refundId).run();
      return error(502, 'PAYMENT_REFUND_FAILED', 'Stripe payment intent is unavailable');
    }
    const secret = (await getNativeStripeSecret(env, 'secretKey', env.STRIPE_SECRET_KEY)).value;
    const form = new URLSearchParams({ payment_intent: intent, amount: String(Math.round(amount * 100)), 'metadata[orderId]': orderId });
    const stripe = await fetch('https://api.stripe.com/v1/refunds', { method: 'POST', headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/x-www-form-urlencoded', 'idempotency-key': key }, body: form });
    const provider = await stripe.json<{ id?: string; status?: string; error?: { message?: string } }>();
    if (!stripe.ok || !provider.id || (provider.status !== 'succeeded' && provider.status !== 'pending')) {
      await env.DB.prepare("DELETE FROM native_refunds WHERE id = ?1 AND status = 'PENDING'").bind(refundId).run();
      return error(502, 'PAYMENT_REFUND_FAILED', provider.error?.message ?? 'Payment provider rejected the refund');
    }
    if (provider.status === 'pending') {
      // The provider has taken the refund and confirms it a moment later (that is how a card refund begins).
      // The refund is kept, with the provider's number on it; the timer asks the provider again and finishes it.
      await env.DB.prepare("UPDATE native_refunds SET provider_refund_id = ?1 WHERE id = ?2 AND status = 'PENDING'").bind(provider.id, refundId).run();
      return refundAccepted(JSON.parse(native.payload));
    }
    await completeNativeRefund(env, { orderId, refundId, providerRefundId: provider.id, amount, actorId: admin.id, reason, items: refundItems });
    return result(JSON.parse((await loadNativeOrder(env, orderId))?.payload ?? native.payload));
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
