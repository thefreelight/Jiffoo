import { OrderPaymentStatus, OrderStatus } from '@prisma/client';
import { ApiError } from '@/utils/api-errors';

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
