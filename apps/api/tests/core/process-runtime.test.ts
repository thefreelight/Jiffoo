import { afterEach, describe, expect, it } from 'vitest';
import { prisma } from '@/config/database';
import { env } from '@/config/env';
import { startWorkerRuntime } from '@/worker-runtime';
import { startApiRuntime } from '@/server';
import { queueManager, workerManager, outboxPoller } from '@/infra/jobs';
import { PaymentReconciliationJob } from '@/jobs/payment-reconciliation';
import { redisCache } from '@/core/cache/redis';

const stoppedTasks = {
  outbox: false,
  bullmq: false,
  notifications: false,
  unpaidOrders: false,
  paymentReconciliation: false,
};

describe('backend process isolation', () => {
  let stop: (() => Promise<void>) | undefined;
  let eventId: string | undefined;

  afterEach(async () => {
    await stop?.();
    stop = undefined;
    if (eventId) await prisma.outboxEvent.deleteMany({ where: { id: eventId } });
    eventId = undefined;
    await prisma.$disconnect();
  });

  async function createOwnEvent() {
    expect(new URL(env.REDIS_URL).pathname).toBe('/15');
    expect(new URL(process.env.DATABASE_URL_TEST!).pathname).toBe('/jiffoo_core_test');
    const event = await prisma.outboxEvent.create({
      data: { type: 'runtime.test', aggregateId: 'process-runtime', payload: { test: true }, published: true },
    });
    eventId = event.id;
  }

  it('A: starts exactly five worker tasks and stops every task and Redis connection', async () => {
    await createOwnEvent();
    const runtime = await startWorkerRuntime();
    stop = runtime.stop;
    const connections = runtime.state().redisConnections;
    expect(connections).toHaveLength(13);
    expect(connections.every(({ status }) => status === 'ready')).toBe(true);
    expect(connections.filter(({ name }) => name.startsWith('queue-events:'))).toHaveLength(3);
    expect(connections.filter(({ name }) => name.startsWith('queue-events-input:'))).toHaveLength(3);
    expect(connections.filter(({ name }) => name.startsWith('worker-blocking:'))).toHaveLength(2);
    expect(runtime.state()).toEqual({
      tasks: { outbox: true, bullmq: true, notifications: true, unpaidOrders: true, paymentReconciliation: true },
      queueConnected: true,
      redisConnected: true,
      redisConnections: connections,
    });
    await runtime.stop();
    stop = undefined;
    expect(runtime.state()).toEqual({
      tasks: stoppedTasks,
      queueConnected: false,
      redisConnected: false,
      redisConnections: connections.map(({ name }) => ({ name, status: 'end' })),
    });
    expect(queueManager.getQueue('webhook-delivery')).toBeNull();
    expect(queueManager.getQueue('email')).toBeNull();
    expect(queueManager.getQueue('fulfillment')).toBeNull();
  });

  it('B: real API startup on an ephemeral port starts no background task or BullMQ connection', async () => {
    await createOwnEvent();
    const runtime = await startApiRuntime({ port: 0, host: '127.0.0.1' });
    stop = runtime.stop;
    expect(runtime.app.server.listening).toBe(true);
    expect(queueManager.isConnected()).toBe(false);
    expect(queueManager.isAvailable()).toBe(false);
    expect(workerManager.isRunning()).toBe(false);
    expect(outboxPoller.isRunning()).toBe(false);
    expect(PaymentReconciliationJob.getStatus()).toMatchObject({ isRunning: false, hasScheduledUpdates: false });
    await runtime.stop();
    stop = undefined;
    expect(runtime.app.server.listening).toBe(false);
    expect(redisCache.getConnectionStatus()).toBe(false);
  });

  it('C: rejects unavailable Redis at worker startup and leaves every task and connection stopped', async () => {
    await createOwnEvent();
    await expect(startWorkerRuntime({ redisUrl: 'redis://127.0.0.1:1/15' })).rejects.toMatchObject({
      message: 'Redis unavailable at worker startup',
      runtimeState: { tasks: stoppedTasks, queueConnected: false, redisConnected: false },
    });
    expect(queueManager.isAvailable()).toBe(false);
    expect(workerManager.isRunning()).toBe(false);
    expect(outboxPoller.isRunning()).toBe(false);
    expect(PaymentReconciliationJob.getStatus().hasScheduledUpdates).toBe(false);
  });
});
