import { normalizeShipmentStatus, upsertSupplierShipment } from './shipments';
import { enqueueShipmentEmail } from './mail-outbox';
import { createNativeOdooOrder, readNativeOdooShipments } from './odoo';
import { getNativePluginSecret } from './plugin-settings';

interface ExternalOrderEnv {
  DB: D1Database;
  JWT_SECRET: SecretsStoreSecret;
  CORE_ORIGIN: string;
  PUBLIC_API_BASE_URL?: string;
  CATALOG_IMPORT_TOKEN?: SecretsStoreSecret | string;
}

interface SupplierUpdate {
  provider?: unknown;
  installationId?: unknown;
  externalOrderRef?: unknown;
  externalOrderName?: unknown;
  externalStatus?: unknown;
  productCode?: unknown;
  shipmentId?: unknown;
  carrierCode?: unknown;
  carrierName?: unknown;
  trackingNumber?: unknown;
  trackingUrl?: unknown;
  shipmentStatus?: unknown;
  shippedAt?: unknown;
  estimatedDeliveryAt?: unknown;
  lastCheckedAt?: unknown;
  shipmentEvents?: unknown;
  rawResponse?: unknown;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function value(source: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) if (source[key] !== undefined) return source[key];
  return undefined;
}

export function normalizeOdooWebhook(raw: unknown): SupplierUpdate | null {
  const source = object(raw);
  if (Object.keys(source).length === 0) return null;
  const shipment = { ...object(source.shipping), ...object(source.shipment) };
  const field = (...keys: string[]) => value(shipment, ...keys) ?? value(source, ...keys);
  return {
    provider: 'odoo',
    externalOrderRef: value(source, 'externalOrderRef', 'external_order_ref', 'customerOrderRef', 'customer_order_ref', 'client_order_ref'),
    externalOrderName: value(source, 'externalOrderName', 'external_order_name', 'orderName', 'order_name', 'name'),
    externalStatus: value(source, 'externalStatus', 'external_status', 'state'),
    productCode: value(source, 'productCode', 'product_code', 'default_code'),
    shipmentId: value(shipment, 'shipmentId', 'shipment_id', 'id') ?? value(source, 'shipmentId', 'shipment_id'),
    carrierCode: field('carrierCode', 'carrier_code'),
    carrierName: field('carrierName', 'carrier_name', 'carrier'),
    trackingNumber: field('trackingNumber', 'tracking_number'),
    trackingUrl: field('trackingUrl', 'tracking_url'),
    shipmentStatus: field('shipmentStatus', 'shipment_status', 'status'),
    shippedAt: field('shippedAt', 'shipped_at', 'date_done'),
    estimatedDeliveryAt: field('estimatedDeliveryAt', 'estimated_delivery_at', 'scheduled_date'),
    lastCheckedAt: field('lastCheckedAt', 'last_checked_at', 'write_date'),
    shipmentEvents: field('shipmentEvents', 'shipment_events', 'events'),
    rawResponse: source,
  };
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function fulfillmentStatus(externalStatus: string | null, shipmentStatus: string | null): string {
  const value = `${externalStatus ?? ''} ${shipmentStatus ?? ''}`.toLowerCase();
  if (value.includes('deliver') || value.includes('complete')) return 'delivered';
  if (value.includes('fail') || value.includes('exception') || value.includes('cancel')) return 'failed';
  if (value.includes('ship') || value.includes('transit') || value.includes('processing')) return 'processing';
  return 'pending';
}

export async function submitNativeOdooOrders(env: ExternalOrderEnv, orderId: string): Promise<void> {
  const snapshot = await env.DB.prepare('SELECT payload FROM native_order_snapshots WHERE id = ?1').bind(orderId).first<{ payload: string }>();
  if (!snapshot) throw new Error(`Order ${orderId} is missing`);
  const order = JSON.parse(snapshot.payload) as Record<string, unknown>;
  const items = Array.isArray(order.items) ? order.items as Array<Record<string, unknown>> : [];
  for (const item of items) {
    const attributes = item.variantAttributes && typeof item.variantAttributes === 'object' && !Array.isArray(item.variantAttributes)
      ? item.variantAttributes as Record<string, unknown> : {};
    if (attributes.provider !== 'odoo') continue;
    const itemId = text(item.id);
    const installationId = text(attributes.installationId);
    const productCode = text(attributes.externalVariantCode) || text(item.variantId);
    if (!itemId || !installationId || !productCode) throw new Error('Odoo item is missing installation or external variant metadata');
    const externalOrderRef = `native-${orderId}-${itemId}`.slice(0, 190);
    const existing = await env.DB.prepare(
      `SELECT sync_status FROM native_external_order_links
       WHERE provider = 'odoo' AND installation_id = ?1 AND order_item_id = ?2`,
    ).bind(installationId, itemId).first<{ sync_status: string }>();
    if (existing?.sync_status === 'SUBMITTED' || existing?.sync_status === 'COMPLETED') continue;
    const requestPayload = {
      externalOrderRef,
      coreOrderId: orderId,
      coreOrderItemId: itemId,
      productCode,
      quantity: Number(item.quantity) || 1,
      fulfillmentData: item.fulfillmentData ?? null,
      shippingAddress: order.shippingAddress ?? null,
      customerEmail: order.customerEmail ?? null,
    };
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO native_external_order_links
        (id, provider, installation_id, order_id, order_item_id, external_order_ref, sync_status,
         request_payload, attempt_count, created_at, updated_at)
       VALUES (?1, 'odoo', ?2, ?3, ?4, ?5, 'PENDING', ?6, 0, ?7, ?7)
       ON CONFLICT(provider, installation_id, order_item_id) DO UPDATE SET
         request_payload = excluded.request_payload, updated_at = excluded.updated_at`,
    ).bind(crypto.randomUUID(), installationId, orderId, itemId, externalOrderRef, JSON.stringify(requestPayload), now).run();
    const nativeResult = await createNativeOdooOrder(env, requestPayload);
    if (nativeResult) {
      await env.DB.prepare(
        `UPDATE native_external_order_links SET sync_status = 'SUBMITTED', external_order_name = ?1,
         external_status = ?2, response_payload = ?3, last_error = NULL, attempt_count = attempt_count + 1,
         last_synced_at = ?4, updated_at = ?4 WHERE external_order_ref = ?5`,
      ).bind(nativeResult.orderName, nativeResult.externalStatus, JSON.stringify(nativeResult), now, externalOrderRef).run();
      item.fulfillmentStatus = 'processing';
      item.fulfillmentData = { ...(item.fulfillmentData && typeof item.fulfillmentData === 'object' ? item.fulfillmentData as Record<string, unknown> : {}), provider: 'odoo', installationId, externalOrderRef, externalOrderName: nativeResult.orderName, externalStatus: nativeResult.externalStatus, productCode };
      continue;
    }
    const endpoint = new URL(`/api/extensions/plugin/odoo/api/orders/create`, env.CORE_ORIGIN);
    endpoint.searchParams.set('installationId', installationId);
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-platform-api-base-url': `${(env.PUBLIC_API_BASE_URL?.trim() || env.CORE_ORIGIN).replace(/\/+$/, '')}/api`,
        },
        body: JSON.stringify(requestPayload),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      await env.DB.prepare(
        `UPDATE native_external_order_links SET sync_status = 'FAILED', last_error = ?1,
         attempt_count = attempt_count + 1, last_synced_at = ?2, updated_at = ?2 WHERE external_order_ref = ?3`,
      ).bind(error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000), now, externalOrderRef).run();
      throw error;
    }
    const responseBody: Record<string, unknown> = await response.json<Record<string, unknown>>().catch(() => ({}));
    const data = responseBody.data && typeof responseBody.data === 'object' ? responseBody.data as Record<string, unknown> : responseBody;
    if (!response.ok || responseBody.success === false) {
      const errorObject = responseBody.error && typeof responseBody.error === 'object' && !Array.isArray(responseBody.error)
        ? responseBody.error as Record<string, unknown> : null;
      const message = text(responseBody.message) || text(responseBody.error) || text(errorObject?.message) || `Odoo gateway returned HTTP ${response.status}`;
      await env.DB.prepare(
        `UPDATE native_external_order_links SET sync_status = 'FAILED', response_payload = ?1, last_error = ?2,
         attempt_count = attempt_count + 1, last_synced_at = ?3, updated_at = ?3 WHERE external_order_ref = ?4`,
      ).bind(JSON.stringify(responseBody), message, now, externalOrderRef).run();
      throw new Error(message ?? 'Odoo order creation failed');
    }
    await env.DB.prepare(
      `UPDATE native_external_order_links SET sync_status = 'SUBMITTED', external_order_name = ?1,
       external_status = ?2, response_payload = ?3, last_error = NULL, attempt_count = attempt_count + 1,
       last_synced_at = ?4, updated_at = ?4 WHERE external_order_ref = ?5`,
    ).bind(text(data.orderName) || text(data.externalOrderName), text(data.externalStatus) || 'submitted', JSON.stringify(responseBody), now, externalOrderRef).run();
    item.fulfillmentStatus = 'processing';
    item.fulfillmentData = { ...(item.fulfillmentData && typeof item.fulfillmentData === 'object' ? item.fulfillmentData as Record<string, unknown> : {}), provider: 'odoo', installationId, externalOrderRef, externalOrderName: text(data.orderName) || text(data.externalOrderName), externalStatus: text(data.externalStatus) || 'submitted', productCode };
  }
  order.items = items;
  order.updatedAt = new Date().toISOString();
  await env.DB.prepare('UPDATE native_order_snapshots SET payload = ?1, source_updated_at = ?2 WHERE id = ?3').bind(JSON.stringify(order), order.updatedAt, orderId).run();
}

/** Poll Odoo pickings for a small bounded set of linked orders. */
export async function processNativeOdooShipmentPoll(env: ExternalOrderEnv): Promise<{ received: number; matched: number }> {
  const shipments = await readNativeOdooShipments(env);
  let matched = 0;
  for (const shipment of shipments) {
    const link = await env.DB.prepare(
      `SELECT id, order_id, order_item_id FROM native_external_order_links
       WHERE provider = 'odoo' AND external_order_ref = ?1 LIMIT 1`,
    ).bind(shipment.externalOrderRef).first<{ id: string; order_id: string; order_item_id: string }>();
    if (!link) continue;
    const now = shipment.lastCheckedAt || new Date().toISOString();
    await upsertSupplierShipment(env.DB, {
      orderId: link.order_id,
      shipmentId: shipment.shipmentId,
      carrierName: shipment.carrierName,
      trackingNumber: shipment.trackingNumber,
      status: shipment.shipmentStatus,
      shippedAt: shipment.shippedAt,
      lastCheckedAt: now,
      events: [],
    });
    const nextFulfillment = fulfillmentStatus(null, shipment.shipmentStatus);
    const snapshot = await env.DB.prepare('SELECT payload FROM native_order_snapshots WHERE id = ?1').bind(link.order_id).first<{ payload: string }>();
    if (snapshot) {
      const order = JSON.parse(snapshot.payload) as Record<string, unknown>;
      const items = Array.isArray(order.items) ? order.items as Array<Record<string, unknown>> : [];
      const item = items.find((candidate) => candidate.id === link.order_item_id);
      if (item) item.fulfillmentStatus = nextFulfillment;
      order.items = items;
      if (nextFulfillment === 'delivered') order.status = 'DELIVERED';
      order.updatedAt = now;
      await env.DB.prepare('UPDATE native_order_snapshots SET status = ?1, payload = ?2, source_updated_at = ?3 WHERE id = ?4')
        .bind(String(order.status ?? 'PROCESSING'), JSON.stringify(order), now, link.order_id).run();
    }
    const shipmentRow = await env.DB.prepare(
      'SELECT id, carrier, tracking_number, tracking_url, status FROM native_shipments WHERE order_id = ?1 AND tracking_number = ?2',
    ).bind(link.order_id, shipment.trackingNumber || shipment.shipmentId).first<{ id: string; carrier: string; tracking_number: string; tracking_url: string | null; status: string }>();
    if (shipmentRow) {
      const notificationStatus = ['IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(shipmentRow.status) ? 'SHIPPED' : shipmentRow.status;
      await enqueueShipmentEmail(env, { orderId: link.order_id, shipmentId: shipmentRow.id, status: notificationStatus, carrier: shipmentRow.carrier, trackingNumber: shipmentRow.tracking_number, trackingUrl: shipmentRow.tracking_url });
    }
    await env.DB.prepare(
      `UPDATE native_external_order_links SET external_status = ?1, sync_status = 'PROCESSING',
       last_error = NULL, last_synced_at = ?2, updated_at = ?2 WHERE id = ?3`,
    ).bind(shipment.shipmentStatus, now, link.id).run();
    matched += 1;
  }
  return { received: shipments.length, matched };
}

export async function tryNativeExternalOrderSync(request: Request, env: ExternalOrderEnv): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  const legacyPath = path === '/api/v1/admin/integrations/external-orders/sync-status';
  const nativeOdooPath = path === '/api/v1/integrations/odoo/shipment-webhook';
  if (request.method !== 'POST' || (!legacyPath && !nativeOdooPath)) return null;
  const expected = await getNativePluginSecret(env, 'odoo', 'webhookSecret', env.CATALOG_IMPORT_TOKEN);
  const provided = request.headers.get('x-catalog-import-token')?.trim() || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || '';
  if (!expected) return Response.json({ success: false, error: { code: 'EXTERNAL_ORDER_SYNC_DISABLED', message: 'Integration token is not configured' } }, { status: 503 });
  if (!provided || provided !== expected) return Response.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid integration token' } }, { status: 401 });
  const body = await request.json<Record<string, unknown>>().catch(() => null);
  const updates = nativeOdooPath
    ? (Array.isArray(body?.updates) ? body.updates : [body]).map(normalizeOdooWebhook).filter((item): item is SupplierUpdate => Boolean(item))
    : Array.isArray(body?.updates) ? body.updates : [];
  if (updates.length === 0) return Response.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'updates must contain at least one item' } }, { status: 400 });
  let matched = 0;
  for (const raw of updates) {
    if (!raw || typeof raw !== 'object') continue;
    const update = raw as SupplierUpdate;
    const provider = text(update.provider);
    const installationId = text(update.installationId);
    const externalOrderRef = text(update.externalOrderRef);
    if (!provider || !externalOrderRef || (legacyPath && !installationId)) continue;
    const link = installationId
      ? await env.DB.prepare(
        `SELECT id, order_id, order_item_id FROM native_external_order_links
         WHERE provider = ?1 AND installation_id = ?2 AND external_order_ref = ?3`,
      ).bind(provider, installationId, externalOrderRef).first<{ id: string; order_id: string; order_item_id: string }>()
      : await env.DB.prepare(
        `SELECT id, order_id, order_item_id FROM native_external_order_links
         WHERE provider = 'odoo' AND external_order_ref = ?1 ORDER BY created_at DESC LIMIT 1`,
      ).bind(externalOrderRef).first<{ id: string; order_id: string; order_item_id: string }>();
    if (!link) continue;
    const externalStatus = text(update.externalStatus);
    const shipmentStatus = text(update.shipmentStatus);
    const nextFulfillment = fulfillmentStatus(externalStatus, shipmentStatus);
    const now = new Date().toISOString();
    await env.DB.prepare(
      `UPDATE native_external_order_links SET external_order_name = COALESCE(?1, external_order_name),
       external_status = ?2, sync_status = ?3, response_payload = ?4, last_error = NULL,
       attempt_count = attempt_count + 1, last_synced_at = ?5, updated_at = ?5 WHERE id = ?6`,
    ).bind(text(update.externalOrderName), externalStatus, nextFulfillment === 'failed' ? 'FAILED' : nextFulfillment === 'delivered' ? 'COMPLETED' : 'PROCESSING', JSON.stringify(update.rawResponse ?? update), now, link.id).run();
    const snapshot = await env.DB.prepare('SELECT payload FROM native_order_snapshots WHERE id = ?1').bind(link.order_id).first<{ payload: string }>();
    if (snapshot) {
      const order = JSON.parse(snapshot.payload) as Record<string, unknown>;
      const items = Array.isArray(order.items) ? order.items as Array<Record<string, unknown>> : [];
      const item = items.find((candidate) => candidate.id === link.order_item_id);
      if (item) {
        item.fulfillmentStatus = nextFulfillment;
        item.fulfillmentData = { ...(item.fulfillmentData && typeof item.fulfillmentData === 'object' ? item.fulfillmentData as Record<string, unknown> : {}), externalStatus, externalOrderName: text(update.externalOrderName), productCode: text(update.productCode) };
      }
      order.items = items;
      if (nextFulfillment === 'delivered') order.status = 'DELIVERED';
      order.updatedAt = now;
      await env.DB.prepare('UPDATE native_order_snapshots SET status = ?1, payload = ?2, source_updated_at = ?3 WHERE id = ?4').bind(String(order.status ?? 'PROCESSING'), JSON.stringify(order), now, link.order_id).run();
    }
    await upsertSupplierShipment(env.DB, {
      orderId: link.order_id,
      shipmentId: text(update.shipmentId), carrierCode: text(update.carrierCode), carrierName: text(update.carrierName),
      trackingNumber: text(update.trackingNumber), trackingUrl: text(update.trackingUrl), status: shipmentStatus,
      shippedAt: text(update.shippedAt), estimatedDeliveryAt: text(update.estimatedDeliveryAt), lastCheckedAt: text(update.lastCheckedAt),
      events: Array.isArray(update.shipmentEvents) ? update.shipmentEvents.filter((event): event is Record<string, unknown> => Boolean(event && typeof event === 'object' && !Array.isArray(event))) : [],
    });
    const normalizedStatus = normalizeShipmentStatus(shipmentStatus);
    const shipment = await env.DB.prepare(
      'SELECT id, carrier, tracking_number, tracking_url, status FROM native_shipments WHERE order_id = ?1 AND tracking_number = COALESCE(?2, ?3)'
    ).bind(link.order_id, text(update.trackingNumber), text(update.shipmentId)).first<{ id: string; carrier: string; tracking_number: string; tracking_url: string | null; status: string }>();
    if (shipment && shipment.status === normalizedStatus) {
      const notificationStatus = ['IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(shipment.status) ? 'SHIPPED' : shipment.status;
      await enqueueShipmentEmail(env, { orderId: link.order_id, shipmentId: shipment.id, status: notificationStatus, carrier: shipment.carrier, trackingNumber: shipment.tracking_number, trackingUrl: shipment.tracking_url });
    }
    matched += 1;
  }
  return Response.json({ success: true, data: { matched, received: updates.length } }, { headers: { 'x-jiffoo-runtime': nativeOdooPath ? 'cloudflare-native-d1-odoo-shipping' : 'cloudflare-native-d1-external-orders' } });
}
