/**
 * Job Handlers — Event processors for each queue
 *
 * Each handler is registered with the WorkerManager and processes
 * events from the OutboxPoller / BullMQ queues.
 */

import { prisma } from '@/config/database';
import { winstonLogger } from '@/core/logger/unified-logger';
import type { JobHandler, BaseJobData } from './types';
import { QUEUE_NAMES } from './types';
import { workerManager } from './worker-manager';

async function dispatchToPluginRuntimes(outboxEventId: string, eventType: string): Promise<void> {
  const event = await prisma.outboxEvent.findUnique({ where: { id: outboxEventId } });
  if (!event) return;
  const { dispatchPluginRuntimeEvent } = await import('@/core/admin/extension-installer/plugin-runtime');
  await dispatchPluginRuntimeEvent(eventType, event.payload);
}

// ============================================================
// Webhook Delivery Handler
// ============================================================

/**
 * Dispatches events to webhook subscribers.
 * Replaces the inline webhook dispatch in the old OutboxWorkerService.
 */
const webhookDeliveryHandler: JobHandler = {
  queue: QUEUE_NAMES.WEBHOOK_DELIVERY,
  eventTypes: [
    'webhook.delivery',
    'order.created',
    'order.updated',
    'order.cancelled',
    'payment.succeeded',
    'payment.failed',
    'product.created',
    'product.updated',
  ],
  async handle(data: BaseJobData): Promise<void> {
    const { outboxEventId, eventType } = data;

    // Fetch the full event from outbox
    const event = await prisma.outboxEvent.findUnique({
      where: { id: outboxEventId },
    });

    if (!event) {
      winstonLogger.warn('Outbox event not found for webhook delivery', {
        component: 'webhookDeliveryHandler',
        outboxEventId,
      });
      return;
    }

    // Dispatch to webhook subscribers
    const { dispatchWebhookEvent } = await import('@/core/webhooks/event-dispatcher');
    await dispatchWebhookEvent({
      id: event.id,
      type: event.type,
      payload: (event.payload as any)?.data ?? event.payload,
      aggregateId: event.aggregateId,
    });
    await dispatchToPluginRuntimes(outboxEventId, eventType);

    winstonLogger.debug('Webhook event dispatched', {
      component: 'webhookDeliveryHandler',
      eventType,
      outboxEventId,
    });
  },
};

// ============================================================
// Fulfillment Handler
// ============================================================

/**
 * Processes order fulfillment events (e.g., order paid → trigger fulfillment).
 */
const fulfillmentHandler: JobHandler = {
  queue: QUEUE_NAMES.FULFILLMENT,
  eventTypes: [
    'fulfillment.create',
    'order.paid',
    'shipment.created',
    'shipment.updated',
  ],
  async handle(data: BaseJobData): Promise<void> {
    const { outboxEventId, eventType } = data;

    const event = await prisma.outboxEvent.findUnique({
      where: { id: outboxEventId },
    });

    if (!event) {
      winstonLogger.warn('Outbox event not found for fulfillment', {
        component: 'fulfillmentHandler',
        outboxEventId,
      });
      return;
    }

    winstonLogger.info('Fulfillment job processed', {
      component: 'fulfillmentHandler',
      eventType,
      outboxEventId,
      aggregateId: event.aggregateId,
    });
    await dispatchToPluginRuntimes(outboxEventId, eventType);

  },
};

// ============================================================
// Register all handlers
// ============================================================

export function registerAllHandlers(): void {
  workerManager.register(webhookDeliveryHandler);
  workerManager.register(fulfillmentHandler);

  winstonLogger.info('All job handlers registered', {
    component: 'JobHandlers',
    count: 2,
  });
}

export {
  webhookDeliveryHandler,
  fulfillmentHandler,
};

