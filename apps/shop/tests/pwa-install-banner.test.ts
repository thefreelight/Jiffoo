import { describe, expect, it } from 'vitest';

import { isPwaInstallBannerSuppressedPath } from '@/components/pwa-install-banner';

describe('isPwaInstallBannerSuppressedPath', () => {
  it.each([
    '/en/auth/login',
    '/zh-Hant/auth/register',
    '/en/auth/callback/google',
    '/auth/forgot-password',
  ])('suppresses the install banner on auth routes: %s', (pathname) => {
    expect(isPwaInstallBannerSuppressedPath(pathname)).toBe(true);
  });

  it.each([
    '/en',
    '/en/products',
    '/zh-Hant/checkout',
    '/author/profile',
  ])('keeps the install banner available elsewhere: %s', (pathname) => {
    expect(isPwaInstallBannerSuppressedPath(pathname)).toBe(false);
  });
});
