import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { fork, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@/config/database';
import { emitEvent, syncEventSubscriptions } from '@/infra/events/emit';
import { EventDeliveryEngine, claimEventDeliveries, recoverEventLeases, CLAIM_EVENT_DELIVERIES_SQL, EVENT_CLAIM_PLANNER_SQL, EVENT_HANDLER_TIMEOUT_MS, EVENT_RETRY_SECONDS } from '@/infra/events/delivery';
import { cleanupEvents } from '@/infra/events/cleanup';
import { startWorkerRuntime } from '@/worker-runtime';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';
import { publishTestPlugin } from '../helpers/plugin-cache';
import { dropInternalRuntime } from '@/core/admin/extension-installer/plugin-runtime';
import { hasEventHandler } from '@/core/admin/extension-installer/contract-v1-runtime';
import { eventRegistry, getPluginManifestIssues, type EventKey, type EventSubscription } from '@jiffoo/shared';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createUserWithToken, deleteTestUser } from '../helpers/auth';
import { createTestProduct, deleteTestProduct } from '../helpers/fixtures';
import { checkoutTotal } from '../helpers/checkout-total';
import { installFixturePlugin, removeFixturePlugin } from '../helpers/fixture-plugin';
import { syncBuiltinPlugins } from '@/core/admin/extension-installer/builtin-sync';
import { callContract, deliverInstallationEvent } from '@/core/admin/extension-installer/plugin-runtime';
import { ensurePluginRegistryFresh } from '@/core/admin/extension-installer/plugin-registry-freshness';
import { snapshotPluginRows, restoreBuiltinRows, assertPluginRowsUnchanged } from '../helpers/plugin-db-snapshot';

const subscriptions: EventSubscription[] = [{ type: 'order.created', version: 1 }];
const payload = { id: 'snapshot-order', userId: 'snapshot-user', totalAmount: 10, currency: 'USD', items: [] };
const fixtureSource = `
const fs = require('fs');
const path = require('path');
module.exports = { register(ctx) {
  ctx.events.subscribe('order.created', 1, async (event) => {
    const directory = ctx.config.directory;
    if (directory) {
      const target = path.join(directory, ctx.plugin.installationId + '-' + event.id + '.effect');
      try {
        const fd = fs.openSync(target, 'wx');
        try { fs.writeFileSync(fd, JSON.stringify({ id: event.id, data: event.data })); fs.fsyncSync(fd); }
        finally { fs.closeSync(fd); }
      } catch (error) { if (error.code !== 'EEXIST') throw error; }
      fs.appendFileSync(path.join(directory, 'attempts.log'), JSON.stringify({ eventId: event.id, installationId: ctx.plugin.installationId, attempt: event.attempt }) + '\\n');
    }
    if (process.send) process.send({ kind: 'entered', installationId: ctx.plugin.installationId, eventId: event.id, attempt: event.attempt });
    if (ctx.config.block) await new Promise((resolve) => {
      const listener = (message) => {
        if (message.command === 'release' && message.installationId === ctx.plugin.installationId) {
          process.off('message', listener); resolve();
        }
      };
      process.on('message', listener);
    });
    if (ctx.config.hang) await new Promise(() => {});
    if (ctx.config.fail || (ctx.config.failFirst && event.attempt === 1)) throw new Error('fixture handler failure');
    if (process.send) process.send({ kind: 'completed', installationId: ctx.plugin.installationId, eventId: event.id });
  });
} };`;

type Message = { kind: string; requestId?: string; count?: number; message?: string; installationId?: string; eventId?: string; attempt?: number };

