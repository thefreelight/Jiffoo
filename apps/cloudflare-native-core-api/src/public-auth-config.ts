type Env = { DEMO_MODE?: string };

function response(data: unknown): Response {
  return Response.json({ success: true, data }, {
    headers: {
      'cache-control': 'no-store',
      'x-jiffoo-runtime': 'cloudflare-native-auth-config',
    },
  });
}

export function tryNativePublicAuthConfig(request: Request, env: Env): Response | null {
  if (request.method !== 'GET') return null;
  const path = new URL(request.url).pathname;
  const demoModeEnabled = env.DEMO_MODE === 'true';

  if (path === '/api/v1/auth/login-config') {
    return response({ demoModeEnabled, demoCredentials: null });
  }

  if (path === '/api/v1/auth/bootstrap-status') {
    return response({
      mode: 'normal',
      showDemoCredentials: false,
      requiresPasswordRotation: false,
      credentials: null,
    });
  }

  return null;
}
