import { deliverNativeWebhooks } from './webhooks';
import { submitNativeOdooOrders } from './external-orders';
import { createNativeAffiliateCommission } from './affiliate';
import { enqueueAffiliateCommissionEmail, enqueueOrganizationCommissionEmail, enqueueOrderPaidEmail, enqueueRefundEmail } from './mail-outbox';

interface OutboxRow {
  id: string;
  event_type: string;
  aggregate_id: string;
  payload: string;
  attempt_count: number;
}

interface OrderSnapshotRow {
  payload: string;
}

interface ReservationRow {
  product_id: string;
  variant_id: string;
  quantity: number;
}

export interface OutboxRunResult {
  scanned: number;
  delivered: number;
  failed: number;
}

type OutboxEnv = Pick<Cloudflare.Env, 'DB' | 'CORE_ORIGIN' | 'JWT_SECRET'>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function markDelivered(env: OutboxEnv, eventId: string, now: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE native_checkout_outbox
     SET delivered_at = ?1, last_attempted_at = ?1, attempt_count = attempt_count + 1, last_error = NULL
     WHERE id = ?2 AND delivered_at IS NULL`,
  ).bind(now, eventId).run();
}

async function fulfillPaidOrder(env: OutboxEnv, event: OutboxRow, now: string): Promise<void> {
  const snapshot = await env.DB.prepare(
    'SELECT payload FROM native_order_snapshots WHERE id = ?1',
  ).bind(event.aggregate_id).first<OrderSnapshotRow>();
  if (!snapshot) throw new Error(`Order snapshot ${event.aggregate_id} is missing`);

  const order = JSON.parse(snapshot.payload) as Record<string, unknown>;
  const items = Array.isArray(order.items) ? order.items as Array<Record<string, unknown>> : [];
  for (const item of items) {
    item.fulfillmentStatus = 'awaiting_shipment';
  }
  Object.assign(order, { status: 'PROCESSING', paymentStatus: 'PAID', updatedAt: now, items });

  const reservations = await env.DB.prepare(
    `SELECT product_id, variant_id, quantity
     FROM native_inventory_reservations
     WHERE order_id = ?1 AND active = 1`,
  ).bind(event.aggregate_id).all<ReservationRow>();

  const statements: D1PreparedStatement[] = [];
  for (const reservation of reservations.results) {
    statements.push(env.DB.prepare(
      `UPDATE native_inventory
       SET source_stock = MAX(0, source_stock - ?1), refreshed_at = ?2
       WHERE product_id = ?3 AND variant_id = ?4`,
    ).bind(reservation.quantity, now, reservation.product_id, reservation.variant_id));
  }
  statements.push(
    env.DB.prepare(
      `UPDATE native_inventory_reservations SET active = 0
       WHERE order_id = ?1 AND active = 1`,
    ).bind(event.aggregate_id),
    env.DB.prepare(
      `UPDATE native_order_snapshots
       SET status = 'PROCESSING', payload = ?1, source_updated_at = ?2
       WHERE id = ?3`,
    ).bind(JSON.stringify(order), now, event.aggregate_id),
  );
  await env.DB.batch(statements);
}

async function processEvent(env: OutboxEnv, event: OutboxRow): Promise<void> {
  const now = new Date().toISOString();
  if (event.event_type === 'payment.succeeded') {
    await fulfillPaidOrder(env, event, now);
    await submitNativeOdooOrders(env, event.aggregate_id);
    const paidSnapshot = await env.DB.prepare('SELECT payload FROM native_order_snapshots WHERE id = ?1').bind(event.aggregate_id).first<OrderSnapshotRow>();
    if (paidSnapshot) {
      const paidOrder = JSON.parse(paidSnapshot.payload) as Record<string, unknown>;
      await enqueueOrderPaidEmail(env, paidOrder);
      const commission = await createNativeAffiliateCommission(env, paidOrder);
      if (commission) {
        await enqueueAffiliateCommissionEmail(env, commission.partner);
        if (commission.organization) await enqueueOrganizationCommissionEmail(env, commission.organization);
      }
    }
  }
  if (event.event_type === 'order.refunded') {
    const refund = JSON.parse(event.payload) as { amount?: unknown; fullyRefunded?: unknown; currency?: unknown; reason?: unknown };
    const amount = Number(refund.amount);
    if (Number.isFinite(amount) && amount > 0) {
      const metadata = await env.DB.prepare('SELECT currency FROM native_order_metadata WHERE order_id = ?1')
        .bind(event.aggregate_id).first<{ currency: string }>();
      await enqueueRefundEmail(env, {
        orderId: event.aggregate_id,
        amount,
        currency: typeof refund.currency === 'string' ? refund.currency : metadata?.currency ?? 'USD',
        fullyRefunded: refund.fullyRefunded === true,
        reason: typeof refund.reason === 'string' ? refund.reason : null,
      });
    }
  }
  const snapshot = await env.DB.prepare('SELECT payload FROM native_order_snapshots WHERE id = ?1').bind(event.aggregate_id).first<OrderSnapshotRow>();
  const eventPayload = snapshot ? { order: JSON.parse(snapshot.payload) } : JSON.parse(event.payload) as unknown;
  await deliverNativeWebhooks(env, event.id, event.event_type, eventPayload, event.attempt_count + 1);
  await markDelivered(env, event.id, now);
}

async function claimEvent(env: OutboxEnv, eventId: string, now: string, staleBefore: string): Promise<boolean> {
  const claim = await env.DB.prepare(
    `UPDATE native_checkout_outbox
     SET last_attempted_at = ?1
     WHERE id = ?2 AND delivered_at IS NULL
       AND (last_attempted_at IS NULL OR last_attempted_at < ?3)`,
  ).bind(now, eventId, staleBefore).run();
  return (claim.meta.changes ?? 0) === 1;
}

export async function processCheckoutOutbox(env: OutboxEnv, limit = 25): Promise<OutboxRunResult> {
  const pending = await env.DB.prepare(
    `SELECT id, event_type, aggregate_id, payload, attempt_count
     FROM native_checkout_outbox
     WHERE delivered_at IS NULL AND attempt_count < 10
       AND (last_attempted_at IS NULL OR last_attempted_at < ?2)
     ORDER BY created_at ASC
     LIMIT ?1`,
  ).bind(limit, new Date(Date.now() - 5 * 60_000).toISOString()).all<OutboxRow>();
  const result: OutboxRunResult = { scanned: pending.results.length, delivered: 0, failed: 0 };

  for (const event of pending.results) {
    const claimedAt = new Date().toISOString();
    const staleBefore = new Date(Date.now() - 5 * 60_000).toISOString();
    if (!await claimEvent(env, event.id, claimedAt, staleBefore)) continue;
    try {
      await processEvent(env, event);
      result.delivered += 1;
    } catch (error: unknown) {
      result.failed += 1;
      const message = errorMessage(error).slice(0, 1000);
      await env.DB.prepare(
        `UPDATE native_checkout_outbox
         SET attempt_count = attempt_count + 1, last_attempted_at = ?1, last_error = ?2
         WHERE id = ?3 AND delivered_at IS NULL`,
      ).bind(new Date().toISOString(), message, event.id).run();
      console.error(JSON.stringify({
        message: 'native checkout outbox delivery failed',
        eventId: event.id,
        eventType: event.event_type,
        aggregateId: event.aggregate_id,
        error: message,
      }));
    }
  }
  return result;
}
