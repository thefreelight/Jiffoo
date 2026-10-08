import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanupPluginMigrationFixture } from '../helpers/plugin-migration-cleanup';
import { randomUUID } from 'node:crypto';
import { fork, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@/config/database';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';
import { extensionInstallerSchemas } from '@/core/admin/extension-installer/schemas';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createUserWithToken, deleteAllTestUsers } from '../helpers/auth';
import { installFixturePlugin } from '../helpers/fixture-plugin';
import { clearTestPluginCache } from '../helpers/plugin-cache';
import { snapshotPluginRows, assertPluginRowsUnchanged } from '../helpers/plugin-db-snapshot';
import { restoreBuiltinRows } from '../helpers/plugin-db-snapshot';

let app: FastifyInstance, base: string, token: string, actorId: string, customerToken: string, customerId: string;
const slugs = new Set<string>(), orderIds = new Set<string>(), eventIds = new Set<string>(), tables = new Set<string>();
let before: Awaited<ReturnType<typeof snapshotPluginRows>>;
let registryVersion: number | undefined;
let registryUpdatedAt: Date | undefined;
const own = () => { const slug = `removal-${randomUUID().slice(0, 12)}`; slugs.add(slug); return slug; };
async function fixture(config = false, sql?: string) {
  const slug = own();
  await installFixturePlugin({ app, adminToken: token, adminUserId: actorId }, slug, 'integration', [],
    "module.exports={register(ctx){ctx.http.route({method:'GET',path:'/status',handler:async()=>({ok:true})});},__lifecycle_onEnable(){}};",
    { enable: false, ...(sql ? { migrations: [{ id: 'kept', path: 'migrations/001_kept.sql', sql }] } : {}), ...(config ? { configSchema: { type: 'object', properties: { label: { type: 'string' }, credential: { type: 'string', sensitive: true } }, required: ['label', 'credential'] }, config: { label: 'Kept label', credential: 'kept-secret' }, lifecycle: { onEnable: true } } : {}) });
  return slug;
}
async function request(slug: string, operation: 'uninstall' | 'restore' | 'purge', confirmation?: string, origin = base) {
  const body = operation === 'purge' ? JSON.stringify(confirmation === undefined ? {} : { confirmationSlug: confirmation }) : undefined;
  return fetch(`${origin}/api/v1/extensions/plugin/${slug}${operation === 'uninstall' ? '' : `/${operation}`}`, {
    method: operation === 'restore' ? 'POST' : 'DELETE', headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) }, body,
  });
}
async function error(slug: string, operation: 'uninstall' | 'restore' | 'purge', status: number, code: string, confirmation?: string) {
  const response = await request(slug, operation, confirmation);
  expect(response.status).toBe(status); expect((await response.json()).error.code).toBe(code);
}
async function list(state = 'active') {
  const response = await fetch(`${base}/api/v1/extensions/plugin?state=${state}&limit=100`, { headers: { authorization: `Bearer ${token}` } });
  expect(response.status).toBe(200); return (await response.json()).data.items as Array<{ slug: string; packageState: { status: string; code: string | null } }>;
}
function message(child: ChildProcess, kind: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const receive = (value: any) => { if (value.kind === kind) { child.off('message', receive); resolve(value); } };
    child.on('message', receive); child.once('error', reject);
  });
}
beforeAll(async () => {
  app = await createTestApp({ disableFileSystem: false, disableRedis: false, disableDynamicPlugins: false });
  const admin = await createAdminWithToken(); token = admin.token; actorId = admin.user.id;
  const customer = await createUserWithToken(); customerToken = customer.token; customerId = customer.user.id;
  base = await app.listen({ port: 0, host: '127.0.0.1' });
});
beforeEach(async () => {
  before = await snapshotPluginRows();
  const settings = await prisma.systemSettings.findUnique({ where: { id: 'system' } });
  registryVersion = settings?.pluginRegistryVersion; registryUpdatedAt = settings?.updatedAt;
});
afterEach(async () => {
  await prisma.eventRecord.deleteMany({ where: { id: { in: [...eventIds] } } }); eventIds.clear();
  await prisma.payment.deleteMany({ where: { orderId: { in: [...orderIds] } } });
  await prisma.order.deleteMany({ where: { id: { in: [...orderIds] } } }); orderIds.clear();
  for (const table of tables) await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${table}"`); tables.clear();
  for (const slug of slugs) {
    await prisma.pluginInstall.deleteMany({ where: { slug } });
    await cleanupPluginMigrationFixture(slug);
    await prisma.adminAuditEvent.deleteMany({ where: { targetId: slug } });
    await prisma.pluginOperationLease.deleteMany({ where: { slug } });
    await clearTestPluginCache(slug);
  }
  slugs.clear();
  if (registryVersion === undefined) await prisma.systemSettings.deleteMany({ where: { id: 'system' } });
  else await prisma.systemSettings.update({ where: { id: 'system' }, data: { pluginRegistryVersion: registryVersion, updatedAt: registryUpdatedAt } });
  await assertPluginRowsUnchanged(before);
});
afterAll(async () => { await app.close(); await deleteAllTestUsers(); });

