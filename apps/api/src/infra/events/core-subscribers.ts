import { prisma } from '@/config/database';
import { createOrderNotification, type NotificationTransaction } from '@/core/notifications/service';
import type { EventPayload } from '@jiffoo/shared';

/**
 * Core event subscribers.
 *
 * The core publishes its own domain events through the same transactional
 * outbox that plugins use. These subscribers react after the business
 * transaction committed, so a failing side effect never rolls back the core
 * flow, and a redelivered event never produces a duplicate notification.
 */
export const CORE_EVENT_TARGET = 'core';

export type CoreSubscriber = (data: any) => Promise<void>;

/** One registration: the event version a subscriber reacts to and the subscriber itself. */
type CoreSubscriberRegistration = { version: number; subscriber: CoreSubscriber };

async function notifyOrder(tx: NotificationTransaction, orderId: string, type: 'shipped' | 'cancelled' | 'refunded' | 'payment_received', values: { reason?: string }, dedupKey: string) {
  const order = await tx.order.findUnique({ where: { id: orderId }, select: { id: true } });
  // The order is gone, so there is nobody left to notify.
  if (!order) return;
  await createOrderNotification(tx, type, orderId, values, { dedupKey });
}

async function notifyOrderCancelled(data: EventPayload<'order.cancelled'>) {
  // The event carries the domain reason; the customer facing copy stays unchanged.
  const reason = data.reason === 'unpaid timeout' ? 'Cancelled for non-payment' : data.reason;
  await prisma.$transaction((tx) => notifyOrder(tx, data.orderId, 'cancelled', { reason }, `notification:cancelled:${data.orderId}`));
}

async function notifyOrderShipped(data: EventPayload<'order.fulfilled'>) {
  await prisma.$transaction((tx) => notifyOrder(tx, data.id, 'shipped', {}, `notification:shipped:${data.id}`));
}

async function notifyOrderRefunded(data: EventPayload<'order.refunded'>) {
  await prisma.$transaction((tx) => notifyOrder(tx, data.orderId, 'refunded', {}, `notification:refunded:${data.refundId}`));
}

async function notifyPaymentSucceeded(data: EventPayload<'payment.succeeded'>) {
  await prisma.$transaction((tx) => notifyOrder(tx, data.orderId, 'payment_received', {}, `notification:payment_received:${data.orderId}`));
}

/**
 * The core subscriber registry.
 *
 * The table is built inside a function so the module keeps no registry
 * container at module scope: every lookup rebuilds it from the subscriber
 * functions. A new domain event is registered by adding one entry here, and
 * an event type may carry more than one subscriber.
 */
function coreSubscriberRegistry(): Record<string, CoreSubscriberRegistration[]> {
  return {
    'order.cancelled': [{ version: 1, subscriber: notifyOrderCancelled }],
    'order.fulfilled': [{ version: 1, subscriber: notifyOrderShipped }],
    'order.refunded': [{ version: 1, subscriber: notifyOrderRefunded }],
    'payment.succeeded': [{ version: 1, subscriber: notifyPaymentSucceeded }],
  };
}

/** The core subscribers of an event type, in registration order. */
export function coreSubscribersFor(type: string, version: number): CoreSubscriber[] {
  return (coreSubscriberRegistry()[type] || [])
    .filter(registration => registration.version === version)
    .map(registration => registration.subscriber);
}

/** Resolve the core subscriber for an event, or null when the core ignores it. */
export function coreSubscriberFor(type: string, version: number): CoreSubscriber | null {
  return coreSubscribersFor(type, version)[0] || null;
}
