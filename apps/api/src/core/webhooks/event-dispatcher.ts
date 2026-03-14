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
        // Internal delivery
        deliverInternalWebhook({
          subscriptionId: sub.id,
          eventId: event.id,
          eventType: event.type,
          payload: event.payload,
          installationId: sub.installationId,
        }).catch((err) => {
          LoggerService.logError(err instanceof Error ? err : new Error(String(err)), {
            context: 'Internal webhook delivery',
            subscriptionId: sub.id,
            eventType: event.type,
          });
        });
      }
    } catch (error: any) {
      // Guard against unexpected synchronous throws
      LoggerService.logError(error instanceof Error ? error : new Error(String(error)), {
        context: 'Webhook dispatch loop',
        subscriptionId: sub.id,
        eventType: event.type,
      });
    }
  }
}
