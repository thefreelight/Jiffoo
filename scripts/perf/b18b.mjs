import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, join } from 'node:path';
import { readdir, readFile, mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createHash, randomUUID, randomBytes } from 'node:crypto';
import { PassThrough } from 'node:stream';
import { performance } from 'node:perf_hooks';
import { request } from 'node:http';
import { startUploadTestStorage } from '../upload-test-storage.mjs';
import { writeFileSync } from 'node:fs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const url = 'postgresql://postgres:postgres@localhost:5432/jiffoo_core_test';
assert.equal(process.env.DATABASE_URL, url);
assert.equal(process.env.DATABASE_URL_TEST, url);
assert.equal(process.env.NODE_ENV, 'test');
assert.ok(global.gc, 'Run with node --expose-gc');
process.env.JWT_SECRET = 'ci-test-secret';
process.env.PLUGIN_SECRETS_KEY = Buffer.alloc(32, 17).toString('base64');
process.env.REDIS_URL = 'redis://localhost:6379/15';
process.env.JIFFOO_TEST_PLUGIN_DATABASE_CONTROL = '1';
const directory = await mkdtemp(join(tmpdir(), 'jiffoo-b18b-'));
process.env.EXTENSIONS_PATH = directory;
process.chdir(join(root, 'apps/api'));
const require = createRequire(join(root, 'apps/api/package.json'));
require('tsx/cjs');
const unregisterEsm = require('tsx/esm/api').register({ tsconfig: join(root, 'apps/api/tsconfig.json') });
const { Client } = require('pg');
const client = new Client({ connectionString: url });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const mode = process.argv[2];
const label = process.argv[3] ?? 'measurement';
assert.match(label, /^[a-z0-9-]+$/);
const observations = [];
function record(result) {
  observations.push(result);
  writeFileSync(join(root, 'scripts/perf', `results-${mode}-${label}.json`), JSON.stringify(observations, null, 2) + '\n');
  console.log(JSON.stringify({ ...result, trace: result.trace?.map(sql => sql.replace(/\s+/g, ' ').slice(0, 180)) }, null, 2));
}
let statements = [];
let recording = false;
let instrumentedPrisma;
let faultWire = false, faultTimer;
const originalQuery = Client.prototype.query;
Client.prototype.query = function (sql, ...args) {
  if (recording) statements.push(typeof sql === 'string' ? sql : sql.text);
  if (faultWire && (typeof sql === 'string' ? sql : sql.text) === 'SELECT pg_sleep(0.3)') {
    faultTimer = setTimeout(() => this.connection.stream.destroy(Object.assign(new Error('Benchmark-owned transport interruption'), { code: 'ECONNRESET' })), 30);
  }
  return originalQuery.call(this, sql, ...args);
};

async function guard() {
  const names = (await readdir(join(root, 'apps/api/prisma/migrations'), { withFileTypes: true }))
    .filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  const applied = (await client.query('SELECT migration_name, checksum, finished_at, rolled_back_at FROM public._prisma_migrations ORDER BY migration_name')).rows;
  assert.equal(applied.length, names.length, 'STOP: migration drift');
  for (let index = 0; index < names.length; index++) {
    const row = applied[index];
    assert.ok(row.finished_at && !row.rolled_back_at && row.migration_name === names[index], 'STOP: migration drift');
    assert.equal(row.checksum, hash(await readFile(join(root, 'apps/api/prisma/migrations', names[index], 'migration.sql'))), 'STOP: migration checksum drift');
  }
}

async function measure(name, operation, iterations = 50) {
  await operation();
  global.gc();
  const baseline = process.memoryUsage();
  let peakHeap = baseline.heapUsed, peakRss = baseline.rss;
  const sample = () => {
    const memory = process.memoryUsage();
    peakHeap = Math.max(peakHeap, memory.heapUsed); peakRss = Math.max(peakRss, memory.rss);
  };
  const sampler = setInterval(sample, 2);
  const times = [], counts = [];
  let trace;
  try {
    for (let index = 0; index < iterations; index++) {
      statements = []; recording = true;
      const start = performance.now();
      await operation();
      times.push(performance.now() - start); counts.push(statements.length);
      recording = false; sample();
      trace ??= [...statements];
    }
  } finally { recording = false; clearInterval(sampler); }
  times.sort((a, b) => a - b);
  record({ label, name, iterations, p50Ms: times[Math.ceil(iterations * .5) - 1],
    p95Ms: times[Math.ceil(iterations * .95) - 1], sqlMin: Math.min(...counts), sqlMax: Math.max(...counts),
    baselineHeapMiB: baseline.heapUsed / 1048576, peakHeapMiB: peakHeap / 1048576,
    baselineRssMiB: baseline.rss / 1048576, peakRssMiB: peakRss / 1048576, trace });
}

