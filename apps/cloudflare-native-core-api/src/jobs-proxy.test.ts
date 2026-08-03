import { afterEach, describe, expect, it, vi } from 'vitest';
import { tryNativeJobsProxy } from './jobs-proxy';

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
});
