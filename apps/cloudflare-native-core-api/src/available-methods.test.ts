import { describe, expect, it } from 'vitest';
import { stripeBindingMethod, stripeMethod, tryNativeAvailableMethods } from './available-methods';

function env(rows: Record<string, unknown>, bindings?: { secretKey?: string; webhookSecret?: string }) {
  return {
    DB: {
      prepare: () => ({
        bind: (slug: string) => ({ first: async () => rows[slug] ?? null }),
      }),
    },
    ...(bindings?.secretKey !== undefined ? { STRIPE_SECRET_KEY: bindings.secretKey } : {}),
    ...(bindings?.webhookSecret !== undefined ? { STRIPE_WEBHOOK_SECRET: bindings.webhookSecret } : {}),
  } as unknown as { DB: D1Database };
}

describe('native available methods', () => {
  it('publishes Stripe only when the enabled instance is fully configured', () => {
    expect(stripeMethod(null)).toBeNull();
    expect(stripeMethod({ enabled: 0, config_json: '{}', encrypted_secrets_json: '{}' })).toBeNull();
    expect(stripeMethod({
      enabled: 1,
      config_json: JSON.stringify({ publishableKey: 'pk_test_example' }),
      encrypted_secrets_json: JSON.stringify({ secretKey: {}, webhookSecret: {} }),
    })).toMatchObject({ name: 'stripe', isLive: false, clientConfig: { publishableKey: 'pk_test_example' } });
    expect(stripeMethod({
      enabled: 1,
      config_json: JSON.stringify({ publishableKey: 'pk_live_example' }),
      encrypted_secrets_json: JSON.stringify({ secretKey: {} }),
    })).toBeNull();
  });

  it('returns configured payment and shipping methods without snapshot imports', async () => {
    const configured = env({
      stripe: {
        enabled: 1,
        config_json: JSON.stringify({ publishableKey: 'pk_live_example' }),
        encrypted_secrets_json: JSON.stringify({ secretKey: {}, webhookSecret: {} }),
      },
      shipping: { enabled: 1, config_json: '{}', encrypted_secrets_json: '{}' },
    });
    const payments = await tryNativeAvailableMethods(
      new Request('https://example.com/api/v1/payments/available-methods'),
      configured,
    );
    expect(await payments?.json()).toMatchObject({
      success: true,
      data: [{ name: 'stripe', isLive: true }],
    });
    const shipping = await tryNativeAvailableMethods(
      new Request('https://example.com/api/v1/shipping/available-methods'),
      configured,
    );
    expect(await shipping?.json()).toMatchObject({
      success: true,
      data: [{ methodId: 'standard', pluginSlug: 'shipping' }],
    });
  });

  it('falls back to Stripe Secrets Store bindings when no instance is configured', async () => {
    const payments = await tryNativeAvailableMethods(
      new Request('https://example.com/api/v1/payments/available-methods'),
      env({}, { secretKey: 'sk_test_example', webhookSecret: 'whsec_example' }),
    );
    expect(await payments?.json()).toMatchObject({
      success: true,
      data: [{ name: 'stripe', isLive: false, clientConfig: {} }],
    });
    const live = await tryNativeAvailableMethods(
      new Request('https://example.com/api/v1/payments/available-methods'),
      env({}, { secretKey: 'sk_live_example', webhookSecret: 'whsec_example' }),
    );
    expect(await live?.json()).toMatchObject({
      success: true,
      data: [{ name: 'stripe', isLive: true }],
    });
  });

  it('keeps the method list empty when neither the instance nor the bindings are usable', async () => {
    expect(stripeBindingMethod('', 'whsec_example')).toBeNull();
    expect(stripeBindingMethod('sk_test_example', '')).toBeNull();
    expect(stripeBindingMethod('not-a-stripe-key', 'whsec_example')).toBeNull();
    const payments = await tryNativeAvailableMethods(
      new Request('https://example.com/api/v1/payments/available-methods'),
      env({}),
    );
    expect(await payments?.json()).toEqual({ success: true, data: [] });
  });

  it('prefers the configured plugin instance over the fallback bindings', async () => {
    const payments = await tryNativeAvailableMethods(
      new Request('https://example.com/api/v1/payments/available-methods'),
      env({
        stripe: {
          enabled: 1,
          config_json: JSON.stringify({ publishableKey: 'pk_live_example' }),
          encrypted_secrets_json: JSON.stringify({ secretKey: {}, webhookSecret: {} }),
        },
      }, { secretKey: 'sk_test_example', webhookSecret: 'whsec_example' }),
    );
    expect(await payments?.json()).toMatchObject({
      success: true,
      data: [{ name: 'stripe', isLive: true, clientConfig: { publishableKey: 'pk_live_example' } }],
    });
  });
});
