const VERSION = '1.0.0';

export interface StripeStatus {
  plugin: string;
  version: string;
  environment: string;
  configured: boolean;
  storefrontReady: boolean;
  apiReady: boolean;
  webhookReady: boolean;
  stubMode: boolean;
  publishableKeyPreview: string | null;
  endpoints: {
    createSession: string;
    verifySession: string;
    createIntent: string;
    webhook: string;
    availableMethods: string;
  };
  warnings: string[];
}

type StripeConfigLike = {
  publishableKey?: unknown;
  secretKey?: unknown;
  webhookSecret?: unknown;
};

export function getStripeStatus(config?: StripeConfigLike): StripeStatus {
  const publishableKey = String(
    config?.publishableKey || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
  ).trim();
  const secretKey = String(
    config?.secretKey || process.env.STRIPE_SECRET_KEY || ''
  ).trim();
  const webhookSecret = String(
    config?.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET || ''
  ).trim();
  const isProduction = process.env.NODE_ENV === 'production';

  const warnings: string[] = [];
  if (!publishableKey) {
    warnings.push('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing. Storefront checkout cannot open Stripe Elements.');
  }
  if (!secretKey) {
    warnings.push(
      isProduction
        ? 'STRIPE_SECRET_KEY is missing. Stripe payments cannot run in production.'
        : 'STRIPE_SECRET_KEY is missing. Development mode will fall back to stubbed payment intents.',
    );
  }
  if (!webhookSecret) {
    warnings.push(
      isProduction
        ? 'STRIPE_WEBHOOK_SECRET is missing. Webhook verification is not ready in production.'
        : 'STRIPE_WEBHOOK_SECRET is missing. Local testing can continue, but webhook verification is not configured.',
    );
  }

  return {
    plugin: 'stripe',
    version: VERSION,
    environment: process.env.NODE_ENV || 'development',
    configured: Boolean(publishableKey) && (!isProduction || Boolean(secretKey && webhookSecret)),
    storefrontReady: Boolean(publishableKey),
    apiReady: Boolean(secretKey),
    webhookReady: Boolean(webhookSecret),
    stubMode: !secretKey,
    publishableKeyPreview: publishableKey ? `${publishableKey.slice(0, 12)}...` : null,
    endpoints: {
      createSession: '/api/extensions/plugin/stripe/api/payments/create-session',
      verifySession: '/api/extensions/plugin/stripe/api/payments/verify-session',
      createIntent: '/api/extensions/plugin/stripe/api/create-intent',
      webhook: '/api/extensions/plugin/stripe/api/webhook/stripe',
      availableMethods: '/api/v1/payments/available-methods',
    },
    warnings,
  };
}

export function ensureStripeReadyForEnable(config?: StripeConfigLike): void {
  const publishableKey = String(
    config?.publishableKey || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
  ).trim();
  const secretKey = String(
    config?.secretKey || process.env.STRIPE_SECRET_KEY || ''
  ).trim();
  const webhookSecret = String(
    config?.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET || ''
  ).trim();
  const isProduction = process.env.NODE_ENV === 'production';

  if (!publishableKey) {
    throw new Error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is required before enabling the Stripe plugin.');
  }

  if (isProduction && !secretKey) {
    throw new Error('STRIPE_SECRET_KEY is required before enabling the Stripe plugin in production.');
  }

  if (isProduction && !webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is required before enabling the Stripe plugin in production.');
  }
}
