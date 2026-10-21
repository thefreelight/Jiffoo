import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createRequire } from 'node:module';
import path from 'node:path';
import inventory from '../../../scripts/cookie-route-inventory.json';
vi.mock('server-only', () => ({}));
import * as bff from '../app/bff/[...path]/route';
import { allowedBffRoute } from '../lib/auth-contract';
import { proxy } from '../proxy';
import { GET as assetGet, HEAD as assetHead } from '../app/api/v1/plugin-assets/[installationId]/[zipHash]/[...path]/route';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('Shop opaque-origin cookie isolation inventory', () => {
  it.each(inventory.shopBff)('%s %s rejects cookies and Bearer before any Core call', async (method, path) => {
    vi.stubEnv('STOREFRONT_URL', 'http://127.0.0.1:3003');
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect(allowedBffRoute(method, path)).toBe(true);
    const handle = bff[method as keyof typeof bff];
    for (const credentials of [{ Cookie: 'shop_access=access; shop_refresh=refresh' }, { Authorization: 'Bearer ordinary-token' }] as Record<string, string>[]) {
      const request = new NextRequest(`http://127.0.0.1:3003/bff${path}`, {
        method, headers: { Origin: 'null', ...credentials, 'Content-Type': 'text/plain' },
        ...(!['GET', 'HEAD'].includes(method) ? { body: '{}' } : {}),
      });
      const response = await handle(request, { params: Promise.resolve({ path: path.slice(1).split('/') }) });
      expect(response.status).toBe(403);
      expect(response.headers.get('set-cookie')).toBeNull();
      expect((await response.json()).error.code).toBe('INVALID_ORIGIN');
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(inventory.shopSsr)('%s blocks null Origin before SSR cookie reads', path => {
    for (const locale of ['en', 'zh-Hans', 'zh-Hant']) {
      for (const credential of [{ Cookie: 'shop_access=access' }, { Authorization: 'Bearer ordinary-token' }] as Record<string, string>[]) {
        const response = proxy(new NextRequest(`http://127.0.0.1:3003${path.replace('/en', `/${locale}`)}`, {
          headers: { Origin: 'null', ...credential },
        }));
        expect(response.status).toBe(403);
        expect(response.headers.get('x-middleware-next')).toBeNull();
        expect(response.headers.get('set-cookie')).toBeNull();
      }
    }
  });
  it.each(inventory.localCookieForwardingRewrites)('%s cannot forward cookies through local rewrite proxies', path => {
    const response = proxy(new NextRequest(`http://127.0.0.1:3003${path}`, {
      method: 'POST', headers: { Origin: 'null', Cookie: 'shop_access=private', 'Content-Type': 'text/plain' }, body: 'simple',
    }));
    expect(response.status).toBe(403);
    expect(response.headers.get('x-middleware-next')).toBeNull();
  });
  it.each(inventory.nullOriginGatewayException)('keeps the null-origin gateway exception %s open for Core', path => {
    const response = proxy(new NextRequest(`http://127.0.0.1:3003${path}`, {
      method: 'POST', headers: { Origin: 'null', Cookie: 'shop_access=private', 'Content-Type': 'text/plain' }, body: 'proof',
    }));
    expect(response.status).not.toBe(403);
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });
});
it.each(['GET', 'HEAD'])('Shop %s asset transport strips identity and preserves only a configured public Host', async method => {
  vi.stubEnv('API_SERVICE_URL', 'http://127.0.0.1:3001');
  vi.stubEnv('STOREFRONT_URL', 'http://127.0.0.1:3003');
  const fetcher = vi.fn(async () => new Response(method === 'HEAD' ? null : 'module', { headers: {
    'Access-Control-Allow-Origin': '*', 'Set-Cookie': 'untrusted=private', 'Access-Control-Allow-Credentials': 'true',
  } }));
  vi.stubGlobal('fetch', fetcher);
  const request = new NextRequest(`http://127.0.0.1:3003/api/v1/plugin-assets/instance/${'a'.repeat(64)}/app.js`, {
    method, headers: { Host: '127.0.0.1:3003', Origin: 'null', Cookie: 'shop_access=private', Authorization: 'Bearer private' },
  });
  expect(proxy(request).status).toBe(200);
  const response = await (method === 'GET' ? assetGet : assetHead)(request);
  expect(response.status).toBe(200);
  const outgoing = (fetcher.mock.calls[0] as unknown as [URL, RequestInit])[1].headers as Headers;
  expect(outgoing.get('host')).toBeNull();
  expect(outgoing.get('x-forwarded-host')).toBe('127.0.0.1:3003');
  expect(outgoing.get('cookie')).toBeNull();
  expect(outgoing.get('authorization')).toBeNull();
  expect(response.headers.get('set-cookie')).toBeNull();
  expect(response.headers.get('access-control-allow-credentials')).toBeNull();
});
it('keeps the canonical Core API rewrite after the stateless dynamic asset handler', async () => {
  const require = createRequire(path.resolve('package.json'));
  const config = require('./next.config.js');
  const rewrites = await config.rewrites();
  expect(rewrites.afterFiles.some((rule: { source: string }) => rule.source === '/api/v1/:path*')).toBe(false);
  expect(rewrites.fallback.map((rule: { source: string }) => rule.source)).toEqual(['/api/v1/:path*']);
});
