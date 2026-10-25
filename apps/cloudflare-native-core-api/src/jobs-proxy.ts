import { applyJobTitleTranslations, detectJobLocale } from './jobs-translate';

export interface NativeJobsProxyEnv {
  JOBS_SERVICE_URL?: string;
  JOBS_SERVICE?: { fetch(request: Request): Promise<Response> };
  JOBS_SYNC_TOKEN?: { get(): Promise<string> } | string;
  JOBS_RUNTIME_TOKEN?: { get(): Promise<string> } | string;
  JOBS_ADMIN_TOKEN?: { get(): Promise<string> } | string;
  JOBS_INSTALLATION_ID?: string;
  DB?: { prepare(query: string): { first<T>(): Promise<T | null> } };
}

type NativeJobsAuthenticator = (
  request: Request,
  env: NativeJobsProxyEnv,
) => Promise<{ id: string; role: string } | null>;

async function secretValue(secret: NativeJobsProxyEnv['JOBS_SYNC_TOKEN'] | NativeJobsProxyEnv['JOBS_RUNTIME_TOKEN'] | NativeJobsProxyEnv['JOBS_ADMIN_TOKEN']): Promise<string> {
  return typeof secret === 'string' ? secret : secret ? secret.get() : '';
}

/**
 * Admin proxy for the RemoteRadar jobs worker's /admin/api/* endpoints
 * (connector health, source browsing, provenance audit). Admin sessions are
 * authenticated against the Core admin JWT; the jobs worker re-checks the
 * upstream bearer token, so the shared secret never leaves the Workers edge.
 */
export async function tryNativeJobsAdminProxy(
  request: Request,
  env: NativeJobsProxyEnv,
  authenticate: (request: Request, env: NativeJobsProxyEnv) => Promise<{ id: string; role: string } | null>,
): Promise<Response | null> {
  const incoming = new URL(request.url);
  const adminMatch = incoming.pathname.match(/^\/api\/v1\/admin\/plugins\/remoteradar-jobs\/(connectors|sources(?:\/[^/]+)?|jobs\/[^/]+\/provenance)$/);
  if (!adminMatch) return null;
  const method = request.method;
  if (method !== 'GET' && method !== 'POST') {
    return Response.json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } }, {
      status: 405,
      headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-jobs-proxy' },
    });
  }
  if (!env.JOBS_SERVICE && !env.JOBS_SERVICE_URL?.trim()) {
    return Response.json({ success: false, error: { code: 'JOBS_PLUGIN_UNAVAILABLE', message: 'Jobs plugin is not configured' } }, {
      status: 503,
      headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-jobs-proxy' },
    });
  }
  const admin = await authenticate(request, env);
  if (!admin || !['ADMIN', 'SUPER_ADMIN'].includes(admin.role)) {
    return Response.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Administrator authentication is required' } }, {
      status: 401,
      headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-jobs-proxy' },
    });
  }
  const token = await secretValue(env.JOBS_ADMIN_TOKEN);
  if (!token) {
    return Response.json({ success: false, error: { code: 'JOBS_ADMIN_UNAVAILABLE', message: 'Jobs admin token is not configured' } }, {
      status: 503,
      headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-jobs-proxy' },
    });
  }
  const upstreamPath = `/admin/api/${adminMatch[1]}`;
  const target = new URL(upstreamPath, env.JOBS_SERVICE_URL?.trim() || 'https://jobs.internal');
  target.search = incoming.search;
  const headers = new Headers({ accept: 'application/json', authorization: `Bearer ${token}` });
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  headers.set('x-admin-actor', admin.id);
  headers.set('x-admin-role', admin.role);
  const upstreamRequest = new Request(target, {
    method,
    headers,
    body: method === 'POST' ? await request.arrayBuffer() : undefined,
  });
  const upstream = env.JOBS_SERVICE ? await env.JOBS_SERVICE.fetch(upstreamRequest) : await fetch(upstreamRequest);
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.set('x-jiffoo-runtime', 'cloudflare-native-jobs-proxy');
  responseHeaders.set('cache-control', 'no-store');
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
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
  if (upstreamPath === '/api/jobs' && upstream.ok && request.method === 'GET') {
    // Per-locale job title substitution: the storefront feed renders whatever
    // titles this response carries, so translations happen here once and are
    // cached in D1 (no theme changes, no per-visit AI spend after warm-up).
    let payload: { jobs?: Array<{ jobId: string; title: string; titleOriginal?: string }> } | null = null;
    try {
      payload = await upstream.json() as { jobs?: Array<{ jobId: string; title: string; titleOriginal?: string }> };
    } catch {
      payload = null;
    }
    if (payload) {
      const locale = detectJobLocale(request);
      const jobs = payload.jobs;
      if (locale && Array.isArray(jobs) && jobs.length > 0) {
        try {
          const substitutions = await applyJobTitleTranslations(env as never, jobs
            .filter((job) => typeof job?.jobId === 'string' && typeof job?.title === 'string')
            .map((job) => ({ jobId: job.jobId, title: job.title })), locale);
          for (const job of jobs) {
            const translated = substitutions.get(job.jobId);
            if (translated && job.title !== translated) {
              job.titleOriginal = job.title;
              job.title = translated;
            }
          }
          if (substitutions.size > 0) responseHeaders.set('x-jiffoo-jobs-translated', locale);
        } catch {
          // Translation is best-effort: the original titles ship untranslated.
        }
      }
      return new Response(JSON.stringify(payload), {
        status: upstream.status, statusText: upstream.statusText, headers: responseHeaders,
      });
    }
  }
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
}
