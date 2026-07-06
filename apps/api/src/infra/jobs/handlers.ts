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
import { renderDigitalDeliveryEmail, extractDigitalItems } from '@/core/notification/digital-delivery-email';
import { ResendProvider } from '@/plugins/email-providers/resend-provider';
import { systemSettingsService } from '@/core/admin/system-settings/service';

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

    // Task 7.1.2: Digital delivery email for paid orders
    if (eventType === 'order.paid' || eventType === 'order.confirmation') {
      await sendDigitalDeliveryEmail(event.aggregateId, event.payload);
    }
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

    // Task 7.1.2: Digital fulfillment is handled by ExternalOrderService
    // (called directly from payment reconciliation). This handler serves as
    // a monitoring/logging checkpoint for the unified job layer.
    // Physical fulfillment (shipments) is handled by the order service.
  },
};

// ============================================================
// Stock Alert Handler
// ============================================================

/**
 * Processes stock alert check events.
 */
const stockAlertHandler: JobHandler = {
  queue: QUEUE_NAMES.STOCK_ALERT,
  eventTypes: [
    'stock.check',
    'stock.alert',
    'inventory.adjusted',
    'inventory.transferred',
  ],
  async handle(data: BaseJobData): Promise<void> {
    const { outboxEventId, eventType } = data;

    winstonLogger.info('Stock alert job processed', {
      component: 'stockAlertHandler',
      eventType,
      outboxEventId,
    });

    // The stock alert check logic is in StockAlertService.checkAlerts().
    // This handler is triggered by inventory change events.
    // TODO: Wire to StockAlertService.checkAlerts() for event-driven alerts
  },
};

// ============================================================
// Register all handlers
// ============================================================

export function registerAllHandlers(): void {
  workerManager.register(webhookDeliveryHandler);
  workerManager.register(emailHandler);
  workerManager.register(fulfillmentHandler);
  workerManager.register(stockAlertHandler);

  winstonLogger.info('All job handlers registered', {
    component: 'JobHandlers',
    count: 4,
  });
}

export {
  webhookDeliveryHandler,
  emailHandler,
  fulfillmentHandler,
  stockAlertHandler,
};

// ============================================================
// Helper: Digital Delivery Email (Task 7.1.2)
// ============================================================

async function sendDigitalDeliveryEmail(orderId: string, eventPayload: unknown): Promise<void> {
  try {
    // Fetch order with items and user email
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: { select: { name: true } },
          },
        },
        user: { select: { email: true } },
      },
    });

    if (!order || !order.user?.email) {
      winstonLogger.warn('Cannot send digital delivery email: order or user email not found', {
        component: 'emailHandler',
        orderId,
      });
      return;
    }

    // Map order items to email template items
    const emailItems = order.items.map(item => ({
      productName: item.product?.name || item.productName || 'Unknown Product',
      quantity: item.quantity,
      fulfillmentStatus: item.fulfillmentStatus,
      fulfillmentData: item.fulfillmentData as Record<string, unknown> | null,
    }));

    // Only send if there are digital items
    const digitalItems = extractDigitalItems(emailItems);
    if (digitalItems.length === 0) {
      return; // Not a digital order, skip
    }

    const storeName = (await systemSettingsService.getSetting('storeName').catch(() => null)) as string | null || 'Jiffoo';

    const { html, text, subject } = renderDigitalDeliveryEmail({
      orderNumber: order.id,
      customerEmail: order.user.email,
      storeName,
      items: emailItems,
    });

    if (!html) {
      return; // No digital content to send
    }

    // Send via Resend provider (no-op if not configured)
    const provider = new ResendProvider();
    const fromEmail = process.env.EMAIL_FROM || 'noreply@jiffoo.com';
    const result = await provider.send({
      to: order.user.email,
      from: fromEmail,
      fromName: storeName,
      subject,
      html,
      text,
      tags: ['digital-delivery', `order:${order.id}`],
    });

    if (result.success) {
      winstonLogger.info('Digital delivery email sent', {
        component: 'emailHandler',
        orderId,
        email: order.user.email,
        messageId: result.messageId,
      });
    } else {
      winstonLogger.error('Failed to send digital delivery email', {
        component: 'emailHandler',
        orderId,
        error: result.error,
      });
    }
  } catch (error) {
    winstonLogger.error('Error in sendDigitalDeliveryEmail', {
      component: 'emailHandler',
      orderId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
