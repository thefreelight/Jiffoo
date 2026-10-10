import { describe, expect, it } from 'vitest';
import { fork, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Redis from 'ioredis';
import { env } from '@/config/env';
import { pluginProtectionScope } from '@/infra/shared-protection';
import { getTestPrisma } from '../helpers/db';
import { createTestUser, deleteTestUser } from '../helpers/auth';
import { createTestOrder } from '../helpers/fixtures';
import { publishTestPlugin, clearTestPluginCache } from '../helpers/plugin-cache';
import { snapshotPluginRows, restoreBuiltinRows } from '../helpers/plugin-db-snapshot';
import { redisRelay } from '../helpers/redis-relay';

function command(child: ChildProcess, input: Record<string, unknown>): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = randomUUID();
    const receive = (message: any) => {
      if (message.id !== id) return;
      child.off('message', receive);
      if (message.error) reject(new Error(message.error)); else resolve(message);
    };
    child.on('message', receive); child.send({ ...input, id });
  });
}

describe('worker payment reconciliation shared protection', () => {
  it('R1: a real Redis outage skips payment work without failure samples and the living worker processes it after recovery', async () => {
    const prisma = getTestPrisma();
    const namespace = `test:worker-protection:${randomUUID()}`;
    const slug = `worker-pay-${randomUUID().slice(0, 12)}`;
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'worker-payment-protection-'));
    const marker = path.join(directory, 'invocations.txt');
    const slugs = (await fs.readdir(path.resolve('builtin-plugins'), { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    const before = await snapshotPluginRows(slugs);
    const relay = await redisRelay(env.REDIS_URL);
    const client = new Redis(env.REDIS_URL);
    const child = fork(path.resolve('tests/helpers/reconciliation-worker-child.ts'), [], {
      execArgv: ['--import', 'tsx'], stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TEST, REDIS_URL: relay.url,
        ENABLE_PAYMENT_RECONCILIATION_JOB: 'true', PAYMENT_RECONCILIATION_INTERVAL_MS: '86400000',
        PAYMENT_RECONCILIATION_LIMIT: '1', PAYMENT_RECONCILIATION_MIN_AGE_MINUTES: '8000', PAYMENT_RECONCILIATION_MAX_AGE_MINUTES: '10000' },
    });
    const exited = once(child, 'exit');
    let heartbeatKey: string | undefined; let userId: string | undefined; let orderId: string | undefined; let scope: string | undefined;
    try {
      const ready = await new Promise<any>((resolve, reject) => {
        child.once('message', resolve); child.once('error', reject); child.once('exit', (code) => reject(new Error(`Worker exited before ready: ${code}`)));
      });
      expect(ready.kind).toBe('ready'); heartbeatKey = ready.heartbeatKey;
      await command(child, { kind: 'warm', namespace });
      const manifest = { schemaVersion: 1, slug, name: slug, description: 'Worker payment test', version: '1.0.0', runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1', entryModule: 'server/index.js', permissions: [], contracts: [{ name: 'payment', version: 1 }] };
      await fs.mkdir(path.join(directory, 'server'));
      await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
      await fs.writeFile(path.join(directory, 'server/index.js'), `const fs = require('node:fs/promises'); module.exports = { register(ctx) { ctx.contracts.implement('payment', 1, {
        describe: () => ({ displayName: 'Worker payment', requiresManualConfirmation: false, unpaidTimeoutMinutes: 10080, supportedCurrencies: ['USD'] }),
        createSession: () => ({ sessionId: 'unused', action: { type: 'instructions', text: 'Test payment' } }),
        getSessionStatus: async ({ sessionId }) => { await fs.appendFile(${JSON.stringify(marker)}, 'invoked\\n'); return { status: 'succeeded', providerEventId: 'worker-success:' + sessionId }; }
      }); } };`);
      const zipHash = await publishTestPlugin(slug, directory);
      await prisma.pluginInstall.create({ data: { slug, name: slug, version: '1.0.0', manifestJson: manifest, zipHash, source: 'local-zip' } });
      const installation = await prisma.pluginInstallation.create({ data: { pluginSlug: slug, instanceKey: 'default', enabled: true } });
      scope = pluginProtectionScope(installation.id, installation.protectionGeneration);
      const user = await createTestUser(); userId = user.id;
      const order = await createTestOrder({ userId, total: 10 }); orderId = order.id;
      await prisma.order.update({ where: { id: orderId }, data: { paymentMethod: slug } });
      const payment = await prisma.payment.create({ data: { orderId, paymentMethod: slug, amount: 10, sessionId: randomUUID(), status: 'PENDING', createdAt: new Date(Date.now() - 6 * 24 * 60 * 60000) } });
      await relay.drop();
      const unavailable = await command(child, { kind: 'reconcile' });
      expect(unavailable.result).toEqual({ scanned: 1, updated: 0, failed: 0, skipped: 1 });
      expect(unavailable.state.tasks.paymentReconciliation).toBe(true); expect(child.exitCode).toBeNull();
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('PENDING');
      expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).paymentStatus).toBe('PENDING');
      expect((await prisma.pluginInstallation.findUniqueOrThrow({ where: { id: installation.id } })).lastFailureMessage).toBeNull();
      expect(await client.zcard(`${scope}:samples`)).toBe(0); expect(await client.zcard(`${scope}:failures`)).toBe(0);
      await expect(fs.readFile(marker, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
      await relay.recover(2);
      const recovered = await command(child, { kind: 'reconcile', offsetMs: 61_000 });
      expect(recovered.result).toEqual({ scanned: 1, updated: 1, failed: 0, skipped: 0 });
      expect(child.exitCode).toBeNull();
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('SUCCEEDED');
      expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).paymentStatus).toBe('PAID');
      expect(await client.zcard(`${scope}:samples`)).toBe(1); expect(await client.zcard(`${scope}:failures`)).toBe(0);
      expect(await fs.readFile(marker, 'utf8')).toBe('invoked\n');
    } finally {
      if (child.connected) child.send({ kind: 'stop' });
      const [code] = await exited; expect(code).toBe(0);
      await relay.drop();
      const keys = await client.keys(`${namespace}:*`); if (scope) keys.push(...await client.keys(`${scope}:*`)); if (heartbeatKey) keys.push(heartbeatKey);
      if (keys.length) await client.del(...keys); client.disconnect();
      if (orderId) { await prisma.notification.deleteMany({ where: { relatedId: orderId } }); await prisma.payment.deleteMany({ where: { orderId } }); await prisma.order.delete({ where: { id: orderId } }); }
      if (userId) await deleteTestUser(userId);
      await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: slug } }); await prisma.pluginInstall.deleteMany({ where: { slug } });
      await clearTestPluginCache(slug); await restoreBuiltinRows(before, slugs); await fs.rm(directory, { recursive: true, force: true });
    }
  });
});
