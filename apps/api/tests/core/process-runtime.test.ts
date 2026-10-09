import { afterEach, describe, expect, it } from 'vitest';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
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
  pluginRecovery: false,
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

  it('A: starts exactly six worker tasks and stops every task and Redis connection', async () => {
    await createOwnEvent();
    const runtime = await startWorkerRuntime({ healthPort: 0 });
    stop = runtime.stop;
    const connections = runtime.state().redisConnections;
    expect(connections).toHaveLength(2);
    expect(connections.every(({ status }) => status === 'ready')).toBe(true);
    expect(connections.map(({ name }) => name).sort()).toEqual(['cache', 'heartbeat']);
    expect(runtime.state()).toEqual({
      tasks: { eventDelivery: true, eventCleanup: true, notifications: true, unpaidOrders: true, paymentReconciliation: true, pluginRecovery: true },
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

  it.each([undefined, 'invalid-base64'])('E: production API and worker reject an invalid plugin secrets key: %s', async (key) => {
    const priorEnv = process.env.NODE_ENV;
    const priorKey = process.env.PLUGIN_SECRETS_KEY;
    const priorRoot = process.env.JIFFOO_TEST_PLUGIN_ROOT_PUBLIC_KEY;
    const priorMode = env.EXTENSION_TEST_SIGNING_MODE;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.JIFFOO_TEST_PLUGIN_ROOT_PUBLIC_KEY;
      env.EXTENSION_TEST_SIGNING_MODE = false;
      if (key === undefined) delete process.env.PLUGIN_SECRETS_KEY;
      else process.env.PLUGIN_SECRETS_KEY = key;
      await expect(startApiRuntime({ port: 0, host: '127.0.0.1' })).rejects.toThrow('PLUGIN_SECRETS_KEY must be base64 of exactly 32 bytes');
      await expect(startWorkerRuntime({ healthPort: 0 })).rejects.toThrow('PLUGIN_SECRETS_KEY must be base64 of exactly 32 bytes');
    } finally {
      process.env.NODE_ENV = priorEnv;
      process.env.PLUGIN_SECRETS_KEY = priorKey;
      process.env.JIFFOO_TEST_PLUGIN_ROOT_PUBLIC_KEY = priorRoot;
      env.EXTENSION_TEST_SIGNING_MODE = priorMode;
    }
  });

  it('E: development API and worker start with a missing key and emit a warning', async () => {
    const childEnv = { ...process.env, NODE_ENV: 'development' };
    delete childEnv.PLUGIN_SECRETS_KEY;
    delete childEnv.JIFFOO_TEST_PLUGIN_ROOT_PUBLIC_KEY;
    childEnv.EXTENSION_TEST_SIGNING_MODE = 'false';
    const child = fork(path.resolve('tests/helpers/plugin-secrets-start-child.ts'), [], {
      execArgv: ['--import', 'tsx'], env: childEnv,
    });
    const response = await once(child, 'message');
    await once(child, 'exit');
    expect(response[0]).toMatchObject({ apiListening: true, workerRunning: true });
    expect((response[0].warnings as string[]).join(' ')).toContain('development-only plugin secrets key');
  });

  it('O: API and worker accept the test plugin root with the explicit mode enabled', async () => {
    const child = fork(path.resolve('tests/helpers/plugin-secrets-start-child.ts'), [], {
      execArgv: ['--import', 'tsx'], env: { ...process.env, NODE_ENV: 'test', EXTENSION_TEST_SIGNING_MODE: 'true' },
    });
    const response = await once(child, 'message');
    await once(child, 'exit');
    expect(response[0]).toMatchObject({ apiListening: true, workerRunning: true });
  });
});
