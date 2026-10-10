import { prisma } from './config/database';
import { closePluginDatabase, abandonPluginDatabase } from '@/core/admin/extension-installer/plugin-database';
import { startCoreProcess, drainCoreProcess, finishCoreProcess, stopCoreProcessHeartbeat, drainCoreProcessHeartbeat } from '@/infra/core-process';
import { coreProcessIdentity } from '@/infra/core-process-identity';
import { startPluginRecoverySweeper } from '@/core/admin/extension-installer/plugin-recovery';
import { drainPluginInstallOperations, unsettledPluginInstallOperations } from '@/core/admin/extension-installer/plugin-migration-operation';
import { drainContractInvocations, unsettledContractInvocations } from '@/core/admin/extension-installer/plugin-runtime';
import { workerShutdownDeadlineMs, observeWorkerShutdownForTest } from '@/infra/worker-shutdown';
import { sharedProtection } from './infra/shared-protection';
import { redisCache } from './core/cache/redis';
import { OrderService } from './core/order/service';
import { deliverPendingNotifications, unsettledNotifications } from './core/notifications/delivery';
import { winstonLogger } from './core/logger/unified-logger';
import Redis from 'ioredis';
import { EventDeliveryEngine } from './infra/events/delivery';
import { cleanupEvents, EVENT_CLEANUP_INTERVAL_MS } from './infra/events/cleanup';
import { PaymentReconciliationJob } from './jobs/payment-reconciliation';
import { hostname } from 'node:os';
import { createServer } from 'node:http';
import { env } from './config/env';
import { WORKER_HEARTBEAT_PREFIX, WORKER_HEARTBEAT_TTL_SECONDS, WORKER_HEARTBEAT_INTERVAL_MS, WORKER_TASKS } from './infra/worker-health';
import { pluginSecretsKey } from './core/admin/plugin-management/config-crypto';
import { assertTestRootEnvironment } from 'shared/plugin-signing';
import { syncBuiltinPlugins } from './core/admin/extension-installer/builtin-sync';
import { prewarmPluginPackages } from './core/storage/prewarm-plugin-packages';
import { prewarmThemePackages } from './core/storage/prewarm-theme-packages';
import { assertThemeTestHooks } from './core/storage/theme-test-hooks';
import { uploadedObjectStore } from './core/storage/uploaded-object-store';
import path from 'node:path';

