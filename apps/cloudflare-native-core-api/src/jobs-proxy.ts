export interface NativeJobsProxyEnv {
  JOBS_SERVICE_URL?: string;
  JOBS_SERVICE?: { fetch(request: Request): Promise<Response> };
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
