// @ts-nocheck
/**
 * Stripe Service
 *
 * Lightweight wrapper to keep Stripe usage centralized and test-friendly.
 * Falls back to stub behavior when Stripe credentials are not configured.
 */

import Stripe from 'stripe';
import { env } from '@/config/env';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { SecretManagerService } from '@/core/secrets/secret-manager';

type CreatePaymentIntentInput = {
  amount: number;
  currency: string;
  orderId: string;
  metadata?: Record<string, string>;
};

type StripeRuntimeConfig = {
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
};

type HttpsProxyAgentModule = typeof import('https-proxy-agent');

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  return typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getConfiguredValue(config: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = config[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function getOutboundProxyUrl(): string {
  const candidates = [
    process.env.HTTPS_PROXY,
    process.env.HTTP_PROXY,
    process.env.https_proxy,
    process.env.http_proxy,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return '';
}

async function createStripeHttpAgent(proxyUrl: string): Promise<Stripe.HttpAgent | undefined> {
  if (!proxyUrl) {
    return undefined;
  }

  try {
    // `https-proxy-agent` is ESM-only in v8+, while the API runtime still builds
    // to CommonJS. Use native dynamic import so non-proxy environments do not
    // crash at module load time.
    const importModule = new Function(
      'specifier',
      'return import(specifier)'
    ) as (specifier: string) => Promise<HttpsProxyAgentModule>;
    const { HttpsProxyAgent } = await importModule('https-proxy-agent');
    return new HttpsProxyAgent(proxyUrl);
  } catch (error) {
    console.warn('[StripeService] Failed to initialize HTTPS proxy agent, continuing without proxy.', error);
    return undefined;
  }
}

async function resolveConfiguredSecret(
  config: Record<string, unknown>,
  options: {
    refKeys: string[];
    valueKeys: string[];
    envFallback?: string;
  }
): Promise<string> {
  const secretRef = getConfiguredValue(config, ...options.refKeys);
  if (secretRef) {
    return SecretManagerService.resolve(secretRef);
  }

  const inlineValue = getConfiguredValue(config, ...options.valueKeys);
  if (inlineValue) {
    return inlineValue;
  }

  return String(options.envFallback || '').trim();
}

export class StripeService {
  private static client: Stripe | null = null;
  private static clientKey = '';
  private static configCache: { expiresAt: number; value: StripeRuntimeConfig } | null = null;

  static async getRuntimeConfig(): Promise<StripeRuntimeConfig> {
    const now = Date.now();
    if (this.configCache && this.configCache.expiresAt > now) {
      return this.configCache.value;
    }

    let pluginConfig: Record<string, unknown> = {};
    try {
      const defaultInstance = await PluginManagementService.getDefaultInstance('stripe');
      if (defaultInstance?.enabled && !defaultInstance.deletedAt) {
        pluginConfig = parseJsonObject(defaultInstance.configJson);
      }
    } catch {
      pluginConfig = {};
    }

    const value = {
      publishableKey:
        getConfiguredValue(pluginConfig, 'publishableKey', 'publishable_key')
        || String(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || env.STRIPE_PUBLISHABLE_KEY || '').trim(),
      secretKey: await resolveConfiguredSecret(pluginConfig, {
        refKeys: ['secretKeyRef', 'secret_key_ref'],
        valueKeys: ['secretKey', 'secret_key'],
        envFallback: env.STRIPE_SECRET_KEY,
      }),
      webhookSecret: await resolveConfiguredSecret(pluginConfig, {
        refKeys: ['webhookSecretRef', 'webhook_secret_ref'],
        valueKeys: ['webhookSecret', 'webhook_secret'],
        envFallback: env.STRIPE_WEBHOOK_SECRET,
      }),
    };

    this.configCache = {
      value,
      expiresAt: now + 30_000,
    };

    return value;
  }

  private static async getClient(): Promise<Stripe | null> {
    const { secretKey } = await this.getRuntimeConfig();
    if (!secretKey) {
      return null;
    }

    const proxyUrl = getOutboundProxyUrl();
    const clientKey = `${secretKey}::${proxyUrl}`;

    if (!this.client || this.clientKey !== clientKey) {
      const httpAgent = await createStripeHttpAgent(proxyUrl);
      this.client = new Stripe(secretKey, {
        apiVersion: '2024-06-20',
        typescript: true,
        maxNetworkRetries: 0,
        timeout: 20_000,
        ...(httpAgent ? { httpAgent } : {}),
      });
      this.clientKey = clientKey;
    }

    return this.client;
  }

  static async createPaymentIntent(input: CreatePaymentIntentInput): Promise<{
    id: string;
    clientSecret: string;
  }> {
    const client = await this.getClient();

    if (!client) {
      // Stubbed response for local/test environments without Stripe config.
      const stubId = `pi_${Math.random().toString(36).slice(2, 10)}`;
      return {
        id: stubId,
        clientSecret: `secret_${stubId}`,
      };
    }

    const intent = await client.paymentIntents.create({
      amount: Math.max(0, Math.trunc(input.amount)),
      currency: input.currency,
      metadata: {
        orderId: input.orderId,
        ...(input.metadata || {}),
      },
    });

    if (!intent.client_secret) {
      throw new Error('Stripe did not return a client secret');
    }

    return {
      id: intent.id,
      clientSecret: intent.client_secret,
    };
  }

  static async constructWebhookEvent(payload: Buffer | string, signature: string): Promise<Stripe.Event> {
    const client = await this.getClient();
    const { webhookSecret } = await this.getRuntimeConfig();

    if (!client || !webhookSecret) {
      throw new Error('Stripe webhook is not configured');
    }

    return client.webhooks.constructEvent(payload, signature, webhookSecret);
  }
}
