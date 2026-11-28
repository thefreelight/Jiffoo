import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { coreApiAddressForward, middleware } from '../middleware';

// The Core API counts visitors by the address the storefront worker saw. A
// request on its way to the Core API through the rewrite rules must therefore
// carry that address under a name of our own: the hop between Workers replaces
// Cloudflare's own headers with one shared placeholder.
const VISITOR = { 'cf-connecting-ip': '203.0.113.7', 'cf-ipcountry': 'jp' };

const request = (url: string, init: { method?: string; body?: BodyInit | null; headers?: Record<string, string> } = {}) =>
  new NextRequest(url, {
    method: init.method,
    body: init.body,
    headers: { accept: 'application/json', ...VISITOR, ...(init.headers ?? {}) },
  });

const forwardedHeader = (response: Response | null, name: string) => response?.headers.get(`x-middleware-request-${name}`) ?? null;

describe('a request on its way to the Core API', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('carries the visitor address and country under names of our own', () => {
    const response = coreApiAddressForward(request('https://shop.example.com/api/v1/traffic/collect', { method: 'POST' }));
    expect(response?.status).toBe(200);
    expect(response?.headers.get('x-middleware-next')).toBe('1');
    expect(forwardedHeader(response, 'x-jiffoo-client-ip')).toBe('203.0.113.7');
    expect(forwardedHeader(response, 'x-jiffoo-client-country')).toBe('jp');
  });

  it('keeps every header the request came with', () => {
    const response = coreApiAddressForward(request('https://shop.example.com/api/v1/products?locale=en', { headers: { 'x-request-id': 'abc' } }));
    const kept = (response?.headers.get('x-middleware-override-headers') ?? '').split(',');
    for (const name of ['accept', 'cf-connecting-ip', 'cf-ipcountry', 'x-request-id', 'x-jiffoo-client-ip', 'x-jiffoo-client-country']) {
      expect(kept, name).toContain(name);
    }
    expect(forwardedHeader(response, 'x-request-id')).toBe('abc');
  });

  it('covers every path the rewrite rules hand to the Core API', () => {
    for (const path of ['/api/v1/products', '/plugins/support-hub/store/config', '/extensions/seo/file.js', '/uploads/logo.png']) {
      const response = coreApiAddressForward(request(`https://shop.example.com${path}`));
      expect(response, path).not.toBeNull();
      expect(forwardedHeader(response, 'x-jiffoo-client-ip'), path).toBe('203.0.113.7');
    }
  });

  it('leaves a page, and a path with a handler of its own, to the rest of the middleware', () => {
    for (const path of ['/', '/en', '/en/products/demo-scented-candle', '/media/catalog/1/photo.jpg', '/theme-app/en', '/official-artifacts/index.json']) {
      expect(coreApiAddressForward(request(`https://shop.example.com${path}`)), path).toBeNull();
    }
  });

  it('adds neither name without Cloudflare\u2019s headers (local development)', () => {
    const response = coreApiAddressForward(new NextRequest('https://localhost:3000/api/v1/products', { headers: { accept: 'application/json' } }));
    expect(response).not.toBeNull();
    expect(forwardedHeader(response, 'x-jiffoo-client-ip')).toBeNull();
    expect(forwardedHeader(response, 'x-jiffoo-client-country')).toBeNull();
    expect(forwardedHeader(response, 'accept')).toBe('application/json');
  });

  it('is answered by the middleware at once: no redirect, no lookup, no fetch', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error('the middleware must not fetch for a Core API path')));
    vi.stubGlobal('fetch', fetchMock);
    const response = await middleware(request('https://shop.example.com/api/v1/traffic/collect', { method: 'POST', body: '{"p":"/en"}' }));
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-middleware-rewrite')).toBeNull();
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(forwardedHeader(response, 'x-jiffoo-client-ip')).toBe('203.0.113.7');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lets a Core API path on a host with its own redirects pass too', async () => {
    // get.jiffoo.com answers its root with the installer and /official-artifacts with a
    // redirect; neither rule may catch a Core API path on that host.
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('unexpected fetch'))));
    const response = await middleware(request('https://get.jiffoo.com/api/v1/plugins/i18n/store/locales'));
    expect(response.headers.get('location')).toBeNull();
    expect(forwardedHeader(response, 'x-jiffoo-client-ip')).toBe('203.0.113.7');
  });
});
