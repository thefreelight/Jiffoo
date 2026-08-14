import { authenticateNativeAdmin, authenticateNativeUser, type NativeAuthEnv } from './auth';
import { getNativePluginConfig, type PluginSettingsEnv } from './plugin-settings';
import {
  constantTimeTextEqual, FourPxNativeProvider, Kuaidi100NativeProvider,
  sha256Hex, ShippingProviderError, signKuaidi100Webhook,
} from './shipping-providers';

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
  return new Kuaidi100NativeProvider({ key, secret, customer: string(config.kuaidi100Customer) ?? undefined });
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
  operation: string, payload: JsonObject, invoke: () => Promise<JsonObject>,
): Promise<{ replayed: boolean; response: unknown }> {
  const requestHash = await sha256Hex(JSON.stringify(payload));
  let existing = await env.DB.prepare(
    'SELECT request_hash, state, response_json FROM native_shipping_provider_orders WHERE provider_key = ?1 AND merchant_reference = ?2',
  ).bind(provider, reference).first<ProviderOrderRow>();
  if (existing) {
    if (existing.request_hash !== requestHash) throw new ShippingProviderError('The provider reference was already used with a different payload', 'IDEMPOTENCY_CONFLICT');
    if (existing.state === 'COMPLETED') return { replayed: true, response: json(existing.response_json) };
    if (existing.state !== 'FAILED') throw new ShippingProviderError('The provider request is processing or needs reconciliation', 'PROVIDER_REQUEST_PENDING', true);
    const reclaimed = await env.DB.prepare(
      "UPDATE native_shipping_provider_orders SET state = 'PROCESSING', error_code = NULL, error_message = NULL, updated_at = ?1 WHERE provider_key = ?2 AND merchant_reference = ?3 AND state = 'FAILED'",
    ).bind(new Date().toISOString(), provider, reference).run();
    if ((reclaimed.meta.changes ?? 0) !== 1) throw new ShippingProviderError('The provider request is already processing', 'PROVIDER_REQUEST_PENDING', true);
  } else {
    const now = new Date().toISOString();
    const claimed = await env.DB.prepare(
      `INSERT OR IGNORE INTO native_shipping_provider_orders
       (id, provider_key, merchant_reference, operation, request_hash, state, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, 'PROCESSING', ?6, ?6)`,
    ).bind(crypto.randomUUID(), provider, reference, operation, requestHash, now).run();
    if ((claimed.meta.changes ?? 0) !== 1) {
      existing = await env.DB.prepare(
        'SELECT request_hash, state, response_json FROM native_shipping_provider_orders WHERE provider_key = ?1 AND merchant_reference = ?2',
      ).bind(provider, reference).first<ProviderOrderRow>();
      if (existing?.request_hash !== requestHash) throw new ShippingProviderError('The provider reference was already used with a different payload', 'IDEMPOTENCY_CONFLICT');
      if (existing?.state === 'COMPLETED') return { replayed: true, response: json(existing.response_json) };
      throw new ShippingProviderError('The provider request is already processing', 'PROVIDER_REQUEST_PENDING', true);
    }
  }

  try {
    const response = await invoke();
    const identity = extractProviderIdentity(response);
    await env.DB.prepare(
      `UPDATE native_shipping_provider_orders SET state = 'COMPLETED', external_order_id = ?1,
       tracking_number = ?2, response_json = ?3, updated_at = ?4
       WHERE provider_key = ?5 AND merchant_reference = ?6`,
    ).bind(identity.externalOrderId, identity.trackingNumber, JSON.stringify(response), new Date().toISOString(), provider, reference).run();
    return { replayed: false, response };
  } catch (error) {
    const normalized = error instanceof ShippingProviderError ? error : new ShippingProviderError('Shipping provider request failed', 'PROVIDER_ERROR');
    await env.DB.prepare(
      `UPDATE native_shipping_provider_orders SET state = ?1, error_code = ?2, error_message = ?3, updated_at = ?4
       WHERE provider_key = ?5 AND merchant_reference = ?6`,
    ).bind(normalized.outcomeUnknown ? 'UNKNOWN' : 'FAILED', normalized.code, normalized.message, new Date().toISOString(), provider, reference).run();
    throw normalized;
  }
}

