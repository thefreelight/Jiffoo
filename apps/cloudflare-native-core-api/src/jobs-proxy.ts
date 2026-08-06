export interface NativeJobsProxyEnv {
  JOBS_SERVICE_URL?: string;
  JOBS_SERVICE?: { fetch(request: Request): Promise<Response> };
  JOBS_SYNC_TOKEN?: { get(): Promise<string> } | string;
  JOBS_RUNTIME_TOKEN?: { get(): Promise<string> } | string;
  JOBS_INSTALLATION_ID?: string;
  DB?: { prepare(query: string): { first<T>(): Promise<T | null> } };
}

type NativeJobsAuthenticator = (
  request: Request,
  env: NativeJobsProxyEnv,
) => Promise<{ id: string; role: string } | null>;

async function secretValue(secret: NativeJobsProxyEnv['JOBS_SYNC_TOKEN'] | NativeJobsProxyEnv['JOBS_RUNTIME_TOKEN']): Promise<string> {
  return typeof secret === 'string' ? secret : secret ? secret.get() : '';
}

const authenticateJobsUser: NativeJobsAuthenticator = async (request, env) => {
  const { authenticateNativeUser } = await import('./auth');
  return authenticateNativeUser(request, env as NativeJobsProxyEnv & import('./auth').NativeAuthEnv);
};

export async function processNativeJobsSync(env: NativeJobsProxyEnv): Promise<unknown> {
  if (!env.JOBS_SERVICE) return { skipped: 'jobs service binding unavailable' };
  const token = await secretValue(env.JOBS_SYNC_TOKEN);
  if (!token) return { skipped: 'jobs sync token unavailable' };
  if (env.DB) {
    const source = await env.DB.prepare("SELECT updated_at FROM remoteradar_sources WHERE id = 'github-default'").first<{ updated_at: string }>();
    if (source?.updated_at && Date.now() - Date.parse(source.updated_at) < 6 * 60 * 60 * 1000) {
      return { skipped: 'fresh', updated_at: source.updated_at };
    }
  }
  const response = await env.JOBS_SERVICE.fetch(new Request('https://jobs.internal/api/internal/sync', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'incremental' }),
  }));
  if (!response.ok) throw new Error(`RemoteRadar jobs sync ${response.status}`);
  return response.json();
}

export async function tryNativeJobsProxy(
  request: Request,
  env: NativeJobsProxyEnv,
  authenticate: NativeJobsAuthenticator = authenticateJobsUser,
): Promise<Response | null> {
  const incoming = new URL(request.url);
  const upstreamPath = incoming.pathname === '/api/v1/jobs'
    ? '/api/jobs'
    : incoming.pathname === '/api/v1/jobs/stats'
      ? '/api/jobs/stats'
      : (incoming.pathname === '/api/v1/jobs/search-profiles' || incoming.pathname.startsWith('/api/v1/jobs/search-profiles/'))
        ? incoming.pathname.replace('/api/v1/jobs/search-profiles', '/api/search-profiles')
        : null;
  if (!upstreamPath) return null;
  const profileRequest = upstreamPath.startsWith('/api/search-profiles') || (
    upstreamPath === '/api/jobs' && incoming.searchParams.has('profileId')
  );
  const allowed = upstreamPath.startsWith('/api/search-profiles')
    ? new Set(['GET', 'POST', 'PATCH', 'DELETE'])
    : new Set(['GET']);
  if (!allowed.has(request.method)) {
    return Response.json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } }, {
      status: 405,
      headers: { allow: [...allowed].join(', '), 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-jobs-proxy' },
    });
  }
  if (!env.JOBS_SERVICE && !env.JOBS_SERVICE_URL?.trim()) {
    return Response.json({ success: false, error: { code: 'JOBS_PLUGIN_UNAVAILABLE', message: 'Job search is not configured' } }, {
      status: 503,
      headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-jobs-proxy' },
    });
  }
  const target = new URL(upstreamPath, env.JOBS_SERVICE_URL?.trim() || 'https://jobs.internal');
  target.search = incoming.search;
  const headers = new Headers({ accept: 'application/json' });
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  if (profileRequest) {
    const user = await authenticate(request, env);
    if (!user) {
      return Response.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Login required' } }, {
        status: 401,
        headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-jobs-proxy' },
      });
    }
    const installationId = env.JOBS_INSTALLATION_ID?.trim();
    const integrationToken = await secretValue(env.JOBS_RUNTIME_TOKEN);
    if (!installationId || !integrationToken) {
      return Response.json({ success: false, error: { code: 'JOBS_PROFILE_UNAVAILABLE', message: 'Saved searches are not configured' } }, {
        status: 503,
        headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-jobs-proxy' },
      });
    }
    headers.set('x-caller', 'jiffoo-core');
    headers.set('x-installation-id', installationId);
    headers.set('x-platform-integration-token', integrationToken);
    headers.set('x-user-id', user.id);
    headers.set('x-user-role', user.role);
  }
  const upstreamRequest = new Request(target, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer(),
  });
  const upstream = env.JOBS_SERVICE ? await env.JOBS_SERVICE.fetch(upstreamRequest) : await fetch(upstreamRequest);
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.set('x-jiffoo-runtime', 'cloudflare-native-jobs-proxy');
  responseHeaders.set('cache-control', profileRequest || !upstream.ok ? 'no-store' : 'public, max-age=30, stale-while-revalidate=120');
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
}
