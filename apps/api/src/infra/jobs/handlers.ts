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
import { ResendProvider } from '@/plugins/email-providers/resend-provider';

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
// Email Handler
// ============================================================

/**
 * Processes email-sending events.
 */
const emailHandler: JobHandler = {
  queue: QUEUE_NAMES.EMAIL,
  eventTypes: [
    'email.send',
    'user.registered',
    'order.confirmation',
    'order.paid',
    'password.reset',
  ],
  async handle(data: BaseJobData): Promise<void> {
    const { outboxEventId, eventType } = data;

    const event = await prisma.outboxEvent.findUnique({
      where: { id: outboxEventId },
    });

    if (!event) {
      winstonLogger.warn('Outbox event not found for email', {
        component: 'emailHandler',
        outboxEventId,
      });
      return;
    }

    winstonLogger.info('Email job processed', {
      component: 'emailHandler',
      eventType,
      outboxEventId,
      aggregateId: event.aggregateId,
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

    // Task 7.1.2: Digital fulfillment is handled by ExternalOrderService
    // (called directly from payment reconciliation). This handler serves as
    // a monitoring/logging checkpoint for the unified job layer.
    // Physical fulfillment (shipments) is handled by the order service.
  },
};

// ============================================================
// Register all handlers
// ============================================================

export function registerAllHandlers(): void {
  workerManager.register(webhookDeliveryHandler);
  workerManager.register(emailHandler);
  workerManager.register(fulfillmentHandler);

  winstonLogger.info('All job handlers registered', {
    component: 'JobHandlers',
    count: 3,
  });
}

export {
  webhookDeliveryHandler,
  emailHandler,
  fulfillmentHandler,
};

