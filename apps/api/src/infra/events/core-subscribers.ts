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

type CoreSubscriber = (data: any) => Promise<void>;

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

/** Resolve the core subscriber for an event, or null when the core ignores it. */
export function coreSubscriberFor(type: string, version: number): CoreSubscriber | null {
  if (version !== 1) return null;
  switch (type) {
    case 'order.cancelled': return notifyOrderCancelled;
    case 'order.fulfilled': return notifyOrderShipped;
    case 'order.refunded': return notifyOrderRefunded;
    case 'payment.succeeded': return notifyPaymentSucceeded;
    default: return null;
  }
}
