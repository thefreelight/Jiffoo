import { describe, expect, it } from 'vitest';
import { OrderItemFulfillmentStatus, OrderPaymentStatus, OrderStatus, ShipmentStatus } from '@prisma/client';
import {
  allowedOrderTransitions,
  assertOrderTransition,
  canRefundOrder,
  closedOrderStatuses,
  isOrderClosed,
  orderItemFulfillmentStatusValues,
  orderStatusValues,
  paymentStatusValues,
  restocksInventoryOnRefund,
  shipmentStatusValues,
} from '@/core/order/policy';
import { allowed, InvalidOrderTransitionError } from '@/core/order/transition';
import { orderSchemas } from '@/core/order/schemas';
import { adminOrderSchemas } from '@/core/admin/order-management/schemas';
import { adminDashboardSchemas } from '@/core/admin/dashboard/schemas';

const orderStatuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
const paymentStatuses = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'];
const shipmentStatuses = ['PENDING', 'SHIPPED', 'DELIVERED', 'FAILED', 'CANCELLED'];
const fulfillmentStatuses = ['pending', 'processing', 'shipped', 'delivered', 'failed'];

describe('the public order policy', () => {
  it('publishes the Prisma order and payment vocabularies', () => {
    expect(orderStatusValues()).toEqual(orderStatuses);
    expect(orderStatusValues()).toEqual(Object.values(OrderStatus));
    expect(paymentStatusValues()).toEqual(paymentStatuses);
    expect(paymentStatusValues()).toEqual(Object.values(OrderPaymentStatus));
  });

  it('publishes the shipment and the item fulfilment vocabularies', () => {
    expect(shipmentStatusValues()).toEqual(shipmentStatuses);
    expect(shipmentStatusValues()).toEqual(Object.values(ShipmentStatus));
    expect(orderItemFulfillmentStatusValues()).toEqual(fulfillmentStatuses);
    expect(orderItemFulfillmentStatusValues()).toEqual(Object.values(OrderItemFulfillmentStatus));
  });

  it('publishes the transition table of every order status', () => {
    expect(allowedOrderTransitions('PENDING')).toEqual(['PROCESSING', 'CANCELLED']);
    expect(allowedOrderTransitions('PROCESSING')).toEqual(['SHIPPED', 'REFUNDED']);
    expect(allowedOrderTransitions('SHIPPED')).toEqual(['DELIVERED', 'REFUNDED']);
    expect(allowedOrderTransitions('DELIVERED')).toEqual(['REFUNDED']);
    expect(allowedOrderTransitions('CANCELLED')).toEqual(['REFUNDED']);
    expect(allowedOrderTransitions('REFUNDED')).toEqual([]);
    for (const status of orderStatusValues()) {
      expect(allowedOrderTransitions(status)).toEqual(expect.any(Array));
    }
  });

  it('keeps the transition table importable from its historical path', () => {
    for (const status of orderStatusValues()) {
      expect(allowed[status]).toEqual(allowedOrderTransitions(status));
    }
  });

  it('accepts exactly the transitions of the table and rejects the rest', () => {
    for (const from of orderStatusValues()) {
      for (const to of orderStatusValues()) {
        const allowed = allowedOrderTransitions(from).includes(to);
        if (allowed) {
          expect(() => assertOrderTransition(from, to, 'PAID')).not.toThrow();
        } else {
          expect(() => assertOrderTransition(from, to, 'PAID')).toThrow(InvalidOrderTransitionError);
        }
      }
    }
  });

  it('still rejects a cancelled order that is refunded without a paid payment', () => {
    expect(() => assertOrderTransition('CANCELLED', 'REFUNDED', 'PENDING')).toThrow(InvalidOrderTransitionError);
    expect(() => assertOrderTransition('CANCELLED', 'REFUNDED', 'FAILED')).toThrow(InvalidOrderTransitionError);
    expect(() => assertOrderTransition('CANCELLED', 'REFUNDED', 'REFUNDED')).toThrow(InvalidOrderTransitionError);
    expect(() => assertOrderTransition('CANCELLED', 'REFUNDED', 'PAID')).not.toThrow();
  });

  it('agrees with the refund rule of the order module', () => {
    // The order module refunds an order whose payment status is PAID.
    for (const status of orderStatusValues()) {
      for (const paymentStatus of paymentStatusValues()) {
        expect(canRefundOrder(status, paymentStatus)).toBe(paymentStatus === 'PAID');
      }
    }
  });

  it('expresses the wider refund rule of the admin order module', () => {
    // The admin order module also refunds a payment that is already refunded.
    for (const status of orderStatusValues()) {
      for (const paymentStatus of paymentStatusValues()) {
        expect(canRefundOrder(status, paymentStatus, { allowAlreadyRefunded: true }))
          .toBe(paymentStatus === 'PAID' || paymentStatus === 'REFUNDED');
      }
    }
  });

  it('agrees with the shipping rule of the order module', () => {
    for (const status of orderStatusValues()) {
      for (const paymentStatus of paymentStatusValues()) {
        const shippable = allowedOrderTransitions(status).includes('SHIPPED');
        if (shippable) {
          expect(() => assertOrderTransition(status, 'SHIPPED', paymentStatus)).not.toThrow();
        } else {
          expect(() => assertOrderTransition(status, 'SHIPPED', paymentStatus)).toThrow(InvalidOrderTransitionError);
        }
      }
    }
  });

  it('agrees with the inventory restock rule of a refund', () => {
    for (const status of orderStatusValues()) {
      expect(restocksInventoryOnRefund(status)).toBe(status === 'PROCESSING');
    }
  });

  it('knows the closed order statuses', () => {
    expect(closedOrderStatuses()).toEqual(['CANCELLED', 'REFUNDED']);
    expect(isOrderClosed('CANCELLED')).toBe(true);
    expect(isOrderClosed('REFUNDED')).toBe(true);
    expect(isOrderClosed('PENDING')).toBe(false);
    expect(isOrderClosed('PROCESSING')).toBe(false);
    expect(isOrderClosed('SHIPPED')).toBe(false);
    expect(isOrderClosed('DELIVERED')).toBe(false);
  });
});

