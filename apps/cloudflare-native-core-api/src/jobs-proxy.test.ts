import { afterEach, describe, expect, it, vi } from 'vitest';
import { processNativeJobsSync, tryNativeJobsProxy } from './jobs-proxy';

describe('native jobs proxy', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('forwards job search queries to the configured plugin worker', async () => {
    const fetchMock = vi.fn(async () => Response.json({ jobs: [{ title: 'Engineer' }] }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await tryNativeJobsProxy(
      new Request('https://api.example/api/v1/jobs?q=typescript&limit=3'),
      { JOBS_SERVICE_URL: 'https://jobs.example' },
    );
    expect(fetchMock).toHaveBeenCalledOnce();
    const forwarded = fetchMock.mock.calls[0][0] as Request;
    expect(forwarded.url).toBe('https://jobs.example/api/jobs?q=typescript&limit=3');
    expect(forwarded.headers.get('accept')).toBe('application/json');
    expect(response?.status).toBe(200);
  });

  it('degrades clearly when the plugin worker is unavailable', async () => {
    const response = await tryNativeJobsProxy(new Request('https://api.example/api/v1/jobs'), {});
    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toMatchObject({ error: { code: 'JOBS_PLUGIN_UNAVAILABLE' } });
  });

  it('uses a Worker service binding when available', async () => {
    const service = { fetch: vi.fn(async () => Response.json({ jobs: [] })) };
    const response = await tryNativeJobsProxy(new Request('https://api.example/api/v1/jobs?q=design'), { JOBS_SERVICE: service });
    expect(service.fetch).toHaveBeenCalledOnce();
    expect(new URL(service.fetch.mock.calls[0][0].url).pathname).toBe('/api/jobs');
    expect(response?.status).toBe(200);
  });

  it('forwards public job statistics without exposing a direct worker URL', async () => {
    const service = { fetch: vi.fn(async () => Response.json({ activeJobs: 872, addedToday: 1 })) };
    const response = await tryNativeJobsProxy(new Request('https://api.example/api/v1/jobs/stats'), { JOBS_SERVICE: service });
    expect(service.fetch).toHaveBeenCalledOnce();
    expect(new URL(service.fetch.mock.calls[0][0].url).pathname).toBe('/api/jobs/stats');
    await expect(response?.json()).resolves.toEqual({ activeJobs: 872, addedToday: 1 });
  });

  it('requires a valid native session before forwarding search profile requests', async () => {
    const service = { fetch: vi.fn(async () => Response.json({ profiles: [] })) };
    const authenticate = vi.fn(async () => null);
    const response = await tryNativeJobsProxy(
      new Request('https://api.example/api/v1/jobs/search-profiles'),
      { JOBS_SERVICE: service },
      authenticate,
    );
    expect(response?.status).toBe(401);
    expect(service.fetch).not.toHaveBeenCalled();
    await expect(response?.json()).resolves.toMatchObject({ error: { code: 'UNAUTHORIZED' } });
  });

  it('injects trusted profile ownership and does not forward spoofed identity headers', async () => {
    const service = { fetch: vi.fn(async () => Response.json({ profiles: [] })) };
    const response = await tryNativeJobsProxy(
      new Request('https://api.example/api/v1/jobs/search-profiles', {
        headers: { 'x-user-id': 'spoofed-user', 'x-installation-id': 'spoofed-installation' },
      }),
      {
        JOBS_SERVICE: service,
        JOBS_INSTALLATION_ID: 'rr-production',
        JOBS_RUNTIME_TOKEN: { get: async () => 'trusted-runtime-token' },
      },
      async () => ({ id: 'user-123', email: 'user@example.com', username: 'user', role: 'USER' }),
    );
    expect(response?.status).toBe(200);
    const forwarded = service.fetch.mock.calls[0][0];
    expect(new URL(forwarded.url).pathname).toBe('/api/search-profiles');
    expect(forwarded.headers.get('x-user-id')).toBe('user-123');
    expect(forwarded.headers.get('x-user-role')).toBe('USER');
    expect(forwarded.headers.get('x-installation-id')).toBe('rr-production');
    expect(forwarded.headers.get('x-caller')).toBe('jiffoo-core');
    expect(forwarded.headers.get('x-platform-integration-token')).toBe('trusted-runtime-token');
    expect(response?.headers.get('cache-control')).toBe('no-store');
  });

  it('forwards search profile writes and profile-backed job searches', async () => {
    const service = { fetch: vi.fn(async () => Response.json({ ok: true })) };
    const env = { JOBS_SERVICE: service, JOBS_INSTALLATION_ID: 'rr-production', JOBS_RUNTIME_TOKEN: 'runtime-token' };
    const authenticate = async () => ({ id: 'user-123', email: 'user@example.com', username: 'user', role: 'USER' });
    const createResponse = await tryNativeJobsProxy(
      new Request('https://api.example/api/v1/jobs/search-profiles', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Frontend', query: 'typescript' }),
      }),
      env,
      authenticate,
    );
    expect(createResponse?.status).toBe(200);
    const createRequest = service.fetch.mock.calls[0][0];
    expect(createRequest.method).toBe('POST');
    await expect(createRequest.json()).resolves.toEqual({ name: 'Frontend', query: 'typescript' });

    const searchResponse = await tryNativeJobsProxy(
      new Request('https://api.example/api/v1/jobs?profileId=profile-1'),
      env,
      authenticate,
    );
    expect(searchResponse?.status).toBe(200);
    const searchRequest = service.fetch.mock.calls[1][0];
    expect(searchRequest.url).toBe('https://jobs.internal/api/jobs?profileId=profile-1');
    expect(searchRequest.headers.get('x-user-id')).toBe('user-123');
  });

  it('fails closed when trusted profile forwarding is not configured', async () => {
    const service = { fetch: vi.fn(async () => Response.json({ profiles: [] })) };
    const response = await tryNativeJobsProxy(
      new Request('https://api.example/api/v1/jobs/search-profiles'),
      { JOBS_SERVICE: service },
      async () => ({ id: 'user-123', email: 'user@example.com', username: 'user', role: 'USER' }),
    );
    expect(response?.status).toBe(503);
    expect(service.fetch).not.toHaveBeenCalled();
    await expect(response?.json()).resolves.toMatchObject({ error: { code: 'JOBS_PROFILE_UNAVAILABLE' } });
  });

  it('skips scheduled collection when the source is fresh', async () => {
    const service = { fetch: vi.fn(async () => Response.json({ ok: true })) };
    const db = {
      prepare: vi.fn(() => ({ first: async () => ({ updated_at: new Date().toISOString() }) })),
    };
    await expect(processNativeJobsSync({ JOBS_SERVICE: service, JOBS_SYNC_TOKEN: 'token', DB: db })).resolves.toMatchObject({ skipped: 'fresh' });
    expect(service.fetch).not.toHaveBeenCalled();
  });

  it('runs scheduled collection through the service binding when stale', async () => {
    const service = { fetch: vi.fn(async () => Response.json({ status: 'completed' })) };
    const db = {
      prepare: vi.fn(() => ({ first: async () => ({ updated_at: '2020-01-01T00:00:00.000Z' }) })),
    };
    await expect(processNativeJobsSync({ JOBS_SERVICE: service, JOBS_SYNC_TOKEN: { get: async () => 'token' }, DB: db })).resolves.toEqual({ status: 'completed' });
    const request = service.fetch.mock.calls[0][0];
    expect(request.headers.get('authorization')).toBe('Bearer token');
    await expect(request.json()).resolves.toEqual({ mode: 'incremental' });
  });
});
