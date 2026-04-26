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

  it('ignores internal MARKET_API_URL values and self-hosted store domains', () => {
    vi.stubEnv('MARKET_API_URL', 'http://platform-api.jiffoo-mall-prod.svc.cluster.local/api');
    vi.stubEnv('PLATFORM_API_DOMAIN', 'navtoai.com');
    vi.stubEnv('NEXT_PUBLIC_SHOP_URL', 'https://navtoai.com');
    vi.stubEnv('NEXT_PUBLIC_ADMIN_URL', 'https://admin.navtoai.com');

    expect(getPublicPlatformBaseUrl()).toBe('https://platform-api.jiffoo.com');
  });

  it('preserves already-public verify URLs', () => {
    const url = 'https://platform-api.jiffoo.com/marketplace/connect?deviceCode=abc';
    expect(normalizePlatformVerifyUrl(url)).toBe(url);
  });
});
