import { beforeEach, describe, expect, it, vi } from 'vitest';

const { pluginManagementServiceMock, secretManagerServiceMock } = vi.hoisted(() => ({
  pluginManagementServiceMock: {
    getDefaultInstance: vi.fn(),
  },
  secretManagerServiceMock: {
    resolve: vi.fn(),
  },
}));

vi.mock('@/core/admin/plugin-management/service', () => ({
  PluginManagementService: pluginManagementServiceMock,
}));

vi.mock('@/core/secrets/secret-manager', () => ({
  SecretManagerService: secretManagerServiceMock,
}));

vi.mock('@/config/env', () => ({
  env: {
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: '',
    STRIPE_PUBLISHABLE_KEY: '',
    STRIPE_SECRET_KEY: '',
    STRIPE_WEBHOOK_SECRET: '',
  },
}));

vi.mock('stripe', () => ({
  default: vi.fn(),
}));

import { StripeService } from '@/services/stripe.service';

describe('StripeService runtime config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (StripeService as any).client = null;
    (StripeService as any).clientKey = '';
    (StripeService as any).configCache = null;
  });

  it('reads official namespaced Stripe plugin settings', async () => {
    pluginManagementServiceMock.getDefaultInstance.mockResolvedValue({
      enabled: true,
      deletedAt: null,
      configJson: {
        'stripe.publishableKey': 'pk_test_bokmoo',
        'stripe.secretKey': 'sk_test_bokmoo',
        'stripe.webhookSecret': 'whsec_bokmoo',
      },
    });

    const config = await StripeService.getRuntimeConfig();

    expect(config).toEqual({
      publishableKey: 'pk_test_bokmoo',
      secretKey: 'sk_test_bokmoo',
      webhookSecret: 'whsec_bokmoo',
    });
  });

  it('resolves official namespaced Stripe secret references', async () => {
    pluginManagementServiceMock.getDefaultInstance.mockResolvedValue({
      enabled: true,
      deletedAt: null,
      configJson: {
        'stripe.publishableKey': 'pk_test_bokmoo',
        'stripe.secretKeyRef': 'secret://stripe-secret-key',
        'stripe.webhookSecretRef': 'secret://stripe-webhook-secret',
      },
    });
    secretManagerServiceMock.resolve
      .mockResolvedValueOnce('sk_test_from_ref')
      .mockResolvedValueOnce('whsec_from_ref');

    const config = await StripeService.getRuntimeConfig();

    expect(config).toEqual({
      publishableKey: 'pk_test_bokmoo',
      secretKey: 'sk_test_from_ref',
      webhookSecret: 'whsec_from_ref',
    });
    expect(secretManagerServiceMock.resolve).toHaveBeenCalledWith('secret://stripe-secret-key');
    expect(secretManagerServiceMock.resolve).toHaveBeenCalledWith('secret://stripe-webhook-secret');
  });
});