function providerPath(pathname: string): string | null {
  for (const prefix of ['/api/v1/extensions/plugin/shipping/api', '/api/v1/plugins/shipping', '/api/v1/shipping']) {
    if (pathname.startsWith(prefix)) return pathname.slice(prefix.length) || '/';
  }
  return null;
}

async function adminProviderRequest(request: Request, env: NativeShippingEnv, path: string): Promise<Response> {
  if (!await authenticateNativeAdmin(request, env)) return failure(401, 'UNAUTHORIZED', 'Administrator authentication is required');
  const body = object(await request.json<unknown>().catch(() => null));
  try {
    if (path === '/admin/providers/kuaidi100/label-orders') {
      const reference = string(body.reference);
      const input = object(body.input);
      if (!reference) return failure(400, 'REFERENCE_REQUIRED', 'reference is required');
      return success(await providerCreate(env, 'kuaidi100', reference, 'label.order', input, async () => (await kuaidi100(env)).createLabel(input)));
    }
    if (path === '/admin/providers/kuaidi100/pickup-orders') {
      const reference = string(body.reference);
      if (!reference || reference.length > 32) return failure(400, 'REFERENCE_INVALID', 'reference is required and must not exceed 32 characters');
      const input = { ...object(body.input), thirdOrderId: reference };
      return success(await providerCreate(env, 'kuaidi100', reference, 'pickup.order', input, async () => (await kuaidi100(env)).createPickup(input)));
    }
    if (path === '/admin/providers/kuaidi100/tracking/query') return success(await (await kuaidi100(env)).query(object(body.input)));
    if (path === '/admin/providers/kuaidi100/tracking/subscribe') return success(await (await kuaidi100(env)).subscribe(body));
    if (path === '/admin/providers/fourpx/orders') {
      const reference = string(body.reference);
      if (!reference) return failure(400, 'REFERENCE_REQUIRED', 'reference is required');
      const input = { ...object(body.input), ref_no: reference };
      return success(await providerCreate(env, 'fourpx', reference, 'order.create', input, async () => (await fourpx(env)).create(input)));
    }
    if (path === '/admin/providers/fourpx/orders/get') return success(await (await fourpx(env)).get(object(body.input)));
    if (path === '/admin/providers/fourpx/orders/cancel') return success(await (await fourpx(env)).cancel(body));
    if (path === '/admin/providers/fourpx/labels') return success(await (await fourpx(env)).label(object(body.input)));
    if (path === '/admin/providers/fourpx/tracking') {
      const deliveryOrderNo = string(body.deliveryOrderNo);
      if (!deliveryOrderNo) return failure(400, 'TRACKING_NUMBER_REQUIRED', 'deliveryOrderNo is required');
      return success(await (await fourpx(env)).tracking({ deliveryOrderNo }));
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
  let event: unknown;
  try { event = JSON.parse(rawParam); } catch { return Response.json({ result: false, returnCode: '400', message: 'Invalid callback payload' }, { status: 400 }); }
  const eventHash = await sha256Hex(rawParam);
  await env.DB.prepare(
    `INSERT OR IGNORE INTO native_shipping_provider_webhook_events
     (id, provider_key, event_hash, payload_json, received_at) VALUES (?1, 'kuaidi100', ?2, ?3, ?4)`,
  ).bind(crypto.randomUUID(), eventHash, JSON.stringify(event), new Date().toISOString()).run();
  return Response.json({ result: true, returnCode: '200', message: 'success' }, { headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-shipping-1.1.0' } });
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
