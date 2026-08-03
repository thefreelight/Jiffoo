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
