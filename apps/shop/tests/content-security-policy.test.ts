import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { buildContentSecurityPolicy, cspOrigins } = require('../config/content-security-policy.js') as {
  buildContentSecurityPolicy(options?: { development?: boolean; extraScriptSrc?: string; extraFrameSrc?: string }): string;
  cspOrigins(value?: string): string;
};

// The policy every storefront shipped before deployments could extend it.
const PRODUCTION_POLICY = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: http:; frame-src 'self' https://js.stripe.com https://hooks.stripe.com; frame-ancestors 'none';";
const DEVELOPMENT_POLICY = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://unpkg.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: http:; frame-src 'self' https://js.stripe.com https://hooks.stripe.com; worker-src 'self' blob:; frame-ancestors 'none';";

describe('cspOrigins', () => {
  it('accepts bare https origins only, once each', () => {
    expect(cspOrigins('https://a.example https://b.example:8443 https://a.example')).toBe(' https://a.example https://b.example:8443');
  });

  it('drops anything that is not a bare https origin', () => {
    expect(cspOrigins('http://a.example https://a.example/path https://*.example.com https://user@a.example javascript:alert(1) https://a.example?x=1')).toBe('');
    // A semicolon is not part of an origin, so an attempt to append a directive loses the origin too.
    expect(cspOrigins('https://a.example; frame-ancestors *')).toBe('');
  });

  it('is empty for an unset value', () => {
    expect(cspOrigins(undefined)).toBe('');
    expect(cspOrigins('')).toBe('');
  });
});

describe('buildContentSecurityPolicy', () => {
  it('keeps the policy every storefront shipped with when nothing extra is declared', () => {
    expect(buildContentSecurityPolicy()).toBe(PRODUCTION_POLICY);
    expect(buildContentSecurityPolicy({ development: true })).toBe(DEVELOPMENT_POLICY);
  });

  it('adds declared origins to script-src and frame-src only', () => {
    const policy = buildContentSecurityPolicy({
      extraScriptSrc: 'https://pagead2.googlesyndication.com',
      extraFrameSrc: 'https://html5.gamemonetize.co https://googleads.g.doubleclick.net',
    });
    expect(policy).toBe(
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://pagead2.googlesyndication.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: http:; frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://html5.gamemonetize.co https://googleads.g.doubleclick.net; frame-ancestors 'none';",
    );
  });

  it('cannot be talked into widening another directive', () => {
    // Whoever sets the build variable chooses the origins; the value cannot add or change a directive.
    const policy = buildContentSecurityPolicy({ extraFrameSrc: 'https://a.example; default-src *; frame-ancestors *' });
    expect(policy).toBe(PRODUCTION_POLICY);
    expect(buildContentSecurityPolicy({ extraFrameSrc: 'https://a.example default-src *' })).toBe(
      PRODUCTION_POLICY.replace('https://hooks.stripe.com;', 'https://hooks.stripe.com https://a.example;'),
    );
  });
});
