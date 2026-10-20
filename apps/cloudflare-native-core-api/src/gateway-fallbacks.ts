const GATEWAY_JSON_HEADERS = {
  'cache-control': 'no-store',
  'x-jiffoo-runtime': 'cloudflare-native-gateway-fallback',
} as const;

// Gateway-routed plugins whose workers are not deployed on Cloudflare-native
// instances. Without these fallbacks every client call hangs in the
// CORE_ORIGIN self-loop until Cloudflare answers 522 (register-page OAuth
// checks, the workspace campaigns call). A fast structured response lets the
// callers degrade the way they are written to (provider hidden, workspace
// section shows an unavailable state).
const UNAVAILABLE_PLUGIN_GATEWAYS = new Set(['google-auth', 'apple-auth', 'hermes-bridge']);

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: GATEWAY_JSON_HEADERS });
}

export function tryNativeGatewayFallbacks(request: Request): Response | null {
  if (request.method !== 'GET' && request.method !== 'POST') return null;
  const path = new URL(request.url).pathname;

  const pluginGateway = path.match(/^\/api\/extensions\/plugin\/([a-z0-9][a-z0-9-]{0,63})\/api\/(.+)$/);
  if (pluginGateway && UNAVAILABLE_PLUGIN_GATEWAYS.has(pluginGateway[1])) {
    if (request.method === 'GET' && pluginGateway[2] === 'status') {
      return json({ success: true, data: { available: false } }, 200);
    }
    return json({
      success: false,
      error: {
        code: 'PLUGIN_GATEWAY_UNAVAILABLE',
        message: `The ${pluginGateway[1]} gateway is not available on this instance`,
      },
    }, 503);
  }

  if (request.method === 'GET' && (path === '/api/recommendations/personalized' || path === '/api/v1/recommendations/personalized')) {
    return json({ success: true, data: { type: 'personalized', products: [], totalCount: 0 } }, 200);
  }

  return null;
}