async function packageBytes(slug, payloadSize) {
  const manifest = { schemaVersion: 1, slug, name: 'Performance fixture', description: '', version: '1.0.0',
    runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1', entryModule: 'index.js', permissions: [] };
  const archive = require('archiver')('zip', { store: true });
  const output = new PassThrough(), chunks = [];
  const done = new Promise((accept, reject) => { output.on('data', chunk => chunks.push(chunk)); output.on('end', () => accept(Buffer.concat(chunks))); output.on('error', reject); });
  archive.on('error', error => output.destroy(error)); archive.pipe(output);
  archive.append(JSON.stringify(manifest), { name: 'manifest.json' });
  archive.append('module.exports = { register() {} };', { name: 'index.js' });
  archive.append(randomBytes(payloadSize), { name: 'payload.bin' });
  await archive.finalize();
  const bytes = await done;
  return { manifest, bytes, zipHash: hash(bytes) };
}

async function audit() {
  const schema = `audit_test_${randomUUID().replaceAll('-', '')}`;
  const tables = ['_prisma_migrations', 'plugin_installs', 'plugin_package_blobs', 'plugin_namespaces',
    'plugin_migration_successes', 'plugin_migration_operations', 'plugin_migration_attempts', 'plugin_operation_leases', 'core_processes'];
  const { auditPluginDatabase, setPluginDatabaseAuditTestLimits } = require(join(root, 'apps/api/src/core/admin/extension-installer/plugin-database-audit.ts'));
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    for (const table of tables) await client.query(`CREATE TABLE ${schema}.${table} (LIKE public.${table} INCLUDING DEFAULTS INCLUDING GENERATED INCLUDING IDENTITY)`);
    await client.query(`INSERT INTO ${schema}._prisma_migrations SELECT * FROM public._prisma_migrations`);
    await client.query(`INSERT INTO ${schema}.plugin_namespaces SELECT * FROM public.plugin_namespaces`);
    // The audit does not inspect successful attempts; exercise its near-limit row inventory.
    await client.query(`INSERT INTO ${schema}.plugin_migration_attempts (id,"namespaceId","operationId","order","migrationId",path,sha256,status) SELECT 'perf-' || n,1,'perf',1,'m1','m.sql',repeat('a',64),'SUCCESS' FROM generate_series(1,9500) n`);
    let bytes = 0;
    for (let index = 0; index < 13; index++) {
      const slug = `perf-audit-${index}`;
      const pkg = await packageBytes(slug, Math.floor(9.7 * 1048576));
      bytes += pkg.bytes.length;
      await client.query(`INSERT INTO ${schema}.plugin_installs (id,slug,name,version,"zipHash","manifestJson","trustLevel","updatedAt") VALUES ($1,$1,'Performance fixture','1.0.0',$2,$3,'unsigned',now())`, [slug, pkg.zipHash, pkg.manifest]);
      await client.query(`INSERT INTO ${schema}.plugin_package_blobs (id,"pluginSlug","zipHash",bytes,"sizeBytes") VALUES ($1,$1,$2,$3,$4)`, [slug, pkg.zipHash, pkg.bytes, pkg.bytes.length]);
    }
    console.log(JSON.stringify({ dataset: { packageBytes: bytes, packageMiB: bytes / 1048576, attempts: 9500, packages: 13 } }));
    setPluginDatabaseAuditTestLimits(true, undefined, schema);
    await measure('audit-near-limits', async () => {
      const report = await auditPluginDatabase(client);
      assert.equal(report.complete, true); assert.equal(report.database.schemaState, 'current');
      assert.equal(report.counts.plugins, 13); assert.equal(report.counts.blocking, 0);
    });
  } finally {
    setPluginDatabaseAuditTestLimits(true);
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  }
}

