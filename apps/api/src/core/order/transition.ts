import { OrderPaymentStatus, OrderStatus } from '@prisma/client';
import { ApiError } from '@/utils/api-errors';
import { assertOrderTransition as assertPolicyTransition } from './policy';

const allowed: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  PROCESSING: [OrderStatus.SHIPPED, OrderStatus.REFUNDED],
  SHIPPED: [OrderStatus.DELIVERED, OrderStatus.REFUNDED],
  DELIVERED: [OrderStatus.REFUNDED],
  CANCELLED: [OrderStatus.REFUNDED],
  REFUNDED: [],
};

export class InvalidOrderTransitionError extends ApiError {

  constructor(from: OrderStatus, to: OrderStatus) {
    super('INVALID_ORDER_TRANSITION');
    this.message = `Invalid order transition from ${from} to ${to}`;
  }
}

export { allowed };

/**
 * Guard of the order state machine. The rule lives in the public order policy
 * of this module; this export keeps the historical import path working.
 */
export function assertOrderTransition(
  from: OrderStatus,
  to: OrderStatus,
  paymentStatus: OrderPaymentStatus,
): void {
  assertPolicyTransition(from, to, paymentStatus);
}
