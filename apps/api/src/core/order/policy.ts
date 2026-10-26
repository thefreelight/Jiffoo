/**
 * Public order policy.
 *
 * This module is the single source of truth of the order domain: the order
 * status vocabulary, the shipment and the item fulfilment vocabulary, the
 * order transition table and the order status predicates. Every other module
 * reads the order vocabulary and the order rules from here instead of
 * repeating status literals.
 *
 * The module holds one collection, the transition table of the order state
 * machine; every other collection is built inside a function body.
 *
 * A new order status is not a decision of this module alone: the status is
 * stored in the database, so a new order state needs a Prisma enum change and
 * the matching migration first, and only then a new entry in the vocabularies
 * and in the transition table below. The same holds for the shipment status
 * and for the item fulfilment status, which are stored as well.
 */

import {
  OrderItemFulfillmentStatus,
  OrderStatus,
  PaymentStatus,
  ShipmentStatus,
  type OrderItemFulfillmentStatusType,
  type OrderStatusType,
  type PaymentStatusType,
  type ShipmentStatusType,
} from './types';
import { ApiError } from '@/utils/api-errors';

export { OrderStatus, PaymentStatus, ShipmentStatus, OrderItemFulfillmentStatus };
export type {
  OrderItemFulfillmentStatusType,
  OrderStatusType,
  PaymentStatusType,
  ShipmentStatusType,
};

/** Options of the refund rule. */
export interface RefundPolicyOptions {
  /**
   * Accept a payment that is already refunded. The admin order module refunds
   * such a payment, the order module itself only refunds a paid payment.
   */
  allowAlreadyRefunded?: boolean;
}

/**
 * The transitions allowed from an order status.
 *
 * The table is the single source of the order state machine: the guard and
 * the published `allowedOrderTransitions` read it and never repeat a rule.
 */
export const allowed: Record<OrderStatusType, readonly OrderStatusType[]> = {
  PENDING: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  PROCESSING: [OrderStatus.SHIPPED, OrderStatus.REFUNDED],
  SHIPPED: [OrderStatus.DELIVERED, OrderStatus.REFUNDED],
  DELIVERED: [OrderStatus.REFUNDED],
  CANCELLED: [OrderStatus.REFUNDED],
  REFUNDED: [],
};

/** The error raised when an order transition is not allowed. */
export class InvalidOrderTransitionError extends ApiError {

  constructor(from: OrderStatusType, to: OrderStatusType) {
    super('INVALID_ORDER_TRANSITION');
    this.message = `Invalid order transition from ${from} to ${to}`;
  }
}

/** The order status vocabulary, in the stable order of the Prisma enum. */
export function orderStatusValues(): OrderStatusType[] {
  return Object.values(OrderStatus);
}

/** The payment status vocabulary, in the stable order of the Prisma enum. */
export function paymentStatusValues(): PaymentStatusType[] {
  return Object.values(PaymentStatus);
}

/** The shipment status vocabulary, in the stable order of the Prisma enum. */
export function shipmentStatusValues(): ShipmentStatusType[] {
  return Object.values(ShipmentStatus);
}

/** The item fulfilment vocabulary, in the stable order of the Prisma enum. */
export function orderItemFulfillmentStatusValues(): OrderItemFulfillmentStatusType[] {
  return Object.values(OrderItemFulfillmentStatus);
}

/** The order statuses that close an order: CANCELLED and REFUNDED. */
export function closedOrderStatuses(): OrderStatusType[] {
  return [OrderStatus.CANCELLED, OrderStatus.REFUNDED];
}

/** Whether the order is closed, that is cancelled or refunded. */
export function isOrderClosed(status: OrderStatusType): boolean {
  return closedOrderStatuses().includes(status);
}

/** The transitions allowed from an order status. */
export function allowedOrderTransitions(from: OrderStatusType): readonly OrderStatusType[] {
  return allowed[from];
}

/**
 * Guard of the order state machine. It throws the `InvalidOrderTransitionError`
 * of the order module when the transition is not allowed.
 *
 * The published transition table is the single source of the rule: the guard
 * asks `allowedOrderTransitions` and never the raw table.
 */
export function assertOrderTransition(
  from: OrderStatusType,
  to: OrderStatusType,
  paymentStatus: PaymentStatusType,
): void {
  if (!allowedOrderTransitions(from).includes(to)
    || (from === OrderStatus.CANCELLED && to === OrderStatus.REFUNDED && paymentStatus !== PaymentStatus.PAID)) {
    throw new InvalidOrderTransitionError(from, to);
  }
}

/**
 * Whether an order may be refunded. The rule is expressed on the payment
 * status of the order: a paid payment can be refunded. A payment that is
 * already refunded is only refundable when the caller asks for it with
 * `allowAlreadyRefunded`, which the admin order module does and the order
 * module itself does not. The order status is part of the signature because
 * the rule is asked for an order; it does not restrict the refund today.
 */
export function canRefundOrder(
  status: OrderStatusType,
  paymentStatus: PaymentStatusType,
  options: RefundPolicyOptions = {},
): boolean {
  if (paymentStatus === PaymentStatus.PAID) return true;
  return options.allowAlreadyRefunded === true && paymentStatus === PaymentStatus.REFUNDED;
}

/** Whether a refund of the order restocks its inventory: only PROCESSING does. */
export function restocksInventoryOnRefund(status: OrderStatusType): boolean {
  return status === OrderStatus.PROCESSING;
}
