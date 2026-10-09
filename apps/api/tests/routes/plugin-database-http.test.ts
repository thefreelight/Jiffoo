import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { createServer, type ServerResponse } from 'node:http';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@/config/database';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, deleteTestUser } from '../helpers/auth';
import { installFixturePlugin } from '../helpers/fixture-plugin';
import { cleanupPluginMigrationFixture } from '../helpers/plugin-migration-cleanup';
import { clearTestPluginCache } from '../helpers/plugin-cache';
import { callContract, deliverInstallationEvent } from '@/core/admin/extension-installer/plugin-runtime';
import { withPluginDatabaseTestControl } from '@/core/admin/extension-installer/plugin-database-test-control';
import { pluginSchemaName } from 'shared/plugin-signing';
import { startPluginInstallOperation, getPluginInstallOperation, waitPluginInstallOperation } from '@/core/admin/extension-installer/plugin-migration-operation';
import { PassThrough } from 'node:stream';
import archiver from 'archiver';
import { createHash } from 'node:crypto';
import { localUploadOptions } from '../helpers/plugin-upload';
import { closePluginDatabase } from '@/core/admin/extension-installer/plugin-database';

let app: FastifyInstance, admin: Awaited<ReturnType<typeof createAdminWithToken>>, base: string, previousSwitch: string | undefined;
const slugs = new Set<string>();
const own = () => { const slug = `database-${randomUUID().slice(0, 12)}`; slugs.add(slug); return slug; };
const input = { currency: 'USD', items: [], subtotalMinor: 0, address: { country: 'US' } };
const event = () => ({ id: randomUUID(), type: 'order.created' as const, version: 1 as const, aggregateId: 'test-order', occurredAt: new Date().toISOString(), attempt: 1, data: { id: 'test-order', userId: admin.user.id, totalAmount: 1, currency: 'USD', items: [] } });
const firstSql = 'CREATE TABLE records (id TEXT PRIMARY KEY, value TEXT NOT NULL);';
const source = (latch = '') => `module.exports = { register(ctx) {
  const registration = ctx.database.query('SELECT 1', []).then(() => 'unexpected', error => error.code);
  const hold = async id => ctx.database.transaction(async tx => { await tx.query('INSERT INTO records VALUES ($1, $2)', [id, 'held']); await fetch(${JSON.stringify(latch)} + '/' + process.pid); return { ok: true }; });
  ctx.http.route({method:'GET',path:'/registration',handler:async()=>({code:await registration})});
  ctx.http.route({method:'POST',path:'/records',handler:async request=>ctx.database.query('INSERT INTO records VALUES ($1, $2) RETURNING id, value', [request.body.id, request.body.value])});
  ctx.http.route({method:'GET',path:'/core',handler:async()=>ctx.database.query('SELECT * FROM plugin_installs', [])});
  ctx.http.route({method:'GET',path:'/sleep',handler:async()=>ctx.database.query('SELECT pg_sleep(60)', [])});
  ctx.http.route({method:'POST',path:'/hold',handler:async request=>hold(request.body.id)});
  ctx.http.route({method:'GET',path:'/status',handler:async()=>ctx.database.query('SELECT current_schema() AS schema', [])});
  ctx.contracts.implement('shipping',1,{quote:async()=>{await ctx.database.query('SELECT * FROM records', []);return{options:[{id:'one',label:'One',amountMinor:0}]};}});
  ctx.events.subscribe('order.created',1,async event=>{if (${JSON.stringify(latch)}) await hold(event.id); else await ctx.database.query('INSERT INTO records VALUES ($1, $2)',[event.id,'event']);});
} };`;
const options = () => ({ app, adminToken: admin.token, adminUserId: admin.user.id });
async function install(slug: string, code = source(), sql = firstSql) {
  await installFixturePlugin(options(), slug, 'shipping', [{ name: 'shipping', version: 1 }], code, { subscriptions: [{ type: 'order.created', version: 1 }], migrations: [{ id: 'first', path: 'migrations/001.sql', sql }] });
  return prisma.pluginInstallation.findFirstOrThrow({ where: { pluginSlug: slug } });
}
beforeAll(async () => {
  previousSwitch = process.env.JIFFOO_TEST_PLUGIN_DATABASE_CONTROL; process.env.JIFFOO_TEST_PLUGIN_DATABASE_CONTROL = '1';
  app = await createTestApp({ disableFileSystem: false, disableRedis: false }); admin = await createAdminWithToken(); base = await app.listen({ host: '127.0.0.1', port: 0 });
});
afterEach(async () => {
  // Remove only owned fixture rows; provider uninstall protection is not under test.
  for (const slug of slugs) {
    await clearTestPluginCache(slug); await prisma.pluginInstall.deleteMany({ where: { slug } });
    await cleanupPluginMigrationFixture(slug); await prisma.adminAuditEvent.deleteMany({ where: { targetId: slug } });
  }
  slugs.clear();
});
afterAll(async () => { await app.close(); await closePluginDatabase(); await deleteTestUser(admin.user.id); if (previousSwitch === undefined) delete process.env.JIFFOO_TEST_PLUGIN_DATABASE_CONTROL; else process.env.JIFFOO_TEST_PLUGIN_DATABASE_CONTROL = previousSwitch; });

