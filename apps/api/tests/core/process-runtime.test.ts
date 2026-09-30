import { afterEach, describe, expect, it } from 'vitest';
import { prisma } from '@/config/database';
import { env } from '@/config/env';
import { startWorkerRuntime } from '@/worker-runtime';
import { startApiRuntime } from '@/server';
import { PaymentReconciliationJob } from '@/jobs/payment-reconciliation';
import { redisCache } from '@/core/cache/redis';

const stoppedTasks = {
  eventDelivery: false,
  eventCleanup: false,
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
    if (eventId) await prisma.eventRecord.deleteMany({ where: { id: eventId } });
    eventId = undefined;
    await prisma.$disconnect();
  });

  async function createOwnEvent() {
    expect(new URL(env.REDIS_URL).pathname).toBe('/15');
    expect(new URL(process.env.DATABASE_URL_TEST!).pathname).toBe('/jiffoo_core_test');
    const event = await prisma.eventRecord.create({
      data: { type: 'order.cancelled', version: 1, aggregateId: 'process-runtime', data: { id: 'process-runtime', orderId: 'process-runtime', userId: 'test', reason: 'test' } },
    });
    eventId = event.id;
  }

  it('A: starts exactly five worker tasks and stops every task and Redis connection', async () => {
    await createOwnEvent();
    const runtime = await startWorkerRuntime({ healthPort: 0 });
    stop = runtime.stop;
    const connections = runtime.state().redisConnections;
    expect(connections).toHaveLength(2);
    expect(connections.every(({ status }) => status === 'ready')).toBe(true);
    expect(connections.map(({ name }) => name).sort()).toEqual(['cache', 'heartbeat']);
    expect(runtime.state()).toEqual({
      tasks: { eventDelivery: true, eventCleanup: true, notifications: true, unpaidOrders: true, paymentReconciliation: true },
      eventHandlerTimeoutMs: 30000,
      redisConnected: true,
      redisConnections: connections,
    });
    await runtime.stop();
    stop = undefined;
    expect(runtime.state()).toEqual({
      tasks: stoppedTasks,
      eventHandlerTimeoutMs: 30000,
      redisConnected: false,
      redisConnections: connections.map(({ name }) => ({ name, status: 'end' })),
    });
  });

  it('B: real API startup on an ephemeral port starts no background delivery task', async () => {
    await createOwnEvent();
    const runtime = await startApiRuntime({ port: 0, host: '127.0.0.1' });
    stop = runtime.stop;
    expect(runtime.app.server.listening).toBe(true);
    expect(await prisma.eventDelivery.count({ where: { eventId } })).toBe(0);
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
      runtimeState: { tasks: stoppedTasks, eventHandlerTimeoutMs: 30000, redisConnected: false },
    });
    expect(PaymentReconciliationJob.getStatus().hasScheduledUpdates).toBe(false);
  });
});
