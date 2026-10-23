import { afterEach, expect, it, vi } from 'vitest';
import { proxyPrivateDownload } from '../../../packages/shared/src/plugin-pages/download-proxy';

afterEach(() => vi.unstubAllGlobals());
const id = '12345678-1234-4123-8123-123456789abc';

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
