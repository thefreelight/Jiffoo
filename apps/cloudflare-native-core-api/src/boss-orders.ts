import { createBossOrder, getBossOrderStatus } from './boss-upstream';

/**
 * BOSS paid-order fulfillment (eSIM mall Phase 2).
 *
 * Subscribes to the checkout outbox `payment.succeeded` event: any paid
 * order line whose product snapshot carries `typeData.esim.bossOdooId` is
 * routed to the BOSS OpenAPI (`createBossOrder`), and the BOSS orderNo is
 * persisted per line for tracing and status sync. Orders without BOSS
 * products (bokmoo physical cards, RemoteRadar, subscriptions) are
 * legitimate non-targets and are skipped without retrying the event.
 *
 * Ordering safety: the intent row is written before the upstream call and
 * every retry consults it. A line whose create outcome is unknown (crash
 * between BOSS 200 and the D1 update) moves to 'unverified' instead of
 * re-ordering — duplicate eSIM orders cost real money. A periodic sweep
 * (`syncBossOrderStatuses`) polls BOSS for created orders and records
 * upstream completion.
 */

type BossOrderEnv = Pick<Cloudflare.Env, 'DB' | 'JWT_SECRET'> & { BOSS_API_KEY?: string; BOSS_BASE_URL?: string };

interface OrderMetadataRow {
  user_id: string;
  payment_status: string;
}

interface OrderItemRow {
  id: string;
  product_id: string;
  quantity: number;
  payload: string;
}

interface OrderSnapshotRow {
  payload: string;
}

interface ProductSnapshotRow {
  payload: string;
  status_code: number;
}

export interface BossOrderLineRow {
  id: string;
  order_id: string;
  line_item_id: string;
  status: 'pending' | 'created' | 'completed' | 'failed' | 'unverified';
  boss_order_no: string | null;
  error: string | null;
}

interface BossEsimTypeData {
  bossOdooId: number;
  defaultCode: string;
}

interface ProductDetailEnvelope {
  data?: {
    name?: unknown;
    typeData?: { provider?: unknown; esim?: Partial<BossEsimTypeData> | null } | null;
  } | null;
}

