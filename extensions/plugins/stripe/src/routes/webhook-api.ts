/**
 * Webhook API - Receives Stripe webhook events for payment status updates.
 * The raw body is required for signature verification.
 */

import { Router, Request, Response } from 'express';
import { webhookService } from '../services/webhook.service';

const router = Router();
const PLATFORM_LIFECYCLE_EVENTS = new Set(['order.created', 'order.canceled']);

function readEventTypeFromBody(body: unknown): string | undefined {
  try {
    if (Buffer.isBuffer(body)) {
      const parsed = JSON.parse(body.toString('utf8')) as { type?: unknown; eventType?: unknown };
      return typeof parsed.type === 'string'
        ? parsed.type
        : typeof parsed.eventType === 'string'
          ? parsed.eventType
          : undefined;
    }

    if (typeof body === 'string') {
      const parsed = JSON.parse(body) as { type?: unknown; eventType?: unknown };
      return typeof parsed.type === 'string'
        ? parsed.type
        : typeof parsed.eventType === 'string'
          ? parsed.eventType
          : undefined;
    }

    if (body && typeof body === 'object') {
      const payload = body as { type?: unknown; eventType?: unknown };
      return typeof payload.type === 'string'
        ? payload.type
        : typeof payload.eventType === 'string'
          ? payload.eventType
          : undefined;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

async function handleStripeWebhook(
  req: Request & { pluginConfig?: { secretKey?: string; webhookSecret?: string } },
  res: Response,
) {
  try {
    const signature = req.headers['stripe-signature'] as string;
    if (!signature) {
      const eventType = readEventTypeFromBody(req.body);
      if (eventType && PLATFORM_LIFECYCLE_EVENTS.has(eventType)) {
        return res.json({
          success: true,
          data: {
            ignored: true,
            eventType,
            reason: 'platform-lifecycle-event',
          },
        });
      }

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing stripe-signature header',
        },
      });
    }

    const webhookSecret = req.pluginConfig?.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'NOT_CONFIGURED',
          message: 'Webhook secret not configured',
        },
      });
    }

    // req.body is a raw Buffer when express.raw() middleware is applied
    const rawBody = req.body;

    const result = await webhookService.verifyAndHandle(
      rawBody,
      signature,
      webhookSecret,
      req.pluginConfig?.secretKey,
    );
    return res.json({ success: true, data: result });
  } catch (error: any) {
    if (error.type === 'StripeSignatureVerificationError') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SIGNATURE',
          message: 'Webhook signature verification failed',
        },
      });
    }
    return res.status(500).json({
      success: false,
      error: {
        code: 'WEBHOOK_ERROR',
        message: error.message || 'Failed to process webhook',
      },
    });
  }
}

// POST /webhook
// This endpoint receives raw body (not JSON parsed) for signature verification.
router.post('/', handleStripeWebhook);

// POST /webhook/stripe
// Manifest-declared webhook path.
router.post('/stripe', handleStripeWebhook);

export { router as webhookApiRoutes };
