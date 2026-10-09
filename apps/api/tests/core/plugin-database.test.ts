import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { createServer, type Socket } from 'node:net';
import { once } from 'node:events';
import { spawnSync } from 'node:child_process';
import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import { prisma } from '@/config/database';
import type { PluginDatabaseTransaction } from '@jiffoo/shared';
import { pluginSchemaName } from 'shared/plugin-signing';
import { createPluginDatabaseTestRuntime, withPluginDatabaseInvocation, withPluginDatabaseHandler } from '@/core/admin/extension-installer/plugin-database';
import { withPluginDatabaseTestControl } from '@/core/admin/extension-installer/plugin-database-test-control';
import { migrationConnectionUrl } from '@/core/admin/extension-installer/plugin-migration-executor';
import { commitAcknowledgementProxy } from '../helpers/plugin-migration-commit-proxy';
import { withPluginMigrationGate } from '@/core/admin/extension-installer/plugin-migration-gate';
import { tcpRelay } from '../helpers/error-http-fixture';

const deferred = <T = void>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const slugs = new Set<string>();
let runtime: ReturnType<typeof createPluginDatabaseTestRuntime>;
let previousSwitch: string | undefined;
const databaseUrl = process.env.DATABASE_URL_TEST!;
async function fixture(provisioned = true) {
  const slug = `runtime-${randomUUID().slice(0, 12)}`; slugs.add(slug);
  const schema = pluginSchemaName(slug);
  await prisma.pluginNamespace.create({ data: { slug, schemaName: schema, publisherKind: 'unsigned', provisionedAt: provisioned ? new Date() : null } });
  if (provisioned) {
    await prisma.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    await prisma.$executeRawUnsafe(`CREATE TABLE "${schema}".records (id TEXT PRIMARY KEY, value TEXT NOT NULL)`);
  }
  return { slug, schema, database: runtime.database(slug, slug) };
}
function invoke<T>(fixture: { slug: string }, handler: () => Promise<T>, signal?: AbortSignal) {
  return withPluginDatabaseInvocation(fixture.slug, fixture.slug, () => withPluginDatabaseHandler(fixture.slug, fixture.slug, handler), signal);
}
beforeAll(() => { previousSwitch = process.env.JIFFOO_TEST_PLUGIN_DATABASE_CONTROL; process.env.JIFFOO_TEST_PLUGIN_DATABASE_CONTROL = '1'; });
beforeEach(() => { runtime = createPluginDatabaseTestRuntime(databaseUrl, 1); });
afterEach(async () => {
  await runtime.close();
  for (const slug of slugs) {
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${pluginSchemaName(slug)}" CASCADE`);
    await prisma.pluginNamespace.deleteMany({ where: { slug } });
  }
  slugs.clear();
});
afterAll(() => { if (previousSwitch === undefined) delete process.env.JIFFOO_TEST_PLUGIN_DATABASE_CONTROL; else process.env.JIFFOO_TEST_PLUGIN_DATABASE_CONTROL = previousSwitch; });