describe('the published OpenAPI vocabularies', () => {
  it('publishes the order vocabulary in the order schemas', () => {
    expect(orderSchemas.listOrders.querystring.properties.status.enum).toEqual(orderStatuses);
    expect((orderSchemas.getOrder.response[200] as any).properties.data.properties.paymentStatus.enum)
      .toEqual(paymentStatuses);
  });

  it('publishes the order vocabulary in the admin order schemas', () => {
    expect(adminOrderSchemas.listOrders.querystring.properties.status.enum).toEqual(orderStatuses);
    expect((adminOrderSchemas.getOrder.response[200] as any).properties.data.properties.paymentStatus.enum)
      .toEqual(paymentStatuses);
  });

  it('publishes the order vocabulary in the admin dashboard schemas', () => {
    const recentOrder = (adminDashboardSchemas.getDashboard.response[200] as any)
      .properties.data.properties.recentOrders.items.properties;
    expect(recentOrder.status.enum).toEqual(orderStatuses);
    expect(recentOrder.paymentStatus.enum).toEqual(paymentStatuses);
  });

  it('publishes the shipment vocabulary in the OpenAPI schemas', () => {
    const orderShipment = (orderSchemas.getOrder.response[200] as any)
      .properties.data.properties.shipments.items.properties;
    expect(orderShipment.status.enum).toEqual(shipmentStatuses);
    const adminShipment = (adminOrderSchemas.getOrder.response[200] as any)
      .properties.data.properties.shipments.items.properties;
    expect(adminShipment.status.enum).toEqual(shipmentStatuses);
  });

  it('publishes the item fulfilment vocabulary in the OpenAPI schemas', () => {
    const orderItem = (orderSchemas.getOrder.response[200] as any)
      .properties.data.properties.items.items.properties;
    expect(orderItem.fulfillmentStatus.enum).toEqual(fulfillmentStatuses);
  });
});
