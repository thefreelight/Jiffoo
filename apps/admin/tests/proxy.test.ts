// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '../proxy';

describe('Admin locale proxy with the installed Next runtime', () => {
  it.each([
    ['/', '/en'],
    ['/products?search=widget', '/en/products?search=widget'],
    ['/auth/login?next=%2Fen%2Forders', '/en/auth/login?next=%2Fen%2Forders'],
  ])('redirects %s while preserving its query', async (pathname, destination) => {
    const response = await proxy(new NextRequest(`http://admin.local${pathname}`));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(`http://admin.local${destination}`);
  });

  it.each(['en', 'zh-Hans', 'zh-Hant'])('keeps the %s locale and authentication path', async locale => {
    const response = await proxy(new NextRequest(`http://admin.local/${locale}/auth/login`));
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-middleware-request-x-admin-locale')).toBe(locale);
  });

  it.each(['/api/v1/orders', '/plugins/example', '/extensions/plugin/example', '/uploads/image.png', '/_next/static/chunk.js'])('keeps %s outside locale routing', async pathname => {
    const response = await proxy(new NextRequest(`http://admin.local${pathname}`));
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it.each(['GET', 'HEAD'])('keeps a signed %s download outside locale routing and rejects opaque origins', async method => {
    const url = 'http://admin.local/plugin-downloads/12345678-1234-4123-8123-123456789abc?token=signed';
    const response = await proxy(new NextRequest(url, { method }));
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(response.headers.get('location')).toBeNull();
    const opaque = await proxy(new NextRequest(url, { method, headers: { Origin: 'null', Cookie: 'session=private' } }));
    expect(opaque.status).toBe(403);
    expect(opaque.headers.get('x-middleware-next')).toBeNull();
  });
});
