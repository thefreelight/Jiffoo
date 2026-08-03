export interface NativeJobsProxyEnv {
  JOBS_SERVICE_URL?: string;
  JOBS_SERVICE?: { fetch(request: Request): Promise<Response> };
  JOBS_SYNC_TOKEN?: { get(): Promise<string> } | string;
  DB?: { prepare(query: string): { first<T>(): Promise<T | null> } };
}

async function secretValue(secret: NativeJobsProxyEnv['JOBS_SYNC_TOKEN']): Promise<string> {
  return typeof secret === 'string' ? secret : secret ? secret.get() : '';
}

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

export async function tryNativeJobsProxy(request: Request, env: NativeJobsProxyEnv): Promise<Response | null> {
  const incoming = new URL(request.url);
  if (request.method !== 'GET' || incoming.pathname !== '/api/v1/jobs') return null;
  if (!env.JOBS_SERVICE && !env.JOBS_SERVICE_URL?.trim()) {
    return Response.json({ success: false, error: { code: 'JOBS_PLUGIN_UNAVAILABLE', message: 'Job search is not configured' } }, {
      status: 503,
      headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-jobs-proxy' },
    });
  }
  const target = new URL('/api/jobs', env.JOBS_SERVICE_URL?.trim() || 'https://jobs.internal');
  target.search = incoming.search;
  const upstreamRequest = new Request(target, { headers: { accept: 'application/json' } });
  const upstream = env.JOBS_SERVICE ? await env.JOBS_SERVICE.fetch(upstreamRequest) : await fetch(upstreamRequest);
  const headers = new Headers(upstream.headers);
  headers.set('x-jiffoo-runtime', 'cloudflare-native-jobs-proxy');
  headers.set('cache-control', upstream.ok ? 'public, max-age=30, stale-while-revalidate=120' : 'no-store');
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
}
