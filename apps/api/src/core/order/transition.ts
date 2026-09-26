import { OrderPaymentStatus, OrderStatus } from '@prisma/client';

const allowed: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  PROCESSING: [OrderStatus.SHIPPED, OrderStatus.REFUNDED],
  SHIPPED: [OrderStatus.DELIVERED, OrderStatus.REFUNDED],
  DELIVERED: [OrderStatus.REFUNDED],
  CANCELLED: [OrderStatus.REFUNDED],
  REFUNDED: [],
};

export class InvalidOrderTransitionError extends Error {
  readonly code = 'INVALID_ORDER_TRANSITION';
  readonly statusCode = 409;

  constructor(from: OrderStatus, to: OrderStatus) {
    super(`Invalid order transition from ${from} to ${to}`);
  }
}

export function assertOrderTransition(
  from: OrderStatus,
  to: OrderStatus,
  paymentStatus: OrderPaymentStatus,
): void {
  if (!allowed[from].includes(to) ||
    (from === OrderStatus.CANCELLED && to === OrderStatus.REFUNDED && paymentStatus !== OrderPaymentStatus.PAID)) {
    throw new InvalidOrderTransitionError(from, to);
  }
}
