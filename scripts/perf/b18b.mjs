import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, join } from 'node:path';
import { readdir, readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createHash, randomUUID, randomBytes } from 'node:crypto';
import { PassThrough } from 'node:stream';
import { performance } from 'node:perf_hooks';

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
const { Client } = require('pg');
const client = new Client({ connectionString: url });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const mode = process.argv[2];
const label = process.argv[3] ?? 'measurement';
let statements = [];
let recording = false;
const originalQuery = Client.prototype.query;
Client.prototype.query = function (sql, ...args) {
  if (recording) statements.push(typeof sql === 'string' ? sql : sql.text);
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
  console.log(JSON.stringify({ label, name, iterations, p50Ms: times[Math.ceil(iterations * .5) - 1],
    p95Ms: times[Math.ceil(iterations * .95) - 1], sqlMin: Math.min(...counts), sqlMax: Math.max(...counts),
    baselineHeapMiB: baseline.heapUsed / 1048576, peakHeapMiB: peakHeap / 1048576,
    baselineRssMiB: baseline.rss / 1048576, peakRssMiB: peakRss / 1048576, trace }, null, 2));
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

try {
  await client.connect(); await guard();
  if (mode === 'audit') await audit();
  else throw new Error(`Unknown benchmark mode: ${mode}`);
} finally {
  recording = false; Client.prototype.query = originalQuery;
  await client.end(); await rm(directory, { recursive: true, force: true });
}
