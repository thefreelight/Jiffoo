import type { Order } from './checkout-types';

export function paymentResult(order: Pick<Order, 'paymentStatus' | 'paymentAttemptState' | 'status'> & Partial<Pick<Order, 'paymentInstructions'>>) {
  if (order.paymentAttemptState === 'UNKNOWN' || order.paymentAttemptState === 'REQUIRES_REVIEW') return 'pending';
  if (order.paymentStatus === 'PAID') return 'paid';
  if (order.status === 'CANCELLED' || order.paymentStatus === 'FAILED') return 'cancelled';
  return order.status === 'PENDING' && order.paymentStatus === 'PENDING' && order.paymentAttemptState === 'PENDING' && order.paymentInstructions?.trim() ? 'manual' : 'pending';
}

export const paymentPollDelay = () => 5_000;
