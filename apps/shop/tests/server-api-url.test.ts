import { afterEach, describe, expect, it, vi } from 'vitest';

const headersMock = vi.hoisted(() => vi.fn());

vi.mock('next/headers', () => ({
  headers: headersMock,
}));

import { buildServerApiUrl, resolveServerApiOrigin } from '@/lib/server-api-url';

describe('server API URL resolution', () => {
  const originalApiServiceUrl = process.env.API_SERVICE_URL;

  afterEach(() => {
    headersMock.mockReset();

    if (originalApiServiceUrl === undefined) {
      delete process.env.API_SERVICE_URL;
    } else {
      process.env.API_SERVICE_URL = originalApiServiceUrl;
    }
  });

  it('prefers API_SERVICE_URL over the incoming shop request origin', async () => {
    process.env.API_SERVICE_URL = 'http://api:80/';
    headersMock.mockResolvedValue({
      get: (key: string) => {
        if (key === 'x-forwarded-host') return null;
        if (key === 'x-forwarded-proto') return 'https';
        if (key === 'host') return 'bokmoo.com';
        return null;
      },
    });

    await expect(resolveServerApiOrigin()).resolves.toBe('http://api:80');
    await expect(buildServerApiUrl('/store/context')).resolves.toBe('http://api/api/store/context');
  });

  it('falls back to the request origin when no internal API URL is configured', async () => {
    delete process.env.API_SERVICE_URL;
    headersMock.mockResolvedValue({
      get: (key: string) => {
        if (key === 'x-forwarded-host') return 'bokmoo.com';
        if (key === 'x-forwarded-proto') return 'https';
        return null;
      },
    });

    await expect(resolveServerApiOrigin()).resolves.toBe('https://bokmoo.com');
    await expect(buildServerApiUrl('/themes/active')).resolves.toBe('https://bokmoo.com/api/themes/active');
  });
});
