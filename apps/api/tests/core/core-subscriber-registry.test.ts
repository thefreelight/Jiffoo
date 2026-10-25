import { describe, expect, it } from 'vitest';
import { eventRegistry } from '@jiffoo/shared';
import { coreSubscriberFor, coreSubscribersFor } from '@/infra/events/core-subscribers';
import { notificationTypes } from '@/core/notifications/service';

// The event types the core subscribes to today. A new domain event is added
// to the core subscriber registry, and to this list, in one place each.
const coreSubscribedEventTypes = ['order.cancelled', 'order.fulfilled', 'order.refunded', 'payment.succeeded'];

describe('the core subscriber registry', () => {
  it('resolves every core event type to a subscriber', () => {
    for (const type of coreSubscribedEventTypes) {
      expect(coreSubscriberFor(type, 1)).toBeTypeOf('function');
    }
  });

  it('resolves an unknown type and a version other than 1 to null', () => {
    expect(coreSubscriberFor('does.not.exist', 1)).toBeNull();
    expect(coreSubscriberFor('order.cancelled', 0)).toBeNull();
    expect(coreSubscriberFor('order.cancelled', 2)).toBeNull();
  });

  it('publishes the subscriber list of an event type', () => {
    expect(coreSubscribersFor('order.cancelled', 1)).toHaveLength(1);
    expect(coreSubscribersFor('order.cancelled', 1)[0]).toBe(coreSubscriberFor('order.cancelled', 1));
    expect(coreSubscribersFor('does.not.exist', 1)).toEqual([]);
    expect(coreSubscribersFor('order.cancelled', 2)).toEqual([]);
  });

  it('maps exactly the four core event types of the event vocabulary', () => {
    const subscribed = Object.keys(eventRegistry).filter(type => coreSubscribersFor(type, 1).length > 0);
    expect(subscribed.sort()).toEqual([...coreSubscribedEventTypes].sort());
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
