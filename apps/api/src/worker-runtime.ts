import { prisma } from './config/database';
import { redisCache } from './core/cache/redis';
import { OrderService } from './core/order/service';
import { deliverPendingNotifications } from './core/notifications/delivery';
import { winstonLogger } from './core/logger/unified-logger';
import { queueManager, workerManager, outboxPoller, registerAllHandlers } from './infra/jobs';
import { PaymentReconciliationJob } from './jobs/payment-reconciliation';

export async function startWorkerRuntime(options: { redisUrl?: string } = {}) {
  let notificationTimer: NodeJS.Timeout | null = null;
  let unpaidTimer: NodeJS.Timeout | null = null;
  const redisConnections: Array<{ name: string; client: { status: string } }> = [];
  const pending = new Set<Promise<void>>();
  const run = (task: () => Promise<unknown>, context: string) => {
    const operation = task().then(() => undefined).catch((error) => {
      winstonLogger.error(context, { component: 'Worker', error: error instanceof Error ? error.message : String(error) });
    });
    pending.add(operation);
    void operation.finally(() => pending.delete(operation));
    return operation;
  };
  const state = () => ({
    tasks: {
      outbox: outboxPoller.isRunning(),
      bullmq: workerManager.isRunning(),
      notifications: notificationTimer !== null,
      unpaidOrders: unpaidTimer !== null,
      paymentReconciliation: PaymentReconciliationJob.getStatus().hasScheduledUpdates,
    },
    queueConnected: queueManager.isConnected(),
    redisConnected: redisCache.getConnectionStatus(),
    redisConnections: redisConnections.map(({ name, client }) => ({ name, status: client.status })),
  });
  const stop = async () => {
    if (notificationTimer) clearInterval(notificationTimer);
    if (unpaidTimer) clearInterval(unpaidTimer);
    notificationTimer = unpaidTimer = null;
    PaymentReconciliationJob.stop();
    outboxPoller.stop();
    await Promise.all([...pending, outboxPoller.drain(), PaymentReconciliationJob.drain()]);
    await workerManager.stop();
    await queueManager.disconnect();
    await redisCache.disconnect();
    await prisma.$disconnect();
  };
  try {
    registerAllHandlers();
    await queueManager.connect(options.redisUrl);
    redisConnections.push(...await queueManager.getRedisConnections());
    if (!queueManager.isAvailable()) throw new Error('Redis unavailable at worker startup');
    redisConnections.push({ name: 'cache', client: redisCache.getRawClient() });
    await redisCache.connect();
    await workerManager.start();
    redisConnections.push(...await workerManager.getRedisConnections());
    outboxPoller.start();
    await run(() => OrderService.cancelExpiredUnpaidOrders(), 'Unpaid order timeout failed');
    unpaidTimer = setInterval(() => void run(() => OrderService.cancelExpiredUnpaidOrders(), 'Unpaid order timeout failed'), 60_000);
    await run(deliverPendingNotifications, 'Notification delivery failed');
    notificationTimer = setInterval(() => void run(deliverPendingNotifications, 'Notification delivery failed'), 10_000);
    if (process.env.ENABLE_PAYMENT_RECONCILIATION_JOB !== 'false') {
      PaymentReconciliationJob.start({
        intervalMs: Number(process.env.PAYMENT_RECONCILIATION_INTERVAL_MS || 600_000) || 600_000,
        limit: Number(process.env.PAYMENT_RECONCILIATION_LIMIT || 100) || 100,
        maxAgeMinutes: Number(process.env.PAYMENT_RECONCILIATION_MAX_AGE_MINUTES || 10080) || 10080,
        minAgeMinutes: Number(process.env.PAYMENT_RECONCILIATION_MIN_AGE_MINUTES || 2) || 2,
      });
    }
    return { state, stop };
  } catch (error) {
    await stop();
    throw Object.assign(error instanceof Error ? error : new Error(String(error)), { runtimeState: state() });
  }
}
