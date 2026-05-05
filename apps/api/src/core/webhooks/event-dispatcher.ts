/**
 * Webhook Event Dispatcher
 *
 * Bridges the Outbox Worker and webhook subscriptions.  When an outbox event
 * is published, this module fans it out to every active subscription that
 * matches the event type.
 */

import { WebhookSubscriptionService } from './subscription-service';
import { deliverExternalWebhook, deliverInternalWebhook } from './delivery-worker';
import { LoggerService, logger } from '@/core/logger/unified-logger';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Dispatch an outbox event to all matching webhook subscriptions.
 *
 * Called by the OutboxWorkerService after an event is dequeued.
 * Delivery is fire-and-forget per subscription -- individual failures
 * are logged and retried by the delivery worker; they do NOT prevent
 * other subscriptions from receiving the event.
 */
export async function dispatchWebhookEvent(event: {
  id: string;
  type: string;
  payload: unknown;
  aggregateId: string;
}): Promise<void> {
  const subscriptions = await WebhookSubscriptionService.findByEventType(event.type);

  if (subscriptions.length === 0) {
    return;
  }

  logger.debug(`Dispatching event ${event.type} to ${subscriptions.length} webhook subscriber(s)`, {
    eventId: event.id,
    aggregateId: event.aggregateId,
  });

  const internalFailures: Error[] = [];

  for (const sub of subscriptions) {
    try {
      if (sub.deliveryMode === 'external') {
        if (!sub.endpointUrl) {
          logger.warn('External subscription missing endpointUrl, skipping', {
            subscriptionId: sub.id,
            eventType: event.type,
          });
          continue;
        }

        // Fire-and-forget -- deliverExternalWebhook handles its own retries
        deliverExternalWebhook({
          subscriptionId: sub.id,
          eventId: event.id,
          eventType: event.type,
          payload: event.payload,
          endpointUrl: sub.endpointUrl,
          secret: sub.secret ?? undefined,
        }).catch((err) => {
          LoggerService.logError(err instanceof Error ? err : new Error(String(err)), {
            context: 'External webhook delivery',
            subscriptionId: sub.id,
            eventType: event.type,
          });
        });
      } else {
        // Internal delivery is part of the in-process runtime contract. Await it
        // so the outbox event is not marked published when a plugin did not ack.
        await deliverInternalWebhook({
          subscriptionId: sub.id,
          eventId: event.id,
          eventType: event.type,
          payload: event.payload,
          aggregateId: event.aggregateId,
          installationId: sub.installationId,
        });
      }
    } catch (error: any) {
      // Guard against unexpected synchronous throws
      const normalized = error instanceof Error ? error : new Error(String(error));
      LoggerService.logError(normalized, {
        context: 'Webhook dispatch loop',
        subscriptionId: sub.id,
        eventType: event.type,
      });
      if (sub.deliveryMode !== 'external') {
        internalFailures.push(normalized);
      }
    }
  }

  if (internalFailures.length > 0) {
    throw new Error(
      `Failed to deliver ${internalFailures.length} internal webhook(s) for event ${event.type}`,
    );
  }
}
