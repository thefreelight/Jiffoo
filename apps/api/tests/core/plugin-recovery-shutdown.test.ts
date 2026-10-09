import { fork } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/config/database';
import { pluginSchemaName } from 'shared/plugin-signing';
import { cleanupPluginMigrationFixture } from '../helpers/plugin-migration-cleanup';
import { tcpRelay } from '../helpers/error-http-fixture';

it('S API app.close and worker stop release process heartbeats, recovery tasks, pools and Redis clients before natural exit', async () => {
  for (const [role, outage] of [['api', false], ['worker', false], ['api', true]] as const) {
    const slug = `shutdown-${randomUUID().slice(0, 12)}`, schemaName = pluginSchemaName(slug);
    await prisma.pluginNamespace.create({ data: { slug, schemaName, publisherKind: 'unsigned', provisionedAt: new Date() } });
    await prisma.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);
    const relay = outage ? await tcpRelay(process.env.REDIS_URL!, 6379) : undefined;
    const child = fork(path.resolve('tests/helpers/shutdown-runtime-child.ts'), [role, slug, outage ? 'outage' : 'healthy'], {
      execArgv: ['--import', 'tsx'], stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TEST,
        REDIS_URL: relay?.url ?? process.env.REDIS_URL,
        JIFFOO_TEST_PLUGIN_RECOVERY_CONTROL: undefined, JIFFOO_TEST_PLUGIN_DATABASE_CONTROL: undefined, JIFFOO_TEST_PLUGIN_MIGRATION_CONTROL: undefined },
    });
    let diagnostics = '';
    child.stdout?.on('data', () => undefined);
    child.stderr?.on('data', value => { diagnostics += String(value); });
    const exited = once(child, 'exit');
    const message = () => new Promise<any>((resolve, reject) => {
      const onExit = () => { child.off('message', onMessage); reject(new Error(`Runtime exited before state: ${diagnostics}`)); };
      const onMessage = (value: unknown) => { child.off('exit', onExit); resolve(value); };
      child.once('exit', onExit); child.once('message', onMessage);
    });
    try {
      const started = await message();
      expect(started).toMatchObject({ kind: 'started', state: { process: { heartbeatRunning: true }, database: { poolCreated: true, connections: 1, idle: 1 } } });
      if (role === 'worker') expect(started.state.worker.tasks.pluginRecovery).toBe(true);
      if (relay) { const disconnected = message(); relay.drop(); expect(await disconnected).toEqual({ kind: 'redis-closed' }); }
      const stopped = message(); child.send('stop');
      const result = await stopped;
      expect(result).toMatchObject({ kind: 'stopped', state: {
        process: { registered: false, heartbeatRunning: false, heartbeatPending: false },
        database: { poolCreated: false, activeInvocations: 0, connections: 0, idle: 0, waiting: 0 }, redisConnected: false, redisStreamDestroyed: true,
      } });
      if (!outage) expect(result.state.redis).toBe('end');
      if (role === 'worker') {
        expect(Object.values(result.state.worker.tasks)).toEqual(Array(6).fill(false));
        expect(result.state.worker.redisConnections.every((client: { status: string }) => client.status === 'end')).toBe(true);
      }
      const [code, signal] = await exited;
      expect(code, diagnostics).toBe(0); expect(signal).toBeNull();
    } finally {
      if (child.connected) child.send('stop');
      await exited;
      await relay?.close();
      await cleanupPluginMigrationFixture(slug);
    }
  }
}, 120_000);