it('A real gateway, contract and event invocations share scoped parameterized database access', async () => {
  const slug = own(), instance = await install(slug);
  const response = await fetch(`${base}/api/v1/extensions/plugin/${slug}/api/records`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'http', value: "bound '; --" }) });
  expect(response.status).toBe(200); expect(await response.json()).toEqual({ rows: [{ id: 'http', value: "bound '; --" }], rowCount: 1 });
  expect(await callContract(slug, 'shipping', 1, 'quote', input)).toEqual({ options: [{ id: 'one', label: 'One', amountMinor: 0 }] });
  const delivery = event(); await deliverInstallationEvent(instance.id, delivery);
  expect(await prisma.$queryRawUnsafe(`SELECT id FROM "${pluginSchemaName(slug)}".records ORDER BY id`)).toEqual([{ id: delivery.id }, { id: 'http' }].sort((a, b) => a.id.localeCompare(b.id)));
  expect((await (await fetch(`${base}/api/v1/extensions/plugin/${slug}/api/registration`)).json()).code).toBe('PLUGIN_ERROR');
});
it('G a Core table name used unqualified becomes a sanitized PLUGIN_ERROR at the real gateway', async () => {
  const slug = own(); await install(slug);
  const response = await fetch(`${base}/api/v1/extensions/plugin/${slug}/api/core`);
  expect(response.status).toBe(502); expect(await response.json()).toEqual({ success: false, error: { code: 'PLUGIN_ERROR', message: 'Plugin request failed' } });
});
it('F a guarded outward gateway timeout cancels database work and releases its durable marker only after settlement', async () => {
  const slug = own(); await install(slug);
  const response = await withPluginDatabaseTestControl({ limits: { invocationMs: 100 } }, () => app.inject({ method: 'GET', url: `/api/v1/extensions/plugin/${slug}/api/sleep` }));
  expect(response.statusCode).toBe(504); expect(response.json().error.code).toBe('PLUGIN_TIMEOUT');
  await closePluginDatabase();
  let markers = await prisma.pluginOperationLease.findMany({ where: { operation: `plugin-invocation:${slug}` } });
  while (markers.length) markers = await prisma.pluginOperationLease.findMany({ where: { operation: `plugin-invocation:${slug}` } });
  expect(markers).toEqual([]);
});
it('J database faults preserve safe classifications through contract and event execution', async () => {
  const slug = own(), instance = await install(slug, `module.exports={register(ctx){ctx.contracts.implement('shipping',1,{quote:async()=>{await ctx.database.query('SELECT * FROM PRIVATE_MISSING_TABLE',[]);return{options:[]};}});ctx.events.subscribe('order.created',1,async()=>ctx.database.query('SELECT * FROM PRIVATE_MISSING_TABLE',[]));}};`);
  await expect(callContract(slug, 'shipping', 1, 'quote', input)).rejects.toMatchObject({ code: 'PLUGIN_ERROR', statusCode: 502, message: 'Plugin request failed' });
  await expect(deliverInstallationEvent(instance.id, event())).rejects.toMatchObject({ code: 'PLUGIN_ERROR', statusCode: 502, message: 'Plugin request failed' });
});

