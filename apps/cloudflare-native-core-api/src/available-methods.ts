interface AvailableMethodsEnv {
  DB: D1Database;
}

interface PluginInstanceRow {
  enabled: number;
  config_json: string;
  encrypted_secrets_json: string;
}

function object(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

async function instance(env: AvailableMethodsEnv, slug: string): Promise<PluginInstanceRow | null> {
  return env.DB.prepare(
    "SELECT enabled, config_json, encrypted_secrets_json FROM native_plugin_instances WHERE plugin_slug = ?1 AND instance_key = 'default'",
  ).bind(slug).first<PluginInstanceRow>();
}

export function stripeMethod(row: PluginInstanceRow | null) {
  if (!row || row.enabled !== 1) return null;
  const config = object(row.config_json);
  const secrets = object(row.encrypted_secrets_json);
  const publishableKey = typeof config.publishableKey === 'string' ? config.publishableKey.trim() : '';
  if (!/^pk_(?:test|live)_/.test(publishableKey) || !secrets.secretKey || !secrets.webhookSecret) return null;
  return {
    pluginSlug: 'stripe',
    name: 'stripe',
    displayName: 'Stripe',
    icon: 'credit-card',
    supportedCurrencies: ['USD'],
    isLive: publishableKey.startsWith('pk_live_'),
    clientConfig: { publishableKey },
  };
}

export async function tryNativeAvailableMethods(
  request: Request,
  env: AvailableMethodsEnv,
): Promise<Response | null> {
  if (request.method !== 'GET') return null;
  const url = new URL(request.url);
  if (url.pathname === '/api/v1/payments/available-methods') {
    const method = stripeMethod(await instance(env, 'stripe'));
    return Response.json({ success: true, data: method ? [method] : [] }, {
      headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-payment-methods' },
    });
  }
  if (url.pathname === '/api/v1/shipping/available-methods') {
    const shipping = await instance(env, 'shipping');
    const methods = shipping?.enabled === 1 ? [{
      methodId: 'standard',
      methodName: 'Standard Shipping',
      description: 'Standard tracked shipping',
      rate: 0,
      currency: 'USD',
      estimatedDays: null,
      isFree: true,
      pluginSlug: 'shipping',
    }] : [];
    return Response.json({ success: true, data: methods }, {
      headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-shipping-methods' },
    });
  }
  return null;
}
