import { prisma } from './config/database';
import { redisCache } from './core/cache/redis';
import { OrderService } from './core/order/service';
import { deliverPendingNotifications } from './core/notifications/delivery';
import { winstonLogger } from './core/logger/unified-logger';
import Redis from 'ioredis';
import { EventDeliveryEngine } from './infra/events/delivery';
import { cleanupEvents, EVENT_CLEANUP_INTERVAL_MS } from './infra/events/cleanup';
import { PaymentReconciliationJob } from './jobs/payment-reconciliation';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { createServer } from 'node:http';
import { env } from './config/env';
import { WORKER_HEARTBEAT_PREFIX, WORKER_HEARTBEAT_TTL_SECONDS, WORKER_HEARTBEAT_INTERVAL_MS, WORKER_TASKS } from './infra/worker-health';
import { pluginSecretsKey } from './core/admin/plugin-management/config-crypto';
import { assertTestRootEnvironment } from 'shared/plugin-signing';
import { syncBuiltinPlugins } from './core/admin/extension-installer/builtin-sync';
import path from 'node:path';

export async function startWorkerRuntime(options: { redisUrl?: string; healthPort?: number } = {}) {
  assertTestRootEnvironment();
  pluginSecretsKey();
  const instanceId = randomUUID();
  const startedAt = new Date().toISOString();
  const heartbeatKey = `${WORKER_HEARTBEAT_PREFIX}${instanceId}`;
  const heartbeatRedis = new Redis(options.redisUrl ?? env.REDIS_URL, { lazyConnect: true, retryStrategy: () => null, maxRetriesPerRequest: 1, connectTimeout: 1000 });
  const eventDelivery = new EventDeliveryEngine(instanceId);
  let cleanupTimer: NodeJS.Timeout | null = null;
  let started = false;
  let heartbeatTimer: NodeJS.Timeout | null = null;
  const healthServer = createServer(async (request, response) => {
    if (request.method !== 'GET' || request.url !== '/healthz') {
      response.writeHead(404).end();
      return;
    }
    const healthy = started && await redisCache.ping();
    response.writeHead(healthy ? 200 : 503, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ status: healthy ? 'ok' : 'unavailable', instanceId, tasks: [...WORKER_TASKS] }));
  });
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
      eventDelivery: eventDelivery.isRunning(),
      eventCleanup: cleanupTimer !== null,
      notifications: notificationTimer !== null,
      unpaidOrders: unpaidTimer !== null,
      paymentReconciliation: PaymentReconciliationJob.getStatus().hasScheduledUpdates,
    },
    eventHandlerTimeoutMs: eventDelivery.timeoutMs,
    redisConnected: redisCache.getConnectionStatus(),
    redisConnections: redisConnections.map(({ name, client }) => ({ name, status: client.status })),
  });
  const stop = async () => {
    started = false;
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    if (healthServer.listening) {
      await new Promise<void>((resolve, reject) => healthServer.close((error) => error ? reject(error) : resolve()));
    }
    if (notificationTimer) clearInterval(notificationTimer);
    if (unpaidTimer) clearInterval(unpaidTimer);
    notificationTimer = unpaidTimer = null;
    PaymentReconciliationJob.stop();
    if (cleanupTimer) clearInterval(cleanupTimer);
    cleanupTimer = null;
    await Promise.all([...pending, eventDelivery.stop(), PaymentReconciliationJob.drain()]);
    if (heartbeatRedis.status === 'ready') {
      await run(() => heartbeatRedis.del(heartbeatKey), 'Worker heartbeat deletion failed');
    }
    const heartbeatEnded = heartbeatRedis.status === 'end' ? Promise.resolve()
      : new Promise<void>((resolve) => heartbeatRedis.once('end', resolve));
    heartbeatRedis.disconnect();
    await heartbeatEnded;
    const cacheRedis = redisCache.getRawClient();
    const cacheEnded = cacheRedis.status === 'end' ? Promise.resolve()
      : new Promise<void>((resolve) => cacheRedis.once('end', resolve));
    await redisCache.disconnect();
    await cacheEnded;
    await prisma.$disconnect();
  };
  try {
    redisConnections.push({ name: 'heartbeat', client: heartbeatRedis });
    try { await heartbeatRedis.connect(); } catch { throw new Error('Redis unavailable at worker startup'); }
    redisConnections.push({ name: 'cache', client: redisCache.getRawClient() });
    await redisCache.connect();
    await syncBuiltinPlugins(path.join(process.cwd(), 'builtin-plugins'));
    await eventDelivery.start();
    await run(cleanupEvents, 'Event cleanup failed');
    cleanupTimer = setInterval(() => void run(cleanupEvents, 'Event cleanup failed'), EVENT_CLEANUP_INTERVAL_MS);
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
    const beat = () => run(() => heartbeatRedis.set(
      heartbeatKey,
      JSON.stringify({ instanceId, hostname: hostname(), pid: process.pid, startedAt, lastBeatAt: new Date().toISOString() }),
      'EX', WORKER_HEARTBEAT_TTL_SECONDS,
    ), 'Worker heartbeat write failed');
    await beat();
    heartbeatTimer = setInterval(() => void beat(), WORKER_HEARTBEAT_INTERVAL_MS);
    await new Promise<void>((resolve, reject) => {
      healthServer.once('error', reject);
      healthServer.listen(options.healthPort ?? env.WORKER_HEALTH_PORT, '0.0.0.0', () => {
        healthServer.removeListener('error', reject);
        resolve();
      });
    });
    started = true;
    const address = healthServer.address();
    if (!address || typeof address === 'string') throw new Error('Worker health server has no TCP address');
    return { state, stop, instanceId, heartbeatKey, healthPort: address.port };
  } catch (error) {
    await stop();
    throw Object.assign(error instanceof Error ? error : new Error(String(error)), { runtimeState: state() });
  }
}
