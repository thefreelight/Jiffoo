import { afterEach, describe, expect, it, vi } from 'vitest';
import { parentDomainAuthCookieEnabled } from '@/lib/auth-cookie-policy';

describe('parentDomainAuthCookieEnabled', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('shares the session across the site family unless the deployment opts out', () => {
    vi.stubEnv('NEXT_PUBLIC_AUTH_PARENT_DOMAIN_COOKIE', '');
    expect(parentDomainAuthCookieEnabled()).toBe(true);
    vi.stubEnv('NEXT_PUBLIC_AUTH_PARENT_DOMAIN_COOKIE', '1');
    expect(parentDomainAuthCookieEnabled()).toBe(true);
  });

  it('stops mirroring the token into the family cookie on an explicit opt-out', () => {
    vi.stubEnv('NEXT_PUBLIC_AUTH_PARENT_DOMAIN_COOKIE', '0');
    expect(parentDomainAuthCookieEnabled()).toBe(false);
  });
});
