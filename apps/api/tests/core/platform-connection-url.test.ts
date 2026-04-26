import { describe, expect, it, vi, afterEach } from 'vitest';
import { getPublicPlatformBaseUrl, normalizePlatformVerifyUrl } from '@/core/admin/platform-connection/url';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('platform connection public URL normalization', () => {
  it('uses MARKET_API_URL as the public platform base', () => {
    vi.stubEnv('MARKET_API_URL', 'https://platform-api.jiffoo.com/api');
    expect(getPublicPlatformBaseUrl()).toBe('https://platform-api.jiffoo.com');
  });

  it('rewrites cluster-local verify URLs to the public platform origin', () => {
    vi.stubEnv('MARKET_API_URL', 'https://platform-api.jiffoo.com/api');

    const normalized = normalizePlatformVerifyUrl(
      'http://platform-api.jiffoo-mall-prod.svc.cluster.local/marketplace/connect?deviceCode=abc',
    );

    expect(normalized).toBe('https://platform-api.jiffoo.com/marketplace/connect?deviceCode=abc');
  });

  it('preserves already-public verify URLs', () => {
    const url = 'https://platform-api.jiffoo.com/marketplace/connect?deviceCode=abc';
    expect(normalizePlatformVerifyUrl(url)).toBe(url);
  });
});
