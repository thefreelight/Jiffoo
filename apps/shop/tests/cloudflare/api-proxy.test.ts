import { afterEach, describe, expect, it, vi } from 'vitest';

import { proxyApiRequest } from '@/lib/cloudflare/api-proxy';

describe('proxyApiRequest', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('forwards same-origin API requests to the configured Core API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"success":true}'));
    vi.stubGlobal('fetch', fetchMock);

    const response = await proxyApiRequest(
      new Request('https://bokmoo.com/api/themes/active?preview=1', {
        headers: { cookie: 'session=abc' },
      }),
      'https://api.bokmoo.com',
    );

    expect(response?.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();

    const forwarded = fetchMock.mock.calls[0]?.[0] as Request;
    expect(forwarded.url).toBe('https://api.bokmoo.com/api/themes/active?preview=1');
    expect(forwarded.headers.get('cookie')).toBe('session=abc');
    expect(forwarded.headers.get('x-forwarded-host')).toBe('bokmoo.com');
    expect(forwarded.headers.get('x-forwarded-proto')).toBe('https');
  });

  it('does not intercept non-API requests', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await proxyApiRequest(
      new Request('https://bokmoo.com/en/products'),
      'https://api.bokmoo.com',
    );

    expect(response).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