describe('Plugin runtime database against real PostgreSQL', () => {
  it('A binds SQL-looking values and preserves JSON, dates, binary and numeric results', async () => {
    const f = await fixture();
    await invoke(f, async () => {
      const value = "Unicode \u4e2d\u6587 '; DROP TABLE records; --";
      await f.database.query('INSERT INTO records VALUES ($1, $2)', ['one', value]);
      expect(await f.database.query('SELECT * FROM records', [])).toEqual({ rows: [{ id: 'one', value }], rowCount: 1 });
      const result = await f.database.query('SELECT $1::jsonb AS json, $2::timestamptz AS date, $3::bytea AS bytes, 9007199254740993::bigint AS big, 1.25::numeric AS decimal', [{ nested: [1, true, null] }, new Date('2026-01-01T00:00:00Z'), new Uint8Array([0, 255])]);
      expect(result.rows[0]).toEqual({ json: { nested: [1, true, null] }, date: new Date('2026-01-01T00:00:00Z'), bytes: Buffer.from([0, 255]), big: '9007199254740993', decimal: '1.25' });
    });
  });
  it('A commits one transaction and rolls back every write on callback failure', async () => {
    const f = await fixture();
    await invoke(f, async () => {
      expect(await f.database.transaction(async tx => { await tx.query('INSERT INTO records VALUES ($1, $2)', ['one', 'committed']); return 7; })).toBe(7);
      await expect(f.database.transaction(async tx => { await tx.query('INSERT INTO records VALUES ($1, $2)', ['two', 'rolled-back']); throw new Error('PRIVATE_CALLBACK_TEXT'); })).rejects.toMatchObject({ code: 'PLUGIN_ERROR', message: 'Plugin request failed' });
      expect((await f.database.query('SELECT id FROM records', [])).rows).toEqual([{ id: 'one' }]);
    });
  });
  it('A rejects nested transactions and top-level queries inside a transaction without deadlock', async () => {
    const f = await fixture();
    await invoke(f, () => f.database.transaction(async tx => {
      await expect(f.database.transaction(async () => 1)).rejects.toMatchObject({ code: 'PLUGIN_ERROR' });
      await expect(f.database.query('SELECT 1', [])).rejects.toMatchObject({ code: 'PLUGIN_ERROR' });
      expect((await tx.query('SELECT 1 AS value', [])).rows).toEqual([{ value: 1 }]);
    }));
  });
  it('B rejects registration, foreign plugin contexts and captured transactions after settlement', async () => {
    const f = await fixture(), other = await fixture(); let captured!: PluginDatabaseTransaction;
    await expect(f.database.query('SELECT 1', [])).rejects.toMatchObject({ code: 'PLUGIN_ERROR' });
    await invoke(f, async () => {
      await expect(other.database.query('SELECT 1', [])).rejects.toMatchObject({ code: 'PLUGIN_ERROR' });
      await f.database.transaction(async tx => { captured = tx; await tx.query('SELECT 1', []); });
    });
    await expect(captured.query('SELECT 1', [])).rejects.toMatchObject({ code: 'PLUGIN_ERROR' });
  });
  it('B inherited timer admission is revoked when its handler settles', async () => {
    const f = await fixture(), release = deferred(), completed = deferred<string>();
    await invoke(f, async () => {
      setTimeout(() => { void release.promise.then(() => f.database.query('SELECT 1', [])).then(() => completed.resolve('unexpected'), error => completed.resolve(error.code)); }, 0);
    });
    release.resolve(); expect(await completed.promise).toBe('PLUGIN_ERROR');
    expect(runtime.snapshot(f.slug).total).toBe(0);
  });
  it('B drains a database query started without await before releasing invocation admission', async () => {
    const f = await fixture(), query = deferred<Promise<unknown>>();
    await invoke(f, async () => { const work = f.database.query('INSERT INTO records VALUES ($1, $2)', ['one', 'drained']); query.resolve(work); });
    await query.promise;
    expect(await prisma.$queryRawUnsafe(`SELECT value FROM "${f.schema}".records`)).toEqual([{ value: 'drained' }]);
  });
  it('E an early reply retains the durable gate until the actual handler and its SQL settle', async () => {
    const f = await fixture(), app = Fastify(), entered = deferred(), held = deferred();
    app.get('/early', (_request, reply) => withPluginDatabaseHandler(f.slug, f.slug, async () => {
      reply.send({ ok: true }); entered.resolve(); await held.promise;
      await f.database.query('INSERT INTO records VALUES ($1, $2)', ['one', 'after-reply']);
    }));
    const work = withPluginMigrationGate(f.slug, () => withPluginDatabaseInvocation(f.slug, f.slug, () => app.inject({ method: 'GET', url: '/early' })));
    try {
      await entered.promise;
      expect(await prisma.pluginOperationLease.count({ where: { operation: `plugin-invocation:${f.slug}` } })).toBe(1);
      expect(await prisma.$queryRawUnsafe(`SELECT * FROM "${f.schema}".records`)).toEqual([]);
      held.resolve(); expect((await work).json()).toEqual({ ok: true });
      expect(await prisma.$queryRawUnsafe(`SELECT value FROM "${f.schema}".records`)).toEqual([{ value: 'after-reply' }]);
      expect(await prisma.pluginOperationLease.count({ where: { operation: `plugin-invocation:${f.slug}` } })).toBe(0);
    } finally { held.resolve(); await work; await app.close(); }
  });
  it('C enforces one shared slug permit across contexts and releases it on cancellation', async () => {
    const f = await fixture(), held = deferred(), entered = deferred();
    const first = invoke(f, () => f.database.transaction(async tx => { await tx.query('SELECT 1', []); entered.resolve(); await held.promise; }));
    await entered.promise;
    const controller = new AbortController();
    const second = invoke(f, () => runtime.database(f.slug, f.slug).query('SELECT 1', [], { signal: controller.signal }));
    expect(runtime.snapshot(f.slug)).toMatchObject({ active: 1, queued: 1, total: 1 });
    controller.abort(); await expect(second).rejects.toMatchObject({ code: 'PLUGIN_TIMEOUT' });
    held.resolve(); await first; expect(runtime.snapshot(f.slug)).toEqual({ active: 0, queued: 0, total: 0 });
  });
  it('D a saturated plugin leaves half the pool available and queued slugs rotate fairly', async () => {
    const a = await fixture(), b = await fixture(), c = await fixture(), d = await fixture();
    const holdA = deferred(), holdB = deferred(), enteredA = deferred(), enteredB = deferred();
    const first = invoke(a, () => a.database.transaction(async tx => { await tx.query('SELECT 1', []); enteredA.resolve(); await holdA.promise; }));
    await enteredA.promise;
    const order: string[] = [];
    const pendingA = invoke(a, () => a.database.query('SELECT 1', []).then(() => { order.push('a'); }));
    const second = invoke(b, () => b.database.transaction(async tx => { await tx.query('SELECT 1', []); enteredB.resolve(); await holdB.promise; }));
    await enteredB.promise; expect(runtime.snapshot(a.slug).total).toBe(2);
    const pendingC = invoke(c, () => c.database.transaction(async tx => { await tx.query('SELECT 1', []); order.push('c'); }));
    const pendingD = invoke(d, () => d.database.transaction(async tx => { await tx.query('SELECT 1', []); order.push('d'); }));
    expect(await prisma.$queryRaw`SELECT 1 AS alive`).toEqual([{ alive: 1 }]);
    holdB.resolve(); await second; await pendingC; await pendingD;
    expect(order).toEqual(['c', 'd']); holdA.resolve(); await first; await pendingA;
    expect(order).toEqual(['c', 'd', 'a']);
  });
  it('D preserves FIFO within a slug and rejects its sixty-fifth queued request', async () => {
    const f = await fixture(), held = deferred(), entered = deferred();
    const first = invoke(f, () => f.database.transaction(async tx => { await tx.query('SELECT 1', []); entered.resolve(); await held.promise; }));
    await entered.promise;
    const order: number[] = [];
    const queued = Array.from({ length: 64 }, (_, index) => invoke(f, () => f.database.query('SELECT $1::integer AS n', [index]).then(() => { order.push(index); })));
    await expect(invoke(f, () => f.database.query('SELECT 1', []))).rejects.toMatchObject({ code: 'PLUGIN_DATABASE_BUSY', statusCode: 503 });
    held.resolve(); await first; await Promise.all(queued);
    expect(order).toEqual(Array.from({ length: 64 }, (_, index) => index));
  });
  it('F queued work times out under a guarded short limit without stealing a permit', async () => {
    const f = await fixture(), held = deferred(), entered = deferred();
    const first = invoke(f, () => f.database.transaction(async tx => { await tx.query('SELECT 1', []); entered.resolve(); await held.promise; }));
    await entered.promise;
    await expect(withPluginDatabaseTestControl({ limits: { queueMs: 30 } }, () => invoke(f, () => f.database.query('SELECT 1', [])))).rejects.toMatchObject({ code: 'PLUGIN_DATABASE_BUSY' });
    expect(runtime.snapshot(f.slug)).toMatchObject({ active: 1, queued: 0 }); held.resolve(); await first;
  });
  it('F real statement timeout cancels pg_sleep and the pool remains usable', async () => {
    const f = await fixture();
    await expect(withPluginDatabaseTestControl({ limits: { statementMs: 30 } }, () => invoke(f, () => f.database.query('SELECT pg_sleep(60)', [])))).rejects.toMatchObject({ code: 'PLUGIN_TIMEOUT', statusCode: 504 });
    expect(await invoke(f, () => f.database.query('SELECT 1 AS alive', []))).toEqual({ rows: [{ alive: 1 }], rowCount: 1 });
  });
  it('F AbortSignal cancels actual server execution and rolls back its earlier write', async () => {
    const f = await fixture(), controller = new AbortController(); let pid = 0, queries = 0;
    const work = withPluginDatabaseTestControl({ observe: event => { if (event.stage === 'query' && ++queries === 2) { pid = event.pid!; controller.abort(); } } }, () => invoke(f, () => f.database.transaction(async tx => {
      await tx.query('INSERT INTO records VALUES ($1, $2)', ['one', 'rollback']);
      await tx.query('SELECT pg_sleep(60)', []);
    }, { signal: controller.signal })));
    await expect(work).rejects.toMatchObject({ code: 'PLUGIN_TIMEOUT' });
    expect(await prisma.$queryRaw`SELECT 1 FROM pg_stat_activity WHERE pid = ${pid}::integer AND state = 'active'`).toEqual([]);
    expect(runtime.snapshot(f.slug).total).toBe(0);
    expect(await prisma.$queryRawUnsafe(`SELECT * FROM "${f.schema}".records`)).toEqual([]);
  });
  it('F lock timeout rolls back on a real competing PostgreSQL row lock', async () => {
    const f = await fixture(); await prisma.$executeRawUnsafe(`INSERT INTO "${f.schema}".records VALUES ('one', 'old')`);
    const blocker = new Client({ connectionString: migrationConnectionUrl(databaseUrl) }); await blocker.connect();
    try {
      await blocker.query('BEGIN'); await blocker.query(`UPDATE "${f.schema}".records SET value = 'held' WHERE id = 'one'`);
      await expect(withPluginDatabaseTestControl({ limits: { lockMs: 30 } }, () => invoke(f, () => f.database.query('UPDATE records SET value = $1 WHERE id = $2', ['changed', 'one'])))).rejects.toMatchObject({ code: 'PLUGIN_TIMEOUT' });
    } finally { await blocker.query('ROLLBACK'); await blocker.end(); }
    expect(await invoke(f, () => f.database.query('SELECT value FROM records', []))).toMatchObject({ rows: [{ value: 'old' }] });
  });
  it('F transaction deadline revokes a held callback and its captured transaction', async () => {
    const f = await fixture(), held = deferred(); let tx!: PluginDatabaseTransaction;
    const work = withPluginDatabaseTestControl({ limits: { transactionMs: 100 }, callbackDeadline: true }, () => invoke(f, () => f.database.transaction(async transaction => { tx = transaction; await tx.query('INSERT INTO records VALUES ($1, $2)', ['one', 'rollback']); await held.promise; await tx.query('SELECT 1', []); })));
    await expect(work).rejects.toMatchObject({ code: 'PLUGIN_TIMEOUT' }); held.resolve();
    await expect(tx.query('SELECT 1', [])).rejects.toMatchObject({ code: 'PLUGIN_ERROR' });
    expect(await invoke(f, () => f.database.query('SELECT * FROM records', []))).toMatchObject({ rows: [] });
  });
  it('F lost real COMMIT acknowledgement is unknown and never retries the write', async () => {
    const f = await fixture(), proxy = await commitAcknowledgementProxy(databaseUrl, 'jiffoo-plugin-runtime:');
    const proxied = createPluginDatabaseTestRuntime(proxy.databaseUrl, 1);
    try {
      const db = proxied.database(f.slug, f.slug);
      await expect(invoke(f, () => db.query('INSERT INTO records VALUES ($1, $2)', ['one', 'once']))).rejects.toMatchObject({ code: 'PLUGIN_DATABASE_OUTCOME_UNKNOWN', statusCode: 502 });
      await proxy.acknowledged;
      expect(await prisma.$queryRawUnsafe(`SELECT * FROM "${f.schema}".records`)).toEqual([{ id: 'one', value: 'once' }]);
    } finally { await proxied.close(); await proxy.close(); }
  });
  it('G unqualified names exclude Core and other plugin schemas while pg_catalog remains available', async () => {
    const f = await fixture(), other = await fixture();
    await prisma.$executeRawUnsafe(`CREATE TABLE "${other.schema}".other_records (id INTEGER)`);
    await invoke(f, async () => {
      const row = (await f.database.query("SELECT current_schema() AS schema, current_setting('search_path') AS path, length($1::text) AS size", ['abc'])).rows[0];
      expect({ ...row, path: String(row.path).replaceAll('"', '') }).toEqual({ schema: f.schema, path: f.schema, size: 3 });
      for (const table of ['plugin_installs', 'other_records']) await expect(f.database.query(`SELECT * FROM ${table}`, [])).rejects.toMatchObject({ code: 'PLUGIN_ERROR' });
    });
  });
  it.each(['SET search_path = public', 'SET LOCAL search_path = public', 'RESET ALL', 'BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT one', 'SELECT 1; SELECT 2', "SELECT set_config('search_path', 'public', true)", 'SELECT pg_catalog."set_config"($1, $2, true)', '/* nested /* x */ */ SET ROLE postgres', 'DO $$ BEGIN END $$', 'SELECT 1 INTO TEMP records'])('G rejects session or transaction-control SQL: %s', async sql => {
    const f = await fixture();
    await invoke(f, async () => { await expect(f.database.query(sql, ['search_path', 'public'])).rejects.toMatchObject({ code: 'PLUGIN_ERROR' }); expect((await f.database.query('SELECT current_schema() AS schema', [])).rows).toEqual([{ schema: f.schema }]); });
  });
  it('I refuses unprovisioned namespaces and accepts provisioned namespaces without migrations', async () => {
    const absent = await fixture(false), empty = await fixture();
    await expect(invoke(absent, () => absent.database.query('SELECT 1', []))).rejects.toMatchObject({ code: 'PLUGIN_ERROR' });
    expect((await invoke(empty, () => empty.database.query('SELECT 1 AS value', []))).rows).toEqual([{ value: 1 }]);
  });
  it('I a deliberately missing fixture schema is drift and is never recreated at runtime', async () => {
    const f = await fixture(); await prisma.$executeRawUnsafe(`DROP SCHEMA "${f.schema}" CASCADE`);
    await expect(invoke(f, () => f.database.query('SELECT 1', []))).rejects.toMatchObject({ code: 'PLUGIN_MIGRATION_DRIFT' });
    expect(await prisma.$queryRaw`SELECT 1 FROM pg_namespace WHERE nspname = ${f.schema}`).toEqual([]);
  });
  it('J SQL failures redact text, parameters and server detail at the adapter boundary', async () => {
    const f = await fixture();
    await invoke(f, async () => {
      await f.database.query('INSERT INTO records VALUES ($1, $2)', ['PRIVATE_KEY_VALUE', 'PRIVATE_VALUE']);
      try { await f.database.query('INSERT INTO records VALUES ($1, $2)', ['PRIVATE_KEY_VALUE', 'PRIVATE_VALUE']); throw new Error('Expected a constraint failure'); }
      catch (error) { expect(error).toMatchObject({ code: 'PLUGIN_ERROR', message: 'Plugin request failed' }); expect(String(error)).not.toContain('PRIVATE'); expect(error).not.toHaveProperty('detail'); expect(error).not.toHaveProperty('cause'); }
    });
  });
  it('J a real refused database connection is DATABASE_UNAVAILABLE', async () => {
    const f = await fixture(), port = createServer(); port.listen(0, '127.0.0.1'); await once(port, 'listening');
    const address = port.address(); if (!address || typeof address === 'string') throw new Error('No TCP port');
    await new Promise<void>(resolve => port.close(() => resolve()));
    const url = new URL(databaseUrl); url.hostname = '127.0.0.1'; url.port = String(address.port);
    const unavailable = createPluginDatabaseTestRuntime(url.toString(), 1);
    try { await expect(invoke(f, () => unavailable.database(f.slug, f.slug).query('SELECT 1', []))).rejects.toMatchObject({ code: 'DATABASE_UNAVAILABLE', statusCode: 503 }); }
    finally { await unavailable.close(); }
  });
  it('I a real connection loss during a query is unavailable and retains work until its backend exits', async () => {
    const f = await fixture(), relay = await tcpRelay(databaseUrl, 5432), started = deferred<number>();
    const url = new URL(relay.url); url.searchParams.set('application_name', 'jiffoo-core-url-override'); url.searchParams.set('options', '-c timezone=Asia/Shanghai');
    const proxied = createPluginDatabaseTestRuntime(url.toString(), 1);
    let pid = 0;
    try {
      const work = withPluginDatabaseTestControl({ limits: { statementMs: 1_000 }, observe: value => { if (value.stage === 'query') started.resolve(value.pid!); } },
        () => invoke(f, () => proxied.database(f.slug, f.slug).query('SELECT pg_sleep(60)', [])));
      const failure = expect(work).rejects.toMatchObject({ code: 'DATABASE_UNAVAILABLE', statusCode: 503 });
      pid = await started.promise;
      for (;;) {
        const rows = await prisma.$queryRaw<Array<{ state: string; query: string; application_name: string }>>`SELECT state, query, application_name FROM pg_stat_activity WHERE pid = ${pid}::integer`;
        if (rows[0]?.state === 'active' && rows[0].query.includes('pg_sleep')) { expect(rows[0].application_name).toBe('jiffoo-core-url-override'); break; }
      }
      relay.drop(); await failure;
      expect(await prisma.$queryRaw`SELECT 1 FROM pg_stat_activity WHERE pid = ${pid}::integer`).toEqual([]);
      expect(proxied.snapshot(f.slug).total).toBe(0);
    } finally { await proxied.close(); await relay.close(); }
  });
  it('I a failed real namespace lookup is unavailable and the same facade recovers after reconnection', async () => {
    const f = await fixture(), relay = await tcpRelay(databaseUrl, 5432);
    const url = new URL(relay.url); url.searchParams.set('connect_timeout', '1'); url.searchParams.set('pool_timeout', '1');
    const metadata = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    const store = createPluginDatabaseTestRuntime(databaseUrl, 1, slug => metadata.pluginNamespace.findUnique({ where: { slug }, select: { schemaName: true, provisionedAt: true } }));
    const db = store.database(f.slug, f.slug);
    try {
      relay.drop(); await expect(invoke(f, () => db.query('SELECT 1', []))).rejects.toMatchObject({ code: 'DATABASE_UNAVAILABLE', statusCode: 503 });
      relay.recover(); expect(await invoke(f, () => db.query('SELECT current_schema() AS schema', []))).toEqual({ rows: [{ schema: f.schema }], rowCount: 1 });
      expect(store.snapshot(f.slug).total).toBe(0);
    } finally { await store.close(); await metadata.$disconnect(); await relay.close(); }
  });
  it('F a stalled TCP handshake reaches the guarded connection deadline and leaves no permit', async () => {
    const f = await fixture(), sockets = new Set<Socket>();
    const server = createServer(socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); socket.resume(); });
    server.listen(0, '127.0.0.1'); await once(server, 'listening'); const address = server.address(); if (!address || typeof address === 'string') throw new Error('No TCP port');
    const url = new URL(databaseUrl); url.hostname = '127.0.0.1'; url.port = String(address.port);
    const stalled = withPluginDatabaseTestControl({ limits: { connectMs: 50 } }, () => createPluginDatabaseTestRuntime(url.toString(), 1));
    try { await expect(invoke(f, () => stalled.database(f.slug, f.slug).query('SELECT 1', []))).rejects.toMatchObject({ code: 'DATABASE_UNAVAILABLE' }); expect(stalled.snapshot(f.slug).total).toBe(0); }
    finally { await stalled.close(); for (const socket of sockets) socket.end(); await new Promise<void>(resolve => server.close(() => resolve())); }
  });
  it('L shutdown rejects queued work and rolls back active transactions before ending the pool', async () => {
    const f = await fixture(), entered = deferred(), held = deferred();
    const active = invoke(f, () => f.database.transaction(async tx => { await tx.query('INSERT INTO records VALUES ($1, $2)', ['one', 'rollback']); entered.resolve(); await held.promise; }));
    await entered.promise;
    const queued = invoke(f, () => f.database.query('SELECT 1', []));
    const activeFailure = expect(active).rejects.toMatchObject({ code: 'PLUGIN_TIMEOUT' });
    const queuedFailure = expect(queued).rejects.toMatchObject({ code: 'DATABASE_UNAVAILABLE' });
    await runtime.close(); await activeFailure; await queuedFailure; held.resolve();
    expect(await prisma.$queryRawUnsafe(`SELECT * FROM "${f.schema}".records`)).toEqual([]);
    await expect(invoke(f, () => f.database.query('SELECT 1', []))).rejects.toMatchObject({ code: 'DATABASE_UNAVAILABLE' });
  });
  it('M non-test startup rejects the explicit database control switch', () => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', '-e', "require('./src/config/env.ts')"], { env: { ...process.env, NODE_ENV: 'production', JIFFOO_TEST_PLUGIN_DATABASE_CONTROL: '1' }, encoding: 'utf8', windowsHide: true });
    expect(result.status).toBe(1); expect(result.stderr).toContain('Plugin database test controls are not permitted outside NODE_ENV=test');
  });
  it.each(['0', '65', '1.5', 'invalid'])('M startup rejects invalid PLUGIN_DB_POOL_MAX %s', value => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', '-e', "require('./src/config/env.ts')"], { env: { ...process.env, NODE_ENV: 'test', PLUGIN_DB_POOL_MAX: value }, encoding: 'utf8', windowsHide: true });
    expect(result.status).toBe(1); expect(result.stderr).toContain('PLUGIN_DB_POOL_MAX');
  });
});
