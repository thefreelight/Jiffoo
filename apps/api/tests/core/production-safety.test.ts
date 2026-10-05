import { describe, expect, it } from 'vitest';
import { assertProductionSafety, productionSafetyViolations } from '@/config/production-safety';

const compliant = {
  NODE_ENV: 'production',
  JWT_SECRET: 'a-secret-that-is-at-least-32-characters',
  CORS_ORIGIN: 'https://store.example.com,https://admin.example.com',
  STOREFRONT_URL: 'https://store.example.com',
  ADMIN_URL: 'https://admin.example.com',
};

describe('Production startup safety', () => {
  it.each([
    ['DISABLE_RATE_LIMITER=true', {}, 'true'],
    ['JWT_SECRET must be at least 32 characters', { JWT_SECRET: 'short' }, undefined],
    ['CORS_ORIGIN must not contain a wildcard', { CORS_ORIGIN: 'https://*.example.com' }, undefined],
    ['STOREFRONT_URL must use HTTPS except loopback', { STOREFRONT_URL: 'http://store.example.com' }, undefined],
    ['ADMIN_URL must use HTTPS except loopback', { ADMIN_URL: 'http://admin.example.com' }, undefined],
  ])('rejects %s', (message, overrides, disabled) => {
    expect(() => assertProductionSafety({ ...compliant, ...overrides }, disabled)).toThrow(message);
  });

  it('lists all simultaneous violations', () => {
    expect(productionSafetyViolations({
      ...compliant,
      JWT_SECRET: 'short',
      CORS_ORIGIN: '*',
      STOREFRONT_URL: 'http://store.example.com',
      ADMIN_URL: 'http://admin.example.com',
    }, 'true')).toHaveLength(5);
  });

  it('accepts compliant production settings and loopback HTTP URLs', () => {
    expect(() => assertProductionSafety(compliant, undefined)).not.toThrow();
    expect(() => assertProductionSafety({
      ...compliant, STOREFRONT_URL: 'http://127.0.0.1:3003', ADMIN_URL: 'http://[::1]:3002',
    }, undefined)).not.toThrow();
  });
});
