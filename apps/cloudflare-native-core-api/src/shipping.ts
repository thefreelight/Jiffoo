import { authenticateNativeUser, type NativeAuthEnv } from './auth';

interface NativeShippingEnv extends NativeAuthEnv {
  DB: D1Database;
}

interface ShippingItem {
  productKind?: unknown;
}

interface ShippingRequest {
  items?: unknown;
}

const manualMethod = {
  methodId: 'standard',
  methodName: 'Standard Shipping',
  description: 'Built-in manual shipping rate',
  rate: 0,
  currency: 'USD',
  estimatedDays: null,
  isFree: true,
  pluginSlug: 'manual-shipping',
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
