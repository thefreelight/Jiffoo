import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { fork, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@/config/database';
import { emitEvent } from '@/infra/events/emit';
import { incrementPluginRegistryVersion } from '@/core/admin/extension-installer/plugin-registry-version';
import { pluginFsInstaller } from '@/core/admin/extension-installer/plugin-fs-installer';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, deleteAllTestUsers } from '../helpers/auth';
import { installFixturePlugin } from '../helpers/fixture-plugin';
import { clearTestPluginCache } from '../helpers/plugin-cache';

const httpSource = (tag: string) => `module.exports = { register(ctx) {
  ctx.http.route({ method: 'GET', path: '/status', handler: () => ({ tag: '${tag}' }) });
} };`;
const eventSource = `const fs = require('fs'); module.exports = { register(ctx) {
  ctx.events.subscribe('order.created', 1, async (event) => {
    fs.writeFileSync(ctx.config.directory + '/' + event.id + '.effect', event.id);
  });
} };`;
const combinedSource = `const fs = require('fs'); module.exports = { register(ctx) {
  ctx.http.route({ method: 'GET', path: '/status', handler: () => ({ tag: 'healthy' }) });
  ctx.contracts.implement('shipping', 1, { quote: () => ({ options: [{ id: 'standard', label: 'Standard', amountMinor: 0 }] }) });
  ctx.events.subscribe('order.created', 1, async (event) => {
    fs.writeFileSync(ctx.config.directory + '/' + event.id + '.effect', event.id);
  });
} };`;

type Started = { child: ChildProcess; root: string; messages: any[]; base?: string; output: string[] };

