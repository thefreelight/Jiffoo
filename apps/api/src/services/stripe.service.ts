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
      secretKey:
        getConfiguredValue(pluginConfig, 'secretKey', 'secret_key')
        || String(env.STRIPE_SECRET_KEY || '').trim(),
      webhookSecret:
        getConfiguredValue(pluginConfig, 'webhookSecret', 'webhook_secret')
        || String(env.STRIPE_WEBHOOK_SECRET || '').trim(),
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

    if (!this.client || this.clientKey !== secretKey) {
      this.client = new Stripe(secretKey, {
        apiVersion: '2024-06-20',
        typescript: true,
      });
      this.clientKey = secretKey;
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
