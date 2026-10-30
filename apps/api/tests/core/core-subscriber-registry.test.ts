import { describe, expect, it, vi } from 'vitest';
import { eventRegistry } from '@jiffoo/shared';
import {
  CORE_SUBSCRIBERS,
  coreSubscriberFor,
  coreSubscribedEventTypes,
  coreSubscribersFor,
  notifyOrderCancelled,
  notifyOrderConfirmed,
  notifyOrderRefunded,
  notifyOrderShipped,
  notifyPaymentSucceeded,
  type CoreSubscriber,
} from '@/infra/events/core-subscribers';
import { notificationTypes, notifyOrderEvent } from '@/core/notifications/service';
import { OrderService } from '@/core/order/service';

// The subscriber that each core event type is bound to. The identity of the
// function is the expectation: a subscriber bound to the wrong event fails.
const bindings: Record<string, CoreSubscriber> = {
  'order.cancelled': notifyOrderCancelled,
  'order.confirmed': notifyOrderConfirmed,
  'order.fulfilled': notifyOrderShipped,
  'order.refunded': notifyOrderRefunded,
  'payment.succeeded': notifyPaymentSucceeded,
};

describe('the core subscriber registry', () => {
  const published = coreSubscribedEventTypes();

  it('publishes the subscribed event types of the registry', () => {
    expect([...published].sort()).toEqual(Object.keys(bindings).sort());
    for (const type of published) expect(Object.keys(eventRegistry)).toContain(type);
  });

  it('binds every core event type to its own subscriber', () => {
    for (const [type, subscriber] of Object.entries(bindings)) {
      expect(coreSubscribersFor(type, 1)).toHaveLength(1);
      expect(coreSubscribersFor(type, 1)[0]).toBe(subscriber);
      expect(coreSubscriberFor(type, 1)).toBe(subscriber);
    }
  });

  it('subscribes exactly the core event types of the shared event vocabulary', () => {
    const subscribed = Object.keys(eventRegistry).filter(type => coreSubscribersFor(type, 1).length > 0);
    expect(subscribed.sort()).toEqual([...published].sort());
  });

  it('resolves an unknown type and a version other than 1 to null', () => {
    expect(coreSubscriberFor('does.not.exist', 1)).toBeNull();
    expect(coreSubscriberFor('order.cancelled', 0)).toBeNull();
    expect(coreSubscriberFor('order.cancelled', 2)).toBeNull();
    expect(coreSubscribersFor('does.not.exist', 1)).toEqual([]);
    expect(coreSubscribersFor('order.cancelled', 2)).toEqual([]);
  });

  it('publishes the registry as a frozen table that the lookups read', () => {
    // The table is built once: the lookups resolve the very registrations of
    // the published constant instead of a table of their own.
    expect(Object.isFrozen(CORE_SUBSCRIBERS)).toBe(true);
    expect(Object.keys(CORE_SUBSCRIBERS).sort()).toEqual([...published].sort());
    for (const [type, subscriber] of Object.entries(bindings)) {
      const registrations = CORE_SUBSCRIBERS[type];
      expect(Object.isFrozen(registrations)).toBe(true);
      expect(registrations).toHaveLength(1);
      expect(registrations[0].version).toBe(1);
      expect(registrations[0].subscriber).toBe(subscriber);
      // The lookup reads the published table: the same registration object.
      expect(coreSubscribersFor(type, 1)[0]).toBe(registrations[0].subscriber);
    }
  });
});

describe('the order event notification of the notification module', () => {
  it('reports that there is nobody to notify when the order is gone, and writes nothing', async () => {
    const recipient = vi.spyOn(OrderService, 'getOrderRecipient').mockResolvedValue(null);
    try {
      // The transaction is empty on purpose: the notification module resolves
      // the recipient first and must not write a row for an order that is gone.
      const tx = {} as never;
      await expect(notifyOrderEvent(tx, 'cancelled', 'order-1', { reason: 'Cancelled for non-payment' }, { dedupKey: 'notification:cancelled:order-1' }))
        .resolves.toBe(false);
      expect(recipient).toHaveBeenCalledWith(tx, 'order-1');
    } finally {
      recipient.mockRestore();
    }
  });
});

describe('the notification vocabulary', () => {
  it('publishes exactly the notification types of the union, in the order of the copy table', () => {
    expect(notificationTypes()).toEqual([
      'email_verification',
      'password_reset',
      'staff_invite',
      'order_confirmation',
      'payment_received',
      'shipped',
      'cancelled',
      'refunded',
    ]);
  });
});
