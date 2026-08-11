import { describe, expect, it } from 'vitest';
import { stripeMethod, tryNativeAvailableMethods } from './available-methods';

function env(rows: Record<string, unknown>) {
  return {
    DB: {
      prepare: () => ({
        bind: (slug: string) => ({ first: async () => rows[slug] ?? null }),
      }),
    },
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
});