async function prismaEvents() {
  const modulePath = require.resolve(join(root, 'apps/api/src/config/database.ts'));
  const original = require(modulePath).prisma;
  await original.$disconnect();
  const { PrismaClient } = require('@prisma/client');
  instrumentedPrisma = new PrismaClient({ datasources: { db: { url } }, log: [{ emit: 'event', level: 'query' }] });
  instrumentedPrisma.$on('query', event => { if (recording) statements.push(event.query); });
  const { slowQueryExtension } = require(join(root, 'apps/api/src/infra/prisma-slow-query-extension.ts'));
  require.cache[modulePath].exports = { prisma: instrumentedPrisma.$extends(slowQueryExtension) };
  return require.cache[modulePath].exports.prisma;
}

async function list() {
  const prisma = await prismaEvents();
  const { extensionInstaller } = require(join(root, 'apps/api/src/core/admin/extension-installer/index.ts'));
  const existing = await prisma.pluginInstall.count({ where: { deletedAt: null } });
  assert.ok(existing <= 10, 'Too many existing packages for the 10-package fixture');
  const owned = [];
  try {
    for (const count of [10, 30]) {
      while (existing + owned.length < count) {
        const slug = `perf-list-${randomUUID().slice(0, 12)}`;
        owned.push(slug);
        const pkg = await packageBytes(slug, 2 * 1048576);
        await prisma.pluginInstall.create({ data: { slug, name: pkg.manifest.name, version: '1.0.0', source: 'local-zip',
          trustLevel: 'unsigned', zipHash: pkg.zipHash, manifestJson: pkg.manifest } });
        await prisma.pluginPackageBlob.create({ data: { pluginSlug: slug, zipHash: pkg.zipHash, bytes: pkg.bytes, sizeBytes: pkg.bytes.length } });
      }
      console.log(JSON.stringify({ dataset: { installedPackages: count, existingPackages: existing, addedPackages: owned.length, addedPayloadBytesEach: 2 * 1048576 } }));
      await measure(`list-${count}`, async () => {
        const rows = await extensionInstaller.listInstalled('plugin');
        assert.equal(rows.length, count);
        assert.ok(rows.filter(row => owned.includes(row.slug)).every(row => row.packageState.status === 'available'));
      });
    }
  } finally {
    await prisma.pluginPackageBlob.deleteMany({ where: { pluginSlug: { in: owned } } });
    await prisma.pluginInstall.deleteMany({ where: { slug: { in: owned } } });
    require(join(root, 'apps/api/src/infra/shared-protection.ts')).sharedProtection.close();
    await require(join(root, 'apps/api/src/core/cache/redis.ts')).redisCache.disconnect();
  }
}

async function media() {
  let storage, app, store;
  try {
    process.chdir(root); storage = await startUploadTestStorage(); process.chdir(join(root, 'apps/api'));
    Object.assign(process.env, storage.env);
    await prismaEvents();
    store = require(join(root, 'apps/api/src/core/storage/uploaded-object-store.ts')).uploadedObjectStore;
    const sharp = require('sharp');
    const png = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#113355' } }).png().toBuffer();
    // PNG decoders accept trailing bytes; the served, hashed object is exactly 5 MiB.
    const bytes = Buffer.concat([png, randomBytes(5 * 1048576 - png.length)]);
    await sharp(bytes).metadata();
    const { publishMediaSet } = require(join(root, 'apps/api/src/core/storage/uploaded-media-set.ts'));
    const digest = await publishMediaSet('products', [{ name: 'original.png', mime: 'image/png', content: bytes }]);
    app = await require(join(root, 'apps/api/src/server.ts')).buildApp();
    const base = await app.listen({ port: 0, host: '127.0.0.1' });
    console.log(JSON.stringify({ dataset: { imageBytes: bytes.length, storage: 'isolated real Silo', client: 'drains HTTP body without accumulating bytes' } }));
    await measure('serve-5MiB-no-change-bounded-by-design', () => new Promise((accept, reject) => {
      const call = request(`${base}/uploads/products/${digest}/original.png`, { headers: { connection: 'close' } }, response => {
        let size = 0; const checksum = createHash('sha256');
        response.on('data', chunk => { size += chunk.length; checksum.update(chunk); }); response.once('error', reject);
        response.once('end', () => {
          try {
            assert.equal(response.statusCode, 200); assert.equal(size, bytes.length);
            assert.equal(response.headers['content-length'], String(bytes.length));
            assert.equal(response.headers.etag, `"${checksum.digest('hex')}"`); accept();
          } catch (error) { reject(error); }
        });
      });
      call.once('error', reject); call.end();
    }));
  } finally {
    await app?.close(); store?.client?.destroy();
    if (app) {
      require(join(root, 'apps/api/src/infra/shared-protection.ts')).sharedProtection.close();
      await require(join(root, 'apps/api/src/core/cache/redis.ts')).redisCache.disconnect();
    }
    storage?.stop();
  }
}

