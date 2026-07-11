import Stripe from 'stripe';
import { prisma } from '../lib/prisma';
import { getStripeClient } from '../lib/stripe-client';
import { paymentService } from './payment.service';
import { refundService } from './refund.service';

export class WebhookService {
  private buildNormalizedResult(
    event: Stripe.Event,
    handled: boolean,
  ): {
    received: boolean;
    handled: boolean;
    eventType: string;
    providerEventId: string;
    sessionId: string | null;
    normalizedStatus: 'succeeded' | 'failed' | 'ignored';
    occurredAt: string | null;
    reason?: string;
  } {
    const occurredAt = typeof event.created === 'number'
      ? new Date(event.created * 1000).toISOString()
      : null;

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      return {
        received: true,
        handled,
        eventType: event.type,
        providerEventId: event.id,
        sessionId: session.id || null,
        normalizedStatus: 'succeeded',
        occurredAt,
      };
    }

    if (event.type === 'checkout.session.expired') {
      const session = event.data.object as Stripe.Checkout.Session;
      return {
        received: true,
        handled,
        eventType: event.type,
        providerEventId: event.id,
        sessionId: session.id || null,
        normalizedStatus: 'failed',
        occurredAt,
        reason: 'checkout_session_expired',
      };
    }

    return {
      received: true,
      handled,
      eventType: event.type,
      providerEventId: event.id,
      sessionId: null,
      normalizedStatus: 'ignored',
      occurredAt,
    };
  }

  /**
   * Verify the Stripe webhook signature, persist the event, and dispatch it
   * to the appropriate handler. Idempotent: duplicate events are skipped.
   */
  async verifyAndHandle(
    rawBody: Buffer,
    signature: string,
    webhookSecret: string,
    secretKey?: string
  ): Promise<{
    received: boolean;
    handled: boolean;
    eventType: string;
    providerEventId: string;
    sessionId: string | null;
    normalizedStatus: 'succeeded' | 'failed' | 'ignored';
    occurredAt: string | null;
    reason?: string;
  }> {
    const stripe = getStripeClient(secretKey);

    // Verify webhook signature
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    // Idempotency check
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { stripeEventId: event.id },
    });

    if (existingEvent?.processed) {
      return this.buildNormalizedResult(event, false);
    }

    // Store event
    await prisma.webhookEvent.upsert({
      where: { stripeEventId: event.id },
      update: {},
      create: {
        stripeEventId: event.id,
        eventType: event.type,
        payload: event.data as any,
        installationId:
          (event.data.object as any)?.metadata?.installationId || 'default',
      },
    });

    let handled = false;

    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(
            event.data.object as Stripe.PaymentIntent
          );
          handled = true;
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(
            event.data.object as Stripe.PaymentIntent
          );
          handled = true;
          break;

        case 'payment_intent.canceled':
          await this.handlePaymentIntentCanceled(
            event.data.object as Stripe.PaymentIntent
          );
          handled = true;
          break;

        case 'charge.refunded':
          await this.handleChargeRefunded(event.data.object as Stripe.Charge);
          handled = true;
          break;

        case 'charge.refund.updated':
          await this.handleRefundUpdated(event.data.object as Stripe.Refund);
          handled = true;
          break;

        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(
            event.data.object as Stripe.Checkout.Session
          );
          handled = true;
          break;

        case 'checkout.session.expired':
          await this.handleCheckoutSessionExpired(
            event.data.object as Stripe.Checkout.Session
          );
          handled = true;
          break;

        default:
          // Unhandled event type - log but do not error
          break;
      }

      // Mark as processed
      await prisma.webhookEvent.update({
        where: { stripeEventId: event.id },
        data: { processed: true },
      });
    } catch (error) {
      await prisma.webhookEvent.update({
        where: { stripeEventId: event.id },
        data: {
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }

    return this.buildNormalizedResult(event, handled);
  }

  private async handlePaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent
  ) {
    await paymentService.updatePaymentStatus(paymentIntent.id, 'succeeded', {
      paidAt: new Date(),
    });
  }

  private async handlePaymentIntentFailed(
    paymentIntent: Stripe.PaymentIntent
  ) {
    const errorMessage =
      paymentIntent.last_payment_error?.message || 'Payment failed';
    await paymentService.updatePaymentStatus(paymentIntent.id, 'failed', {
      errorMessage,
    });
  }

  private async handlePaymentIntentCanceled(
    paymentIntent: Stripe.PaymentIntent
  ) {
    await paymentService.updatePaymentStatus(paymentIntent.id, 'canceled');
  }

  private async handleChargeRefunded(charge: Stripe.Charge) {
    if (!charge.payment_intent) return;

    const piId =
      typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : charge.payment_intent.id;

    if (charge.refunded) {
      await paymentService.updatePaymentStatus(piId, 'refunded');
    } else if (charge.amount_refunded > 0) {
      await paymentService.updatePaymentStatus(piId, 'partially_refunded');
    }
  }

  private async handleRefundUpdated(refund: Stripe.Refund) {
    if (!refund.id) return;

    const status =
      refund.status === 'succeeded'
        ? 'succeeded'
        : refund.status === 'failed'
          ? 'failed'
          : 'pending';
    await refundService.updateRefundStatus(
      refund.id,
      status,
      refund.failure_reason || undefined
    );
  }

  private async handleCheckoutSessionCompleted(
    session: Stripe.Checkout.Session
  ) {
    const orderId = session.metadata?.orderId;
    const installationId = session.metadata?.installationId || 'default';
    if (!orderId) return;

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id ?? null;

    try {
      await prisma.paymentRecord.update({
        where: {
          installationId_orderId: { installationId, orderId },
        },
        data: {
          status: 'succeeded',
          stripePaymentIntentId: paymentIntentId,
          paidAt: new Date(),
        },
      });
    } catch {
      // Record may not exist - not critical since core polls via verify-session
    }
  }

  private async handleCheckoutSessionExpired(
    session: Stripe.Checkout.Session
  ) {
    const orderId = session.metadata?.orderId;
    const installationId = session.metadata?.installationId || 'default';
    if (!orderId) return;

    try {
      await prisma.paymentRecord.update({
        where: {
          installationId_orderId: { installationId, orderId },
        },
        data: { status: 'failed', errorMessage: 'Checkout session expired' },
      });
    } catch {
      // Record may not exist
    }
  }
}

export const webhookService = new WebhookService();