export async function startWorkerRuntime(options: { redisUrl?: string; healthPort?: number } = {}) {
  workerShutdownDeadlineMs();
  assertThemeTestHooks();
  await uploadedObjectStore.initialize();
  assertTestRootEnvironment(env.EXTENSION_TEST_SIGNING_MODE);
  if (env.EXTENSION_TEST_SIGNING_MODE) console.warn('Test signing mode is enabled for the worker');
  pluginSecretsKey();
  const instanceId = coreProcessIdentity.instanceId;
  let recovery: ReturnType<typeof startPluginRecoverySweeper> | undefined;
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
  const pendingLabels = new Map<Promise<void>, string>();
  let stopping = false;
  let stopWork: Promise<0 | 1> | undefined;
  const drainItems = new Map<Promise<unknown>, { kind: string; id: string }>();
  const trackDrain = <T>(kind: string, work: Promise<T>): Promise<T> => {
    drainItems.set(work, { kind, id: coreProcessIdentity.bootNonce });
    void work.finally(() => drainItems.delete(work)).catch(() => undefined);
    return work;
  };
  const run = (task: () => Promise<unknown>, context: string) => {
    const operation = task().then(() => undefined).catch((error) => {
      winstonLogger.error(context, { component: 'Worker', error: error instanceof Error ? error.message : String(error) });
    });
    pending.add(operation);
    pendingLabels.set(operation, context);
    void operation.finally(() => { pending.delete(operation); pendingLabels.delete(operation); });
    return operation;
  };
  const state = () => ({
    tasks: {
      eventDelivery: eventDelivery.isRunning(),
      eventCleanup: cleanupTimer !== null,
      notifications: notificationTimer !== null,
      unpaidOrders: unpaidTimer !== null,
      paymentReconciliation: PaymentReconciliationJob.getStatus().hasScheduledUpdates,
      pluginRecovery: recovery?.isRunning() ?? false,
    },
    eventHandlerTimeoutMs: eventDelivery.timeoutMs,
    redisConnected: redisCache.getConnectionStatus(),
    redisConnections: redisConnections.map(({ name, client }) => ({ name, status: client.status })),
  });
  const stop = (): Promise<0 | 1> => stopWork ??= (async () => {
    const deadlineMs = workerShutdownDeadlineMs();
    stopping = true;
    eventDelivery.stopClaiming();
    const eventStopped = trackDrain('event-drain', eventDelivery.stop());
    const recoveryStopped = recovery ? trackDrain('plugin-recovery-sweep', recovery.stop()) : undefined;
    started = false;
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    const healthClosed = trackDrain('worker-health-close', healthServer.listening ? new Promise<void>((resolve, reject) => healthServer.close((error) => error ? reject(error) : resolve())) : Promise.resolve());
    if (notificationTimer) clearInterval(notificationTimer);
    if (unpaidTimer) clearInterval(unpaidTimer);
    notificationTimer = unpaidTimer = null;
    PaymentReconciliationJob.stop();
    if (cleanupTimer) clearInterval(cleanupTimer);
    cleanupTimer = null;
    const drain = (async () => {
      await trackDrain('core-process-draining', drainCoreProcess());
      observeWorkerShutdownForTest('draining', { bootNonce: coreProcessIdentity.bootNonce });
      await Promise.allSettled([recoveryStopped, healthClosed, trackDrain('plugin-database-close', closePluginDatabase()), ...pending, eventStopped, trackDrain('payment-reconciliation-drain', PaymentReconciliationJob.drain()), trackDrain('plugin-install-drain', drainPluginInstallOperations())]);
      await trackDrain('contract-invocation-drain', drainContractInvocations());
      await trackDrain('core-heartbeat-drain', drainCoreProcessHeartbeat());
    })();
    let deadlineTimer: NodeJS.Timeout | undefined;
    const drained = await Promise.race([
      drain.then(() => true, error => { winstonLogger.error('Worker drain failed', { error: error instanceof Error ? error.name : 'UnknownError' }); return false; }),
      new Promise<false>(resolve => { deadlineTimer = setTimeout(() => resolve(false), deadlineMs); }),
    ]).finally(() => clearTimeout(deadlineTimer));
    if (!drained) {
      const unsettled = [
        ...eventDelivery.unsettled(), ...unsettledContractInvocations(), ...unsettledNotifications(), ...unsettledPluginInstallOperations(),
        ...drainItems.values(),
        ...[...pendingLabels.values()].map(kind => ({ kind, id: instanceId })),
        ...(PaymentReconciliationJob.getStatus().inFlight ? [{ kind: 'payment-reconciliation', id: instanceId }] : []),
      ];
      for (const item of unsettled) console.error(JSON.stringify({ event: 'worker-shutdown-unsettled', ...item }));
      console.error(JSON.stringify({ event: 'worker-shutdown-deadline', deadlineMs, unsettled: unsettled.length, bootNonce: coreProcessIdentity.bootNonce }));
      stopCoreProcessHeartbeat();
      abandonPluginDatabase();
      healthServer.closeAllConnections();
      heartbeatRedis.disconnect();
      void redisCache.disconnect().catch(() => undefined);
      void prisma.$disconnect().catch(() => undefined);
      sharedProtection.close();
      return 1;
    }
    await finishCoreProcess();
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
    sharedProtection.close();
    return 0;
  })();
  try {
    await startCoreProcess('worker');
    recovery = startPluginRecoverySweeper();
    redisConnections.push({ name: 'heartbeat', client: heartbeatRedis });
    try { await heartbeatRedis.connect(); } catch { throw new Error('Redis unavailable at worker startup'); }
    redisConnections.push({ name: 'cache', client: redisCache.getRawClient() });
    await redisCache.connect();
    await syncBuiltinPlugins(path.join(process.cwd(), 'builtin-plugins'));
    await prewarmPluginPackages();
    await prewarmThemePackages();
    await recovery.run();
    await eventDelivery.start();
    await run(cleanupEvents, 'Event cleanup failed');
    cleanupTimer = setInterval(() => void run(cleanupEvents, 'Event cleanup failed'), EVENT_CLEANUP_INTERVAL_MS);
    await run(() => OrderService.cancelExpiredUnpaidOrders(), 'Unpaid order timeout failed');
    unpaidTimer = setInterval(() => void run(() => OrderService.cancelExpiredUnpaidOrders(), 'Unpaid order timeout failed'), 60_000);
    const sendNotifications = () => deliverPendingNotifications({ isStopping: () => stopping });
    await run(sendNotifications, 'Notification delivery failed');
    notificationTimer = setInterval(() => void run(sendNotifications, 'Notification delivery failed'), 10_000);
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
