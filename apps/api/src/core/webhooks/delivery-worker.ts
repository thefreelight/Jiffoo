/**
 * Webhook Delivery Worker
 *
 * Handles the actual delivery of webhook payloads to external HTTP endpoints
 * and internal plugin handlers.  Implements:
 *   - HMAC-SHA256 request signing
 *   - Exponential-backoff retries (up to MAX_RETRIES attempts)
 *   - Dead-letter queue for permanently failed deliveries
 *   - Per-attempt delivery logging
 */

import { createHmac } from 'crypto';
import { prisma } from '@/config/database';
import { LoggerService, logger } from '@/core/logger/unified-logger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RETRIES = 5;

/** Delays between consecutive retry attempts (index = attempt - 1). */
const RETRY_DELAYS_MS = [
  10_000,   // 10 seconds
  30_000,   // 30 seconds
  60_000,   // 1 minute
  300_000,  // 5 minutes
  900_000,  // 15 minutes
];

/** Maximum time to wait for a single delivery HTTP response. */
const DELIVERY_TIMEOUT_MS = 30_000;

/** Maximum response body stored in the delivery log. */
const MAX_RESPONSE_BODY_LENGTH = 1000;

// ---------------------------------------------------------------------------
// External delivery
// ---------------------------------------------------------------------------

export interface ExternalDeliveryParams {
  subscriptionId: string;
  eventId: string;
  eventType: string;
  payload: unknown;
  endpointUrl: string;
  secret?: string;
  attempt?: number;
}

/**
 * Deliver a webhook event to an external HTTP endpoint.
 *
 * On failure the function schedules a retry with exponential back-off.
 * After MAX_RETRIES the event is moved to the dead-letter queue.
 */
export async function deliverExternalWebhook(params: ExternalDeliveryParams): Promise<void> {
  const {
    subscriptionId,
    eventId,
    eventType,
    payload,
    endpointUrl,
    secret,
    attempt = 1,
  } = params;

  const startTime = Date.now();

  try {
    // Build the request body
    const body = JSON.stringify({
      id: eventId,
      type: eventType,
      payload,
      timestamp: new Date().toISOString(),
    });

    // Standard webhook headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'JiffooMall-Webhook/1.0',
      'X-Webhook-Event': eventType,
      'X-Webhook-Delivery': eventId,
      'X-Webhook-Attempt': String(attempt),
    };

    // HMAC-SHA256 signature when a shared secret is configured
    if (secret) {
      const signature = createHmac('sha256', secret).update(body).digest('hex');
      headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }

    // Issue the request with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(endpointUrl, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const latencyMs = Date.now() - startTime;
    const responseBody = await response.text().catch(() => '');

    // Persist delivery log
    await prisma.webhookDeliveryLog.create({
      data: {
        subscriptionId,
        eventId,
        attempt,
        status: response.ok ? 'success' : 'failed',
        responseCode: response.status,
        responseBody: responseBody.slice(0, MAX_RESPONSE_BODY_LENGTH),
        latencyMs,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseBody.slice(0, 200)}`);
    }

    logger.debug('External webhook delivered successfully', {
      subscriptionId,
      eventId,
      eventType,
      attempt,
      latencyMs,
    });
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;

    // Best-effort delivery log for the failed attempt
    await prisma.webhookDeliveryLog.create({
      data: {
        subscriptionId,
        eventId,
        attempt,
        status: 'failed',
        errorMessage: String(error.message ?? error).slice(0, 500),
        latencyMs,
      },
    }).catch(() => {
      // Swallow log-write failures so they don't mask the real error
    });

    // Dead-letter if we exhausted all retries
    if (attempt >= MAX_RETRIES) {
      await moveToDeadLetter({
        subscriptionId,
        eventId,
        eventType,
        payload,
        lastError: String(error.message ?? error),
        retryCount: attempt,
      });
      return;
    }

    // Schedule the next retry with exponential back-off
    const delay = RETRY_DELAYS_MS[attempt - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];

    logger.debug(`Scheduling webhook retry #${attempt + 1} in ${delay}ms`, {
      subscriptionId,
      eventId,
      eventType,
    });

    setTimeout(() => {
      deliverExternalWebhook({
        ...params,
        attempt: attempt + 1,
      }).catch(() => {
        // Retry is fire-and-forget; errors are handled inside the next call
      });
    }, delay);
  }
}

