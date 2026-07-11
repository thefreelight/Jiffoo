import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// We do NOT mock stripe-client itself - we test the real module.
// However, we mock the Stripe constructor so we do not make real API calls.

const mockStripeConstructor = vi.hoisted(() =>
  vi.fn(() => ({ _id: Math.random() })),
);

vi.mock('stripe', () => ({
  default: mockStripeConstructor,
}));

import { getStripeClient, resetStripeClient } from '../../src/lib/stripe-client';

const ENV_KEYS = ['STRIPE_SECRET_KEY'];
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

describe('stripe-client', () => {
  beforeEach(() => {
    saveEnv();
    resetStripeClient();
    vi.clearAllMocks();
    // Each call creates a unique object for identity checks
    mockStripeConstructor.mockImplementation(() => ({ _id: Math.random() }));
  });

  afterEach(() => {
    restoreEnv();
    resetStripeClient();
  });

  describe('getStripeClient', () => {
    it('creates an instance using env STRIPE_SECRET_KEY', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_env_key';

      const client = getStripeClient();

      expect(client).toBeDefined();
      expect(mockStripeConstructor).toHaveBeenCalledWith(
        'sk_test_env_key',
        expect.objectContaining({ typescript: true }),
      );
    });

    it('creates an instance with a provided secret key', () => {
      const client = getStripeClient('sk_test_provided');

      expect(client).toBeDefined();
      expect(mockStripeConstructor).toHaveBeenCalledWith(
        'sk_test_provided',
        expect.objectContaining({ typescript: true }),
      );
    });

    it('throws when no key is available', () => {
      delete process.env.STRIPE_SECRET_KEY;

      expect(() => getStripeClient()).toThrow('Stripe secret key is not configured');
    });

    it('caches the singleton when using env key', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_cached';

      const first = getStripeClient();
      const second = getStripeClient();

      expect(first).toBe(second);
      expect(mockStripeConstructor).toHaveBeenCalledTimes(1);
    });

    it('creates a new instance each time when explicit key is provided', () => {
      const first = getStripeClient('sk_test_a');
      const second = getStripeClient('sk_test_b');

      expect(first).not.toBe(second);
      expect(mockStripeConstructor).toHaveBeenCalledTimes(2);
    });

    it('does not mix explicit key instance with cached env instance', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_env';

      const envClient = getStripeClient();
      const explicitClient = getStripeClient('sk_test_explicit');

      expect(envClient).not.toBe(explicitClient);
      expect(mockStripeConstructor).toHaveBeenCalledTimes(2);

      // Cached env client is still the same instance
      const envClient2 = getStripeClient();
      expect(envClient2).toBe(envClient);
    });
  });

  describe('resetStripeClient', () => {
    it('clears the cached singleton', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_reset';

      const first = getStripeClient();
      resetStripeClient();
      const second = getStripeClient();

      expect(first).not.toBe(second);
      expect(mockStripeConstructor).toHaveBeenCalledTimes(2);
    });
  });
});