async function gates() {
  const prisma = await prismaEvents();
  const slug = `perf-gate-${randomUUID().slice(0, 12)}`;
  const { pluginSchemaName } = require('shared/plugin-signing');
  const schema = pluginSchemaName(slug);
  const { withPluginMigrationGate } = require(join(root, 'apps/api/src/core/admin/extension-installer/plugin-migration-gate.ts'));
  const database = require(join(root, 'apps/api/src/core/admin/extension-installer/plugin-database.ts'));
  const core = require(join(root, 'apps/api/src/infra/core-process.ts'));
  const { coreProcessIdentity } = require(join(root, 'apps/api/src/infra/core-process-identity.ts'));
  let runtime, instance;
  const redis = new (require('ioredis'))(process.env.REDIS_URL);
  try {
    const manifest = { schemaVersion: 1, slug, name: 'Performance gate', description: '', version: '1.0.0',
      runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1', entryModule: 'index.js', permissions: [],
      contracts: [{ name: 'shipping', version: 1 }] };
    const hashValue = hash(Buffer.from(JSON.stringify(manifest)));
    const source = join(directory, 'source'); await mkdir(source);
    await writeFile(join(source, 'manifest.json'), JSON.stringify(manifest));
    await writeFile(join(source, 'index.js'), 'module.exports={register(ctx){ctx.contracts.implement("shipping",1,{quote:()=>({options:[{id:"perf",label:"Performance",amountMinor:0}]})});}};');
    await require(join(root, 'apps/api/src/core/storage/plugin-package-store.ts')).pluginPackageStore.put(slug, hashValue, source);
    await prisma.pluginInstall.create({ data: { slug, name: manifest.name, version: manifest.version, source: 'local-zip',
      trustLevel: 'unsigned', zipHash: hashValue, manifestJson: manifest } });
    instance = await prisma.pluginInstallation.create({ data: { pluginSlug: slug, instanceKey: 'default', enabled: true } });
    const { callContract } = require(join(root, 'apps/api/src/core/admin/extension-installer/plugin-runtime.ts'));
    const invoke = async () => {
      const result = await callContract(slug, 'shipping', 1, 'quote', { currency: 'USD', items: [], subtotalMinor: 0, address: { country: 'US' } });
      assert.equal(result.options[0].amountMinor, 0);
    };
    statements = []; recording = true; const coldStart = performance.now();
    await invoke(); recording = false;
    record({ name: 'callContract-cold-no-namespace', wallMs: performance.now() - coldStart, sql: statements.length, trace: statements });
    await measure('callContract-warm-no-namespace', invoke);
    await measure('migration-gate-warm-no-namespace', () => withPluginMigrationGate(slug, async () => undefined));
    await client.query(`CREATE SCHEMA "${schema}"`);
    await prisma.pluginNamespace.create({ data: { slug, schemaName: schema, publisherKind: 'unsigned', provisionedAt: new Date() } });
    await measure('callContract-warm-with-namespace', invoke);
    await measure('migration-gate-warm-with-namespace', () => withPluginMigrationGate(slug, async () => undefined));
    runtime = database.createPluginDatabaseTestRuntime(url);
    const db = runtime.database(slug, instance.id);
    const query = () => database.withPluginDatabaseInvocation(slug, instance.id,
      () => database.withPluginDatabaseHandler(slug, instance.id, () => db.query('SELECT 1 AS value', [])));
    statements = []; recording = true; const queryStart = performance.now();
    await query(); recording = false;
    record({ name: 'plugin-query-cold', wallMs: performance.now() - queryStart, sql: statements.length, trace: statements });
    await measure('plugin-query-warm', query);
    faultWire = true;
    await measure('broken-transport-cancellation-proof', async () => {
      await assert.rejects(database.withPluginDatabaseInvocation(slug, instance.id,
        () => database.withPluginDatabaseHandler(slug, instance.id, () => db.query('SELECT pg_sleep(0.3)', []))),
      error => error.code === 'DATABASE_UNAVAILABLE');
    });
    faultWire = false;
  } finally {
    recording = false; faultWire = false; clearTimeout(faultTimer);
    await runtime?.close();
    if (instance) await require(join(root, 'apps/api/src/core/admin/extension-installer/plugin-runtime.ts')).dropInternalRuntime(instance.id);
    await core.finishCoreProcess();
    await prisma.pluginOperationLease.deleteMany({ where: { ownerBootNonce: coreProcessIdentity.bootNonce } });
    await prisma.coreProcess.deleteMany({ where: { bootNonce: coreProcessIdentity.bootNonce } });
    await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: slug } });
    await prisma.pluginInstall.deleteMany({ where: { slug } });
    await prisma.pluginNamespace.deleteMany({ where: { slug } });
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    if (instance) {
      const keys = await redis.keys(`jiffoo:protection:plugin:{${instance.id}:*`);
      // The braces enclose both instance and generation; use the precise fixture prefix.
      const generationKeys = await redis.keys(`jiffoo:protection:plugin:{${instance.id}:*}` + '*');
      if (keys.length || generationKeys.length) await redis.del(...new Set([...keys, ...generationKeys]));
    }
    redis.disconnect();
    require(join(root, 'apps/api/src/infra/shared-protection.ts')).sharedProtection.close();
    await require(join(root, 'apps/api/src/core/cache/redis.ts')).redisCache.disconnect();
  }
}

