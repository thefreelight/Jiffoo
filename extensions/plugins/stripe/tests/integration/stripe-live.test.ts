/**
 * Stripe LIVE integration tests.
 *
 * These tests create real PaymentIntents and Refunds on Stripe's test environment.
 * They require a real sk_test_... key in STRIPE_SECRET_KEY.
 *
 * No real money is charged -- Stripe test mode is used.
 * These tests are automatically skipped when STRIPE_SECRET_KEY is a placeholder.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { loadEnvFile } from '../../../../../tests/shared/load-env';
import { resolve } from 'path';

loadEnvFile(resolve(__dirname, '../../../../../.env.test'));

function isRealKey(key: string | undefined): boolean {
  return !!key && !key.includes('placeholder') && key.length > 10;
}

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const RUN_LIVE = isRealKey(STRIPE_KEY);

const describeIf = RUN_LIVE ? describe : describe.skip;

describeIf('[LIVE] Stripe API Integration', () => {
  let stripe: any;

  beforeAll(async () => {
    const Stripe = (await import('stripe')).default;
    stripe = new Stripe(STRIPE_KEY!, { apiVersion: '2025-04-30.basil' as any });
  });

  describe('PaymentIntent lifecycle', () => {
    let paymentIntentId: string;

    it('creates a PaymentIntent', async () => {
      const pi = await stripe.paymentIntents.create({
        amount: 2000, // $20.00
        currency: 'usd',
        metadata: { test: 'jiffoo-live-integration' },
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      });

      expect(pi.id).toMatch(/^pi_/);
      expect(pi.status).toBe('requires_payment_method');
      expect(pi.amount).toBe(2000);
      expect(pi.currency).toBe('usd');
      expect(pi.client_secret).toBeDefined();

      paymentIntentId = pi.id;
    });

    it('retrieves the PaymentIntent', async () => {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      expect(pi.id).toBe(paymentIntentId);
      expect(pi.metadata.test).toBe('jiffoo-live-integration');
    });

    it('updates PaymentIntent metadata', async () => {
      const pi = await stripe.paymentIntents.update(paymentIntentId, {
        metadata: { test: 'jiffoo-live-integration', updated: 'true' },
      });
      expect(pi.metadata.updated).toBe('true');
    });

    it('confirms PaymentIntent with test card (pm_card_visa)', async () => {
      const pi = await stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: 'pm_card_visa',
        return_url: 'https://example.com/return',
      });
      expect(pi.status).toBe('succeeded');
    });

    it('retrieves the succeeded PaymentIntent', async () => {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      expect(pi.status).toBe('succeeded');
      expect(pi.amount_received).toBe(2000);
    });
  });

  describe('Refund lifecycle', () => {
    let paymentIntentId: string;
    let refundId: string;

    it('creates and confirms a PaymentIntent for refund testing', async () => {
      const pi = await stripe.paymentIntents.create({
        amount: 5000,
        currency: 'usd',
        metadata: { test: 'jiffoo-refund-test' },
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        confirm: true,
        payment_method: 'pm_card_visa',
        return_url: 'https://example.com/return',
      });
      expect(pi.status).toBe('succeeded');
      paymentIntentId = pi.id;
    });

    it('creates a partial refund', async () => {
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: 1000, // $10 of $50
        reason: 'requested_by_customer',
      });

      expect(refund.id).toMatch(/^re_/);
      expect(refund.status).toBe('succeeded');
      expect(refund.amount).toBe(1000);
      refundId = refund.id;
    });

    it('retrieves the refund', async () => {
      const refund = await stripe.refunds.retrieve(refundId);
      expect(refund.id).toBe(refundId);
      expect(refund.amount).toBe(1000);
    });

    it('PaymentIntent shows partial refund', async () => {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      // After partial refund, the PI is still "succeeded" but charges show refunded amount
      expect(pi.status).toBe('succeeded');
    });

    it('creates a full refund for remaining amount', async () => {
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: 4000, // remaining $40
      });
      expect(refund.status).toBe('succeeded');
      expect(refund.amount).toBe(4000);
    });
  });

  describe('Webhook signature verification', () => {
    it('rejects invalid webhook signatures', () => {
      const payload = JSON.stringify({ id: 'evt_test', type: 'test' });
      const secret = 'whsec_test_secret';

      expect(() => {
        stripe.webhooks.constructEvent(payload, 'invalid_signature', secret);
      }).toThrow();
    });

    it('generates and verifies a test webhook payload', async () => {
      // Use Stripe's own generateTestHeaderString to create a properly signed header
      const payload = JSON.stringify({
        id: 'evt_test_123',
        object: 'event',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_test' } },
      });

      const secret = 'whsec_test_secret_for_verification';

      // Stripe SDK provides a helper for generating test headers
      const header = stripe.webhooks.generateTestHeaderString({
        payload,
        secret,
      });

      const event = stripe.webhooks.constructEvent(payload, header, secret);
      expect(event.type).toBe('payment_intent.succeeded');
      expect(event.id).toBe('evt_test_123');
    });
  });

  describe('Error handling', () => {
    it('rejects invalid currency', async () => {
      try {
        await stripe.paymentIntents.create({
          amount: 1000,
          currency: 'INVALID',
          automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        });
        expect.unreachable('Should have thrown');
      } catch (error: any) {
        expect(error.type).toBe('StripeInvalidRequestError');
      }
    });

    it('rejects negative amount', async () => {
      try {
        await stripe.paymentIntents.create({
          amount: -100,
          currency: 'usd',
          automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        });
        expect.unreachable('Should have thrown');
      } catch (error: any) {
        expect(error.type).toBe('StripeInvalidRequestError');
      }
    });

    it('handles declined card (pm_card_chargeDeclined)', async () => {
      try {
        await stripe.paymentIntents.create({
          amount: 1000,
          currency: 'usd',
          confirm: true,
          payment_method: 'pm_card_chargeDeclined',
          automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
          return_url: 'https://example.com/return',
        });
        expect.unreachable('Should have thrown');
      } catch (error: any) {
        expect(error.type).toBe('StripeCardError');
        expect(error.code).toBe('card_declined');
      }
    });

    it('handles insufficient funds (pm_card_chargeDeclinedInsufficientFunds)', async () => {
      try {
        await stripe.paymentIntents.create({
          amount: 1000,
          currency: 'usd',
          confirm: true,
          payment_method: 'pm_card_chargeDeclinedInsufficientFunds',
          automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
          return_url: 'https://example.com/return',
        });
        expect.unreachable('Should have thrown');
      } catch (error: any) {
        expect(error.type).toBe('StripeCardError');
      }
    });
  });

  describe('Customer flow simulation', () => {
    it('full checkout flow: create intent -> confirm -> verify', async () => {
      // Step 1: Create intent (what the plugin does)
      const createResult = await stripe.paymentIntents.create({
        amount: 3500,
        currency: 'usd',
        metadata: {
          orderId: 'order_live_test_001',
          installationId: 'test-install',
        },
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      });

      expect(createResult.status).toBe('requires_payment_method');

      // Step 2: Customer confirms payment (what Stripe.js does on frontend)
      const confirmed = await stripe.paymentIntents.confirm(createResult.id, {
        payment_method: 'pm_card_visa',
        return_url: 'https://example.com/return',
      });

      expect(confirmed.status).toBe('succeeded');
      expect(confirmed.amount_received).toBe(3500);

      // Step 3: Plugin verifies payment status (what webhook handler does)
      const verified = await stripe.paymentIntents.retrieve(createResult.id);
      expect(verified.status).toBe('succeeded');
      expect(verified.metadata.orderId).toBe('order_live_test_001');
    });
  });
});
