import { describe, expect, it } from 'vitest';
import { eventRegistry } from '@jiffoo/shared';
import {
  coreSubscriberFor,
  coreSubscribedEventTypes,
  coreSubscribersFor,
  notifyOrderCancelled,
  notifyOrderRefunded,
  notifyOrderShipped,
  notifyPaymentSucceeded,
  type CoreSubscriber,
} from '@/infra/events/core-subscribers';
import { notificationTypes } from '@/core/notifications/service';

// The subscriber that each core event type is bound to. The identity of the
// function is the expectation: a subscriber bound to the wrong event fails.
const bindings: Record<string, CoreSubscriber> = {
  'order.cancelled': notifyOrderCancelled,
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