describe('Plugin uninstall, restore and purge', () => {
  it('A database metadata isolates missing and corrupt packages in list and detail without materializing them', async () => {
    const good = await fixture(), missing = await fixture(), corrupt = await fixture();
    for (const slug of [missing, corrupt]) {
      const row = await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } });
      const pkg = await pluginPackageStore.get(slug, row.zipHash!); await fs.rm(pkg!.getEntryPath(''), { recursive: true, force: true });
      if (slug === missing) await prisma.pluginPackageBlob.deleteMany({ where: { pluginSlug: slug } });
      else await prisma.pluginPackageBlob.updateMany({ where: { pluginSlug: slug }, data: { bytes: Buffer.from('corrupt bytes') } });
    }
    const items = await list();
    for (const [slug, status, code] of [[good, 'available', null], [missing, 'unavailable', 'PLUGIN_PACKAGE_UNAVAILABLE'], [corrupt, 'corrupt', 'PLUGIN_PACKAGE_CORRUPT']] as const) {
      expect(items.find(item => item.slug === slug)?.packageState).toEqual({ status, code });
      const response = await fetch(`${base}/api/v1/extensions/plugin/${slug}`, { headers: { authorization: `Bearer ${token}` } });
      expect(response.status).toBe(200); expect((await response.json()).data.packageState).toEqual({ status, code });
    }
    for (const slug of [missing, corrupt]) {
      const row = await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } }); expect(await pluginPackageStore.get(slug, row.zipHash!)).toBeNull();
    }
  });
  it('B soft uninstall retains configuration, encrypted credentials, blob and directory and appears only in Removed', async () => {
    const slug = await fixture(true); const prior = await snapshotPluginRows([slug]);
    const pkg = await pluginPackageStore.get(slug, prior.installs[0].zipHash!);
    expect((await request(slug, 'uninstall')).status).toBe(200);
    const next = await snapshotPluginRows([slug]);
    expect(next.installations[0].configJson).toEqual(prior.installations[0].configJson);
    expect(JSON.stringify(next.installations[0].configJson)).not.toContain('kept-secret');
    expect(next.blobs).toEqual(prior.blobs); expect(await fs.stat(pkg!.getEntryPath(''))).toBeDefined();
    expect(next.installs[0].deletedAt).not.toBeNull(); expect(next.installations[0].enabled).toBe(false);
    expect((await list()).some(item => item.slug === slug)).toBe(false); expect((await list('removed')).some(item => item.slug === slug)).toBe(true);
    expect(await prisma.adminAuditEvent.findFirst({ where: { targetId: slug, action: 'PLUGIN_UNINSTALLED', actorId } })).not.toBeNull();
  });
  it('B returns typed unknown, builtin and already-uninstalled errors', async () => {
    const builtin = own(); await prisma.pluginInstall.create({ data: { slug: builtin, name: builtin, version: '1.0.0', source: 'builtin', trustLevel: 'builtin' } });
    await error(own(), 'uninstall', 404, 'PLUGIN_NOT_FOUND'); await error(builtin, 'uninstall', 400, 'PLUGIN_BUILTIN_PROTECTED');
    const slug = await fixture(); expect((await request(slug, 'uninstall')).status).toBe(200); await error(slug, 'uninstall', 409, 'PLUGIN_ALREADY_UNINSTALLED');
  });
  it('B uninstall preserves the last enabled provider protection', async () => {
    const builtin = await snapshotPluginRows(['zero-tax']); const slug = own();
    try {
      await installFixturePlugin({ app, adminToken: token, adminUserId: actorId }, slug, 'tax', [{ name: 'tax', version: 1 }],
        "module.exports={register(ctx){ctx.contracts.implement('tax',1,{calculate:()=>({pricesIncludeTax:false,lines:[],shippingTaxMinor:0,totalTaxMinor:0})});}};");
      await error(slug, 'uninstall', 409, 'LAST_PROVIDER_REQUIRED');
      expect((await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } })).deletedAt).toBeNull();
      expect(await prisma.adminAuditEvent.count({ where: { targetId: slug, action: 'PLUGIN_UNINSTALLED' } })).toBe(0);
    } finally { await restoreBuiltinRows(builtin, ['zero-tax']); }
  });
  it('C restore refuses a signed package without an established signing root', async () => {
    const slug = await fixture(); expect((await request(slug, 'uninstall')).status).toBe(200);
    await prisma.pluginInstall.update({ where: { slug }, data: { trustLevel: 'signed', signingRoot: null } });
    await error(slug, 'restore', 409, 'PLUGIN_REINSTALL_CONFLICT');
    expect((await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } })).deletedAt).not.toBeNull();
  });
  it('C restore remains disabled with credentials kept and the normal enable transition then invokes the package', async () => {
    const slug = await fixture(true); expect((await request(slug, 'uninstall')).status).toBe(200); expect((await request(slug, 'restore')).status).toBe(200);
    const instance = await prisma.pluginInstallation.findFirstOrThrow({ where: { pluginSlug: slug } }); expect(instance.enabled).toBe(false);
    const enabled = await app.inject({ method: 'PATCH', url: `/api/v1/extensions/plugin/${slug}/instances/${instance.id}`, headers: { authorization: `Bearer ${token}` }, payload: { enabled: true } });
    expect(enabled.statusCode).toBe(200); expect((await fetch(`${base}/api/v1/extensions/plugin/${slug}/api/status`)).status).toBe(200);
    expect(await prisma.adminAuditEvent.findFirst({ where: { targetId: slug, action: 'PLUGIN_RESTORED', actorId } })).not.toBeNull();
  });
  it('C returns typed unknown, active and unavailable-package errors without restoring', async () => {
    await error(own(), 'restore', 404, 'PLUGIN_NOT_FOUND'); const slug = await fixture(); await error(slug, 'restore', 409, 'PLUGIN_NOT_UNINSTALLED');
    expect((await request(slug, 'uninstall')).status).toBe(200);
    const row = await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } }); const pkg = await pluginPackageStore.get(slug, row.zipHash!);
    await fs.rm(pkg!.getEntryPath(''), { recursive: true, force: true }); await prisma.pluginPackageBlob.deleteMany({ where: { pluginSlug: slug } });
    await error(slug, 'restore', 503, 'PLUGIN_PACKAGE_UNAVAILABLE'); expect((await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } })).deletedAt).not.toBeNull();
  });
  it('C F corrupt package restore stays a 500 package error and does not restore the installation', async () => {
    const slug = await fixture(); expect((await request(slug, 'uninstall')).status).toBe(200);
    const row = await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } }); const pkg = await pluginPackageStore.get(slug, row.zipHash!);
    await fs.rm(pkg!.getEntryPath(''), { recursive: true, force: true }); await prisma.pluginPackageBlob.updateMany({ where: { pluginSlug: slug }, data: { bytes: Buffer.from('corrupt') } });
    await error(slug, 'restore', 500, 'PLUGIN_PACKAGE_CORRUPT');
    expect((await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } })).deletedAt).not.toBeNull();
  });
  it('D purge requires removal, protects builtin plugins and requires the exact typed slug server-side', async () => {
    const slug = await fixture(); await error(slug, 'purge', 409, 'PLUGIN_NOT_UNINSTALLED', slug);
    const builtin = own(); await prisma.pluginInstall.create({ data: { slug: builtin, name: builtin, version: '1.0.0', source: 'builtin', trustLevel: 'builtin' } });
    await error(builtin, 'purge', 400, 'PLUGIN_BUILTIN_PROTECTED', builtin); await error(own(), 'purge', 404, 'PLUGIN_NOT_FOUND');
    expect((await request(slug, 'uninstall')).status).toBe(200);
    await error(slug, 'purge', 400, 'PLUGIN_PURGE_CONFIRMATION_REQUIRED'); await error(slug, 'purge', 400, 'PLUGIN_PURGE_CONFIRMATION_REQUIRED', 'wrong-slug');
    for (const confirmationSlug of [42, [slug], null]) {
      const response = await fetch(`${base}/api/v1/extensions/plugin/${slug}/purge`, { method: 'DELETE', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ confirmationSlug }) });
      expect(response.status).toBe(400); expect((await response.json()).error.code).toBe('PLUGIN_PURGE_CONFIRMATION_REQUIRED');
    }
    const absent = await fetch(`${base}/api/v1/extensions/plugin/${slug}/purge`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
    expect(absent.status).toBe(400); expect((await absent.json()).error.code).toBe('PLUGIN_PURGE_CONFIRMATION_REQUIRED');
  });
  it('D pending payments block purge; terminal history, plugin data, migration ledger, directories and events survive successful purge', async () => {
    const table = `plugin_removal_${randomUUID().replaceAll('-', '')}`; tables.add(table);
    const slug = await fixture(true, `CREATE TABLE public."${table}" (value TEXT)`);
    await prisma.$executeRawUnsafe(`INSERT INTO "${table}" VALUES ('kept')`);
    const namespace = await prisma.pluginNamespace.findUniqueOrThrow({ where: { slug } });
    const ledger = await prisma.pluginMigrationSuccess.findMany({ where: { namespaceId: namespace.id }, orderBy: { order: 'asc' } });
    expect(ledger).toHaveLength(1); expect(ledger[0].migrationId).toBe('kept');
    await prisma.pluginEventSubscription.create({ data: { pluginSlug: slug, eventType: 'order.created', version: 1 } });
    const event = await prisma.eventRecord.create({ data: { type: 'order.created', version: 1, aggregateId: slug, data: { plugin: slug } } }); eventIds.add(event.id);
    const row = await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } }); const pkg = await pluginPackageStore.get(slug, row.zipHash!);
    const order = await prisma.order.create({ data: { userId: customerId, subtotalAmount: 12, totalAmount: 12, paymentMethod: slug } }); orderIds.add(order.id);
    const payment = await prisma.payment.create({ data: { orderId: order.id, paymentMethod: slug, amount: 12, sessionId: randomUUID(), status: 'PENDING' } });
    expect((await request(slug, 'uninstall')).status).toBe(200);
    expect(await prisma.$queryRawUnsafe(`SELECT value FROM "${table}"`)).toEqual([{ value: 'kept' }]);
    expect(await prisma.pluginMigrationSuccess.findMany({ where: { namespaceId: namespace.id }, orderBy: { order: 'asc' } })).toEqual(ledger);
    await error(slug, 'purge', 409, 'PLUGIN_UNFINISHED_PAYMENTS', slug);
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'SUCCEEDED' } });
    await prisma.order.update({ where: { id: order.id }, data: { status: 'DELIVERED', paymentStatus: 'PAID' } });
    const historical = await prisma.order.findUniqueOrThrow({ where: { id: order.id } }); const paid = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect((await request(slug, 'purge', slug)).status).toBe(200);
    expect(await prisma.pluginInstall.findUnique({ where: { slug } })).toBeNull(); expect(await prisma.pluginInstallation.count({ where: { pluginSlug: slug } })).toBe(0);
    expect(await prisma.pluginPackageBlob.count({ where: { pluginSlug: slug } })).toBe(0); expect(await prisma.pluginEventSubscription.count({ where: { pluginSlug: slug } })).toBe(0);
    expect(await prisma.$queryRawUnsafe(`SELECT value FROM "${table}"`)).toEqual([{ value: 'kept' }]); expect(await prisma.pluginMigrationSuccess.findMany({ where: { namespaceId: namespace.id }, orderBy: { order: 'asc' } })).toEqual(ledger);
    expect(await prisma.pluginNamespace.findUnique({ where: { slug } })).toEqual(namespace);
    expect(await fs.stat(pkg!.getEntryPath(''))).toBeDefined(); expect(await prisma.eventRecord.findUnique({ where: { id: event.id } })).toEqual(event);
    expect(await prisma.order.findUnique({ where: { id: order.id } })).toEqual(historical); expect(await prisma.payment.findUnique({ where: { id: payment.id } })).toEqual(paid);
    for (const [url, bearer] of [[`/api/v1/admin/orders/${order.id}`, token], [`/api/v1/orders/${order.id}`, customerToken]]) {
      const response = await fetch(`${base}${url}`, { headers: { authorization: `Bearer ${bearer}` } }); expect(response.status).toBe(200); expect((await response.json()).data.paymentMethod).toBe(slug);
    }
    expect(await prisma.adminAuditEvent.findFirst({ where: { targetId: slug, action: 'PLUGIN_PURGED', actorId } })).not.toBeNull();
  });
  it.each(['uninstall', 'restore', 'purge'] as const)('B C D F %s audit duplicate-key failure rolls back the fenced transaction and returns an internal error', async operation => {
    const slug = await fixture(true); if (operation !== 'uninstall') expect((await request(slug, 'uninstall')).status).toBe(200);
    const snapshot = await snapshotPluginRows([slug]); const version = (await prisma.systemSettings.findUniqueOrThrow({ where: { id: 'system' } })).pluginRegistryVersion;
    const auditAction = `PLUGIN_${operation === 'uninstall' ? 'UNINSTALLED' : operation === 'restore' ? 'RESTORED' : 'PURGED'}`;
    const audits = await prisma.adminAuditEvent.count({ where: { targetId: slug, action: auditAction } });
    const duplicate = await prisma.adminAuditEvent.create({ data: { actorId, action: 'collision', targetType: 'test', targetId: slug, summary: {} } });
    const worker = fork(path.resolve('tests/helpers/plugin-lifecycle-child.ts'), [], { execArgv: ['--import', 'tsx'], env: { ...process.env, NODE_ENV: 'test', JIFFOO_TEST_PLUGIN_LEASE_BARRIER: 'audit' } });
    const exited = once(worker, 'exit'); await message(worker, 'ready'); const entered = message(worker, 'plugin-audit-ready'), done = message(worker, 'done');
    worker.send({ operation, slug, actorId }); await entered; worker.send({ kind: 'plugin-audit-release', eventId: duplicate.id });
    expect((await done).statusCode).toBe(500); await exited; await assertPluginRowsUnchanged(snapshot, [slug]);
    expect((await prisma.systemSettings.findUniqueOrThrow({ where: { id: 'system' } })).pluginRegistryVersion).toBe(version);
    expect(await prisma.adminAuditEvent.count({ where: { targetId: slug, action: auditAction } })).toBe(audits);
    expect(await prisma.pluginOperationLease.findUnique({ where: { slug } })).toBeNull();
  });
  it.each(['uninstall', 'restore', 'purge'] as const)('E a real %s lease and acquired latch reject every competing lifecycle operation with 409', async operation => {
    const slug = await fixture(); if (operation !== 'uninstall') expect((await request(slug, 'uninstall')).status).toBe(200);
    const worker = fork(path.resolve('tests/helpers/plugin-lifecycle-child.ts'), [], { execArgv: ['--import', 'tsx'], env: { ...process.env, NODE_ENV: 'test', JIFFOO_TEST_PLUGIN_LEASE_BARRIER: 'acquired' } });
    const exited = once(worker, 'exit'); await message(worker, 'ready'); const entered = message(worker, 'plugin-lease-ready'), done = message(worker, 'done');
    worker.send({ operation, slug, actorId }); await entered;
    try {
      for (const competing of ['uninstall', 'restore', 'purge'] as const) await error(slug, competing, 409, 'PLUGIN_OPERATION_IN_PROGRESS', slug);
    } finally { worker.send({ kind: 'plugin-lease-release' }); }
    expect((await done).statusCode).toBe(200); await exited;
    const result = await prisma.pluginInstall.findUnique({ where: { slug } });
    if (operation === 'purge') expect(result).toBeNull();
    else expect(Boolean(result?.deletedAt)).toBe(operation === 'uninstall');
    if (operation === 'restore') expect((await prisma.pluginInstallation.findFirstOrThrow({ where: { pluginSlug: slug } })).enabled).toBe(false);
  });
  it('F schemas declare lifecycle statuses, database package state and the purge confirmation body', () => {
    for (const schema of [extensionInstallerSchemas.uninstallPlugin, extensionInstallerSchemas.purgePlugin]) for (const status of [200, 400, 401, 403, 404, 409, 500]) expect(schema.response).toHaveProperty(String(status));
    for (const status of [200, 401, 403, 404, 409, 500, 503]) expect(extensionInstallerSchemas.restorePlugin.response).toHaveProperty(String(status));
    expect(extensionInstallerSchemas.restorePlugin.response).not.toHaveProperty('201'); expect(extensionInstallerSchemas.purgePlugin.body.properties).toHaveProperty('confirmationSlug');
  });
});