async function polling() {
  const prisma = await prismaEvents();
  const slug = `perf-poll-${randomUUID().slice(0, 12)}`, id = randomUUID(), token = randomUUID();
  const { getPluginInstallOperation } = require(join(root, 'apps/api/src/core/admin/extension-installer/plugin-migration-operation.ts'));
  let timer, transition;
  try {
    await prisma.pluginMigrationOperation.create({ data: { id, slug, actorId: 'perf', packageHash: 'a'.repeat(64),
      packageVersion: '1.0.0', manifestDigest: 'b'.repeat(64), manifest: {}, declarations: [], expectedInstall: null,
      installOptions: {}, leaseToken: token, confirmed: true, phase: 'QUEUED' } });
    await prisma.pluginOperationLease.create({ data: { slug, token, operation: 'perf', acquiredAt: new Date(), expiresAt: new Date(Date.now() + 3600000) } });
    await measure('operation-long-poll-transition-250ms', async () => {
      await originalQuery.call(client, 'UPDATE public.plugin_migration_operations SET phase=\'QUEUED\' WHERE id=$1', [id]);
      transition = new Promise((accept, reject) => {
        timer = setTimeout(() => {
          originalQuery.call(client, 'UPDATE public.plugin_migration_operations SET phase=\'SUCCESS\' WHERE id=$1', [id]).then(accept, reject);
        }, 250);
      });
      const result = await getPluginInstallOperation(id, true, { phase: 'QUEUED', committedPrefix: 0 });
      await transition; assert.equal(result.phase, 'SUCCESS');
    });
    await originalQuery.call(client, 'UPDATE public.plugin_migration_operations SET phase=\'QUEUED\' WHERE id=$1', [id]);
    await measure('operation-long-poll-unchanged-5s', async () => {
      const result = await getPluginInstallOperation(id, true, { phase: 'QUEUED', committedPrefix: 0 });
      assert.equal(result.phase, 'QUEUED');
    });
  } finally {
    recording = false; clearTimeout(timer); await transition?.catch(() => undefined);
    await prisma.pluginOperationLease.deleteMany({ where: { slug, token } });
    await prisma.pluginMigrationOperation.deleteMany({ where: { id, slug } });
    require(join(root, 'apps/api/src/infra/shared-protection.ts')).sharedProtection.close();
    await require(join(root, 'apps/api/src/core/cache/redis.ts')).redisCache.disconnect();
  }
}

try {
  await client.connect(); await guard();
  if (mode === 'audit') await audit();
  else if (mode === 'list') await list();
  else if (mode === 'media') await media();
  else if (mode === 'gates') await gates();
  else if (mode === 'polling') await polling();
  else throw new Error(`Unknown benchmark mode: ${mode}`);
} finally {
  recording = false; Client.prototype.query = originalQuery;
  await client.end(); await rm(directory, { recursive: true, force: true });
  await instrumentedPrisma?.$disconnect();
  unregisterEsm();
}
