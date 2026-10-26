import { prisma } from '@/config/database';
import { notifyOrderEvent } from '@/core/notifications/service';
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
type CoreSubscriberRegistration = { readonly version: 1; readonly subscriber: CoreSubscriber };

/** The frozen registrations of one event type. */
function registrations(subscriber: CoreSubscriber): readonly CoreSubscriberRegistration[] {
  return Object.freeze([Object.freeze({ version: 1 as const, subscriber })]);
}

/**
 * The core subscribers of the order and payment events.
 *
 * They are exported so the registry binding is verifiable: the test asserts
 * which subscriber belongs to which event type.
 */
export async function notifyOrderCancelled(data: EventPayload<'order.cancelled'>) {
  // The event carries the domain reason; the customer facing copy stays unchanged.
  const reason = data.reason === 'unpaid timeout' ? 'Cancelled for non-payment' : data.reason;
  // The order may be gone: the notification module resolves the recipient
  // through the order projection and reports that there is nobody to notify.
  await prisma.$transaction((tx) => notifyOrderEvent(tx, 'cancelled', data.orderId, { reason }, { dedupKey: `notification:cancelled:${data.orderId}` }));
}

export async function notifyOrderShipped(data: EventPayload<'order.fulfilled'>) {
  await prisma.$transaction((tx) => notifyOrderEvent(tx, 'shipped', data.id, {}, { dedupKey: `notification:shipped:${data.id}` }));
}

export async function notifyOrderRefunded(data: EventPayload<'order.refunded'>) {
  await prisma.$transaction((tx) => notifyOrderEvent(tx, 'refunded', data.orderId, {}, { dedupKey: `notification:refunded:${data.refundId}` }));
}

export async function notifyPaymentSucceeded(data: EventPayload<'payment.succeeded'>) {
  await prisma.$transaction((tx) => notifyOrderEvent(tx, 'payment_received', data.orderId, {}, { dedupKey: `notification:payment_received:${data.orderId}` }));
}

/**
 * The core subscriber registry.
 *
 * The table is a module scope constant, built once when the module loads and
 * frozen: the subscribers are functions, the version is the literal 1, and
 * nothing may mutate the table at runtime. The module state audit requires
 * every module scope container to be reviewed, so the registry is registered
 * in the module state allowlist of that audit. A new domain event is
 * registered by adding one entry here, and an event type may carry more than
 * one subscriber.
 */
export const CORE_SUBSCRIBERS: Readonly<Record<string, readonly CoreSubscriberRegistration[]>> = Object.freeze({
  'order.cancelled': registrations(notifyOrderCancelled),
  'order.fulfilled': registrations(notifyOrderShipped),
  'order.refunded': registrations(notifyOrderRefunded),
  'payment.succeeded': registrations(notifyPaymentSucceeded),
});

/** The core subscribers of an event type, in registration order. */
export function coreSubscribersFor(type: string, version: number): CoreSubscriber[] {
  return (CORE_SUBSCRIBERS[type] || [])
    .filter(registration => registration.version === version)
    .map(registration => registration.subscriber);
}

/**
 * The event types the core subscribes to, in registration order.
 *
 * A read only view of the registry keys: a new core subscriber is registered by
 * adding one entry to the registry, and the list follows.
 */
export function coreSubscribedEventTypes(): string[] {
  return Object.keys(CORE_SUBSCRIBERS);
}

/** Resolve the first core subscriber of an event, or null when the core ignores it. */
export function coreSubscriberFor(type: string, version: number): CoreSubscriber | null {
  return coreSubscribersFor(type, version)[0] || null;
}
