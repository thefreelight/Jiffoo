/**
 * Jiffoo Plugin SDK - Webhook Handler
 *
 * Receives webhook events from the platform and routes them to registered handlers.
 * Features:
 * - HMAC-SHA256 signature verification
 * - Event routing via .on() pattern
 * - Express/Fastify-compatible HTTP handler
 */

import { createHmac } from 'crypto';

export interface WebhookHandlerOptions {
  /** Shared secret for HMAC signature verification */
  secret: string;
}

export type WebhookEventHandler = (payload: unknown, eventType: string) => void | Promise<void>;

export interface WebhookHandler {
  /** Register a handler for a specific event type */
  on(eventType: string, handler: WebhookEventHandler): WebhookHandler;
  /** Express/Fastify compatible HTTP handler */
  httpHandler(): (req: any, res: any) => Promise<void>;
  /** Verify a webhook signature */
  verify(payload: string, signature: string): boolean;
}

/**
 * Create a webhook handler for receiving platform events.
 *
 * @param options - Handler configuration with shared secret
 * @returns WebhookHandler with chainable .on() registration and HTTP handler
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { createWebhookHandler } from '@jiffoo/plugin-sdk';
 *
 * const app = express();
 * const webhooks = createWebhookHandler({ secret: process.env.WEBHOOK_SECRET! });
 *
 * webhooks
 *   .on('order.created', async (payload) => {
 *     console.log('New order:', payload);
 *   })
 *   .on('order.paid', async (payload) => {
 *     await fulfillOrder(payload);
 *   })
 *   .on('*', async (payload, eventType) => {
 *     console.log(`Received event: ${eventType}`);
 *   });
 *
 * app.post('/webhooks', express.raw({ type: '*\/*' }), webhooks.httpHandler());
 * ```
 */
export function createWebhookHandler(options: WebhookHandlerOptions): WebhookHandler {
  const { secret } = options;
  const handlers = new Map<string, WebhookEventHandler[]>();

  function on(eventType: string, handler: WebhookEventHandler): WebhookHandler {
    const existing = handlers.get(eventType) || [];
    existing.push(handler);
    handlers.set(eventType, existing);
    return webhookHandler;
  }

  function verify(payload: string, signature: string): boolean {
    const expected = createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    // Constant-time comparison
    if (expected.length !== signature.length) return false;
    let mismatch = 0;
    for (let i = 0; i < expected.length; i++) {
      mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return mismatch === 0;
  }

  function httpHandler() {
    return async (req: any, res: any) => {
      // Get raw body
      let rawBody: string;
      if (typeof req.body === 'string') {
        rawBody = req.body;
      } else if (Buffer.isBuffer(req.body)) {
        rawBody = req.body.toString('utf-8');
      } else {
        rawBody = JSON.stringify(req.body);
      }

      // Verify signature
      const signature = req.headers['x-webhook-signature'] as string;
      if (!signature || !verify(rawBody, signature)) {
        return sendResponse(res, 401, { error: 'Invalid signature' });
      }

      // Parse event
      const event = typeof req.body === 'object' && !Buffer.isBuffer(req.body)
        ? req.body
        : JSON.parse(rawBody);
      const eventType = event.type || event.eventType;

      if (!eventType) {
        return sendResponse(res, 400, { error: 'Missing event type' });
      }

      // Route to handlers
      const eventHandlers = handlers.get(eventType) || [];
      const wildcardHandlers = handlers.get('*') || [];
      const allHandlers = [...eventHandlers, ...wildcardHandlers];

      try {
        await Promise.all(allHandlers.map(h => h(event.payload || event.data || event, eventType)));
        return sendResponse(res, 200, { received: true });
      } catch (error: any) {
        return sendResponse(res, 500, { error: error.message });
      }
    };
  }

  const webhookHandler: WebhookHandler = { on, httpHandler, verify };
  return webhookHandler;
}

/**
 * Send an HTTP response compatible with both Express and Fastify.
 */
function sendResponse(res: any, statusCode: number, body: Record<string, unknown>): void {
  // Express style: res.status(code).send(body)
  // Fastify style: res.code(code).send(body)
  if (typeof res.status === 'function') {
    res.status(statusCode).send(body);
  } else if (typeof res.code === 'function') {
    res.code(statusCode).send(body);
  }
}
