/**
 * Session Service - Stripe Checkout Session integration.
 *
 * Implements the core platform's session-based payment contract:
 *   createSession  -> returns { sessionId, url, expiresAt }
 *   verifySession  -> returns { status, paymentIntentId, eventId }
 *
 * This complements the existing PaymentIntent-based flow (payment.service.ts)
 * by providing Stripe Checkout Sessions, which is the integration mode
 * expected by the core payment module.
 */

import { prisma } from '../lib/prisma';
import { getStripeClient } from '../lib/stripe-client';

export interface CreateSessionInput {
  orderId: string;
  amount: number; // in smallest currency unit (cents)
  currency?: string;
  successUrl?: string;
  cancelUrl?: string;
  customerEmail?: string;
  idempotencyKey?: string;
  metadata?: Record<string, string>;
}

export interface CreateSessionResult {
  sessionId: string;
  url: string;
  expiresAt: string;
  paymentIntentId: string | null;
}

export interface VerifySessionResult {
  status: string;
  paymentIntentId: string | null;
  eventId: string;
}

/** Default session expiry: 30 minutes */
const SESSION_EXPIRY_SECONDS = 30 * 60;

export class SessionService {
  /**
   * Create a Stripe Checkout Session for the given order.
   *
   * Idempotent: if a non-expired session already exists for the same
   * orderId + installationId combination, the existing session URL is returned.
   */
  async createSession(
    installationId: string,
    input: CreateSessionInput,
    secretKey?: string,
  ): Promise<CreateSessionResult> {
    const stripe = getStripeClient(secretKey);
    const currency = input.currency || 'usd';

    // Check for existing active payment for this order
    const existing = await prisma.paymentRecord.findUnique({
      where: {
        installationId_orderId: {
          installationId,
          orderId: input.orderId,
        },
      },
    });

    if (
      existing &&
      existing.stripeSessionId &&
      existing.stripeSessionUrl &&
      existing.status === 'pending'
    ) {
      // Return existing session if it hasn't expired
      if (!existing.sessionExpiresAt || existing.sessionExpiresAt > new Date()) {
        return {
          sessionId: existing.stripeSessionId,
          url: existing.stripeSessionUrl,
          expiresAt:
            existing.sessionExpiresAt?.toISOString() ??
            new Date(Date.now() + SESSION_EXPIRY_SECONDS * 1000).toISOString(),
          paymentIntentId: existing.stripePaymentIntentId,
        };
      }
    }

    // Build success/cancel URLs with fallbacks
    const successUrl =
      input.successUrl || process.env.STRIPE_SUCCESS_URL || 'http://localhost:3000/checkout/success';
    const cancelUrl =
      input.cancelUrl || process.env.STRIPE_CANCEL_URL || 'http://localhost:3000/checkout/cancel';

    const expiresAt = Math.floor(Date.now() / 1000) + SESSION_EXPIRY_SECONDS;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `Order ${input.orderId}`,
            },
            unit_amount: input.amount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        orderId: input.orderId,
        installationId,
        ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
        ...(input.metadata || {}),
      },
      customer_email: input.customerEmail || undefined,
      expires_at: expiresAt,
    });

    // Persist payment record
    await prisma.paymentRecord.upsert({
      where: {
        installationId_orderId: {
          installationId,
          orderId: input.orderId,
        },
      },
      update: {
        stripeSessionId: session.id,
        stripeSessionUrl: session.url!,
        stripePaymentIntentId:
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id ?? null,
        amount: input.amount,
        currency,
        status: 'pending',
        customerEmail: input.customerEmail,
        metadata: input.metadata || {},
        sessionExpiresAt: new Date(expiresAt * 1000),
        errorMessage: null,
      },
      create: {
        installationId,
        orderId: input.orderId,
        stripeSessionId: session.id,
        stripeSessionUrl: session.url!,
        stripePaymentIntentId:
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id ?? null,
        amount: input.amount,
        currency,
        status: 'pending',
        customerEmail: input.customerEmail,
        metadata: input.metadata || {},
        sessionExpiresAt: new Date(expiresAt * 1000),
      },
    });

    return {
      sessionId: session.id,
      url: session.url!,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
      paymentIntentId:
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id ?? null,
    };
  }

  /**
   * Verify the status of a Stripe Checkout Session.
   *
   * Retrieves the session directly from Stripe to get the authoritative
   * payment status, independent of webhook delivery.
   */
  async verifySession(
    sessionId: string,
    secretKey?: string,
  ): Promise<VerifySessionResult> {
    const stripe = getStripeClient(secretKey);

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    let status: string;
    if (session.payment_status === 'paid') {
      status = 'paid';
    } else if (session.status === 'expired') {
      status = 'expired';
    } else if (session.status === 'complete' && session.payment_status === 'unpaid') {
      // Edge case: complete but unpaid (e.g. delayed payment methods)
      status = 'pending';
    } else {
      status = 'pending';
    }

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id ?? null;

    // Update local record if payment succeeded
    if (status === 'paid' && session.metadata?.orderId) {
      const installationId = session.metadata.installationId || 'default';
      try {
        await prisma.paymentRecord.update({
          where: {
            installationId_orderId: {
              installationId,
              orderId: session.metadata.orderId,
            },
          },
          data: {
            status: 'succeeded',
            stripePaymentIntentId: paymentIntentId,
            paidAt: new Date(),
          },
        });
      } catch {
        // Record may not exist or already updated - not critical
      }
    }

    return {
      status,
      paymentIntentId,
      eventId: `session:${sessionId}:${session.payment_status}`,
    };
  }
}

export const sessionService = new SessionService();