describe('startup plugin package prewarm', () => {
  let app: FastifyInstance;
  let token: string;
  let userId: string;
  const slugs: string[] = [];
  const events: string[] = [];
  const started: Started[] = [];

  beforeEach(async () => {
    app = await createTestApp({ disableRedis: false });
    const admin = await createAdminWithToken();
    token = admin.token;
    userId = admin.user.id;
  });

  afterEach(async () => {
    for (const item of started.splice(0)) {
      if (item.child.connected) {
        const exited = once(item.child, 'exit');
        item.child.send({ kind: 'stop' });
        await exited;
      }
      await fs.rm(item.root, { recursive: true, force: true });
    }
    await prisma.eventDelivery.deleteMany({ where: { eventId: { in: events } } });
    await prisma.eventRecord.deleteMany({ where: { id: { in: events.splice(0) } } });
    for (const slug of slugs.splice(0)) {
      await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: slug } });
      await prisma.pluginInstall.deleteMany({ where: { slug } });
      await clearTestPluginCache(slug);
    }
    await deleteAllTestUsers();
    await app.close();
  });

  async function install(source: string, subscription = false, config?: Record<string, unknown>, shipping = false): Promise<string> {
    const slug = `prewarm-${randomUUID().slice(0, 12)}`;
    slugs.push(slug);
    await installFixturePlugin({ app, adminToken: token, adminUserId: userId }, slug, shipping ? 'shipping' : 'integration', shipping ? [{ name: 'shipping', version: 1 }] : [], source, {
      subscriptions: subscription ? [{ type: 'order.created', version: 1 }] : [],
      config,
    });
    return slug;
  }

  async function start(role: 'api' | 'worker'): Promise<Started> {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), `startup-${role}-`));
    expect(await fs.readdir(root)).toEqual([]);
    const child = fork(path.resolve('tests/helpers/startup-prewarm-child.ts'), [role], {
      execArgv: ['--import', 'tsx'], stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: {
        ...process.env, NODE_ENV: 'test', EXTENSIONS_PATH: root,
        JIFFOO_TEST_PLUGIN_MATERIALIZE_OBSERVE: '1',
        JIFFOO_TEST_PLUGIN_PREWARM_OBSERVE: '1',
        JIFFOO_TEST_EVENT_CLAIM_OBSERVE: '1',
      },
    });
    const item: Started = { child, root, messages: [], output: [] };
    started.push(item);
    child.stdout?.on('data', (data) => item.output.push(data.toString()));
    child.stderr?.on('data', (data) => item.output.push(data.toString()));
    const ready = new Promise<any>((resolve, reject) => {
      child.on('message', (message: any) => {
        item.messages.push(message);
        if (message?.kind === 'ready') resolve(message);
        if (message?.kind === 'error') reject(new Error(message.message));
      });
      child.once('exit', (code) => reject(new Error(`Startup child exited ${code}`)));
      child.once('error', reject);
    });
    try {
      item.base = (await ready).base;
      return item;
    } catch (error) {
      throw new Error(`${String(error)}\n${item.output.join('')}`);
    }
  }

  const index = (item: Started, kind: string, slug?: string) =>
    item.messages.findIndex((message) => message.kind === kind && (!slug || message.slug === slug));
  const local = (item: Started, slug: string, hash: string) =>
    fs.readFile(path.join(item.root, 'plugins', slug, hash, '.complete.json'), 'utf8');
  async function operation(item: Started, kind: 'call-contract' | 'deliver-event', details: Record<string, unknown>): Promise<any> {
    const requestId = randomUUID();
    const result = new Promise<any>((resolve, reject) => {
      const receive = (message: any) => {
        if (message.kind !== 'operation-result' || message.requestId !== requestId) return;
        item.child.off('message', receive);
        if (message.error) reject(new Error(message.error));
        else resolve(message.result);
      };
      item.child.on('message', receive);
      item.child.once('exit', (code) => reject(new Error(`Child exited during ${kind}: ${code}`)));
    });
    item.child.send({ kind, requestId, ...details });
    return result;
  }

  it('D a real API starts with an empty root, prewarms the remote package before its first request, and does not rematerialize', async () => {
    const slug = await install(httpSource('ready'));
    const hash = (await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } })).zipHash!;
    const item = await start('api');
    expect(index(item, 'plugin-materialize-read', slug)).toBeGreaterThanOrEqual(0);
    expect(index(item, 'plugin-materialize-read', slug)).toBeLessThan(index(item, 'plugin-prewarm-complete'));
    expect(index(item, 'plugin-prewarm-complete')).toBeLessThan(index(item, 'ready'));
    expect(await local(item, slug, hash)).toBe(JSON.stringify({ slug, zipHash: hash }));
    const before = item.messages.filter((message) => message.kind === 'plugin-materialize-read').length;
    const response = await fetch(`${item.base}/api/v1/extensions/plugin/${slug}/api/status`, { headers: { connection: 'close' } });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ tag: 'ready' });
    expect(item.messages.filter((message) => message.kind === 'plugin-materialize-read')).toHaveLength(before);
  });

  it('E a real API continues past one corrupt blob, prewarms the healthy plugin, and reports corruption on call', async () => {
    const healthy = await install(httpSource('healthy'));
    const corrupt = await install(httpSource('corrupt'));
    const healthyHash = (await prisma.pluginInstall.findUniqueOrThrow({ where: { slug: healthy } })).zipHash!;
    await prisma.pluginPackageBlob.update({
      where: { pluginSlug_zipHash: { pluginSlug: corrupt, zipHash: (await prisma.pluginInstall.findUniqueOrThrow({ where: { slug: corrupt } })).zipHash! } },
      data: { bytes: Buffer.from('corrupt') },
    });
    const item = await start('api');
    expect(index(item, 'plugin-prewarm-complete')).toBeLessThan(index(item, 'ready'));
    expect(await local(item, healthy, healthyHash)).toBe(JSON.stringify({ slug: healthy, zipHash: healthyHash }));
    const good = await fetch(`${item.base}/api/v1/extensions/plugin/${healthy}/api/status`, { headers: { connection: 'close' } });
    expect(good.status).toBe(200);
    const bad = await fetch(`${item.base}/api/v1/extensions/plugin/${corrupt}/api/status`, { headers: { connection: 'close' } });
    expect(bad.status).toBe(500);
    expect(await bad.json()).toMatchObject({ error: { code: 'PLUGIN_PACKAGE_CORRUPT' } });
  });

  it('F a real worker prewarms from an empty root before its first claim and delivers the event', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'prewarm-effect-'));
    try {
      const slug = await install(eventSource, true, { directory });
      const row = await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } });
      const installation = await prisma.pluginInstallation.findUniqueOrThrow({
        where: { pluginSlug_instanceKey: { pluginSlug: slug, instanceKey: 'default' } },
      });
      const event = await prisma.$transaction((tx) => emitEvent(tx, 'order.created', 1, randomUUID(),
        { id: 'snapshot-order', userId: 'snapshot-user', totalAmount: 10, currency: 'USD', items: [] }));
      events.push(event.id);
      const item = await start('worker');
      expect(index(item, 'plugin-materialize-read', slug)).toBeGreaterThanOrEqual(0);
      expect(index(item, 'plugin-materialize-read', slug)).toBeLessThan(index(item, 'plugin-prewarm-complete'));
      expect(index(item, 'plugin-prewarm-complete')).toBeLessThan(index(item, 'event-claim-start'));
      expect(await local(item, slug, row.zipHash!)).toBe(JSON.stringify({ slug, zipHash: row.zipHash }));
      const stop = once(item.child, 'exit');
      item.child.send({ kind: 'stop' });
      await stop;
      expect((await prisma.eventDelivery.findUniqueOrThrow({
        where: { eventId_installationId: { eventId: event.id, installationId: installation.id } },
      })).status).toBe('SUCCEEDED');
      expect(await fs.readFile(path.join(directory, `${event.id}.effect`), 'utf8')).toBe(event.id);
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });

  it('G isolates a corrupt plugin after a running-process registry change so healthy gateway, contract, and event calls succeed', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'contained-effect-'));
    try {
      const healthy = await install(combinedSource, true, { directory }, true);
      const corrupt = await install(httpSource('corrupt'));
      const corruptRow = await prisma.pluginInstall.findUniqueOrThrow({ where: { slug: corrupt } });
      await prisma.pluginPackageBlob.update({
        where: { pluginSlug_zipHash: { pluginSlug: corrupt, zipHash: corruptRow.zipHash! } },
        data: { bytes: Buffer.from('corrupt') },
      });
      const item = await start('api');
      await prisma.$transaction((tx) => incrementPluginRegistryVersion(tx));
      const good = await fetch(`${item.base}/api/v1/extensions/plugin/${healthy}/api/status`, { headers: { connection: 'close' } });
      expect(good.status).toBe(200);
      expect(await good.json()).toMatchObject({ tag: 'healthy' });
      expect(await operation(item, 'call-contract', { slug: healthy })).toMatchObject({ options: [{ id: 'standard' }] });
      const instance = await prisma.pluginInstallation.findUniqueOrThrow({
        where: { pluginSlug_instanceKey: { pluginSlug: healthy, instanceKey: 'default' } },
      });
      const event = { id: randomUUID(), type: 'order.created', version: 1, aggregateId: 'order', occurredAt: new Date().toISOString(),
        attempt: 1, data: { id: 'order', userId: 'user', totalAmount: 10, currency: 'USD', items: [] } };
      expect(await operation(item, 'deliver-event', { installationId: instance.id, event })).toBeNull();
      expect(await fs.readFile(path.join(directory, `${event.id}.effect`), 'utf8')).toBe(event.id);
      const bad = await fetch(`${item.base}/api/v1/extensions/plugin/${corrupt}/api/status`, { headers: { connection: 'close' } });
      expect(bad.status).toBe(500);
      expect(await bad.json()).toMatchObject({ error: { code: 'PLUGIN_PACKAGE_CORRUPT' } });
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });

  it('H memoizes a corrupt slug and hash for one registry version with exactly one blob read', async () => {
    const corrupt = await install(httpSource('corrupt'));
    const row = await prisma.pluginInstall.findUniqueOrThrow({ where: { slug: corrupt } });
    await prisma.pluginPackageBlob.update({
      where: { pluginSlug_zipHash: { pluginSlug: corrupt, zipHash: row.zipHash! } },
      data: { bytes: Buffer.from('corrupt') },
    });
    const item = await start('api');
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(`${item.base}/api/v1/extensions/plugin/${corrupt}/api/status`, { headers: { connection: 'close' } });
      expect(response.status).toBe(500);
      expect(await response.json()).toMatchObject({ error: { code: 'PLUGIN_PACKAGE_CORRUPT' } });
    }
    expect(item.messages.filter((message) => message.kind === 'plugin-materialize-read' && message.slug === corrupt)).toHaveLength(1);
  });

  it('I retries a missing blob and runs after a same-ZIP re-upload repairs it without restarting', async () => {
    const slug = await install(httpSource('repaired'));
    const row = await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } });
    const blob = await prisma.pluginPackageBlob.findUniqueOrThrow({
      where: { pluginSlug_zipHash: { pluginSlug: slug, zipHash: row.zipHash! } },
    });
    await prisma.pluginPackageBlob.delete({ where: { id: blob.id } });
    const item = await start('api');
    const missing = await fetch(`${item.base}/api/v1/extensions/plugin/${slug}/api/status`, { headers: { connection: 'close' } });
    expect(missing.status).toBe(503);
    expect(await missing.json()).toMatchObject({ error: { code: 'PLUGIN_PACKAGE_UNAVAILABLE' } });
    const before = (await prisma.systemSettings.findUniqueOrThrow({ where: { id: 'system' } })).pluginRegistryVersion;
    await pluginFsInstaller.install(Readable.from(Buffer.from(blob.bytes)), { confirmUnsigned: true, actorUserId: userId });
    expect((await prisma.systemSettings.findUniqueOrThrow({ where: { id: 'system' } })).pluginRegistryVersion).toBeGreaterThan(before);
    const repaired = await fetch(`${item.base}/api/v1/extensions/plugin/${slug}/api/status`, { headers: { connection: 'close' } });
    expect(repaired.status).toBe(200);
    expect(await repaired.json()).toMatchObject({ tag: 'repaired' });
  });
});
