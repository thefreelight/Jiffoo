import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { getStorefrontCode } from '../lib/storefront-code';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '127.0.0.1' }),
  cookies: async () => ({ get: () => undefined }),
}));

afterEach(() => vi.unstubAllEnvs());

async function withApi(status: number, body: unknown, check: () => Promise<void>, raw = false) {
  const server: Server = createServer((request, response) => {
    expect(request.url).toBe('/api/v1/store/storefront-code');
    expect(request.headers['x-forwarded-for']).toBe('127.0.0.1');
    if (status === 0) { request.socket.destroy(); return; }
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(raw ? body as string : JSON.stringify(body));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test API address');
  vi.stubEnv('API_SERVICE_URL', `http://127.0.0.1:${address.port}`);
  try { await check(); }
  finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

const data = {
  ga4MeasurementId: 'G-IGNORED', metaPixelId: null, baiduSiteKey: null,
  headCode: '<style>body { visibility: visible }</style>', bodyStartCode: '', bodyEndCode: '',
};

describe('Storefront code server fetch', () => {
  it('I propagates a non-availability server failure instead of hiding storefront code', async () => {
    await withApi(500, { success: true, data }, async () => expect(getStorefrontCode()).rejects.toMatchObject({ status: 500 }));
  });

  it('I propagates invalid public API response shapes instead of treating them as empty code', async () => {
    for (const body of [
      null, {}, { success: false, data }, { success: true, data: null },
      { success: true, data: { ...data, headCode: 1 } },
      { success: true, data: { ...data, bodyStartCode: null } },
      { success: true, data: { ...data, bodyEndCode: 'x'.repeat(65537) } },
      { success: true, data: { ...data, metaPixelId: 1 } },
    ]) await withApi(200, body, async () => expect(getStorefrontCode()).rejects.toMatchObject({ status: 500 }));
  });

  it('I returns provider IDs and code slots and omits only entirely empty configurations', async () => {
    await withApi(200, { success: true, data }, async () => {
      expect(await getStorefrontCode()).toEqual(data);
    });
    await withApi(200, { success: true, data: { ...data, headCode: '' } },
      async () => expect(await getStorefrontCode()).toEqual({ ...data, headCode: '' }));
    await withApi(200, { success: true, data: { ...data, headCode: '', ga4MeasurementId: null } },
      async () => expect(await getStorefrontCode()).toBeNull());
  });

  it('I propagates malformed JSON and failed connections to the safe error boundary', async () => {
    await withApi(200, 'invalid JSON', async () => expect(getStorefrontCode()).rejects.toThrow(), true);
    await withApi(0, null, async () => expect(getStorefrontCode()).rejects.toThrow());
  });
});
