import { authenticateNativeAdmin, type NativeAuthEnv } from './auth';

type Env = NativeAuthEnv & { DB: D1Database; PLATFORM_API_BASE_URL?: string };
type State = { instanceKey: string; pending?: Record<string, unknown> | null; instance?: Record<string, unknown> | null; tenantBinding?: Record<string, unknown> | null };

function envelope(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function load(env: Env): Promise<State> {
  const row = await env.DB.prepare("SELECT value FROM runtime_metadata WHERE key='platform_connection'").first<{ value: string }>();
  try {
    const value = envelope(row?.value ? JSON.parse(row.value) : {});
    return { instanceKey: typeof value.instanceKey === 'string' ? value.instanceKey : crypto.randomUUID(), pending: envelope(value.pending), instance: envelope(value.instance), tenantBinding: envelope(value.tenantBinding) };
  } catch { return { instanceKey: crypto.randomUUID() }; }
}

async function save(env: Env, state: State): Promise<void> {
  await env.DB.prepare("INSERT INTO runtime_metadata(key,value,updated_at) VALUES('platform_connection',?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at")
    .bind(JSON.stringify(state), new Date().toISOString()).run();
}

function baseUrl(env: Env): string {
  return (env.PLATFORM_API_BASE_URL?.trim() || 'https://platform-api.jiffoo.com/api').replace(/\/+$/, '');
}

async function market(env: Env, path: string, init: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(`${baseUrl(env)}${path}`, { ...init, headers: { 'content-type': 'application/json', ...(init.headers || {}) } });
  const body = envelope(await response.json().catch(() => ({})));
  if (!response.ok) throw new Error(typeof envelope(body.error).message === 'string' ? String(envelope(body.error).message) : `Platform request failed (${response.status})`);
  return envelope(body.data);
}

export async function tryNativePlatformConnection(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/v1/admin/platform/connection/')) return null;
  if (!(await authenticateNativeAdmin(request, env))) return Response.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Administrator authentication is required' } }, { status: 401 });
  const action = url.pathname.slice('/api/v1/admin/platform/connection/'.length);
  const state = await load(env);
  try {
    if (request.method === 'GET' && action === 'status') return Response.json({ success: true, data: { status: state.tenantBinding ? 'tenant_bound' : state.instance ? 'instance_bound' : state.pending ? 'pending' : 'unbound', instanceBound: Boolean(state.instance), tenantBound: Boolean(state.tenantBinding), marketplaceReady: Boolean(state.tenantBinding), requiresPlatformBinding: true, instance: state.instance ?? null, tenantBinding: state.tenantBinding ?? null, pending: state.pending ?? null } });
    if (request.method === 'POST' && action === 'start') {
      const body = envelope(await request.json().catch(() => ({})));
      const next = await market(env, '/marketplace/platform-connection/device/start', { method: 'POST', body: JSON.stringify({ instanceKey: state.instanceKey, instanceName: typeof body.instanceName === 'string' ? body.instanceName : 'Jiffoo workspace', originUrl: typeof body.originUrl === 'string' ? body.originUrl : url.origin, coreVersion: typeof body.coreVersion === 'string' ? body.coreVersion : undefined }) });
      await save(env, { ...state, pending: envelope(next.pending), instance: state.instance, tenantBinding: state.tenantBinding });
      return Response.json({ success: true, data: { status: 'pending', instanceBound: false, tenantBound: false, marketplaceReady: false, requiresPlatformBinding: true, pending: next.pending } });
    }
    if (request.method === 'POST' && action === 'poll') {
      const body = envelope(await request.json().catch(() => ({})));
      if (typeof body.deviceCode !== 'string' || !body.deviceCode) return Response.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'deviceCode is required' } }, { status: 400 });
      const next = await market(env, '/marketplace/platform-connection/device/poll', { method: 'POST', body: JSON.stringify({ deviceCode: body.deviceCode }) });
      const status = envelope(next.status);
      const authorizedInstance = next.authorized ? { ...envelope(status.instance), instanceToken: typeof next.instanceToken === 'string' ? next.instanceToken : undefined } : state.instance;
      const updated: State = { ...state, pending: next.authorized ? null : envelope(status.pending), instance: authorizedInstance, tenantBinding: Object.keys(envelope(status.tenantBinding)).length ? envelope(status.tenantBinding) : state.tenantBinding };
      await save(env, updated);
      return Response.json({ success: true, data: status });
    }
    if (request.method === 'POST' && action === 'bind-tenant') {
      if (!state.instance || typeof state.instance.instanceId !== 'string' || typeof state.instance.instanceToken !== 'string') throw new Error('Platform instance authorization is required first');
      const body = envelope(await request.json().catch(() => ({})));
      const next = await market(env, '/marketplace/platform-connection/tenant/bind', { method: 'POST', body: JSON.stringify({ instanceId: state.instance.instanceId, instanceToken: state.instance.instanceToken, localStoreId: typeof body.localStoreId === 'string' ? body.localStoreId : 'default', localStoreSlug: typeof body.localStoreSlug === 'string' ? body.localStoreSlug : 'default', localStoreName: typeof body.localStoreName === 'string' ? body.localStoreName : 'Default store' }) });
      const updated = { ...state, tenantBinding: envelope(next.status).tenantBinding as Record<string, unknown> };
      await save(env, updated);
      return Response.json({ success: true, data: envelope(next.status) });
    }
    if (request.method === 'POST' && action === 'complete') return Response.json({ success: false, error: { code: 'SECURE_AUTHORIZATION_REQUIRED', message: 'Open the platform authorization page and confirm the account; email-only completion is disabled' } }, { status: 409 });
    if (request.method === 'POST' && action === 'disconnect') { await save(env, { instanceKey: state.instanceKey }); return Response.json({ success: true, data: { disconnected: true } }); }
    return Response.json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } }, { status: 405 });
  } catch (error: unknown) { return Response.json({ success: false, error: { code: 'PLATFORM_CONNECTION_ERROR', message: error instanceof Error ? error.message : 'Platform connection request failed' } }, { status: 502 }); }
}
