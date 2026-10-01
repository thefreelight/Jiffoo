import { authenticateNativeAdmin, authenticateNativeUser, type NativeAuthEnv } from './auth';
import { getNativePluginConfig, type PluginSettingsEnv } from './plugin-settings';
import {
  constantTimeTextEqual, FourPxNativeProvider, Kuaidi100NativeProvider,
  sha256Hex, ShippingProviderError, signKuaidi100Webhook,
} from './shipping-providers';
import { upsertSupplierShipment } from './shipments';

interface NativeShippingEnv extends NativeAuthEnv, PluginSettingsEnv {
  DB: D1Database;
}

interface ShippingItem {
  productKind?: unknown;
}

interface ShippingRequest {
  items?: unknown;
}

type JsonObject = Record<string, unknown>;

interface ProviderOrderRow {
  operation?: string;
  merchant_reference?: string;
  order_id?: string;
  request_hash: string;
  state: 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'UNKNOWN';
  response_json: string | null;
}

const manualMethod = {
  methodId: 'standard',
  methodName: 'Standard Shipping',
  description: 'Built-in manual shipping rate',
  rate: 0,
  currency: 'USD',
  estimatedDays: null,
  isFree: true,
  pluginSlug: 'shipping',
};

function success(data: unknown): Response {
  return Response.json({ success: true, data }, {
    headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-shipping' },
  });
}

function failure(status: number, code: string, message: string): Response {
  return Response.json({ success: false, error: { code, message } }, {
    status,
    headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-shipping' },
  });
}

