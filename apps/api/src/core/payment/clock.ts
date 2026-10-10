import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from '@prisma/client';

export const PAYMENT_SESSION_LIFETIME_MS = 30 * 60 * 1_000;
const clock = new AsyncLocalStorage<number>();
export function paymentClockOffsetMs(): number {
  const offset = clock.getStore();
  if (offset !== undefined && process.env.NODE_ENV !== 'test') throw new Error('Payment clock controls are not permitted outside tests');
  return offset ?? 0;
}
export function withPaymentTestClock<T>(enabled: boolean, offsetMs: number, run: () => T): T {
  if (!enabled || process.env.NODE_ENV !== 'test' || !Number.isSafeInteger(offsetMs)) throw new Error('Payment clock requires an explicit test switch');
  return clock.run(offsetMs, run);
}
export async function paymentNow(tx: Pick<Prisma.TransactionClient, '$queryRaw'>): Promise<Date> {
  const rows = await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() + ${paymentClockOffsetMs()} * interval '1 millisecond' AS now`;
  return rows[0].now;
}
