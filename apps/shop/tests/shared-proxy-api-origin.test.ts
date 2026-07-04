import { afterEach, describe, expect, it, vi } from 'vitest';
import { getActiveThemeInfo } from 'shared/src/proxy';

describe('shared proxy API origin', () => {
  const originalApiServiceUrl = process.env.API_SERVICE_URL;

  afterEach(() => {
    vi.unstubAllGlobals();

    if (originalApiServiceUrl === undefined) {
      delete process.env.API_SERVICE_URL;
    } else {
      process.env.API_SERVICE_URL = originalApiServiceUrl;
    }
  });

  it('fetches active theme from API_SERVICE_URL instead of the shop request origin', async () => {
    process.env.API_SERVICE_URL = 'http://api:80/';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          type: 'pack',
          slug: 'bokmoo',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const request = {
      nextUrl: new URL('https://bokmoo.com/en'),
    };

    await expect(getActiveThemeInfo(request as any, 'shop')).resolves.toEqual({
      type: 'pack',
      slug: 'bokmoo',
      baseUrl: undefined,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api/api/themes/active?target=shop',
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
      }),
    );
  });
});
