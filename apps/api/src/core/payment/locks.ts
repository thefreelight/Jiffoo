import type { Prisma } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';

type LockClient = Pick<Prisma.TransactionClient, '$queryRaw'>;
const observers = new AsyncLocalStorage<(orderId: string, tx: LockClient) => Promise<void>>();
export function withOrderLockTestControl<T>(enabled: boolean, observer: (orderId: string, tx: LockClient) => Promise<void>, run: () => T): T {
  if (!enabled || process.env.NODE_ENV !== 'test') throw new Error('Order lock controls require an explicit test switch');
  return observers.run(observer, run);
}

/** Every order/payment writer uses this order, including cancellation and offline refunds. */
export async function lockOrder(tx: LockClient, orderId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM public.orders WHERE id = ${orderId} FOR UPDATE`;
  const observer = observers.getStore();
  if (observer && process.env.NODE_ENV !== 'test') throw new Error('Order lock controls are not permitted outside tests');
  await observer?.(orderId, tx);
}
export async function lockPayment(tx: Pick<Prisma.TransactionClient, '$queryRaw'>, paymentId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM public.payments WHERE id = ${paymentId} FOR UPDATE`;
}
