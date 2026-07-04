import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getStripeStatus, ensureStripeReadyForEnable } from '../../src/lib/stripe-status';

const ENV_KEYS = [
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NODE_ENV',
];

let savedEnv: Record<string, string | undefined>;

function saveEnv() {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
  }
}

function restoreEnv() {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
}

function setAllKeys() {
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_51Abc123XyzLong';
  process.env.STRIPE_SECRET_KEY = 'sk_test_secret_key_value';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_webhook_secret';
}

function clearAllKeys() {
  delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
}

describe('getStripeStatus()', () => {
  beforeEach(() => saveEnv());
  afterEach(() => restoreEnv());

  it('returns fully configured status when all keys are present', () => {
    setAllKeys();
    process.env.NODE_ENV = 'development';

    const data = getStripeStatus();

    expect(data.configured).toBe(true);
    expect(data.storefrontReady).toBe(true);
    expect(data.apiReady).toBe(true);
    expect(data.webhookReady).toBe(true);
    expect(data.stubMode).toBe(false);
    expect(data.warnings).toHaveLength(0);
  });

  it('reports storefrontReady=false and includes warning when publishable key is missing', () => {
    setAllKeys();
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    const data = getStripeStatus();

    expect(data.storefrontReady).toBe(false);
    expect(data.warnings.some((w) => w.includes('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'))).toBe(true);
  });

  it('reports configured=false with production warning when secret key is missing in production', () => {
    setAllKeys();
    delete process.env.STRIPE_SECRET_KEY;
    process.env.NODE_ENV = 'production';

    const data = getStripeStatus();

    expect(data.configured).toBeFalsy();
    expect(data.warnings.some((w) => w.includes('production'))).toBe(true);
  });

  it('falls back to stub mode when secret key is missing', () => {
    setAllKeys();
    delete process.env.STRIPE_SECRET_KEY;
    process.env.NODE_ENV = 'development';

    const data = getStripeStatus();

    expect(data.stubMode).toBe(true);
    expect(data.apiReady).toBe(false);
  });

  it('shows first 12 chars of publishable key in publishableKeyPreview', () => {
    setAllKeys();

    const data = getStripeStatus();

    expect(data.publishableKeyPreview).toBe('pk_test_51Ab...');
  });

  it('returns publishableKeyPreview as null when publishable key is absent', () => {
    clearAllKeys();

    const data = getStripeStatus();

    expect(data.publishableKeyPreview).toBeNull();
  });

  it('returns plugin name and version', () => {
    setAllKeys();

    const data = getStripeStatus();

    expect(data.plugin).toBe('stripe');
    expect(data.version).toBe('1.0.0');
  });

  it('returns expected endpoint paths', () => {
    setAllKeys();

    const data = getStripeStatus();

    expect(data.endpoints.createSession).toBe('/api/extensions/plugin/stripe/api/payments/create-session');
    expect(data.endpoints.verifySession).toBe('/api/extensions/plugin/stripe/api/payments/verify-session');
    expect(data.endpoints.createIntent).toBe('/api/extensions/plugin/stripe/api/create-intent');
    expect(data.endpoints.webhook).toBe('/api/extensions/plugin/stripe/api/webhook/stripe');
    expect(data.endpoints.availableMethods).toBe('/api/v1/payments/available-methods');
  });

  it('prefers plugin config over environment variables', () => {
    clearAllKeys();
    process.env.NODE_ENV = 'production';

    const data = getStripeStatus({
      publishableKey: 'pk_live_from_config',
      secretKey: 'sk_live_from_config',
      webhookSecret: 'whsec_from_config',
    });

    expect(data.configured).toBe(true);
    expect(data.storefrontReady).toBe(true);
    expect(data.apiReady).toBe(true);
    expect(data.webhookReady).toBe(true);
    expect(data.stubMode).toBe(false);
  });
});

describe('ensureStripeReadyForEnable()', () => {
  beforeEach(() => saveEnv());
  afterEach(() => restoreEnv());

  it('succeeds when publishable key is set in dev mode', () => {
    setAllKeys();
    process.env.NODE_ENV = 'development';

    expect(() => ensureStripeReadyForEnable()).not.toThrow();
  });

  it('succeeds with only publishable key in dev mode (no secret)', () => {
    clearAllKeys();
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_xyz';
    process.env.NODE_ENV = 'development';

    expect(() => ensureStripeReadyForEnable()).not.toThrow();
  });

  it('throws when publishable key is missing', () => {
    clearAllKeys();
    process.env.NODE_ENV = 'development';

    expect(() => ensureStripeReadyForEnable()).toThrow(
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is required',
    );
  });

  it('throws in production when secret key is missing', () => {
    clearAllKeys();
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_live_abc';
    process.env.NODE_ENV = 'production';

    expect(() => ensureStripeReadyForEnable()).toThrow(
      'STRIPE_SECRET_KEY is required',
    );
  });

  it('throws in production when webhook secret is missing', () => {
    clearAllKeys();
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_live_abc';
    process.env.STRIPE_SECRET_KEY = 'sk_live_xyz';
    process.env.NODE_ENV = 'production';

    expect(() => ensureStripeReadyForEnable()).toThrow(
      'STRIPE_WEBHOOK_SECRET is required',
    );
  });
});
