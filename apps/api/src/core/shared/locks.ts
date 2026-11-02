import type { Prisma } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * A client that can run the row lock.
 *
 * The requirement is structural on purpose: a Prisma transaction client and the
 * order module's own transaction surface both satisfy it, so a caller that
 * holds either one can take the lock.
 */
type LockClient = { $queryRaw: (...args: any[]) => Promise<any> };
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

/**
 * The advisory lock of the plugin service dependency graph.
 *
 * The lock is transaction scoped and every graph decision takes it before the
 * installation rows it protects: the enable, the disable, the uninstall, the
 * purge, the package update and the publication of the derived availability.
 * The key is shared with the durable-task scheduler, which takes the same lock
 * before it claims a task, so a lifecycle decision and a task claim never
 * interleave.
 */
export const PLUGIN_SERVICE_GRAPH_LOCK = 'jiffoo:plugin-service-graph';

/** A client that can take the graph lock. */
export type GraphLockClient = { $executeRawUnsafe: (query: string) => Promise<unknown> };

/** Takes the graph lock of a transaction. */
export async function lockPluginServiceGraph(tx: GraphLockClient): Promise<void> {
  // The statement is a constant of this module: the key of the lock is not
  // read from a request, a header or a row.
  await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtextextended('${PLUGIN_SERVICE_GRAPH_LOCK}', 0))`);
}
