import type { Order } from './checkout-types';

export function paymentResult(order: Pick<Order, 'paymentStatus' | 'paymentAttemptState' | 'status'>) {
  if (order.paymentAttemptState === 'UNKNOWN' || order.paymentAttemptState === 'REQUIRES_REVIEW') return 'pending';
  if (order.paymentStatus === 'PAID') return 'paid';
  return order.status === 'CANCELLED' || order.paymentStatus === 'FAILED' ? 'cancelled' : 'pending';
}

export const paymentPollDelay = (attempt: number) => Math.min(30_000, 5_000 * 2 ** Math.min(attempt, 3));
