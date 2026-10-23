import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxyPrivateDownload } from '../../../packages/shared/src/plugin-pages/download-proxy';
vi.mock('server-only', () => ({}));
vi.mock('../lib/core-transport', () => ({ shopApi: vi.fn() }));
import { shopApi } from '../lib/core-transport';
import { POST } from '../app/bff/[...path]/route';
import { allowedBffRoute } from '../lib/auth-contract';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetAllMocks(); });
const id = '12345678-1234-4123-8123-123456789abc';

it('forwards a same-origin Core Save grant request with the customer cookie authority and configured origin', async () => {
  const origin = 'https://shop.example';
  const path = `/plugin-pages/studio/sessions/${id}/download`;
  const url = `/plugin-downloads/${id}?token=signed`;
  vi.stubEnv('STOREFRONT_URL', origin);
  vi.mocked(shopApi).mockResolvedValue(Response.json({ success: true, data: { url } }));
  const response = await POST(new NextRequest(`${origin}/bff${path}`, { method: 'POST',
    headers: { Origin: origin, Cookie: 'shop_access=customer-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ reference: id }),
  }), { params: Promise.resolve({ path: path.slice(1).split('/') }) });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ success: true, data: { url } });
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(shopApi).toHaveBeenCalledExactlyOnceWith(path, 'customer-token', {
    method: 'POST', body: JSON.stringify({ reference: id }), headers: { 'Content-Type': 'application/json', Origin: origin },
  });
  for (const method of ['GET', 'HEAD', 'PUT', 'DELETE']) expect(allowedBffRoute(method, path)).toBe(false);
  for (const suffix of ['/more', '%2fmore', '/../download']) expect(allowedBffRoute('POST', path + suffix)).toBe(false);
});

it('proxies only a bound attachment and never forwards browser credentials or a target URL', async () => {
  const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('private bytes', { headers: { 'content-type': 'image/png', 'content-disposition': `attachment; filename="${id}.png"`, 'set-cookie': 'must-not-escape=1' } }));
  vi.stubGlobal('fetch', fetch);
  const request = new Request(`https://shop.example/plugin-downloads/${id}?token=signed`, { headers: { cookie: 'session=private', authorization: 'Bearer core-token' } });
  const response = await proxyPrivateDownload(request, id, 'http://core.internal:3001');
  expect(await response.text()).toBe('private bytes');
  expect(response.headers.get('set-cookie')).toBeNull();
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(String(fetch.mock.calls[0][0])).toBe(`http://core.internal:3001/api/v1/plugin-files/${id}?token=signed`);
  expect(fetch.mock.calls[0][1]).toMatchObject({ credentials: 'omit', redirect: 'error', cache: 'no-store' });
  expect(fetch.mock.calls[0][1]).not.toHaveProperty('headers');
});

it('rejects inline grants, extra URL parameters, opaque frame saves and non-file paths', async () => {
  const fetch = vi.fn(async () => new Response('private bytes', { headers: { 'content-disposition': `inline; filename="${id}.png"` } }));
  vi.stubGlobal('fetch', fetch);
  const url = `https://shop.example/plugin-downloads/${id}?token=signed`;
  expect((await proxyPrivateDownload(new Request(url), id, 'http://core.internal')).status).toBe(404);
  for (const request of [new Request(url + '&url=https://evil.example'), new Request(url, { headers: { origin: 'null' } })]) {
    expect((await proxyPrivateDownload(request, id, 'http://core.internal')).status).toBe(404);
  }
  expect((await proxyPrivateDownload(new Request(url), '../secret', 'http://core.internal')).status).toBe(404);
  expect(fetch).toHaveBeenCalledTimes(1);
});
