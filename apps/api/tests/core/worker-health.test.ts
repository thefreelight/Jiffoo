import { afterEach, describe, expect, it } from 'vitest';
import { fork } from 'node:child_process';
import { hostname } from 'node:os';
import { resolve } from 'node:path';
import { once } from 'node:events';
import { startWorkerRuntime } from '@/worker-runtime';
import { redisCache } from '@/core/cache/redis';
import { WORKER_TASKS } from '@/infra/worker-health';
import { createAdminWithToken, deleteTestUser } from '../helpers/auth';
import { createTestApp } from '../helpers/create-test-app';

describe('worker heartbeat and health', () => {
  const stops: Array<() => Promise<void>> = [];
  const userIds: string[] = [];

  afterEach(async () => {
    for (const stop of stops.reverse()) await stop();
    stops.length = 0;
    for (const id of userIds) await deleteTestUser(id);
    userIds.length = 0;
  });

  async function startChild() {
    const child = fork(resolve('tests/helpers/worker-runtime-child.ts'), [], {
      execArgv: ['--import', 'tsx'],
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TEST },
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    });
    const exited = once(child, 'exit');
    let stopped: Promise<void> | undefined;
    const stop = () => stopped ??= (async () => {
      if (child.connected) child.send('stop');
      const [code] = await exited;
      expect(code).toBe(0);
    })();
    stops.push(stop);
    const info = await new Promise<{ instanceId: string; heartbeatKey: string; healthPort: number }>((accept, reject) => {
      child.once('message', (message) => accept(message as typeof info));
      child.once('error', reject);
      child.once('exit', (code) => reject(new Error(`Worker exited before ready: ${code}`)));
    });
    return { ...info, stop, child };
  }

  async function startAdmin() {
    await redisCache.connect();
    const app = await createTestApp({ disableRedis: false });
    stops.push(async () => {
      await app.close();
      await disconnectRedis();
    });
    await app.listen({ port: 0, host: '127.0.0.1' });
    const { user, token } = await createAdminWithToken();
    userIds.push(user.id);
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('Admin test API has no TCP address');
    const summary = async () => {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/admin/health/summary`, {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.status).toBe(200);
      return (await response.json()).data.worker;
    };
    return { summary };
  }

  async function disconnectRedis() {
    const client = redisCache.getRawClient();
    if (client.status === 'end') return;
    const closed = once(client, 'close');
    await redisCache.disconnect();
    await closed;
  }

  it('A: writes a complete heartbeat with a 30-second TTL and deletes it on stop', async () => {
    const runtime = await startWorkerRuntime({ healthPort: 0 });
    const stop = runtime.stop;
    stops.push(stop);
    const client = redisCache.getRawClient();
    const value = JSON.parse((await client.get(runtime.heartbeatKey))!);
    expect(value).toEqual({
      instanceId: runtime.instanceId, hostname: hostname(), pid: process.pid,
      startedAt: expect.any(String), lastBeatAt: expect.any(String),
    });
    expect(new Date(value.startedAt).toISOString()).toBe(value.startedAt);
    expect(new Date(value.lastBeatAt).getTime()).toBeGreaterThanOrEqual(new Date(value.startedAt).getTime());
    const ttl = await client.ttl(runtime.heartbeatKey);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(30);
    await stop();
    stops.pop();
    await redisCache.connect();
    try {
      expect(await client.exists(runtime.heartbeatKey)).toBe(0);
    } finally {
      await redisCache.disconnect();
    }
  });

  it('B: concurrent worker processes have distinct heartbeats and authenticated Admin HTTP reports both', async () => {
    const admin = await startAdmin();
    expect(await admin.summary()).toEqual({ running: false, instances: 0, lastBeatAt: null });
    const [first, second] = await Promise.all([startChild(), startChild()]);
    expect(first.instanceId).not.toBe(second.instanceId);
    expect(first.heartbeatKey).not.toBe(second.heartbeatKey);
    const client = redisCache.getRawClient();
    const values = await client.mget(first.heartbeatKey, second.heartbeatKey);
    expect(values.every((value) => value !== null)).toBe(true);
    const latest = values.map((value) => JSON.parse(value!).lastBeatAt).sort().at(-1);
    expect(await admin.summary()).toEqual({ running: true, instances: 2, lastBeatAt: latest });
    await Promise.all([first.stop(), second.stop()]);
    expect(await admin.summary()).toEqual({ running: false, instances: 0, lastBeatAt: null });
  });

  it('C: authenticated Admin HTTP reports no worker and remains available without Redis', async () => {
    const admin = await startAdmin();
    expect(await admin.summary()).toEqual({ running: false, instances: 0, lastBeatAt: null });
    await disconnectRedis();
    expect(await admin.summary()).toEqual({ running: false, instances: 0, lastBeatAt: null });
  });

  it('D: worker HTTP health checks Redis, lists five tasks, rejects other routes and closes on stop', async () => {
    const runtime = await startWorkerRuntime({ healthPort: 0 });
    stops.push(runtime.stop);
    const url = `http://127.0.0.1:${runtime.healthPort}`;
    const response = await fetch(`${url}/healthz`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', instanceId: runtime.instanceId, tasks: [...WORKER_TASKS] });
    expect((await fetch(`${url}/other`)).status).toBe(404);
    expect((await fetch(`${url}/healthz`, { method: 'POST' })).status).toBe(404);
    await disconnectRedis();
    expect((await fetch(`${url}/healthz`)).status).toBe(503);
    await redisCache.connect();
    await runtime.stop();
    stops.pop();
    await expect(fetch(`${url}/healthz`)).rejects.toMatchObject({ cause: { code: 'ECONNREFUSED' } });
  });
});