async function processFixture(role: 'api' | 'worker') {
  const child = fork(path.resolve('tests/helpers/plugin-database-process.ts'), [role], { execArgv: ['--import', 'tsx'], env: { ...process.env, NODE_ENV: 'test', PLUGIN_DB_POOL_MAX: '1', JIFFOO_TEST_PLUGIN_DATABASE_CONTROL: '1' }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  let queued!: () => void;
  const queuedWork = new Promise<void>(resolve => { queued = resolve; });
  child.on('message', value => { const message = value as { kind: string; stage?: string }; if (message.kind === 'plugin-database-observation' && message.stage === 'queued') queued(); });
  let diagnostics = ''; child.stdout?.on('data', () => undefined); child.stderr?.on('data', chunk => { diagnostics += String(chunk); });
  const ready = new Promise<{ base: string; pid: number }>((resolve, reject) => {
    child.once('error', reject); child.once('exit', code => reject(new Error(`Database process exited ${code}: ${diagnostics}`)));
    child.on('message', message => { if ((message as { kind: string }).kind === 'ready') resolve(message as { base: string; pid: number }); });
  });
  const state = await ready;
  return { child, ...state, queued: queuedWork, event: (installationId: string) => new Promise<unknown>((resolve, reject) => {
    const id = randomUUID(); const listener = (message: unknown) => { const value = message as { kind: string; id: string; code?: string }; if (value.kind !== 'result' || value.id !== id) return; child.off('message', listener); if (value.code) reject(new Error(value.code)); else resolve(value); };
    child.on('message', listener); child.send({ kind: 'event', id, installationId, event: event() });
  }), close: async () => { if (child.connected) { const exited = once(child, 'exit'); child.send({ kind: 'shutdown' }); await exited; } } };
}
async function upgrade(slug: string, code: string) {
  const migrations = [firstSql, 'ALTER TABLE records ADD COLUMN upgraded BOOLEAN NOT NULL DEFAULT true;'];
  const manifest = { schemaVersion: 1, slug, name: slug, version: '2.0.0', description: 'Database drain fixture', category: 'shipping', runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1', entryModule: 'index.js', permissions: [], contracts: [{ name: 'shipping', version: 1 }], subscriptions: [{ type: 'order.created', version: 1 }], database: { apiVersion: 1, migrations: migrations.map((sql, index) => ({ id: index === 0 ? 'first' : 'second', order: index + 1, path: `migrations/00${index + 1}.sql`, sha256: createHash('sha256').update(sql).digest('hex') })) } };
  const output = new PassThrough(), chunks: Buffer[] = [];
  const bytes = new Promise<Buffer>((resolve, reject) => { output.on('data', chunk => chunks.push(chunk)); output.on('end', () => resolve(Buffer.concat(chunks))); output.on('error', reject); });
  const archive = archiver('zip'); archive.on('error', error => output.destroy(error)); archive.pipe(output);
  archive.append(JSON.stringify(manifest), { name: 'manifest.json' }); archive.append(code, { name: 'index.js' }); migrations.forEach((sql, index) => archive.append(sql, { name: `migrations/00${index + 1}.sql` })); await archive.finalize();
  const buffer = await bytes; return startPluginInstallOperation(buffer, await localUploadOptions(buffer, admin.user.id));
}
it('D a guarded queue deadline fails only the waiting install and releases its lease without SQL', async () => {
  let release!: () => void, entered!: () => void, count = 0;
  const held = new Promise<void>(resolve => { release = resolve; }), ready = new Promise<void>(resolve => { entered = resolve; });
  const ids = await withPluginDatabaseTestControl({ beforeMigrationRun: async () => { if (++count === 2) entered(); await held; } }, () => Promise.all([upgrade(own(), source()), upgrade(own(), source())]));
  const slug = own();
  try {
    await ready;
    const queued = await withPluginDatabaseTestControl({ limits: { migrationMs: 200 } }, () => upgrade(slug, source()));
    expect((await getPluginInstallOperation(queued.operationId)).phase).toBe('QUEUED');
    expect(await prisma.pluginOperationLease.findUnique({ where: { slug } })).not.toBeNull();
    await expect(waitPluginInstallOperation(queued.operationId)).rejects.toMatchObject({ code: 'PLUGIN_MIGRATION_FAILED' });
    expect(await prisma.pluginNamespace.findUnique({ where: { slug } })).toBeNull();
    expect(await prisma.pluginOperationLease.findUnique({ where: { slug } })).toBeNull();
    for (const row of ids) expect((await getPluginInstallOperation(row.operationId)).phase).toBe('VALIDATING');
  } finally { const completed = ids.map(row => waitPluginInstallOperation(row.operationId)); release(); await Promise.all(completed); }
});
it('C E two API and two real worker processes enforce per-process limits and drain transactions before migration', async () => {
  const responses: ServerResponse[] = []; let entered!: () => void, released = false;
  const ready = new Promise<void>(resolve => { entered = resolve; });
  const latch = createServer((_request, response) => { responses.push(response); if (released) response.end('{}'); if (responses.length === 4) entered(); });
  latch.listen(0, '127.0.0.1'); await once(latch, 'listening'); const address = latch.address(); if (!address || typeof address === 'string') throw new Error('Missing latch');
  const slug = own(), code = source(`http://127.0.0.1:${address.port}`), instance = await install(slug, code);
  const children: Awaited<ReturnType<typeof processFixture>>[] = []; const work: Promise<unknown>[] = [];
  let operationId: string | undefined;
  try {
    for (const role of ['api', 'api', 'worker', 'worker'] as const) children.push(await processFixture(role));
    work.push(...children.slice(0, 2).map((child, index) => fetch(`${child.base}/api/v1/extensions/plugin/${slug}/api/hold`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: `api-${index}` }) }).then(async response => { expect(response.status).toBe(200); return response.json(); })));
    work.push(...children.slice(2).map(child => child.event(instance.id))); await ready;
    work.push(...children.slice(0, 2).map((child, index) => fetch(`${child.base}/api/v1/extensions/plugin/${slug}/api/hold`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: `queued-api-${index}` }) }).then(async response => { expect(response.status).toBe(200); return response.json(); })));
    work.push(...children.slice(2).map(child => child.event(instance.id)));
    await Promise.all(children.map(child => child.queued));
    const activity = await prisma.$queryRaw<Array<{ application_name: string }>>`SELECT application_name FROM pg_stat_activity WHERE application_name LIKE 'jiffoo-plugin-runtime:%' AND state = 'idle in transaction'`;
    for (const child of children) expect(activity.filter(row => row.application_name.startsWith(`jiffoo-plugin-runtime:${child.pid}:`))).toHaveLength(1);
    const { operationId: id } = await upgrade(slug, code); operationId = id;
    // Long-poll the durable operation state; do not use a timing sleep as a latch.
    let state = await getPluginInstallOperation(id);
    while (state.phase !== 'PAUSING') { expect(state.terminal).toBe(false); state = await getPluginInstallOperation(id, true, { phase: state.phase, committedPrefix: state.committedPrefix }); }
    expect(await prisma.pluginOperationLease.count({ where: { operation: `plugin-invocation:${slug}` } })).toBe(8);
    for (const child of children.slice(0, 2)) { const paused = await fetch(`${child.base}/api/v1/extensions/plugin/${slug}/api/status`); expect(paused.status).toBe(503); expect((await paused.json()).error.code).toBe('PLUGIN_MAINTENANCE'); }
    expect(await prisma.pluginMigrationSuccess.count({ where: { operationId: id } })).toBe(0);
    released = true; for (const response of responses) response.end('{}'); await Promise.all(work); await waitPluginInstallOperation(id);
    expect(await prisma.$queryRawUnsafe(`SELECT upgraded FROM "${pluginSchemaName(slug)}".records`)).toEqual(Array.from({ length: 8 }, () => ({ upgraded: true })));
    expect(await prisma.pluginOperationLease.count({ where: { operation: `plugin-invocation:${slug}` } })).toBe(0);
  } finally {
    released = true; for (const response of responses) response.end('{}'); await Promise.allSettled(work);
    if (operationId) await waitPluginInstallOperation(operationId).catch(() => undefined);
    for (const child of children) await child.close(); await new Promise<void>(resolve => latch.close(() => resolve()));
  }
}, 120_000);