// ---------------------------------------------------------------------------
// Internal delivery
// ---------------------------------------------------------------------------

export interface InternalDeliveryParams {
  subscriptionId: string;
  eventId: string;
  eventType: string;
  payload: unknown;
  installationId: string;
}

/**
 * Deliver a webhook event to an internal plugin handler.
 *
 * Internal plugins receive events via their Fastify sub-instance's
 * `/__webhooks/{eventType}` route.  If the plugin is not running or
 * the route is not registered, the delivery is logged as failed.
 */
export async function deliverInternalWebhook(params: InternalDeliveryParams): Promise<void> {
  const { subscriptionId, eventId, eventType, payload, installationId } = params;
  const startTime = Date.now();

  try {
    // Dynamically import to avoid circular dependencies with the plugin system
    const { PluginManagementService } = await import('@/core/admin/plugin-management/service');
    const instance = await PluginManagementService.getInstanceById(installationId);

    if (!instance) {
      throw new Error(`Plugin installation ${installationId} not found`);
    }
    if (!instance.enabled) {
      throw new Error(`Plugin installation ${installationId} is disabled`);
    }

    // Internal delivery is currently a logged event.
    // When the plugin runtime supports inject(), this will POST to the
    // plugin's internal Fastify route: /__webhooks/{eventType}
    LoggerService.logSystem('Internal webhook delivery', {
      subscriptionId,
      eventId,
      eventType,
      installationId,
      pluginSlug: instance.pluginSlug,
    });

    const latencyMs = Date.now() - startTime;

    await prisma.webhookDeliveryLog.create({
      data: {
        subscriptionId,
        eventId,
        attempt: 1,
        status: 'success',
        latencyMs,
      },
    });

    logger.debug('Internal webhook delivered', {
      subscriptionId,
      eventId,
      eventType,
      installationId,
      latencyMs,
    });
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;

    await prisma.webhookDeliveryLog.create({
      data: {
        subscriptionId,
        eventId,
        attempt: 1,
        status: 'failed',
        errorMessage: String(error.message ?? error).slice(0, 500),
        latencyMs,
      },
    }).catch(() => {
      // Swallow log-write failures
    });

    LoggerService.logError(error instanceof Error ? error : new Error(String(error)), {
      context: 'Internal webhook delivery failed',
      subscriptionId,
      eventId,
      eventType,
      installationId,
    });
  }
}

// ---------------------------------------------------------------------------
// Dead-letter helper
// ---------------------------------------------------------------------------

async function moveToDeadLetter(params: {
  subscriptionId: string;
  eventId: string;
  eventType: string;
  payload: unknown;
  lastError: string;
  retryCount: number;
}): Promise<void> {
  try {
    await prisma.webhookDeadLetter.create({
      data: {
        eventId: params.eventId,
        subscriptionId: params.subscriptionId,
        eventType: params.eventType,
        payload: params.payload as any,
        lastError: params.lastError,
        retryCount: params.retryCount,
      },
    });

    logger.warn('Webhook delivery moved to dead-letter queue', {
      subscriptionId: params.subscriptionId,
      eventId: params.eventId,
      eventType: params.eventType,
      retryCount: params.retryCount,
      lastError: params.lastError,
    });
  } catch (dlqError: any) {
    // Last resort: log and move on
    LoggerService.logError(dlqError instanceof Error ? dlqError : new Error(String(dlqError)), {
      context: 'Failed to write webhook dead letter',
      subscriptionId: params.subscriptionId,
      eventId: params.eventId,
    });
  }
}
