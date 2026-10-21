// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import inventory from '../../../scripts/cookie-route-inventory.json';
import * as routes from '../app/api/[[...path]]/route';
import { proxy } from '../proxy';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it.each(inventory.adminProxy.methods)('Admin %s proxy rejects null Origin for every inventoried route before forwarding', async method => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  for (const path of inventory.adminProxy.samples) {
    for (const credentials of [{ Cookie: 'session=private' }, { Authorization: 'Bearer ordinary-token' }] as Record<string, string>[]) {
      const handle = method === 'HEAD' ? routes.GET : routes[method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS'];
      const response = await handle(new NextRequest(`http://127.0.0.1:3002${path}`, {
        method, headers: { Origin: 'null', ...credentials, 'Content-Type': 'text/plain' },
        ...(!['GET', 'HEAD'].includes(method) ? { body: '{}' } : {}),
      }));
      expect(response.status).toBe(403);
      expect(response.headers.get('set-cookie')).toBeNull();
    }
  }
  expect(fetcher).not.toHaveBeenCalled();
});
it.each(inventory.adminPreferenceConsumers)('%s cannot read preference cookies with null Origin', async path => {
  for (const locale of ['en', 'zh-Hans', 'zh-Hant']) {
    for (const credential of [{ Cookie: 'jiffoo_admin_color_mode=dark; jiffoo_admin_sidebar=1' }, { Authorization: 'Bearer ordinary-token' }] as Record<string, string>[]) {
      const response = await proxy(new NextRequest(`http://127.0.0.1:3002${path.replace('/en', `/${locale}`)}`, {
        headers: { Origin: 'null', ...credential },
      }));
      expect(response.status).toBe(403);
      expect(response.headers.get('x-middleware-next')).toBeNull();
    }
  }
});
it.each(inventory.localCookieForwardingRewrites)('%s cannot forward cookies through local rewrite proxies', async path => {
  const response = await proxy(new NextRequest(`http://127.0.0.1:3002${path}`, {
    method: 'POST', headers: { Origin: 'null', Cookie: 'session=private', 'Content-Type': 'text/plain' }, body: 'simple',
  }));
  expect(response.status).toBe(403);
  expect(response.headers.get('x-middleware-next')).toBeNull();
});
it.each(inventory.nullOriginGatewayException)('forwards the null-origin gateway exception %s to Core', async path => {
  vi.stubEnv('API_SERVICE_URL', 'http://127.0.0.1:3001');
  const fetcher = vi.fn(async () => new Response('{"success":false}', { status: 403, headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fetcher);
  const response = await routes.POST(new NextRequest(`http://127.0.0.1:3002${path}`, {
    method: 'POST', headers: { Origin: 'null', Cookie: 'session=private', 'Content-Type': 'text/plain' }, body: 'proof',
  }));
  expect(response.status).toBe(403);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const outgoing = (fetcher.mock.calls[0] as unknown as [URL, RequestInit])[1].headers as Headers;
  expect(outgoing.get('cookie')).toBe('session=private');
});
it.each(['GET', 'HEAD'])('forwards only stateless plugin asset %s, preserving an exactly configured public Host', async method => {
  vi.stubEnv('API_SERVICE_URL', 'http://127.0.0.1:3001');
  vi.stubEnv('ADMIN_URL', 'http://127.0.0.1:3002');
  const fetcher = vi.fn(async () => new Response(method === 'HEAD' ? null : 'module', { headers: {
    'Access-Control-Allow-Origin': '*', 'Set-Cookie': 'untrusted=private', 'Access-Control-Allow-Credentials': 'true',
  } }));
  vi.stubGlobal('fetch', fetcher);
  const response = await routes.GET(new NextRequest(`http://127.0.0.1:3002/api/v1/plugin-assets/instance/${'a'.repeat(64)}/app.js`, {
    method, headers: { Host: '127.0.0.1:3002', Origin: 'null', Cookie: 'session=private', Authorization: 'Bearer private' },
  }));
  expect(response.status).toBe(200);
  const outgoing = (fetcher.mock.calls[0] as unknown as [URL, RequestInit])[1].headers as Headers;
  expect(outgoing.get('host')).toBeNull();
  expect(outgoing.get('x-forwarded-host')).toBe('127.0.0.1:3002');
  expect(outgoing.get('cookie')).toBeNull();
  expect(outgoing.get('authorization')).toBeNull();
  expect(response.headers.get('set-cookie')).toBeNull();
  expect(response.headers.get('access-control-allow-credentials')).toBeNull();
});
