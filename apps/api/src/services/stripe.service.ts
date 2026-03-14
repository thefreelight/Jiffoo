// @ts-nocheck
/**
 * Stripe Service
 *
 * Lightweight wrapper to keep Stripe usage centralized and test-friendly.
 * Falls back to stub behavior when Stripe credentials are not configured.
 */

import Stripe from 'stripe';
import { env } from '@/config/env';

type CreatePaymentIntentInput = {
  amount: number;
  currency: string;
  orderId: string;
  metadata?: Record<string, string>;
};

export class StripeService {
  private static client: Stripe | null = null;

  private static getClient(): Stripe | null {
    if (!env.STRIPE_SECRET_KEY) {
      return null;
    }
    if (!this.client) {
      this.client = new Stripe(env.STRIPE_SECRET_KEY, {
        apiVersion: '2024-06-20',
        typescript: true,
      });
    }
    return this.client;
  }

  static async createPaymentIntent(input: CreatePaymentIntentInput): Promise<{
    id: string;
    clientSecret: string;
  }> {
    const client = this.getClient();

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

  static constructWebhookEvent(payload: Buffer | string, signature: string): Stripe.Event {
    const client = this.getClient();
    if (!client || !env.STRIPE_WEBHOOK_SECRET) {
      throw new Error('Stripe webhook is not configured');
    }

    return client.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
  }
}
