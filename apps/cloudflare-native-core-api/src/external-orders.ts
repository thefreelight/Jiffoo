import { normalizeShipmentStatus, upsertSupplierShipment } from './shipments';
import { enqueueShipmentEmail } from './mail-outbox';

interface ExternalOrderEnv {
  DB: D1Database;
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

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function secret(value: SecretsStoreSecret | string | undefined): Promise<string> {
  if (!value) return '';
  return typeof value === 'string' ? value : value.get();
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

export async function tryNativeExternalOrderSync(request: Request, env: ExternalOrderEnv): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (request.method !== 'POST' || path !== '/api/v1/admin/integrations/external-orders/sync-status') return null;
  const expected = await secret(env.CATALOG_IMPORT_TOKEN);
  const provided = request.headers.get('x-catalog-import-token')?.trim() || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || '';
  if (!expected) return Response.json({ success: false, error: { code: 'EXTERNAL_ORDER_SYNC_DISABLED', message: 'Integration token is not configured' } }, { status: 503 });
  if (!provided || provided !== expected) return Response.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid integration token' } }, { status: 401 });
  const body = await request.json<{ updates?: unknown }>().catch(() => null);
  if (!body || !Array.isArray(body.updates) || body.updates.length === 0) return Response.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'updates must contain at least one item' } }, { status: 400 });
  let matched = 0;
  for (const raw of body.updates) {
    if (!raw || typeof raw !== 'object') continue;
    const update = raw as SupplierUpdate;
    const provider = text(update.provider);
    const installationId = text(update.installationId);
    const externalOrderRef = text(update.externalOrderRef);
    if (!provider || !installationId || !externalOrderRef) continue;
    const link = await env.DB.prepare(
      `SELECT id, order_id, order_item_id FROM native_external_order_links
       WHERE provider = ?1 AND installation_id = ?2 AND external_order_ref = ?3`,
    ).bind(provider, installationId, externalOrderRef).first<{ id: string; order_id: string; order_item_id: string }>();
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
      await enqueueShipmentEmail(env, { orderId: link.order_id, shipmentId: shipment.id, status: shipment.status, carrier: shipment.carrier, trackingNumber: shipment.tracking_number, trackingUrl: shipment.tracking_url });
    }
    matched += 1;
  }
  return Response.json({ success: true, data: { matched, received: body.updates.length } }, { headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-external-orders' } });
}