describe('durable plugin event delivery', () => {
  let app: FastifyInstance;
  let options: { app: FastifyInstance; adminToken: string; adminUserId: string };
  let directory: string;
  const slugs: string[] = [];
  const eventIds: string[] = [];
  const users: string[] = [];
  const products: string[] = [];
  let pluginRowsBefore: Awaited<ReturnType<typeof snapshotPluginRows>>;
  const children: Array<{ child: ChildProcess; exited: Promise<unknown[]>; output: { stdout: string; stderr: string } }> = [];

  beforeEach(async () => {
    pluginRowsBefore = await snapshotPluginRows();
    app = await createTestApp({ disableRedis: false });
    const admin = await createAdminWithToken();
    users.push(admin.user.id);
    options = { app, adminToken: admin.token, adminUserId: admin.user.id };
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'durable-event-fixture-'));
  });

  afterEach(async () => {
    for (const { child, exited } of children.splice(0)) {
      if (child.connected) child.send({ command: 'stop', requestId: randomUUID() });
      await exited;
    }
    await prisma.eventDelivery.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.eventRecord.deleteMany({ where: { id: { in: eventIds.splice(0) } } });
    for (const slug of slugs.splice(0)) {
      const instances = await prisma.pluginInstallation.findMany({ where: { pluginSlug: slug } });
      for (const instance of instances) await dropInternalRuntime(instance.id);
      await removeFixturePlugin(options, slug);
    }
    for (const id of users.splice(0)) await deleteTestUser(id);
    for (const id of products.splice(0)) await deleteTestProduct(id);
    await app.close();
    await fs.rm(directory, { recursive: true, force: true });
    const builtinSlugs = (await fs.readdir(path.resolve('builtin-plugins'), { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    await restoreBuiltinRows({
      installs: pluginRowsBefore.installs.filter((row) => builtinSlugs.includes(row.slug)),
      blobs: pluginRowsBefore.blobs.filter((row) => builtinSlugs.includes(row.pluginSlug)),
      installations: pluginRowsBefore.installations.filter((row) => builtinSlugs.includes(row.pluginSlug)),
    }, builtinSlugs);
    await assertPluginRowsUnchanged(pluginRowsBefore);
  });

  async function plugin(config: Record<string, unknown> = {}, source = fixtureSource, declarations = subscriptions, enable = true) {
    const slug = `evt-${randomUUID().slice(0, 12)}`;
    slugs.push(slug);
    await installFixturePlugin(options, slug, 'integration', [], source, { subscriptions: declarations, config: { directory, ...config }, enable });
    return prisma.pluginInstallation.findUniqueOrThrow({ where: { pluginSlug_instanceKey: { pluginSlug: slug, instanceKey: 'default' } } });
  }

  async function emit() {
    const event = await prisma.$transaction((tx) => emitEvent(tx, 'order.created', 1, randomUUID(), payload));
    eventIds.push(event.id);
    return event;
  }
  const delivery = (eventId: string, installationId: string) => prisma.eventDelivery.findUniqueOrThrow({ where: { eventId_installationId: { eventId, installationId } } });
  async function expectDelivery(
    row: Awaited<ReturnType<typeof delivery>>,
    expected: Partial<Awaited<ReturnType<typeof delivery>>>,
  ) {
    try {
      expect(row).toMatchObject(expected);
    } catch (error) {
      const installation = await prisma.pluginInstallation.findUnique({ where: { id: row.installationId } });
      const slug = installation?.pluginSlug;
      const plugin = slug ? await prisma.pluginInstall.findUnique({ where: { slug } }) : null;
      const registry = await prisma.systemSettings.findUnique({ where: { id: 'system' } });
      const root = process.env.EXTENSIONS_PATH || path.join(process.cwd(), 'extensions');
      const cachePath = slug ? path.join(root, 'plugins', slug) : null;
      const entries = cachePath
        ? await fs.readdir(cachePath, { withFileTypes: true }).then((items) => items.map((item) => item.name))
          .catch((failure: NodeJS.ErrnoException) => [`${failure.code}: ${failure.message}`])
        : null;
      const scene = { expected, row, plugin, registryVersion: registry?.pluginRegistryVersion, cachePath, entries,
        workers: children.map(({ child, output }) => ({ pid: child.pid, ...output })) };
      throw new Error(`Delivery assertion failed: ${JSON.stringify(scene)}\n${String(error)}`);
    }
  }
  async function due(id: string) {
    await prisma.$executeRaw`UPDATE event_deliveries SET "nextAttemptAt" = statement_timestamp() WHERE id = ${id}`;
  }
  async function run(engine = new EventDeliveryEngine(randomUUID())) {
    await engine.runOnce();
    await engine.drain();
    return engine;
  }
  function wait(child: ChildProcess, kind: string, requestId?: string, installationId?: string): Promise<Message> {
    return new Promise((resolve, reject) => {
      const listener = (message: Message) => {
        if (message.kind === 'error' && message.requestId === requestId) { cleanup(); reject(new Error(message.message)); }
        else if (message.kind === kind && (!requestId || message.requestId === requestId) && (!installationId || message.installationId === installationId)) { cleanup(); resolve(message); }
      };
      const exit = (code: number | null) => { cleanup(); reject(new Error(`Worker exited before ${kind}: ${code}`)); };
      const cleanup = () => { child.off('message', listener); child.off('exit', exit); };
      child.on('message', listener);
      child.once('exit', exit);
    });
  }
  async function child(timeoutMs = EVENT_HANDLER_TIMEOUT_MS, extensionsRoot?: string) {
    const process = fork(path.resolve('tests/helpers/event-worker-child.ts'), [], {
      execArgv: ['--import', 'tsx'], stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: {
        ...globalThis.process.env, DATABASE_URL: globalThis.process.env.DATABASE_URL_TEST,
        EVENT_TEST_TIMEOUT_MS: String(timeoutMs),
        ...(extensionsRoot ? {
          EXTENSIONS_PATH: extensionsRoot, JIFFOO_TEST_ISOLATED_PLUGIN_ROOT: '1',
          JIFFOO_TEST_BUILTIN_SOURCE_ROOT: path.resolve(globalThis.process.env.EXTENSIONS_PATH || 'extensions'),
        } : {}),
      },
    });
    const output = { stdout: '', stderr: '' };
    process.stdout?.on('data', (data) => { output.stdout += data.toString(); });
    process.stderr?.on('data', (data) => { output.stderr += data.toString(); });
    const exited = once(process, 'exit');
    children.push({ child: process, exited, output });
    await wait(process, 'ready');
    return process;
  }
  function command(process: ChildProcess, action = 'run') {
    const requestId = randomUUID();
    const claimed = wait(process, 'claimed', requestId);
    const done = wait(process, 'done', requestId);
    // The handler barrier may deliberately outlive the child.
    void done.catch(() => undefined);
    process.send({ command: action, requestId });
    return { claimed, done };
  }
  async function attempts() {
    return (await fs.readFile(path.join(directory, 'attempts.log'), 'utf8')).trim().split('\n').map((line) => JSON.parse(line) as { eventId: string; installationId: string; attempt: number });
  }

  it('J: a missing current package and blob returns 503 and event delivery retries', async () => {
    const installation = await plugin();
    const row = await prisma.pluginInstall.findUniqueOrThrow({ where: { slug: installation.pluginSlug } });
    const pkg = await pluginPackageStore.get(installation.pluginSlug, row.zipHash!);
    await fs.rm(pkg!.getEntryPath(''), { recursive: true, force: true });
    await prisma.pluginPackageBlob.deleteMany({ where: { pluginSlug: installation.pluginSlug, zipHash: row.zipHash! } });
    const response = await app.inject({ method: 'GET', url: `/api/v1/extensions/plugin/${installation.pluginSlug}/api/status` });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('PLUGIN_PACKAGE_UNAVAILABLE');
    const event = await emit();
    await run();
    const result = await delivery(event.id, installation.id);
    await expectDelivery(result, { status: 'PENDING', attempts: 1 });
    expect(result.lastError).toContain('PLUGIN_PACKAGE_UNAVAILABLE');
  });

  it('F: a real worker with an empty package root materializes the ZIP and delivers an event', async () => {
    const installation = await plugin();
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'worker-empty-packages-'));
    try {
      expect(await fs.readdir(root)).toEqual([]);
      const event = await emit();
      const worker = await child(EVENT_HANDLER_TIMEOUT_MS, root);
      const operation = command(worker);
      await operation.claimed;
      await operation.done;
      await expectDelivery(await delivery(event.id, installation.id), { status: 'SUCCEEDED', attempts: 1 });
      expect(await fs.readFile(path.join(directory, `${installation.id}-${event.id}.effect`), 'utf8')).toContain(event.id);
      expect(await fs.access(path.join(root, 'plugins', installation.pluginSlug))).toBeUndefined();
    } finally {
      for (const item of children.splice(0)) {
        if (item.child.connected) item.child.send({ command: 'stop', requestId: randomUUID() });
        await item.exited;
      }
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('H: a real worker delivers each new business event once to a plugin subscribed to all four types', async () => {
    const types = ['customer.created', 'product.created', 'product.updated', 'order.fulfilled'] as const;
    const source = `const fs = require('fs'); const path = require('path');
module.exports = { register(ctx) {
  for (const type of ${JSON.stringify(types)}) ctx.events.subscribe(type, 1, async (event) => {
    fs.writeFileSync(path.join(ctx.config.directory, event.type + '-' + event.id + '.effect'), JSON.stringify(event.data), { flag: 'wx' });
  });
} };`;
    const installation = await plugin({}, source, types.map((type) => ({ type, version: 1 })));
    const email = `subscriber-${randomUUID()}@example.com`;
    const registered = await app.inject({
      method: 'POST', url: '/api/v1/auth/register',
      payload: { email, username: `subscriber-${randomUUID().slice(0, 8)}`, password: 'Test123456!' },
    });
    expect(registered.statusCode).toBe(201);
    const userId = registered.json().data.user.id as string;
    users.push(userId);
    const created = await app.inject({
      method: 'POST', url: '/api/v1/admin/products', headers: { authorization: `Bearer ${options.adminToken}` },
      payload: { name: `Event ${randomUUID()}`, variants: [{ name: 'Single', stock: 3, salePrice: 10 }] },
    });
    expect(created.statusCode).toBe(201);
    const productId = created.json().data.id as string;
    products.push(productId);
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { productId } });
    const updated = await app.inject({
      method: 'PUT', url: `/api/v1/admin/products/${productId}`,
      headers: { authorization: `Bearer ${options.adminToken}` },
      payload: { name: 'Updated event product', variants: [{ id: variant.id, name: 'Single', stock: 3, salePrice: 10 }] },
    });
    expect(updated.statusCode).toBe(200);
    const order = await prisma.order.create({
      data: {
        userId, status: 'PROCESSING', paymentStatus: 'PAID', subtotalAmount: 10, totalAmount: 10,
        items: { create: { productId, variantId: variant.id, quantity: 1, unitPrice: 10 } },
      },
    });
    const shipped = await app.inject({
      method: 'POST', url: `/api/v1/admin/orders/${order.id}/ship`,
      headers: { authorization: `Bearer ${options.adminToken}` },
      payload: { carrier: 'UPS', trackingNumber: 'EVENT-1' },
    });
    expect(shipped.statusCode).toBe(200);
    const records = await prisma.eventRecord.findMany({
      where: { OR: [{ aggregateId: userId }, { aggregateId: productId }, { aggregateId: order.id }] },
    });
    eventIds.push(...records.map(({ id }) => id));
    expect(records.map(({ type }) => type).sort()).toEqual([...types].sort());
    const worker = await child();
    await command(worker, 'drain-all').done;
    for (const record of records) {
      eventRegistry[record.type as EventKey].parse(record.data);
      const delivered = await prisma.eventDelivery.findUniqueOrThrow({
        where: { eventId_installationId: { eventId: record.id, installationId: installation.id } },
      });
      await expectDelivery(delivered, { status: 'SUCCEEDED', attempts: 1 });
      expect(JSON.parse(await fs.readFile(path.join(directory, `${record.type}-${record.id}.effect`), 'utf8'))).toEqual(record.data);
    }
    expect((await fs.readdir(directory)).filter((name) => name.endsWith('.effect'))).toHaveLength(4);
    await prisma.order.delete({ where: { id: order.id } });
  });

  it('A: writes business state, one event and subscribed deliveries in the same transaction and rolls them back together', async () => {
    const first = await plugin();
    const second = await plugin();
    await plugin({}, 'module.exports = { register() {} };', []);
    const disabled = await plugin({}, fixtureSource, subscriptions, false);
    const original = await prisma.user.findUniqueOrThrow({ where: { id: options.adminUserId } });
    const event = await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: original.id }, data: { username: `business-${randomUUID()}` } });
      return emitEvent(tx, 'order.created', 1, original.id, payload);
    });
    eventIds.push(event.id);
    expect((await prisma.eventDelivery.findMany({ where: { eventId: event.id } })).map((row) => row.installationId).sort()).toEqual([first.id, second.id].sort());
    expect(await prisma.eventDelivery.count({ where: { eventId: event.id, installationId: disabled.id } })).toBe(0);
    let rolledBackId = '';
    const committedName = (await prisma.user.findUniqueOrThrow({ where: { id: original.id } })).username;
    await expect(prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: original.id }, data: { username: 'must-rollback' } });
      rolledBackId = (await emitEvent(tx, 'order.created', 1, original.id, payload)).id;
      throw new Error('rollback business');
    })).rejects.toThrow('rollback business');
    expect(await prisma.eventRecord.count({ where: { id: rolledBackId } })).toBe(0);
    expect(await prisma.eventDelivery.count({ where: { eventId: rolledBackId } })).toBe(0);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: original.id } })).username).toBe(committedName);
  });

  it('B: a real event INSERT failure aborts HTTP order creation and rolls back stock, order and notification writes', async () => {
    let constraintAdded = false;
    let buyerId: string | undefined;
    let responseBody: unknown;
    try {
      await syncBuiltinPlugins(path.resolve('builtin-plugins'));
      const buyer = await createUserWithToken(); users.push(buyer.user.id);
      buyerId = buyer.user.id;
      const product = await createTestProduct({ stock: 5, price: 10 }); products.push(product.id);
      const items = [{ productId: product.id, variantId: product.variants[0].id, quantity: 1 }];
      const address = { firstName: 'Test', lastName: 'Buyer', phone: '+1', addressLine1: '1 Test St', city: 'Toronto', state: 'ON', postalCode: 'M5V 2T6', country: 'CA' };
      const total = await checkoutTotal(app, buyer.token, items, address, 'free-shipping:free');
      await prisma.$executeRawUnsafe(`ALTER TABLE event_records ADD CONSTRAINT event_test_rejection CHECK (data->>'userId' <> '${buyer.user.id}')`);
      constraintAdded = true;
      const response = await app.inject({
        method: 'POST', url: '/api/v1/orders', headers: buyer.authHeader,
        payload: { items, shippingAddress: address, shippingOptionId: 'free-shipping:free', paymentMethod: 'manual-payment', expectedTotal: total },
      });
      responseBody = { statusCode: response.statusCode, body: response.body };
      expect(response.statusCode).toBe(500);
      expect(response.json().success).toBe(false);
      expect(await prisma.order.count({ where: { userId: buyer.user.id } })).toBe(0);
      expect(await prisma.eventRecord.count({ where: { data: { path: ['userId'], equals: buyer.user.id } } })).toBe(0);
      expect(await prisma.notification.count({ where: { toAddress: buyer.user.email } })).toBe(0);
      expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: product.variants[0].id } })).stock).toBe(5);
    } catch (error) {
      const plugins = await prisma.pluginInstall.findMany({
        where: { slug: { in: ['free-shipping', 'manual-payment'] } },
        select: { slug: true, zipHash: true, version: true },
      });
      const registry = await prisma.systemSettings.findUnique({ where: { id: 'system' } });
      const root = process.env.EXTENSIONS_PATH || path.join(process.cwd(), 'extensions');
      const cache = await Promise.all(plugins.map(async (plugin) => ({
        slug: plugin.slug, zipHash: plugin.zipHash,
        entries: await fs.readdir(path.join(root, 'plugins', plugin.slug)).catch((failure: NodeJS.ErrnoException) => [`${failure.code}: ${failure.message}`]),
      })));
      const orders = buyerId ? await prisma.order.findMany({ where: { userId: buyerId } }) : [];
      const events = buyerId ? await prisma.eventRecord.findMany({ where: { data: { path: ['userId'], equals: buyerId } } }) : [];
      throw new Error(`B scene: ${JSON.stringify({ cause: String(error), responseBody, plugins, registryVersion: registry?.pluginRegistryVersion, cache, orders, events })}`);
    } finally {
      if (constraintAdded) await prisma.$executeRawUnsafe('ALTER TABLE event_records DROP CONSTRAINT event_test_rejection');
    }
  });

  it('C: rejects unknown events, unknown versions and invalid payloads before any event or delivery write', async () => {
    const aggregateId = randomUUID();
    await expect(prisma.$transaction((tx) => emitEvent(tx, 'unknown.event' as EventKey, 1, aggregateId, payload))).rejects.toThrow('Unknown event');
    await expect(prisma.$transaction((tx) => emitEvent(tx, 'order.created', 2 as 1, aggregateId, payload))).rejects.toThrow('Unknown event');
    await expect(prisma.$transaction((tx) => emitEvent(tx, 'order.created', 1, aggregateId, { ...payload, totalAmount: Infinity }))).rejects.toThrow();
    await expect(prisma.$transaction((tx) => emitEvent(tx, 'order.created', 1, aggregateId, { ...payload, items: [{ id: 'x', productId: 'x', variantId: 'x', quantity: 1, unitPrice: 1, fulfillmentData: { invalid: () => undefined } }] }))).rejects.toThrow();
    expect(await prisma.eventRecord.count({ where: { aggregateId } })).toBe(0);
  });

  it('D: manifest and handler mismatches fail real plugin enable without publishing candidate handlers', async () => {
    const sources = [
      'module.exports = { register() {} };',
      "module.exports = { register(ctx) { ctx.events.subscribe('order.cancelled', 1, () => {}); } };",
      "module.exports = { register(ctx) { ctx.events.subscribe('order.created', 1, () => {}); ctx.events.subscribe('order.created', 1, () => {}); } };",
    ];
    for (const source of sources) await expect(plugin({}, source)).rejects.toThrow('enable failed');
    for (const slug of slugs) {
      const installation = await prisma.pluginInstallation.findFirstOrThrow({ where: { pluginSlug: slug } });
      expect(installation.enabled).toBe(false);
      expect(hasEventHandler(installation.id, 'order.created', 1)).toBe(false);
    }
    const manifest = { schemaVersion: 1, slug: 'event-validation', name: 'Test', version: '1.0.0', description: '', runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1', entryModule: 'index.js', permissions: [] };
    expect(getPluginManifestIssues({ ...manifest, subscriptions: [{ type: 'unknown', version: 1 }] }).some((issue) => issue.code === 'INVALID_SUBSCRIPTIONS')).toBe(true);
    expect(getPluginManifestIssues({ ...manifest, subscriptions: [subscriptions[0], subscriptions[0]] }).some((issue) => issue.code === 'INVALID_SUBSCRIPTIONS')).toBe(true);
    expect(getPluginManifestIssues({ ...manifest, ['webhooks']: {} }).some((issue) => issue.code === 'MANIFEST_FIELD_REMOVED')).toBe(true);
  });

  it('E: fail-after-effect retries in another worker with the same event ID and exactly one durable effect', async () => {
    const installation = await plugin({ failFirst: true });
    const event = await emit();
    const first = await child();
    await command(first).done;
    const failed = await delivery(event.id, installation.id);
    await expectDelivery(failed, { status: 'PENDING', attempts: 1, lastError: 'fixture handler failure' });
    await due(failed.id);
    const second = await child();
    await command(second).done;
    await expectDelivery(await delivery(event.id, installation.id), { status: 'SUCCEEDED', attempts: 2 });
    expect((await fs.readdir(directory)).filter((name) => name.endsWith('.effect'))).toEqual([`${installation.id}-${event.id}.effect`]);
    expect(JSON.parse(await fs.readFile(path.join(directory, `${installation.id}-${event.id}.effect`), 'utf8'))).toEqual({ id: event.id, data: payload });
    expect(await attempts()).toEqual([
      { eventId: event.id, installationId: installation.id, attempt: 1 },
      { eventId: event.id, installationId: installation.id, attempt: 2 },
    ]);
  });

  it('F: applies all seven retry delays and atomically records the eighth failure on the exact installation', async () => {
    const installation = await plugin({ fail: true });
    const event = await emit();
    for (let attempt = 1; attempt <= 8; attempt++) {
      const [{ before }] = await prisma.$queryRaw<Array<{ before: Date }>>`SELECT clock_timestamp() AS before`;
      await run();
      const [{ after }] = await prisma.$queryRaw<Array<{ after: Date }>>`SELECT clock_timestamp() AS after`;
      const row = await delivery(event.id, installation.id);
      if (attempt < 8) {
        await expectDelivery(row, { status: 'PENDING', attempts: attempt });
        const delay = EVENT_RETRY_SECONDS[attempt - 1] * 1000;
        expect(row.nextAttemptAt.getTime()).toBeGreaterThanOrEqual(before.getTime() + delay - 1);
        expect(row.nextAttemptAt.getTime()).toBeLessThanOrEqual(after.getTime() + delay + 1);
        expect((await prisma.pluginInstallation.findUniqueOrThrow({ where: { id: installation.id } })).lastFailureAt).toBeNull();
        await due(row.id);
      } else {
        await expectDelivery(row, { status: 'FAILED', attempts: attempt });
        expect(row.finishedAt).not.toBeNull();
        expect(await prisma.pluginInstallation.findUniqueOrThrow({ where: { id: installation.id } })).toMatchObject({ lastFailureAt: row.finishedAt, lastFailureMessage: 'fixture handler failure' });
      }
    }
  });

  it('G: a short injected handler timeout counts as a failed attempt without cancelling the handler', async () => {
    const installation = await plugin({ hang: true });
    const event = await emit();
    const process = await child(200);
    await command(process).done;
    await expectDelivery(await delivery(event.id, installation.id), { status: 'PENDING', attempts: 1, lastError: 'Event handler timed out after 200ms' });
  });

  it('H: a blocked installation occupies one slot while another plugin completes in the same worker', async () => {
    const slow = await plugin({ block: true });
    const fast = await plugin();
    const first = await emit();
    await emit();
    const process = await child();
    const entered = wait(process, 'entered', undefined, slow.id);
    const fastCompleted = wait(process, 'completed', undefined, fast.id);
    const batch = command(process);
    await entered;
    await fastCompleted;
    const secondBatch = command(process);
    expect((await secondBatch.claimed).count).toBeLessThanOrEqual(1);
    process.send({ command: 'release', installationId: slow.id });
    await Promise.all([batch.done, secondBatch.done]);
    await expectDelivery(await delivery(first.id, slow.id), { status: 'SUCCEEDED', attempts: 1 });
    await expectDelivery(await delivery(first.id, fast.id), { status: 'SUCCEEDED', attempts: 1 });
    expect((await attempts()).filter((row) => row.installationId === slow.id)).toHaveLength(1);
  });

  it('I: two worker processes claim a batch without attempting any successful delivery twice', async () => {
    const installs = await Promise.all(Array.from({ length: 8 }, () => plugin()));
    const event = await emit();
    const [first, second] = await Promise.all([child(), child()]);
    const firstBatch = command(first);
    const secondBatch = command(second);
    await Promise.all([firstBatch.done, secondBatch.done]);
    const rows = await prisma.eventDelivery.findMany({ where: { eventId: event.id } });
    const claims = await Promise.all([firstBatch.claimed, secondBatch.claimed]);
    const state = JSON.stringify({
      rows: rows.map(({ id, installationId, status, attempts, claimedBy, lastError, finishedAt }) =>
        ({ id, installationId, status, attempts, claimedBy, lastError, finishedAt })),
      claims: claims.map((entry, index) => ({ worker: [first.pid, second.pid][index], count: entry.count })),
    });
    expect(rows, state).toHaveLength(installs.length);
    for (const row of rows) await expectDelivery(row, { status: 'SUCCEEDED', attempts: 1 });
    const log = await attempts();
    expect(log, state).toHaveLength(installs.length);
    expect(new Set(log.map((row) => row.installationId)).size, state).toBe(installs.length);
    expect(log.every((row) => row.eventId === event.id && row.attempt === 1), state).toBe(true);
  });

  it('J: an exited handler lease is recovered and another worker receives the same event ID', async () => {
    const installation = await plugin({ block: true });
    const event = await emit();
    const first = await child();
    const entered = wait(first, 'entered', undefined, installation.id);
    const batch = command(first);
    await entered;
    const exited = children.find((entry) => entry.child === first)!.exited;
    first.send({ command: 'crash' });
    expect((await exited)[0]).toBe(99);
    await expect(batch.done).rejects.toThrow('Worker exited');
    const row = await delivery(event.id, installation.id);
    await prisma.$executeRaw`UPDATE event_deliveries SET "leaseUntil" = statement_timestamp() - interval '1 second' WHERE id = ${row.id}`;
    expect(await recoverEventLeases()).toBe(1);
    await expectDelivery(await delivery(event.id, installation.id), { status: 'PENDING', attempts: 1, lastError: 'Event delivery lease expired' });
    await due(row.id);
    await prisma.pluginInstallation.update({ where: { id: installation.id }, data: { configJson: { directory } } });
    const second = await child();
    await command(second).done;
    await expectDelivery(await delivery(event.id, installation.id), { status: 'SUCCEEDED', attempts: 2 });
    expect((await attempts()).map((entry) => entry.eventId)).toEqual([event.id, event.id]);
  });

  it('K: disabled, deleted and removed subscriptions are permanently skipped even after re-enable', async () => {
    const disabled = await plugin();
    const deleted = await plugin();
    const removed = await plugin();
    const event = await emit();
    const response = await app.inject({ method: 'PATCH', url: `/api/v1/extensions/plugin/${disabled.pluginSlug}/instances/${disabled.id}`, headers: { authorization: `Bearer ${options.adminToken}` }, payload: { enabled: false } });
    expect(response.statusCode).toBe(200);
    await prisma.pluginInstallation.update({ where: { id: deleted.id }, data: { deletedAt: new Date() } });
    await prisma.$transaction((tx) => syncEventSubscriptions(tx, removed.pluginSlug, []));
    await run();
    await expectDelivery(await delivery(event.id, disabled.id), { status: 'SKIPPED', skipReason: 'disabled', attempts: 1 });
    await expectDelivery(await delivery(event.id, deleted.id), { status: 'SKIPPED', skipReason: 'deleted', attempts: 1 });
    await expectDelivery(await delivery(event.id, removed.id), { status: 'SKIPPED', skipReason: 'subscription_removed', attempts: 0 });
    const enabled = await app.inject({ method: 'PATCH', url: `/api/v1/extensions/plugin/${disabled.pluginSlug}/instances/${disabled.id}`, headers: { authorization: `Bearer ${options.adminToken}` }, payload: { enabled: true } });
    expect(enabled.statusCode).toBe(200);
    await run();
    await expectDelivery(await delivery(event.id, disabled.id), { status: 'SKIPPED' });
    expect(await fs.readdir(directory)).toEqual([]);
  });

  it('L: daily cleanup deletes only old finished deliveries and old events with no remaining delivery', async () => {
    const installation = await plugin();
    const states = ['SUCCEEDED', 'SKIPPED', 'FAILED', 'PENDING', 'RUNNING', 'SUCCEEDED'] as const;
    const records = [];
    for (const status of states) {
      const event = await emit(); records.push(event);
      await prisma.$executeRaw`UPDATE event_records SET "occurredAt" = statement_timestamp() - interval '31 days' WHERE id = ${event.id}`;
      await prisma.$executeRaw`UPDATE event_deliveries SET status = ${status}::"EventDeliveryStatus", "finishedAt" = statement_timestamp() - interval '31 days' WHERE "eventId" = ${event.id}`;
    }
    await prisma.$executeRaw`UPDATE event_deliveries SET "finishedAt" = statement_timestamp() WHERE "eventId" = ${records[5].id}`;
    const orphan = await prisma.eventRecord.create({ data: { type: 'order.created', version: 1, aggregateId: 'old-orphan', data: payload, occurredAt: new Date('2000-01-01T00:00:00Z') } }); eventIds.push(orphan.id);
    expect(await cleanupEvents()).toEqual({ deliveries: 3, events: 4 });
    for (const event of records.slice(0, 3)) expect(await prisma.eventRecord.findUnique({ where: { id: event.id } })).toBeNull();
    for (const event of records.slice(3)) expect(await delivery(event.id, installation.id)).not.toBeNull();
  });

  it('M: stale claim tokens cannot write completion and runtime load failures consume retry attempts', async () => {
    const installation = await plugin({ block: true });
    const event = await emit();
    const first = await child();
    const entered = wait(first, 'entered', undefined, installation.id);
    const batch = command(first);
    await entered;
    const claimed = await delivery(event.id, installation.id);
    await expectDelivery(claimed, { status: 'RUNNING' });
    await prisma.$executeRaw`UPDATE event_deliveries SET "leaseUntil" = statement_timestamp() - interval '1 second' WHERE id = ${claimed.id}`;
    await recoverEventLeases();
    await due(claimed.id);
    await prisma.pluginInstallation.update({ where: { id: installation.id }, data: { configJson: { directory } } });
    const second = await child();
    await command(second).done;
    const replacement = await delivery(event.id, installation.id);
    await expectDelivery(replacement, { status: 'SUCCEEDED', attempts: 2, claimToken: null });
    first.send({ command: 'release', installationId: installation.id });
    await batch.done;
    expect(await delivery(event.id, installation.id)).toEqual(replacement);
    const loadEvent = await emit();
    await dropInternalRuntime(installation.id);
    const current = await prisma.pluginInstall.findUniqueOrThrow({ where: { slug: installation.pluginSlug } });
    const pkg = await pluginPackageStore.get(installation.pluginSlug, current.zipHash!);
    const sourceDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'event-bad-entry-'));
    try {
      await fs.cp(pkg!.getEntryPath(''), sourceDirectory, { recursive: true });
      await fs.rm(path.join(sourceDirectory, '.complete.json'));
      await fs.writeFile(path.join(sourceDirectory, 'server/index.js'), 'module.exports = {};');
      const zipHash = await publishTestPlugin(installation.pluginSlug, sourceDirectory);
      await prisma.pluginInstall.update({ where: { slug: installation.pluginSlug }, data: { zipHash } });
    } finally {
      await fs.rm(sourceDirectory, { recursive: true, force: true });
    }
    await run();
    const result = await delivery(loadEvent.id, installation.id);
    await expectDelivery(result, { status: 'PENDING', attempts: 1 });
    expect(result.lastError).toContain('must export an object with register(ctx)');
  });

  it('N: the production handler timeout is 30000 ms and the real worker runtime uses that default', async () => {
    expect(EVENT_HANDLER_TIMEOUT_MS).toBe(30000);
    expect(new EventDeliveryEngine(randomUUID()).timeoutMs).toBe(EVENT_HANDLER_TIMEOUT_MS);
    const runtime = await startWorkerRuntime({ healthPort: 0 });
    try { expect(runtime.state().eventHandlerTimeoutMs).toBe(EVENT_HANDLER_TIMEOUT_MS); }
    finally { await runtime.stop(); }
  });

  it('O: measures the real claim query over 100000 due rows and reports EXPLAIN ANALYZE BUFFERS', async () => {
    const installation = await plugin();
    const prefix = randomUUID();
    await prisma.pluginInstallation.createMany({ data: Array.from({ length: 49 }, (_, index) => ({ id: `${prefix}-installation-${index}`, pluginSlug: installation.pluginSlug, instanceKey: `measure-${index}`, enabled: true })) });
    const installs = await prisma.pluginInstallation.findMany({ where: { pluginSlug: installation.pluginSlug }, orderBy: { id: 'asc' } });
    const event = await prisma.eventRecord.create({ data: { id: prefix, type: 'order.created', version: 1, aggregateId: prefix, data: payload } }); eventIds.push(event.id);
    await prisma.$executeRaw`
      INSERT INTO event_records (id, type, version, "aggregateId", data)
      SELECT ${prefix} || '-event-' || n, 'order.created', 1, ${prefix}, ${JSON.stringify(payload)}::jsonb FROM generate_series(1, 1999) n
    `;
    const seeded = await prisma.$executeRaw`
      INSERT INTO event_deliveries (id, "eventId", "installationId")
      SELECT ${prefix} || '-delivery-' || n,
        CASE WHEN ((n-1)/50) = 0 THEN ${prefix} ELSE ${prefix} || '-event-' || ((n-1)/50)::text END,
        (${installs.map((row) => row.id)}::text[])[((n-1)%50)+1]
      FROM generate_series(1, 100000) n
    `;
    try {
      type PlanNode = {
        'Node Type': string; 'Relation Name'?: string; 'Sort Method'?: string;
        'Actual Rows': number; 'Actual Loops': number; Plans?: PlanNode[];
      };
      type PlanOutput = Array<{ 'QUERY PLAN': Array<{ Plan: PlanNode; 'Execution Time': number }> }>;
      class PlanRollback extends Error {
        constructor(readonly plan: PlanOutput) { super('Rollback measured EXPLAIN'); }
      }
      const measure = async (statistics: string) => {
        let plan: PlanOutput = [];
        const started = performance.now();
        try {
          await prisma.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(EVENT_CLAIM_PLANNER_SQL);
            const output = await tx.$queryRawUnsafe<PlanOutput>(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${CLAIM_EVENT_DELIVERIES_SQL}`, [], 16, 'measurement-plan', randomUUID());
            throw new PlanRollback(output);
          });
        } catch (error) {
          if (!(error instanceof PlanRollback)) throw error;
          plan = error.plan;
        }
        const duration = performance.now() - started;
        const nodes: PlanNode[] = [];
        const visit = (node: PlanNode) => { nodes.push(node); node.Plans?.forEach(visit); };
        visit(plan[0]['QUERY PLAN'][0].Plan);
        const rowsRead = nodes.filter((node) => node['Relation Name'] === 'event_deliveries')
          .reduce((total, node) => total + node['Actual Rows'] * node['Actual Loops'], 0);
        console.log(`EVENT_CLAIM_MEASUREMENT ${JSON.stringify({ statistics, seeded, installations: installs.length, durationMs: duration, rowsRead, plan })}`);
        return { nodes, rowsRead };
      };
      const stale = await measure('before-analyze');
      await prisma.$executeRawUnsafe('ANALYZE event_deliveries');
      const fresh = await measure('after-analyze');
      for (const measured of [stale, fresh]) {
        expect(measured.nodes.filter((node) => node['Relation Name'] === 'event_deliveries' && node['Node Type'] === 'Seq Scan')).toEqual([]);
        expect(measured.nodes.filter((node) => node['Node Type'] === 'Sort' || /external/i.test(node['Sort Method'] ?? ''))).toEqual([]);
        expect(measured.rowsRead).toBeLessThanOrEqual(10 * installs.length);
      }
      const claimed = await claimEventDeliveries('measurement');
      expect(claimed.length).toBeLessThanOrEqual(16);
      expect(claimed.length).toBeGreaterThan(0);
      expect(new Set(claimed.map((row) => row.installationId)).size).toBe(claimed.length);
      for (const row of claimed) await expectDelivery(row, { status: 'RUNNING' });
      expect(claimed.every((row) => !!row.claimToken)).toBe(true);
    } finally {
      await prisma.eventDelivery.deleteMany({ where: { installationId: { in: installs.map((row) => row.id) } } });
      await prisma.eventRecord.deleteMany({ where: { aggregateId: prefix } });
    }
  });

  it('Q: a concurrent registry reconcile cannot remove a resolved event handler', async () => {
    function gate(threshold: number) {
      let enter!: () => void;
      let release!: () => void;
      return {
        threshold, count: 0,
        entered: new Promise<void>((resolve) => { enter = resolve; }),
        released: new Promise<void>((resolve) => { release = resolve; }),
        enter: () => enter(),
        release: () => release(),
      };
    }
    const gates = { active: false, W: gate(2), Z: gate(1) };
    (globalThis as Record<string, unknown>).__eventFreshnessGates = gates;
    const barrierSource = (name: 'W' | 'Z') => `module.exports = { async register() {
      const gates = globalThis.__eventFreshnessGates;
      if (gates?.active) {
        const gate = gates.${name};
        if (++gate.count === gate.threshold) { gate.enter(); await gate.released; }
      }
    } };`;
    try {
      const w = await plugin({}, barrierSource('W'), []);
      const x = await plugin();
      await plugin({}, barrierSource('Z'), []);
      const event = await emit();
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/extensions/plugin/${w.pluginSlug}/instances/${w.id}`,
        headers: { authorization: `Bearer ${options.adminToken}` },
        payload: { config: { generation: randomUUID() } },
      });
      expect(response.statusCode).toBe(200);
      gates.active = true;
      const snapshot = {
        id: event.id, type: 'order.created' as const, version: 1 as const,
        aggregateId: event.aggregateId, occurredAt: event.occurredAt.toISOString(), attempt: 1, data: payload,
      };
      const first = deliverInstallationEvent(x.id, snapshot);
      await gates.Z.entered;
      const second = ensurePluginRegistryFresh();
      gates.Z.release();
      expect(await first).toBeNull();
      await second;
      expect(gates.W.count).toBe(1);
      expect((await attempts()).filter((row) => row.eventId === event.id && row.installationId === x.id)).toHaveLength(1);
    } finally {
      gates.Z.release();
      gates.W.release();
      delete (globalThis as Record<string, unknown>).__eventFreshnessGates;
    }
  });

  it('R: concurrent freshness checks share one full reconcile per registry version', async () => {
    const source = `module.exports = { register(ctx) {
      if (globalThis.__countFreshnessRegisters) {
        require('fs').appendFileSync(require('path').join(ctx.config.directory, 'registers.log'), 'register\\n');
      }
    } };`;
    const installation = await plugin({}, source, []);
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/extensions/plugin/${installation.pluginSlug}/instances/${installation.id}`,
      headers: { authorization: `Bearer ${options.adminToken}` },
      payload: { config: { directory, generation: randomUUID() } },
    });
    expect(response.statusCode).toBe(200);
    (globalThis as Record<string, unknown>).__countFreshnessRegisters = true;
    try {
      await Promise.all(Array.from({ length: 12 }, () => ensurePluginRegistryFresh()));
      expect((await fs.readFile(path.join(directory, 'registers.log'), 'utf8')).trim().split('\n')).toEqual(['register']);
    } finally {
      delete (globalThis as Record<string, unknown>).__countFreshnessRegisters;
    }
  });

  it('S: an in-flight contract call retains its resolved runtime across reconciliation', async () => {
    let entered!: () => void;
    let release!: () => void;
    const gate = {
      entered: new Promise<void>((resolve) => { entered = resolve; }),
      released: new Promise<void>((resolve) => { release = resolve; }),
      enter: () => entered(),
      release: () => release(),
    };
    (globalThis as Record<string, unknown>).__contractCallGate = gate;
    const slug = `evt-contract-${randomUUID().slice(0, 12)}`;
    slugs.push(slug);
    const source = `module.exports = { register(ctx) {
      ctx.contracts.implement('shipping', 1, { quote: async () => {
        const gate = globalThis.__contractCallGate;
        gate.enter();
        await gate.released;
        return { options: [{ id: 'standard', label: 'Standard', amountMinor: 100 }] };
      } });
    } };`;
    try {
      await installFixturePlugin(options, slug, 'shipping', [{ name: 'shipping', version: 1 }], source);
      const other = await plugin({}, 'module.exports = { register() {} };', []);
      await ensurePluginRegistryFresh();
      const call = callContract(slug, 'shipping', 1, 'quote', {
        currency: 'USD', items: [], subtotalMinor: 0, address: { country: 'US' },
      });
      await gate.entered;
      const changed = await app.inject({
        method: 'PATCH',
        url: `/api/v1/extensions/plugin/${other.pluginSlug}/instances/${other.id}`,
        headers: { authorization: `Bearer ${options.adminToken}` },
        payload: { config: { generation: randomUUID() } },
      });
      expect(changed.statusCode).toBe(200);
      await ensurePluginRegistryFresh();
      gate.release();
      expect(await call).toEqual({ options: [{ id: 'standard', label: 'Standard', amountMinor: 100 }] });
    } finally {
      gate.release();
      delete (globalThis as Record<string, unknown>).__contractCallGate;
    }
  });

  it('P: three workers drain 200 deliveries exactly once with one local slot per installation', async () => {
    const source = `const fs = require('fs');
    const path = require('path');
    module.exports = { register(ctx) {
      ctx.events.subscribe('order.created', 1, async (event) => {
        const target = path.join(ctx.config.directory, ctx.plugin.installationId + '-' + event.id + '.effect');
        const fd = fs.openSync(target, 'wx');
        try { fs.writeFileSync(fd, event.id); fs.fsyncSync(fd); }
        finally { fs.closeSync(fd); }
        fs.appendFileSync(path.join(ctx.config.directory, 'attempts.log'),
          JSON.stringify({ eventId: event.id, installationId: ctx.plugin.installationId, attempt: event.attempt }) + '\\n');
        process.send({ kind: 'entered', installationId: ctx.plugin.installationId, eventId: event.id, attempt: event.attempt });
        await globalThis.__eventWorkerRelease.wait();
        process.send({ kind: 'completed', installationId: ctx.plugin.installationId, eventId: event.id });
      });
    } };`;
    const installs = [];
    for (let index = 0; index < 20; index++) installs.push(await plugin({}, source));
    const events = [];
    for (let index = 0; index < 10; index++) events.push(await emit());
    const workers = await Promise.all([child(), child(), child()]);
    const active = new Map<string, number>();
    const peak = new Map<string, number>();
    const messages: Array<{ worker: number; kind: string; installationId?: string; eventId?: string }> = [];
    for (const worker of workers) worker.on('message', (message: Message) => {
      if (message.kind !== 'entered' && message.kind !== 'completed') return;
      messages.push({ worker: worker.pid!, kind: message.kind, installationId: message.installationId, eventId: message.eventId });
      const key = `${worker.pid}:${message.installationId}`;
      const count = (active.get(key) ?? 0) + (message.kind === 'entered' ? 1 : -1);
      active.set(key, count);
      peak.set(key, Math.max(peak.get(key) ?? 0, count));
    });
    const batches = workers.map((worker) => command(worker, 'drain-all'));
    await Promise.all(batches.map((batch) => batch.claimed));
    for (const worker of workers) worker.send({ command: 'release-all', requestId: randomUUID() });
    const done = await Promise.all(batches.map((batch) => batch.done));
    const rows = await prisma.eventDelivery.findMany({ where: { eventId: { in: events.map((event) => event.id) } } });
    const state = JSON.stringify({
      rows: rows.map(({ id, eventId, installationId, status, attempts, claimedBy, lastError, finishedAt }) =>
        ({ id, eventId, installationId, status, attempts, claimedBy, lastError, finishedAt })),
      claims: done.map((entry, index) => ({ worker: workers[index].pid, count: entry.count })),
      messages,
    });
    expect(rows, state).toHaveLength(200);
    expect(rows.every((row) => row.status === 'SUCCEEDED' && row.attempts === 1), state).toBe(true);
    const log = await attempts();
    expect(log, state).toHaveLength(200);
    expect(new Set(log.map((row) => `${row.eventId}:${row.installationId}`)).size, state).toBe(200);
    expect(log.every((row) => row.attempt === 1), state).toBe(true);
    expect(messages.filter((entry) => entry.kind === 'entered'), state).toHaveLength(200);
    expect(messages.filter((entry) => entry.kind === 'completed'), state).toHaveLength(200);
    expect([...peak.values()].every((count) => count <= 1), state).toBe(true);
    expect([...active.values()].every((count) => count === 0), state).toBe(true);
    expect(done.reduce((sum, entry) => sum + (entry.count ?? 0), 0), state).toBe(200);
    expect(installs).toHaveLength(20);
  }, 120000);
});