interface BossOrderRecord {
  orderNo?: unknown;
  odooOrderName?: unknown;
  status?: unknown;
  upstreamStatus?: unknown;
  [key: string]: unknown;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseItemPayload(payload: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(payload) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function loadBossEsimFacts(
  env: BossOrderEnv,
  productId: string,
): Promise<BossEsimTypeData | null> {
  const snapshot = await env.DB.prepare(
    `SELECT payload, status_code FROM core_api_snapshots WHERE cache_key = ?1`,
  ).bind(`core:snapshot:/api/v1/products/${productId}`).first<ProductSnapshotRow>();
  if (!snapshot || snapshot.status_code !== 200) return null;
  let envelope: ProductDetailEnvelope;
  try {
    envelope = JSON.parse(String(snapshot.payload)) as ProductDetailEnvelope;
  } catch {
    return null;
  }
  const typeData = envelope?.data?.typeData;
  const esim = typeData?.esim;
  const bossOdooId = Number(esim?.bossOdooId);
  const defaultCode = optionalString(esim?.defaultCode);
  if (!typeData || typeData.provider !== 'boss' || !Number.isSafeInteger(bossOdooId) || bossOdooId <= 0 || !defaultCode) {
    return null;
  }
  return { bossOdooId, defaultCode };
}

export async function processBossPaidOrder(
  env: BossOrderEnv,
  orderId: string,
  providerEventId: string,
): Promise<{ placed: number; skipped: boolean }> {
  if (!env.BOSS_API_KEY?.trim()) throw new Error('BOSS_NOT_CONFIGURED');

  const metadata = await env.DB.prepare(
    'SELECT user_id, payment_status FROM native_order_metadata WHERE order_id = ?1',
  ).bind(orderId).first<OrderMetadataRow>();
  if (!metadata) throw new Error('BOSS_ORDER_NOT_FOUND');
  if (metadata.payment_status !== 'PAID') throw new Error('BOSS_ORDER_NOT_PAID');

  const items = await env.DB.prepare(
    'SELECT id, product_id, quantity, payload FROM native_order_items WHERE order_id = ?1 ORDER BY id',
  ).bind(orderId).all<OrderItemRow>();

  // Resolve which lines are BOSS-managed before touching state.
  const bossLines: Array<{ lineItemId: string; productId: string; quantity: number; facts: BossEsimTypeData; iccid: string }> = [];
  for (const item of items.results) {
    if (item.quantity <= 0) continue;
    const facts = await loadBossEsimFacts(env, item.product_id);
    if (facts) {
      // Reuse path: the checkout stamped the buyer's chosen eSIM ICCID into
      // the item fulfillmentData — pass it so BOSS tops up that profile
      // (Dashi addPackage) instead of paying a fresh provisioning fee.
      const payloadRecord = (item.payload && typeof item.payload === 'object' ? item.payload : {}) as {
        fulfillmentData?: { esimIccid?: unknown };
      };
      const iccidRaw = payloadRecord.fulfillmentData?.esimIccid;
      // BOSS v4: asset ICCIDs may be short numeric ids (doc example 76010150).
      const iccid = typeof iccidRaw === 'string' && /^\d{6,22}$/.test(iccidRaw.trim()) ? iccidRaw.trim() : '';
      bossLines.push({ lineItemId: item.id, productId: item.product_id, quantity: item.quantity, facts, iccid });
    }
  }
  if (bossLines.length === 0) throw new Error('BOSS_ORDER_NOT_ELIGIBLE');

  // Customer reference for the BOSS order: shipping name when the buyer
  // supplied one, else the account email (BOSS requires a customerName).
  const snapshot = await env.DB.prepare(
    'SELECT payload FROM native_order_snapshots WHERE id = ?1',
  ).bind(orderId).first<OrderSnapshotRow>();
  let customerName = '';
  if (snapshot?.payload) {
    try {
      const order = JSON.parse(snapshot.payload) as Record<string, unknown>;
      const address = order.shippingAddress && typeof order.shippingAddress === 'object'
        ? order.shippingAddress as Record<string, unknown>
        : null;
      customerName = optionalString(address?.name) ?? optionalString(order.customerEmail) ?? '';
    } catch {
      customerName = '';
    }
  }
  if (!customerName) customerName = `order-${orderId}`;

  let placed = 0;
  for (const line of bossLines) {
    const lineId = `boss_line_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const existing = await env.DB.prepare(
      `SELECT id, status, boss_order_no FROM native_boss_order_lines
       WHERE order_id = ?1 AND line_item_id = ?2`,
    ).bind(orderId, line.lineItemId).first<{ id: string; status: BossOrderLineRow['status']; boss_order_no: string | null }>();

    if (existing && (existing.status === 'created' || existing.status === 'completed')) {
      continue; // already fulfilled on a prior attempt of this event
    }
    if (existing && existing.status === 'unverified') {
      continue; // operator review in progress; never re-order
    }
    if (existing && existing.status === 'pending') {
      // Intent row survived but no upstream outcome was recorded: the
      // previous create may have reached BOSS. Flag for review instead of
      // risking a duplicate paid eSIM order.
      await env.DB.prepare(
        `UPDATE native_boss_order_lines SET status = 'unverified',
           error = ?1, updated_at = ?2
         WHERE id = ?3`,
      ).bind(`Unresolved create outcome (event ${providerEventId})`, now, existing.id).run();
      throw new Error('BOSS_ORDER_UNVERIFIED');
    }
    if (!existing) {
      await env.DB.prepare(
        `INSERT INTO native_boss_order_lines
         (id, order_id, line_item_id, user_id, product_id, boss_odoo_id, boss_default_code,
          quantity, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'pending', ?9, ?9)`,
      ).bind(lineId, orderId, line.lineItemId, metadata.user_id, line.productId,
        line.facts.bossOdooId, line.facts.defaultCode, line.quantity, now).run();
    } else {
      // Prior attempt failed upstream: re-drive the same line.
      await env.DB.prepare(
        `UPDATE native_boss_order_lines SET status = 'pending', error = NULL, updated_at = ?1 WHERE id = ?2`,
      ).bind(now, existing.id).run();
    }

    try {
      const bossOrder = await createBossOrder(env, {
        productOdooId: line.facts.bossOdooId,
        quantity: line.quantity,
        customerName,
        // BOSS v4 asset binding: passing the mall user id makes BOSS auto-bind
        // the (new or reused) eSIM to this account — the prerequisite for
        // my-esims reuse and zero provisioning fees on repeat purchases.
        userId: metadata.user_id,
        ...(line.iccid ? { iccid: line.iccid } : {}),
        remark: `${orderId}/${line.lineItemId}`,
      });
      // BOSS accepts the order (HTTP 10000, Odoo INVOICED) but upstream
      // provisioning can still fail inline — e.g. empty SIM inventory
      // returns upstreamStatus FAILED with an upstreamMsg. Store that as a
      // failed line so the admin redeliver path re-drives it; marking it
      // 'created' here would make the idempotency guard skip this order
      // forever.
      const upstreamFailed = String(bossOrder.upstreamStatus ?? '').toUpperCase() === 'FAILED';
      const upstreamMsg = optionalString(bossOrder.upstreamMsg);
      await env.DB.prepare(
        `UPDATE native_boss_order_lines SET
           status = ?1, boss_order_no = ?2, boss_odoo_order_name = ?3,
           error = ?4, payload_json = ?5, updated_at = ?6
         WHERE order_id = ?7 AND line_item_id = ?8`,
      ).bind(
        upstreamFailed ? 'failed' : 'created',
        bossOrder.orderNo,
        optionalString(bossOrder.odooOrderName),
        upstreamFailed ? `BOSS upstream FAILED: ${upstreamMsg ?? 'unknown reason'}`.slice(0, 500) : null,
        JSON.stringify({ providerEventId, bossOrder }),
        new Date().toISOString(),
        orderId,
        line.lineItemId,
      ).run();
      if (!upstreamFailed) placed += 1;
    } catch (error) {
      await env.DB.prepare(
        `UPDATE native_boss_order_lines SET status = 'failed', error = ?1, updated_at = ?2
         WHERE order_id = ?3 AND line_item_id = ?4`,
      ).bind(errorMessage(error).slice(0, 500), new Date().toISOString(), orderId, line.lineItemId).run();
      throw error;
    }
  }
  return { placed, skipped: false };
}

/**
 * BOSS order states that mean the fulfillment is finished upstream. The
 * platform reports upstreamStatus DONE (activated) / SKIP (no iccid —
 * nothing to provision) / FAILED; without `done`/`skip` here the sweep
 * re-polled finished lines forever and lines never reached `completed`.
 */
const BOSS_TERMINAL_STATUS = /delivered|completed|finished|activated|\bdone\b|\bskip\b/i;

/**
 * Periodic sweep: poll BOSS for placed eSIM orders and record upstream
 * completion (activation details land in payload_json verbatim).
 */
export async function syncBossOrderStatuses(
  env: BossOrderEnv,
  limit = 50,
): Promise<{ checked: number; completed: number }> {
  if (!env.BOSS_API_KEY?.trim()) return { checked: 0, completed: 0 };
  const bounded = Math.min(Math.max(Math.trunc(limit), 1), 200);
  const lines = await env.DB.prepare(
    `SELECT id, order_id, boss_order_no, payload_json FROM native_boss_order_lines
     WHERE status = 'created' AND boss_order_no IS NOT NULL
     ORDER BY updated_at ASC LIMIT ?1`,
  ).bind(bounded).all<{ id: string; order_id: string; boss_order_no: string; payload_json: string }>();
  let checked = 0;
  let completed = 0;
  for (const line of lines.results) {
    let record: ({ found: boolean } & Record<string, unknown>) | null = null;
    try {
      record = await getBossOrderStatus(env, line.boss_order_no);
    } catch (error) {
      console.error(JSON.stringify({
        message: 'BOSS order status poll failed',
        orderId: line.order_id,
        orderNo: line.boss_order_no,
        error: errorMessage(error),
      }));
      continue;
    }
    checked += 1;
    if (!record || record.found === false) continue;
    const upstreamStatus = optionalString(record.status) ?? optionalString(record.upstreamStatus) ?? '';
    let payload: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(line.payload_json) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object') payload = parsed;
    } catch {
      payload = {};
    }
    payload.lastStatusRecord = record;
    const now = new Date().toISOString();
    if (upstreamStatus && BOSS_TERMINAL_STATUS.test(upstreamStatus)) {
      await env.DB.prepare(
        `UPDATE native_boss_order_lines SET status = 'completed', payload_json = ?1, updated_at = ?2 WHERE id = ?3`,
      ).bind(JSON.stringify(payload), now, line.id).run();
      completed += 1;
    } else if (upstreamStatus.toUpperCase() === 'FAILED') {
      // Upstream provisioning failed (e.g. empty SIM inventory): flip the
      // line to failed so the admin redeliver path can re-drive it — a line
      // left on 'created' would be skipped by the idempotency guard forever.
      const upstreamMsg = optionalString((record as Record<string, unknown>).upstreamMsg);
      await env.DB.prepare(
        `UPDATE native_boss_order_lines SET status = 'failed', error = ?1, payload_json = ?2, updated_at = ?3 WHERE id = ?4`,
      ).bind(`BOSS upstream FAILED: ${upstreamMsg || 'unknown reason'}`.slice(0, 500), JSON.stringify(payload), now, line.id).run();
    } else {
      await env.DB.prepare(
        `UPDATE native_boss_order_lines SET payload_json = ?1, updated_at = ?2 WHERE id = ?3`,
      ).bind(JSON.stringify(payload), now, line.id).run();
    }
  }
  return { checked, completed };
}