function providerFailure(error: unknown): Response {
  const provider = error instanceof ShippingProviderError ? error : null;
  const code = provider?.code ?? 'PROVIDER_ERROR';
  const status = code === 'IDEMPOTENCY_CONFLICT' || code === 'PROVIDER_REQUEST_PENDING'
    ? 409 : provider?.retryable ? 503 : 400;
  return Response.json({ success: false, error: { code, message: error instanceof Error ? error.message : 'Shipping provider request failed', retryable: provider?.retryable ?? false } }, {
    status, headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-d1-shipping-1.1.0' },
  });
}

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function string(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function providerConfig(env: NativeShippingEnv): Promise<JsonObject> {
  const stored = await getNativePluginConfig(env, 'shipping');
  if (!stored?.enabled) throw new ShippingProviderError('Shipping plugin is disabled', 'PLUGIN_DISABLED');
  return stored.config;
}

async function kuaidi100(env: NativeShippingEnv): Promise<Kuaidi100NativeProvider> {
  const config = await providerConfig(env);
  const key = string(config.kuaidi100Key);
  const secret = string(config.kuaidi100Secret);
  if (config.kuaidi100Enabled !== true || !key || !secret) throw new ShippingProviderError('Kuaidi100 is not configured', 'PROVIDER_NOT_CONFIGURED');
  return new Kuaidi100NativeProvider({
    key,
    secret,
    customer: string(config.kuaidi100Customer) ?? undefined,
    environment: config.mode === 'test' ? 'test' : 'live',
  });
}

async function fourpx(env: NativeShippingEnv): Promise<FourPxNativeProvider> {
  const config = await providerConfig(env);
  const appKey = string(config.fourpxAppKey);
  const appSecret = string(config.fourpxAppSecret);
  if (config.fourpxEnabled !== true || !appKey || !appSecret) throw new ShippingProviderError('4PX is not configured', 'PROVIDER_NOT_CONFIGURED');
  return new FourPxNativeProvider({
    appKey, appSecret, environment: config.mode === 'test' ? 'test' : 'live',
    accessToken: string(config.fourpxAccessToken) ?? undefined,
    language: config.fourpxLanguage === 'cn' ? 'cn' : 'en',
  });
}

function json(value: string | null): unknown {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

function extractProviderIdentity(response: unknown): { externalOrderId: string | null; trackingNumber: string | null } {
  const root = object(response);
  const data = object(root.data);
  const first = (keys: string[]) => keys.map((key) => string(data[key]) ?? string(root[key])).find(Boolean) ?? null;
  return {
    externalOrderId: first(['taskId', 'orderId', 'request_no', '4px_tracking_no']),
    trackingNumber: first(['kuaidinum', '4px_tracking_no', 'label_barcode']),
  };
}

async function providerCreate(
  env: NativeShippingEnv, provider: 'kuaidi100' | 'fourpx', reference: string,
  operation: string, orderId: string, payload: JsonObject, invoke: () => Promise<JsonObject>,
): Promise<{ replayed: boolean; response: unknown }> {
  const requestHash = await sha256Hex(JSON.stringify(payload));
  let existing = await env.DB.prepare(
    'SELECT request_hash, state, response_json FROM native_shipping_provider_orders WHERE provider_key = ?1 AND operation = ?2 AND merchant_reference = ?3',
  ).bind(provider, operation, reference).first<ProviderOrderRow>();
  if (existing) {
    if (existing.request_hash !== requestHash) throw new ShippingProviderError('The provider reference was already used with a different payload', 'IDEMPOTENCY_CONFLICT');
    if (existing.state === 'COMPLETED') return { replayed: true, response: json(existing.response_json) };
    if (existing.state !== 'FAILED') throw new ShippingProviderError('The provider request is processing or needs reconciliation', 'PROVIDER_REQUEST_PENDING', true);
    const reclaimed = await env.DB.prepare(
      "UPDATE native_shipping_provider_orders SET state = 'PROCESSING', error_code = NULL, error_message = NULL, updated_at = ?1 WHERE provider_key = ?2 AND operation = ?3 AND merchant_reference = ?4 AND state = 'FAILED'",
    ).bind(new Date().toISOString(), provider, operation, reference).run();
    if ((reclaimed.meta.changes ?? 0) !== 1) throw new ShippingProviderError('The provider request is already processing', 'PROVIDER_REQUEST_PENDING', true);
  } else {
    const now = new Date().toISOString();
    const claimed = await env.DB.prepare(
      `INSERT OR IGNORE INTO native_shipping_provider_orders
       (id, provider_key, merchant_reference, order_id, operation, request_hash, state, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'PROCESSING', ?7, ?7)`,
    ).bind(crypto.randomUUID(), provider, reference, orderId, operation, requestHash, now).run();
    if ((claimed.meta.changes ?? 0) !== 1) {
      existing = await env.DB.prepare(
        'SELECT request_hash, state, response_json FROM native_shipping_provider_orders WHERE provider_key = ?1 AND operation = ?2 AND merchant_reference = ?3',
      ).bind(provider, operation, reference).first<ProviderOrderRow>();
      if (existing?.request_hash !== requestHash) throw new ShippingProviderError('The provider reference was already used with a different payload', 'IDEMPOTENCY_CONFLICT');
      if (existing?.state === 'COMPLETED') return { replayed: true, response: json(existing.response_json) };
      throw new ShippingProviderError('The provider request is already processing', 'PROVIDER_REQUEST_PENDING', true);
    }
  }

  let response: JsonObject;
  try {
    response = await invoke();
  } catch (error) {
    const normalized = error instanceof ShippingProviderError ? error : new ShippingProviderError('Shipping provider request failed', 'PROVIDER_ERROR');
    await env.DB.prepare(
      `UPDATE native_shipping_provider_orders SET state = ?1, error_code = ?2, error_message = ?3, updated_at = ?4
       WHERE provider_key = ?5 AND operation = ?6 AND merchant_reference = ?7`,
    ).bind(normalized.outcomeUnknown ? 'UNKNOWN' : 'FAILED', normalized.code, normalized.message, new Date().toISOString(), provider, operation, reference).run();
    throw normalized;
  }

  const identity = extractProviderIdentity(response);
  try {
    const persisted = await env.DB.prepare(
      `UPDATE native_shipping_provider_orders SET state = 'COMPLETED', external_order_id = ?1,
       tracking_number = ?2, response_json = ?3, updated_at = ?4
       WHERE provider_key = ?5 AND operation = ?6 AND merchant_reference = ?7 AND state = 'PROCESSING'`,
    ).bind(identity.externalOrderId, identity.trackingNumber, JSON.stringify(response), new Date().toISOString(), provider, operation, reference).run();
    if ((persisted.meta.changes ?? 0) !== 1) throw new Error('Provider result update did not match its claim');
    return { replayed: false, response };
  } catch {
    await env.DB.prepare(
      `UPDATE native_shipping_provider_orders SET state = 'UNKNOWN', error_code = 'RESULT_PERSISTENCE_ERROR',
       error_message = 'The provider accepted the request but its result could not be persisted', updated_at = ?1
       WHERE provider_key = ?2 AND operation = ?3 AND merchant_reference = ?4 AND state = 'PROCESSING'`,
    ).bind(new Date().toISOString(), provider, operation, reference).run().catch(() => undefined);
    throw new ShippingProviderError('The provider accepted the request but its result requires reconciliation', 'RESULT_PERSISTENCE_ERROR', true, true);
  }
}

function callbackStatus(event: JsonObject, lastResult: JsonObject): string {
  const status = string(event.status)?.toLowerCase();
  const state = String(lastResult.state ?? '');
  if (lastResult.ischeck === '1' || state === '3' || status === 'shutdown') return 'DELIVERED';
  if (status === 'abort') return 'EXCEPTION';
  if (state === '5') return 'OUT_FOR_DELIVERY';
  return 'IN_TRANSIT';
}

function callbackEvents(lastResult: JsonObject, overallStatus: string): Array<Record<string, unknown>> {
  if (!Array.isArray(lastResult.data)) return [];
  return lastResult.data.map((entry) => {
    const item = object(entry);
    return {
      status: /^[A-Z_]+$/.test(string(item.status)?.toUpperCase() ?? '') ? string(item.status) : overallStatus,
      occurredAt: string(item.ftime) ?? string(item.time) ?? new Date().toISOString(),
      description: string(item.context),
    };
  });
}

function providerPath(pathname: string): string | null {
  for (const prefix of ['/api/v1/extensions/plugin/shipping/api', '/api/v1/plugins/shipping', '/api/v1/shipping']) {
    if (pathname.startsWith(prefix)) return pathname.slice(prefix.length) || '/';
  }
  return null;
}

async function adminProviderRequest(request: Request, env: NativeShippingEnv, path: string): Promise<Response> {
  const administrator = await authenticateNativeAdmin(request, env);
  if (!administrator) return failure(401, 'UNAUTHORIZED', 'Administrator authentication is required');
  const body = object(await request.json<unknown>().catch(() => null));
  try {
    const requireOrder = async (): Promise<string | Response> => {
      const orderId = string(body.orderId);
      if (!orderId) return failure(400, 'ORDER_ID_REQUIRED', 'orderId is required for create operations');
      const order = await env.DB.prepare('SELECT id FROM native_order_snapshots WHERE id = ?1').bind(orderId).first();
      return order ? orderId : failure(404, 'ORDER_NOT_FOUND', 'The Bokmoo order does not exist');
    };
    if (path === '/admin/providers/kuaidi100/label-orders') {
      const reference = string(body.reference);
      const orderId = await requireOrder();
      if (orderId instanceof Response) return orderId;
      const input = object(body.input);
      if (!reference) return failure(400, 'REFERENCE_REQUIRED', 'reference is required');
      if (!string(input.partnerId)) return failure(400, 'PARTNER_ID_REQUIRED', 'input.partnerId is required');
      if (['CLOUD', 'ORDERFIRST'].includes(string(input.printType)?.toUpperCase() ?? '') && !string(input.siid)) return failure(400, 'SIID_REQUIRED', 'input.siid is required for cloud printing');
      return success(await providerCreate(env, 'kuaidi100', reference, 'label.order', orderId, input, async () => (await kuaidi100(env)).createLabel(input)));
    }
    if (path === '/admin/providers/kuaidi100/pickup-orders') {
      const reference = string(body.reference);
      const orderId = await requireOrder();
      if (orderId instanceof Response) return orderId;
      if (!reference || reference.length > 32) return failure(400, 'REFERENCE_INVALID', 'reference is required and must not exceed 32 characters');
      const input = { ...object(body.input), thirdOrderId: reference };
      return success(await providerCreate(env, 'kuaidi100', reference, 'pickup.order', orderId, input, async () => (await kuaidi100(env)).createPickup(input)));
    }
    if (path === '/admin/providers/kuaidi100/tracking/query') return success(await (await kuaidi100(env)).query(object(body.input)));
    if (path === '/admin/providers/kuaidi100/tracking/subscribe') return success(await (await kuaidi100(env)).subscribe(body));
    if (path === '/admin/providers/fourpx/orders') {
      const reference = string(body.reference);
      const orderId = await requireOrder();
      if (orderId instanceof Response) return orderId;
      if (!reference) return failure(400, 'REFERENCE_REQUIRED', 'reference is required');
      const input = { ...object(body.input), ref_no: reference };
      return success(await providerCreate(env, 'fourpx', reference, 'order.create', orderId, input, async () => (await fourpx(env)).create(input)));
    }
    if (path === '/admin/providers/fourpx/orders/get') return success(await (await fourpx(env)).get(object(body.input)));
    if (path === '/admin/providers/fourpx/orders/cancel') return success(await (await fourpx(env)).cancel(body));
    if (path === '/admin/providers/fourpx/labels') return success(await (await fourpx(env)).label(object(body.input)));
    if (path === '/admin/providers/fourpx/tracking') {
      const deliveryOrderNo = string(body.deliveryOrderNo);
      if (!deliveryOrderNo) return failure(400, 'TRACKING_NUMBER_REQUIRED', 'deliveryOrderNo is required');
      return success(await (await fourpx(env)).tracking({ deliveryOrderNo }));
    }
    if (path === '/admin/providers/operations/status') {
      const provider = string(body.provider);
      const operation = string(body.operation);
      const reference = string(body.reference);
      if (!provider || !operation || !reference) return failure(400, 'OPERATION_ID_REQUIRED', 'provider, operation and reference are required');
      const row = await env.DB.prepare(
        `SELECT provider_key, operation, merchant_reference, order_id, state, external_order_id, tracking_number,
          error_code, error_message, created_at, updated_at FROM native_shipping_provider_orders
         WHERE provider_key = ?1 AND operation = ?2 AND merchant_reference = ?3`,
      ).bind(provider, operation, reference).first();
      return row ? success(row) : failure(404, 'OPERATION_NOT_FOUND', 'Shipping provider operation not found');
    }
    if (path === '/admin/providers/operations/resolve') {
      const provider = string(body.provider);
      const operation = string(body.operation);
      const reference = string(body.reference);
      const resolution = string(body.resolution)?.toUpperCase();
      const reason = string(body.reason);
      if (!provider || !operation || !reference || !['COMPLETED', 'FAILED', 'UNKNOWN'].includes(resolution ?? '')) return failure(400, 'RESOLUTION_INVALID', 'provider, operation, reference and a valid resolution are required');
      if (!reason) return failure(400, 'RESOLUTION_REASON_REQUIRED', 'reason is required for reconciliation audit');
      if (resolution === 'FAILED' && body.confirmRetryRisk !== true) return failure(400, 'RETRY_RISK_CONFIRMATION_REQUIRED', 'confirmRetryRisk must be true before allowing another create attempt');
      if (resolution === 'COMPLETED' && !string(body.externalOrderId) && !string(body.trackingNumber)) return failure(400, 'RESOLUTION_EVIDENCE_REQUIRED', 'externalOrderId or trackingNumber is required to confirm completion');
      if (resolution === 'UNKNOWN') {
        const leaseCutoff = new Date(Date.now() - 15 * 60_000).toISOString();
        const expired = await env.DB.prepare(
          `UPDATE native_shipping_provider_orders SET state = 'UNKNOWN', error_code = 'PROCESSING_LEASE_EXPIRED',
            error_message = ?1, updated_at = ?2 WHERE provider_key = ?3 AND operation = ?4 AND merchant_reference = ?5
            AND state = 'PROCESSING' AND updated_at <= ?6`,
        ).bind(reason, new Date().toISOString(), provider, operation, reference, leaseCutoff).run();
        return (expired.meta.changes ?? 0) === 1 ? success({ resolved: true, state: 'UNKNOWN' }) : failure(409, 'OPERATION_NOT_RESOLVABLE', 'The operation is still active or is not processing');
      }
      const resolutionResponse = JSON.stringify({ manuallyResolved: true, state: resolution, reason, externalOrderId: string(body.externalOrderId), trackingNumber: string(body.trackingNumber) });
      const updated = await env.DB.prepare(
        `UPDATE native_shipping_provider_orders SET state = ?1, external_order_id = COALESCE(?2, external_order_id),
          tracking_number = COALESCE(?3, tracking_number), response_json = ?4,
          error_code = 'MANUALLY_RESOLVED', error_message = ?5, updated_at = ?6
         WHERE provider_key = ?7 AND operation = ?8 AND merchant_reference = ?9 AND state = 'UNKNOWN'`,
      ).bind(resolution, string(body.externalOrderId), string(body.trackingNumber), resolutionResponse, reason, new Date().toISOString(), provider, operation, reference).run();
      return (updated.meta.changes ?? 0) === 1 ? success({ resolved: true, state: resolution }) : failure(409, 'OPERATION_NOT_RESOLVABLE', 'The operation is not awaiting reconciliation');
    }
    return failure(404, 'NOT_FOUND', 'Shipping provider route not found');
  } catch (error) { return providerFailure(error); }
}

async function kuaidi100Webhook(request: Request, env: NativeShippingEnv): Promise<Response> {
  const rawBody = await request.text();
  const form = new URLSearchParams(rawBody);
  const rawParam = form.get('param') ?? '';
  const signature = form.get('sign') ?? request.headers.get('x-kuaidi100-sign') ?? '';
  const config: JsonObject = await providerConfig(env).catch(() => ({}));
  const salt = string(config.kuaidi100CallbackSalt) ?? '';
  if (!rawParam || !signature || !salt || !constantTimeTextEqual(signKuaidi100Webhook(rawParam, salt), signature.toUpperCase())) {
    return Response.json({ result: false, returnCode: '401', message: 'Invalid signature' }, { status: 401 });
  }
  let event: JsonObject;
  try { event = object(JSON.parse(rawParam)); } catch { return Response.json({ result: false, returnCode: '400', message: 'Invalid callback payload' }, { status: 400 }); }
  const eventHash = await sha256Hex(rawParam);
  const now = new Date().toISOString();
  const claim = await env.DB.prepare(
    `INSERT OR IGNORE INTO native_shipping_provider_webhook_events
     (id, provider_key, event_hash, payload_json, processing_state, received_at, updated_at)
     VALUES (?1, 'kuaidi100', ?2, ?3, 'PROCESSING', ?4, ?4)`,
  ).bind(crypto.randomUUID(), eventHash, JSON.stringify(event), now).run();
  if ((claim.meta.changes ?? 0) !== 1) {
    const existing = await env.DB.prepare(
      `SELECT processing_state, updated_at FROM native_shipping_provider_webhook_events
       WHERE provider_key = 'kuaidi100' AND event_hash = ?1`,
    ).bind(eventHash).first<{ processing_state: string; updated_at: string }>();
    const leaseCutoff = new Date(Date.now() - 5 * 60_000).toISOString();
    if (existing?.processing_state === 'APPLIED') {
      return Response.json({ result: true, returnCode: '200', message: 'success', duplicate: true }, { headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-shipping-1.1.0' } });
    }
    if (existing?.processing_state === 'PROCESSING' && existing.updated_at > leaseCutoff) {
      return Response.json({ result: false, returnCode: '503', message: 'Callback is still processing; retry later' }, { status: 503, headers: { 'retry-after': '300' } });
    }
    const reclaimed = await env.DB.prepare(
      `UPDATE native_shipping_provider_webhook_events SET processing_state = 'PROCESSING', last_error = NULL, updated_at = ?1
       WHERE provider_key = 'kuaidi100' AND event_hash = ?2
         AND (processing_state IN ('UNMATCHED', 'FAILED') OR (processing_state = 'PROCESSING' AND updated_at <= ?3))`,
    ).bind(now, eventHash, leaseCutoff).run();
    if ((reclaimed.meta.changes ?? 0) !== 1) return Response.json({ result: true, returnCode: '200', message: 'success', duplicate: true });
  }
  try {
    const lastResult = object(event.lastResult);
    const trackingNumber = string(lastResult.nu) ?? string(lastResult.number);
    let matchedOrderId: string | null = null;
    if (trackingNumber) {
    const operation = await env.DB.prepare(
      `SELECT order_id FROM native_shipping_provider_orders WHERE provider_key = 'kuaidi100' AND tracking_number = ?1
       ORDER BY updated_at DESC LIMIT 1`,
    ).bind(trackingNumber).first<{ order_id: string }>();
    matchedOrderId = operation?.order_id ?? null;
      if (matchedOrderId) {
        const overallStatus = callbackStatus(event, lastResult);
        await upsertSupplierShipment(env.DB, {
          orderId: matchedOrderId,
          carrierCode: string(lastResult.com),
          carrierName: string(lastResult.com),
          trackingNumber,
          status: overallStatus,
          lastCheckedAt: new Date().toISOString(),
          events: callbackEvents(lastResult, overallStatus),
        });
      }
    }
    await env.DB.prepare(
      `UPDATE native_shipping_provider_webhook_events SET processing_state = ?1, matched_order_id = ?2, updated_at = ?3
       WHERE provider_key = 'kuaidi100' AND event_hash = ?4`,
    ).bind(matchedOrderId ? 'APPLIED' : 'UNMATCHED', matchedOrderId, new Date().toISOString(), eventHash).run();
    if (!matchedOrderId) {
      return Response.json({ result: false, returnCode: '503', message: 'Shipment mapping is not ready; retry later', matched: false }, { status: 503, headers: { 'retry-after': '1800', 'x-jiffoo-runtime': 'cloudflare-native-d1-shipping-1.1.0' } });
    }
    return Response.json({ result: true, returnCode: '200', message: 'success', matched: true }, { headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-shipping-1.1.0' } });
  } catch (error) {
    await env.DB.prepare(
      `UPDATE native_shipping_provider_webhook_events SET processing_state = 'FAILED', last_error = ?1, updated_at = ?2
       WHERE provider_key = 'kuaidi100' AND event_hash = ?3 AND processing_state = 'PROCESSING'`,
    ).bind(error instanceof Error ? error.message.slice(0, 500) : 'Shipment projection failed', new Date().toISOString(), eventHash).run().catch(() => undefined);
    return Response.json({ result: false, returnCode: '500', message: 'Shipment projection failed' }, { status: 500 });
  }
}

function calculate(body: ShippingRequest): { methods: typeof manualMethod[]; requiresShipping: boolean } | null {
  if (!Array.isArray(body.items)) return null;
  const requiresShipping = body.items.some((item) => {
    const productKind = typeof item === 'object' && item !== null
      ? (item as ShippingItem).productKind
      : undefined;
    return productKind === 'goods' || productKind === 'consumable';
  });
  return { methods: requiresShipping ? [manualMethod] : [], requiresShipping };
}

export async function tryNativeShipping(request: Request, env: NativeShippingEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const path = providerPath(url.pathname);
  if (path === '/admin/webhooks/kuaidi100' && request.method === 'POST') return kuaidi100Webhook(request, env);
  if (path?.startsWith('/admin/providers/') && request.method === 'POST') return adminProviderRequest(request, env, path);
  if (url.pathname === '/api/v1/shipping/calculate' && request.method === 'POST') {
    const body = await request.json<ShippingRequest>().catch(() => null);
    const result = body ? calculate(body) : null;
    return result ? success(result) : failure(400, 'VALIDATION_ERROR', 'Shipping items are required');
  }

  if (url.pathname !== '/api/v1/shipping/select' || request.method !== 'POST') return null;
  const user = await authenticateNativeUser(request, env);
  if (!user) return null;
  const body = await request.json<ShippingRequest & { methodId?: unknown; pluginSlug?: unknown }>().catch(() => null);
  const calculated = body ? calculate(body) : null;
  if (!calculated || body?.methodId !== manualMethod.methodId || body.pluginSlug !== manualMethod.pluginSlug) {
    return failure(404, 'INVALID_SHIPPING_METHOD', 'Selected shipping method is not available');
  }
  if (!calculated.requiresShipping) {
    return failure(404, 'INVALID_SHIPPING_METHOD', 'Selected shipping method is not available');
  }
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO native_shipping_selections
      (user_id, method_id, method_name, plugin_slug, shipping_amount, selected_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT(user_id) DO UPDATE SET method_id = excluded.method_id,
       method_name = excluded.method_name, plugin_slug = excluded.plugin_slug,
       shipping_amount = excluded.shipping_amount, selected_at = excluded.selected_at`,
  ).bind(user.id, manualMethod.methodId, manualMethod.methodName, manualMethod.pluginSlug, manualMethod.rate, now).run();
  return success({ selected: true, shippingAmount: manualMethod.rate, methodName: manualMethod.methodName });
}
