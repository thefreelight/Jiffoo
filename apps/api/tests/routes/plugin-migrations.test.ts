import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { PassThrough } from 'node:stream';
import archiver from 'archiver';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@/config/database';
import { registerContractV1Runtime } from '@/core/admin/extension-installer/contract-v1-runtime';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, deleteTestUser } from '../helpers/auth';
import { clearTestPluginCache } from '../helpers/plugin-cache';
import { pluginSchemaName, readPluginZipEntries, CERT_PATH, SIGNATURE_PATH, issuePublisherCertificate, signPackage } from 'shared/plugin-signing';
import { testRoot, testPublisher } from '../fixtures/plugin-signing-keys';
import Fastify from 'fastify';
import { fork, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { commitAcknowledgementProxy } from '../helpers/plugin-migration-commit-proxy';
import { createServer, type ServerResponse } from 'node:http';
import { callContract, deliverInstallationEvent, validateCandidateRuntime, dropInternalRuntime } from '@/core/admin/extension-installer/plugin-runtime';
import type { MigrationTestLimits } from '@/core/admin/extension-installer/plugin-migration-test-control';

type File = { path: string; content: Buffer; symlink?: boolean };
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const sqlFile = (sql: string, index = 1): File => ({ path: `migrations/00${index}.sql`, content: Buffer.from(sql) });
const slugs = new Set<string>();
const own = () => { const slug = `migration-${randomUUID().slice(0, 12)}`; slugs.add(slug); return slug; };
let app: FastifyInstance, base: string, token: string, actorId: string;

async function archive(slug: string, files: File[], extra: Record<string, unknown> = {}, source = 'module.exports = { register() {} };', version = '1.0.0') {
  const output = new PassThrough(), chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => { output.on('data', chunk => chunks.push(chunk)); output.on('end', () => resolve(Buffer.concat(chunks))); output.on('error', reject); });
  const zip = archiver('zip'); zip.on('error', error => output.destroy(error)); zip.pipe(output);
  const manifest = { schemaVersion: 1, slug, name: 'Migration fixture', version, description: 'Migration fixture', category: 'integration', runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1', entryModule: 'index.js', permissions: [], contracts: [],
    database: { apiVersion: 1, migrations: files.map((file, index) => ({ id: `step-${index + 1}`, order: index + 1, path: file.path, sha256: sha(file.content) })) }, ...extra };
  zip.append(JSON.stringify(manifest), { name: 'manifest.json' }); zip.append(source, { name: 'index.js' });
  for (const file of files) { if (file.symlink) zip.symlink(file.path, file.content.toString('utf8')); else zip.append(file.content, { name: file.path }); }
  await zip.finalize(); return done;
}
async function upload(bytes: Buffer, route: 'preview' | 'install', fields: Record<string, string> = {}, origin = base) {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  form.set('file', new Blob([new Uint8Array(bytes)], { type: 'application/zip' }), 'migration.zip');
  return fetch(`${origin}/api/v1/extensions/plugin/${route}`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
}
async function signed(bytes: Buffer, publisherId: string) {
  const entries = readPluginZipEntries(bytes).map(entry => ({ path: entry.path, content: entry.content }));
  entries.push({ path: CERT_PATH, content: Buffer.from(JSON.stringify(issuePublisherCertificate(publisherId, publisherId, testPublisher.publicKey, testRoot.privateKey))) });
  entries.sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
  const signature = signPackage(entries.map(entry => ({ path: entry.path, sha256: sha(entry.content) })), testPublisher.privateKey);
  entries.push({ path: SIGNATURE_PATH, content: Buffer.from(JSON.stringify(signature)) });
  const output = new PassThrough(), chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => { output.on('data', chunk => chunks.push(chunk)); output.on('end', () => resolve(Buffer.concat(chunks))); output.on('error', reject); });
  const zip = archiver('zip'); zip.on('error', error => output.destroy(error)); zip.pipe(output);
  for (const entry of entries) zip.append(entry.content, { name: entry.path });
  await zip.finalize(); return done;
}
async function preview(bytes: Buffer, origin = base) {
  const response = await upload(bytes, 'preview', {}, origin); expect(response.status).toBe(200); return (await response.json()).data;
}
async function start(bytes: Buffer, confirmed = true, origin = base) {
  const plan = await preview(bytes, origin);
  const accepted = await upload(bytes, 'install', { previewToken: plan.previewToken, confirmUnsigned: 'true', confirmationSlug: plan.package.slug, ...(confirmed ? { confirmMigrations: 'true' } : {}) }, origin);
  return { accepted, plan };
}
async function terminal(operationId: string, expected = 'SUCCESS', origin = base) {
  const deadline = Date.now() + 25_000;
  let cursor = '';
  while (Date.now() < deadline) {
    const response = await fetch(`${origin}/api/v1/extensions/plugin/operations/${operationId}?wait=true${cursor}`, { headers: { authorization: `Bearer ${token}` } });
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store');
    const state = (await response.json()).data;
    if (state.terminal) { expect(state.phase).toBe(expected); return state; }
    cursor = `&phase=${encodeURIComponent(state.phase)}&committedPrefix=${state.committedPrefix}`;
  }
  throw new Error('Operation did not terminate');
}

type Barrier = { kind: string; stage: string; operationId: string; order: number };
async function apiChild(heldStage: string, heldOrder = 1, statementTimeoutMs?: number, databaseUrl = process.env.DATABASE_URL, limits: MigrationTestLimits = {}) {
  const child = fork(path.resolve('tests/helpers/plugin-migration-api-child.ts'), [], { execArgv: ['--import', 'tsx'], env: { ...process.env, DATABASE_URL: databaseUrl, NODE_ENV: 'test', JIFFOO_TEST_PLUGIN_MIGRATION_CONTROL: '1' }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  const pending: Barrier[] = []; let notify: (() => void) | undefined;
  const held = new Set<Barrier>();
  let diagnostics = '';
  child.stderr?.on('data', chunk => { diagnostics += chunk.toString(); });
  child.stdout?.on('data', () => undefined);
  let ready!: (base: string) => void;
  let draining!: (id: string) => void;
  const drained = new Promise<string>(resolve => { draining = resolve; });
  let renewed!: (id: string) => void;
  const renewal = new Promise<string>(resolve => { renewed = resolve; });
  const started = new Promise<string>((resolve, reject) => { ready = resolve; child.once('error', reject); child.once('exit', code => reject(new Error(`API child exited before readiness: ${code}: ${diagnostics}`))); });
  const release = (message: Barrier, timeout = statementTimeoutMs) => { held.delete(message); child.send({ ...message, ...limits, statementTimeoutMs: timeout ?? limits.statementTimeoutMs, kind: 'plugin-migration-release' }); };
  child.on('message', value => {
    const message = value as Barrier & { base?: string };
    if (message.kind === 'ready') { ready(message.base!); return; }
    if (message.kind === 'plugin-migration-draining') { draining(message.operationId); return; }
    if (message.kind === 'plugin-migration-renewed') { renewed(message.operationId); return; }
    if (message.kind !== 'plugin-migration-barrier') return;
    if (message.stage === heldStage && message.order === heldOrder) { held.add(message); pending.push(message); notify?.(); }
    else release(message);
  });
  const origin = await started;
  return { child, origin, release, draining: drained, renewal, nextRenewal: () => new Promise<string>(resolve => {
    const observe = (value: unknown) => { const message = value as Barrier; if (message.kind === 'plugin-migration-renewed') { child.off('message', observe); resolve(message.operationId); } };
    child.on('message', observe);
  }), next: async () => {
    while (!pending.length) await new Promise<void>(resolve => { notify = resolve; });
    notify = undefined; return pending.shift()!;
  }, close: async () => {
    for (const message of held) release(message);
    pending.splice(0);
    child.removeAllListeners('message');
    child.on('message', value => { const message = value as Barrier; if (message.kind === 'plugin-migration-barrier') release(message); });
    const exited = once(child, 'exit'); child.send({ kind: 'shutdown' }); await exited;
  } };
}
async function install(bytes: Buffer, expected = 'SUCCESS') {
  const { accepted } = await start(bytes); expect(accepted.status).toBe(202);
  return terminal((await accepted.json()).data.operationId, expected);
}

beforeAll(async () => {
  app = await createTestApp({ disableFileSystem: false });
  const admin = await createAdminWithToken(); token = admin.token; actorId = admin.user.id;
  base = await app.listen({ host: '127.0.0.1', port: 0 });
});
afterEach(async () => {
  for (const slug of slugs) {
    await clearTestPluginCache(slug);
    await prisma.pluginInstall.deleteMany({ where: { slug } });
    const namespace = await prisma.pluginNamespace.findUnique({ where: { slug } });
    if (namespace) {
      expect(namespace.schemaName).toBe(pluginSchemaName(slug));
      await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${namespace.schemaName}" CASCADE`);
      await prisma.pluginMigrationAttempt.deleteMany({ where: { namespaceId: namespace.id } });
      await prisma.pluginMigrationSuccess.deleteMany({ where: { namespaceId: namespace.id } });
      await prisma.pluginNamespace.delete({ where: { id: namespace.id } });
    }
    await prisma.pluginMigrationOperation.deleteMany({ where: { slug } });
    await prisma.adminAuditEvent.deleteMany({ where: { targetId: slug } });
  }
  slugs.clear();
});
afterAll(async () => { await app.close(); await deleteTestUser(actorId); });

describe('Declared plugin migrations over real TCP', () => {
  it('G unqualified migration CREATE targets only the plugin schema with public excluded', async () => {
    const slug = own(), table = `scope_${randomUUID().replaceAll('-', '')}`;
    await install(await archive(slug, [sqlFile(`CREATE TABLE ${table} (path TEXT); INSERT INTO ${table} VALUES (current_setting('search_path'));`)]));
    const schema = pluginSchemaName(slug);
    const rows = await prisma.$queryRawUnsafe<Array<{ path: string }>>(`SELECT path FROM "${schema}".${table}`);
    expect(rows.map(row => row.path.replaceAll('"', ''))).toEqual([schema]);
    expect(await prisma.$queryRaw`SELECT n.nspname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = ${table}`).toEqual([{ nspname: schema }]);
  });
  it('D dedicated migration runs are limited to two and further leased operations remain QUEUED', async () => {
    const child = await apiChild('before-file', 1);
    try {
      const ids: string[] = [];
      for (let index = 0; index < 2; index++) {
        const { accepted } = await start(await archive(own(), [sqlFile('CREATE TABLE records (id INTEGER);')]), true, child.origin);
        expect(accepted.status).toBe(202); ids.push((await accepted.json()).data.operationId);
      }
      const first = await child.next(), second = await child.next();
      const queuedSlug = own();
      const { accepted } = await start(await archive(queuedSlug, [sqlFile('CREATE TABLE records (id INTEGER);')]), true, child.origin);
      expect(accepted.status).toBe(202); const queuedId = (await accepted.json()).data.operationId; ids.push(queuedId);
      expect(await prisma.pluginMigrationOperation.findUnique({ where: { id: queuedId } })).toMatchObject({ phase: 'QUEUED', startedAt: null });
      expect(await prisma.pluginOperationLease.findUnique({ where: { slug: queuedSlug } })).not.toBeNull();
      const active = await prisma.$queryRaw<Array<{ id: string }>>`SELECT application_name AS id FROM pg_stat_activity WHERE application_name IN (${`jiffoo-plugin-migration:${first.operationId}`}, ${`jiffoo-plugin-migration:${second.operationId}`}, ${`jiffoo-plugin-migration:${queuedId}`})`;
      expect(active).toHaveLength(2);
      child.release(first); await terminal(first.operationId, 'SUCCESS', child.origin);
      const third = await child.next(); expect(third.operationId).toBe(queuedId);
      child.release(second); child.release(third);
      for (const id of ids) await terminal(id, 'SUCCESS', child.origin);
    } finally { await child.close(); }
  });
  const invalid = ['missing file', 'extra file', 'outside migrations', 'duplicate id', 'duplicate order', 'nonconsecutive order', 'absolute path', 'backslash', 'parent path', 'wrong hash', 'uppercase hash', 'BOM', 'NUL', 'invalid UTF-8', 'wrong API version'] as const;
  it.each(invalid.flatMap(kind => ['preview', 'install'].map(route => [kind, route] as const)))('A rejects %s at %s without namespace or publication', async (kind, route) => {
    const slug = own(), first = sqlFile('CREATE TABLE records (id INTEGER PRIMARY KEY);');
    let files = [first];
    const declarations = [{ id: 'one', order: 1, path: first.path, sha256: sha(first.content) }];
    let apiVersion = 1;
    if (kind === 'missing file') files = [];
    if (kind === 'extra file') files.push(sqlFile('SELECT 1;', 2));
    if (kind === 'outside migrations') { files = [{ ...first, path: 'outside.sql' }]; declarations[0].path = 'outside.sql'; }
    if (kind === 'duplicate id' || kind === 'duplicate order') { files.push(sqlFile('SELECT 1;', 2)); declarations.push({ id: kind === 'duplicate id' ? 'one' : 'two', order: kind === 'duplicate order' ? 1 : 2, path: files[1].path, sha256: sha(files[1].content) }); }
    if (kind === 'nonconsecutive order') declarations[0].order = 2;
    if (kind === 'absolute path') declarations[0].path = '/migrations/001.sql';
    if (kind === 'backslash') declarations[0].path = 'migrations\\001.sql';
    if (kind === 'parent path') declarations[0].path = 'migrations/../001.sql';
    if (kind === 'wrong hash') declarations[0].sha256 = '0'.repeat(64);
    if (kind === 'uppercase hash') declarations[0].sha256 = 'A'.repeat(64);
    if (kind === 'wrong API version') apiVersion = 2;
    if (['BOM', 'NUL', 'invalid UTF-8'].includes(kind)) {
      files[0] = { ...first, content: kind === 'BOM' ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), first.content]) : kind === 'NUL' ? Buffer.from('SELECT\0 1;') : Buffer.from([0xc0, 0xaf]) };
      declarations[0].sha256 = sha(files[0].content);
    }
    const bytes = await archive(slug, files, { database: { apiVersion, migrations: declarations } });
    const response = await upload(bytes, route as 'preview' | 'install');
    expect(response.status).toBe(422); expect((await response.json()).error.code).toBe('PLUGIN_MIGRATION_MANIFEST_INVALID');
    expect(await prisma.pluginNamespace.count({ where: { slug } })).toBe(0);
    expect(await prisma.pluginInstall.count({ where: { slug } })).toBe(0);
  });

  it.each(['module', 'default'])('A legacy %s exports are checked at candidate load before SQL and namespace claims', async shape => {
    const slug = own();
    const source = shape === 'module' ? 'module.exports = { register() {}, migrations: [] };' : 'module.exports = { default: { register() {}, migrations: [] } };';
    const bytes = await archive(slug, [sqlFile('CREATE TABLE records (id INTEGER);')], {}, source);
    const state = await install(bytes, 'FAILED'); expect(state.errorCode).toBe('PLUGIN_MIGRATION_LEGACY_FORMAT');
    expect(await prisma.pluginNamespace.count({ where: { slug } })).toBe(0); expect(await prisma.pluginInstall.count({ where: { slug } })).toBe(0);
    expect(await prisma.pluginMigrationSuccess.count({ where: { operationId: state.operationId } })).toBe(0);
    expect(await prisma.pluginMigrationAttempt.count({ where: { operationId: state.operationId } })).toBe(0);
  });
  it.each(['duplicate path', 'case alias', 'symlink', 'encoding alias'].flatMap(kind => ['preview', 'install'].map(route => [kind, route] as const)))('A rejects %s package paths at %s', async (kind, route) => {
    const slug = own(), first = sqlFile('SELECT 1;');
    let files: File[] = [first];
    let extra: Record<string, unknown> = {};
    if (kind === 'duplicate path') {
      files.push(sqlFile('SELECT 2;', 2));
      extra = { database: { apiVersion: 1, migrations: files.map((file, index) => ({ id: `id-${index}`, order: index + 1, path: first.path, sha256: sha(file.content) })) } };
    } else if (kind === 'case alias') files.push({ ...first, path: 'migrations/001.SQL' });
    else if (kind === 'symlink') files = [{ ...first, content: Buffer.from('target.sql'), symlink: true }];
    else files = [{ ...first, path: 'migrations/e\u0301.sql' }];
    const response = await upload(await archive(slug, files, extra), route as 'preview' | 'install');
    expect(response.status).toBe(422); expect((await response.json()).error.code).toBe(kind === 'duplicate path' ? 'PLUGIN_MIGRATION_MANIFEST_INVALID' : 'PACKAGE_CONTENT_MISMATCH');
    expect(await prisma.pluginNamespace.count({ where: { slug } })).toBe(0); expect(await prisma.pluginInstall.count({ where: { slug } })).toBe(0);
  });
  it.each(['modified', 'removed', 'inserted', 'reordered'].flatMap(kind => ['preview', 'install'].map(route => [kind, route] as const)))('A rejects %s applied prefixes at %s after a preview-bound partial operation', async (kind, route) => {
    const slug = own(), first = sqlFile('CREATE TABLE records (id INTEGER PRIMARY KEY); INSERT INTO records VALUES (1);'), second = sqlFile('INSERT INTO records VALUES (1);', 2);
    const candidateFiles = kind === 'modified' ? [sqlFile('SELECT 1;')] : kind === 'removed' ? [] : kind === 'inserted' ? [{ path: 'migrations/000.sql', content: Buffer.from('SELECT 1;') }, first, second] : [second, first];
    const candidate = await archive(slug, candidateFiles, {}, undefined, '2.0.0');
    const before = await preview(candidate);
    const failed = await install(await archive(slug, [first, second]), 'NEEDS_RECOVERY'); expect(failed.committedPrefix).toBe(1);
    const response = await upload(candidate, route as 'preview' | 'install', route === 'install' ? { previewToken: before.previewToken, confirmUnsigned: 'true', confirmationSlug: slug, confirmMigrations: 'true' } : {});
    expect(response.status).toBe(409); expect((await response.json()).error.code).toBe('PLUGIN_MIGRATION_DRIFT');
    expect(await prisma.pluginInstall.count({ where: { slug } })).toBe(0);
    const namespace = await prisma.pluginNamespace.findUniqueOrThrow({ where: { slug } }); expect(await prisma.pluginMigrationSuccess.count({ where: { namespaceId: namespace.id } })).toBe(1);
  });
  it('A runtime registration rejects a legacy empty export without executing register', async () => {
    const runtime = Fastify(); let registered = false;
    try { await expect(registerContractV1Runtime(runtime, { register() { registered = true; }, migrations: [] }, { slug: 'runtime-legacy', installationId: 'legacy', version: '1.0.0', config: {}, declaredContracts: [], subscriptions: [] })).rejects.toMatchObject({ code: 'PLUGIN_MIGRATION_LEGACY_FORMAT', statusCode: 422 }); expect(registered).toBe(false); }
    finally { await runtime.close(); }
  });
  it('B confirmation is explicit and audited; each multi-statement file commits one success and attempt', async () => {
    const slug = own(), bytes = await archive(slug, [sqlFile('CREATE TABLE records (id INTEGER PRIMARY KEY); INSERT INTO records VALUES (1);'), sqlFile('INSERT INTO records VALUES (2); INSERT INTO records VALUES (3);', 2)]);
    const unconfirmed = await start(bytes, false); expect(unconfirmed.plan.migrationPlan.pending).toHaveLength(2); expect(unconfirmed.plan.migrationPlan.provisionNamespace).toBe(true);
    expect(unconfirmed.accepted.status).toBe(409); expect((await unconfirmed.accepted.json()).error.code).toBe('PLUGIN_MIGRATION_CONFIRMATION_REQUIRED');
    expect(await prisma.pluginNamespace.count({ where: { slug } })).toBe(0);
    const state = await install(bytes); expect(state.committedPrefix).toBe(2); expect(state.result).toMatchObject({ kind: 'plugin', slug, version: '1.0.0', warnings: [], filename: 'migration.zip', size: bytes.length });
    const namespace = await prisma.pluginNamespace.findUniqueOrThrow({ where: { slug } });
    expect(await prisma.$queryRawUnsafe(`SELECT id FROM "${namespace.schemaName}".records ORDER BY id`)).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    const ledger = await prisma.pluginMigrationSuccess.findMany({ where: { namespaceId: namespace.id }, orderBy: { order: 'asc' } });
    expect(ledger).toHaveLength(2); expect(ledger.map(row => row.order)).toEqual([1, 2]);
    for (const row of ledger) expect(row).toMatchObject({ actorId, operationId: state.operationId, packageVersion: '1.0.0' });
    expect(await prisma.pluginMigrationAttempt.count({ where: { operationId: state.operationId, status: 'SUCCESS' } })).toBe(2);
    expect(await prisma.adminAuditEvent.count({ where: { targetId: slug, action: 'PLUGIN_MIGRATIONS_CONFIRMED' } })).toBe(1);
  });
  it.each(['BEGIN; SELECT 1; COMMIT;', 'VACUUM;', 'CREATE DATABASE forbidden;', 'CREATE INDEX CONCURRENTLY bad ON records (id);', 'COPY records FROM STDIN;', '\\copy records FROM file', 'SET statement_timeout = 0;'])('B rejects nontransactional or session SQL %s at preview', async sql => {
    const slug = own(), response = await upload(await archive(slug, [sqlFile(sql)]), 'preview');
    expect(response.status).toBe(422); expect((await response.json()).error.code).toBe('PLUGIN_MIGRATION_MANIFEST_INVALID');
    expect(await prisma.pluginNamespace.count({ where: { slug } })).toBe(0);
  });
  it('B a first-file failure rolls back its schema and data but preserves the failed attempt', async () => {
    const slug = own(), state = await install(await archive(slug, [sqlFile('CREATE TABLE records (id INTEGER PRIMARY KEY); INSERT INTO records VALUES (1); INSERT INTO records VALUES (1);')]), 'FAILED');
    expect(state.errorCode).toBe('PLUGIN_MIGRATION_FAILED'); expect(state.committedPrefix).toBe(0);
    const namespace = await prisma.pluginNamespace.findUniqueOrThrow({ where: { slug } }); expect(namespace.provisionedAt).toBeNull();
    expect(await prisma.$queryRaw`SELECT 1 FROM pg_namespace WHERE nspname = ${namespace.schemaName}`).toEqual([]);
    expect(await prisma.pluginMigrationSuccess.count({ where: { namespaceId: namespace.id } })).toBe(0);
    expect(await prisma.pluginMigrationAttempt.findFirst({ where: { operationId: state.operationId } })).toMatchObject({ status: 'FAILED', sqlstate: '23505', errorCode: 'PLUGIN_MIGRATION_FAILED' });
  });
  it('B namespace-only provisioning has its own successful attempt and audit without a file ledger', async () => {
    const slug = own(), state = await install(await archive(slug, []));
    expect(state.committedPrefix).toBe(0);
    expect(await prisma.pluginMigrationSuccess.count({ where: { operationId: state.operationId } })).toBe(0);
    expect(await prisma.pluginMigrationAttempt.findFirst({ where: { operationId: state.operationId } })).toMatchObject({ order: 0, status: 'SUCCESS', path: '@namespace' });
    expect(await prisma.adminAuditEvent.findFirst({ where: { targetId: slug, action: 'PLUGIN_NAMESPACE_PROVISIONED' } })).not.toBeNull();
  });
  it('D lifecycle preserves data and history, audits unsigned to signed and retains publisher ownership after purge', async () => {
    const slug = own(), file = sqlFile('CREATE TABLE records (id INTEGER PRIMARY KEY); INSERT INTO records VALUES (7);');
    await install(await archive(slug, [file]));
    const namespace = await prisma.pluginNamespace.findUniqueOrThrow({ where: { slug } });
    const ledger = await prisma.pluginMigrationSuccess.findMany({ where: { namespaceId: namespace.id } });
    const instance = await prisma.pluginInstallation.findFirstOrThrow({ where: { pluginSlug: slug } });
    for (const enabled of [true, false]) {
      const response = await fetch(`${base}/api/v1/extensions/plugin/${slug}/instances/${instance.id}`, { method: 'PATCH', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ enabled }) }); expect(response.status).toBe(200);
    }
    const lifecycle = (method: string, suffix: string, body?: unknown) => fetch(`${base}/api/v1/extensions/plugin/${slug}${suffix}`, { method, headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    expect((await lifecycle('DELETE', '')).status).toBe(200); expect((await lifecycle('POST', '/restore')).status).toBe(200);
    expect(await prisma.pluginMigrationSuccess.findMany({ where: { namespaceId: namespace.id } })).toEqual(ledger);
    const upgraded = await signed(await archive(slug, [file], {}, undefined, '2.0.0'), 'publisher-one');
    await install(upgraded);
    expect(await prisma.pluginNamespace.findUnique({ where: { slug } })).toMatchObject({ id: namespace.id, publisherKind: 'signed', publisherId: 'publisher-one' });
    expect(await prisma.adminAuditEvent.count({ where: { targetId: slug, action: 'PLUGIN_NAMESPACE_SIGNED' } })).toBe(1);
    expect((await lifecycle('DELETE', '')).status).toBe(200); expect((await lifecycle('DELETE', '/purge', { confirmationSlug: slug })).status).toBe(200);
    expect(await prisma.pluginInstall.count({ where: { slug } })).toBe(0);
    expect(await prisma.$queryRawUnsafe(`SELECT id FROM "${namespace.schemaName}".records`)).toEqual([{ id: 7 }]);
    expect(await prisma.pluginMigrationSuccess.findMany({ where: { namespaceId: namespace.id } })).toEqual(ledger);
    for (const [bytes, code] of [[await signed(await archive(slug, [file], {}, undefined, '3.0.0'), 'publisher-two'), 'PUBLISHER_CHANGE_FORBIDDEN'], [await archive(slug, [file], {}, undefined, '3.0.0'), 'SIGNED_UPGRADE_REQUIRED']] as const) {
      const rejected = await upload(bytes, 'preview'); expect(rejected.status).toBe(409); expect((await rejected.json()).error.code).toBe(code);
    }
    await install(upgraded); expect(await prisma.pluginMigrationSuccess.findMany({ where: { namespaceId: namespace.id } })).toEqual(ledger);
    expect(await prisma.$queryRawUnsafe(`SELECT id FROM "${namespace.schemaName}".records`)).toEqual([{ id: 7 }]);
  });
  it.each(['lock', 'statement', 'deadline'])('B real %s timeout preserves the attempt and returns no running connection', async kind => {
    const slug = own(), key = Math.floor(Math.random() * 1_000_000_000) + 1;
    let unlocked!: () => void, locked!: () => void;
    const ready = new Promise<void>(resolve => { locked = resolve; });
    const release = new Promise<void>(resolve => { unlocked = resolve; });
    const blocker = prisma.$transaction(async tx => { await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock($1::bigint)', key); locked(); await release; }, { timeout: 25_000 });
    await ready;
    const child = await apiChild('before-file', 1, kind === 'statement' ? 100 : undefined, undefined, { lockTimeoutMs: kind === 'lock' ? 100 : 1_000, ...(kind === 'deadline' ? { deadlineMs: 100 } : {}) });
    try {
      const bytes = await archive(slug, [sqlFile(`SELECT pg_advisory_xact_lock(${key}::bigint);`)]);
      const { accepted } = await start(bytes, true, child.origin); expect(accepted.status).toBe(202);
      const id = (await accepted.json()).data.operationId;
      const barrier = await child.next(); child.release(barrier);
      const state = await terminal(id, 'FAILED', child.origin); expect(state.errorCode).toBe('PLUGIN_MIGRATION_FAILED');
      expect(await prisma.pluginMigrationAttempt.findFirst({ where: { operationId: id } })).toMatchObject({ status: 'FAILED', ...(kind === 'deadline' ? {} : { sqlstate: kind === 'statement' ? '57014' : '55P03' }) });
      expect(await prisma.$queryRaw`SELECT 1 FROM pg_stat_activity WHERE application_name = ${`jiffoo-plugin-migration:${id}`}`).toEqual([]);
      expect(await prisma.pluginMigrationSuccess.count({ where: { operationId: id } })).toBe(0);
    } finally { unlocked(); await blocker; await child.close(); }
  });
  it('B short lease renewal updates the real lease and a lost token fences SQL before execution', async () => {
    const slug = own(), child = await apiChild('before-file', 1, undefined, undefined, { renewalIntervalMs: 10 });
    try {
      const { accepted } = await start(await archive(slug, [sqlFile('CREATE TABLE records (id INTEGER);')]), true, child.origin); expect(accepted.status).toBe(202);
      const id = (await accepted.json()).data.operationId, barrier = await child.next();
      const before = await prisma.pluginOperationLease.findUniqueOrThrow({ where: { slug } });
      expect(await child.nextRenewal()).toBe(id);
      const renewed = await prisma.pluginOperationLease.findUniqueOrThrow({ where: { slug } }); expect(renewed.expiresAt.getTime()).toBeGreaterThan(before.expiresAt.getTime()); expect(renewed.token).toBe(before.token);
      await prisma.pluginOperationLease.update({ where: { slug }, data: { token: 'replacement-owner' } });
      child.release(barrier); const failed = await terminal(id, 'NEEDS_RECOVERY', child.origin); expect(failed.errorCode).toBe('PLUGIN_MIGRATION_OUTCOME_UNKNOWN');
      expect((await prisma.pluginOperationLease.findUniqueOrThrow({ where: { slug } })).token).toBe('replacement-owner');
      expect(await prisma.pluginMigrationSuccess.count({ where: { operationId: id } })).toBe(0);
      expect(await prisma.pluginMigrationAttempt.findFirst({ where: { operationId: id } })).toMatchObject({ status: 'UNKNOWN', errorCode: null });
      const namespace = await prisma.pluginNamespace.findUniqueOrThrow({ where: { slug } }); expect(namespace.provisionedAt).toBeNull();
    } finally { await child.close(); await prisma.pluginOperationLease.deleteMany({ where: { slug } }); }
  });
  it('B short bounded drain fails before SQL while the actual plugin invocation remains latched', async () => {
    let entered!: () => void; const ready = new Promise<void>(resolve => { entered = resolve; });
    let heldResponse: ServerResponse | undefined;
    const latch = createServer((_request, response) => { heldResponse = response; entered(); });
    latch.listen(0, '127.0.0.1'); await once(latch, 'listening');
    const address = latch.address(); if (!address || typeof address === 'string') throw new Error('Latch has no port');
    const slug = own(), first = sqlFile('CREATE TABLE records (id INTEGER PRIMARY KEY); INSERT INTO records VALUES (1);');
    const source = `module.exports={register(ctx){ctx.http.route({method:'GET',path:'/hold',handler:async()=>{await fetch('http://127.0.0.1:${address.port}');return{ok:true};}});}};`;
    await install(await archive(slug, [first], {}, source));
    const instance = await prisma.pluginInstallation.findFirstOrThrow({ where: { pluginSlug: slug } });
    expect((await fetch(`${base}/api/v1/extensions/plugin/${slug}/instances/${instance.id}`, { method: 'PATCH', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ enabled: true }) })).status).toBe(200);
    const invocation = fetch(`${base}/api/v1/extensions/plugin/${slug}/api/hold`); await ready;
    const child = await apiChild('before-drain', 0, undefined, undefined, { drainTimeoutMs: 100 });
    try {
      const { accepted } = await start(await archive(slug, [first, sqlFile('INSERT INTO records VALUES (2);', 2)], {}, source, '2.0.0'), true, child.origin); expect(accepted.status).toBe(202);
      const id = (await accepted.json()).data.operationId; child.release(await child.next()); expect(await child.draining).toBe(id);
      const failed = await terminal(id, 'FAILED', child.origin); expect(failed.errorCode).toBe('PLUGIN_MAINTENANCE');
      expect(await prisma.pluginMigrationAttempt.count({ where: { operationId: id } })).toBe(0);
      const namespace = await prisma.pluginNamespace.findUniqueOrThrow({ where: { slug } }); expect(await prisma.$queryRawUnsafe(`SELECT id FROM "${namespace.schemaName}".records`)).toEqual([{ id: 1 }]);
      expect(await prisma.pluginOperationLease.count({ where: { operation: `plugin-invocation:${slug}` } })).toBe(1);
    } finally { heldResponse?.end('{}'); await invocation; await child.close(); await new Promise<void>(resolve => latch.close(() => resolve())); }
  });
  it('C two API processes reject concurrent ownership and apply each file exactly once', async () => {
    const slug = own(), bytes = await archive(slug, [sqlFile('CREATE TABLE records (id INTEGER PRIMARY KEY); INSERT INTO records VALUES (1);'), sqlFile('INSERT INTO records VALUES (2);', 2)]);
    const child = await apiChild('before-file', 1);
    try {
      const { accepted } = await start(bytes, true, child.origin); expect(accepted.status).toBe(202);
      const id = (await accepted.json()).data.operationId; const barrier = await child.next();
      const competing = await start(bytes); expect(competing.accepted.status).toBe(409); expect((await competing.accepted.json()).error.code).toBe('PLUGIN_OPERATION_IN_PROGRESS');
      child.release(barrier); await terminal(id, 'SUCCESS', child.origin);
      const namespace = await prisma.pluginNamespace.findUniqueOrThrow({ where: { slug } });
      expect(await prisma.pluginMigrationSuccess.count({ where: { namespaceId: namespace.id } })).toBe(2);
      expect(await prisma.$queryRawUnsafe(`SELECT id FROM "${namespace.schemaName}".records ORDER BY id`)).toEqual([{ id: 1 }, { id: 2 }]);
    } finally { await child.close(); }
  });
  it('C initial and changed-prefix long polls return the actual in-flight snapshot promptly', async () => {
    const slug = own(), child = await apiChild('before-commit', 2);
    try {
      const bytes = await archive(slug, [sqlFile('CREATE TABLE records (id INTEGER); INSERT INTO records VALUES (1);'), sqlFile('INSERT INTO records VALUES (2);', 2)]);
      const { accepted } = await start(bytes, true, child.origin); expect(accepted.status).toBe(202);
      const id = (await accepted.json()).data.operationId, barrier = await child.next();
      for (const cursor of ['', '&phase=MIGRATING&committedPrefix=0']) {
        const response = await fetch(`${child.origin}/api/v1/extensions/plugin/operations/${id}?wait=true${cursor}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(1_000) });
        expect(response.status).toBe(200); expect((await response.json()).data).toMatchObject({ phase: 'MIGRATING', committedPrefix: 1, terminal: false });
      }
      child.release(barrier); await terminal(id, 'SUCCESS', child.origin);
    } finally { await child.close(); }
  });
  it('C pauses gateway, contracts and events, drains actual invocations and keeps another plugin and store serving', async () => {
    const responses: ServerResponse[] = []; let entered!: () => void;
    const ready = new Promise<void>(resolve => { entered = resolve; });
    const latch = createServer((_request, response) => { responses.push(response); if (responses.length === 3) entered(); });
    latch.listen(0, '127.0.0.1'); await once(latch, 'listening');
    const address = latch.address(); if (!address || typeof address === 'string') throw new Error('Latch has no port');
    const url = `http://127.0.0.1:${address.port}`;
    const slug = own(), other = own(), first = sqlFile('CREATE TABLE records (id INTEGER PRIMARY KEY); INSERT INTO records VALUES (1);');
    const source = `module.exports={register(ctx){ctx.http.route({method:'GET',path:'/status',handler:async()=>({version:ctx.plugin.version})});ctx.http.route({method:'GET',path:'/hold',handler:async()=>{await fetch(${JSON.stringify(url)});return{ok:true};}});ctx.contracts.implement('shipping',1,{quote:async()=>{await fetch(${JSON.stringify(url)});return{options:[{id:'one',label:'One',amountMinor:0}]};}});ctx.events.subscribe('order.created',1,async()=>{await fetch(${JSON.stringify(url)});});}};`;
    const declarations = { contracts: [{ name: 'shipping', version: 1 }], subscriptions: [{ type: 'order.created', version: 1 }] };
    await install(await archive(slug, [first], declarations, source));
    await install(await archive(other, [], {}, "module.exports={register(ctx){ctx.http.route({method:'GET',path:'/status',handler:async()=>({ok:true})});}};"));
    for (const name of [slug, other]) {
      const instance = await prisma.pluginInstallation.findFirstOrThrow({ where: { pluginSlug: name } });
      const enabled = await fetch(`${base}/api/v1/extensions/plugin/${name}/instances/${instance.id}`, { method: 'PATCH', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ enabled: true }) }); expect(enabled.status).toBe(200);
    }
    const instance = await prisma.pluginInstallation.findFirstOrThrow({ where: { pluginSlug: slug } });
    const event = { id: randomUUID(), type: 'order.created' as const, version: 1 as const, aggregateId: slug, occurredAt: new Date().toISOString(), attempt: 1, data: { id: slug, userId: actorId, totalAmount: 10, currency: 'USD', items: [] } };
    const contractInput = { currency: 'USD', items: [], subtotalMinor: 0, address: { country: 'US' } };
    const gateway = fetch(`${base}/api/v1/extensions/plugin/${slug}/api/hold`);
    const contract = callContract(slug, 'shipping', 1, 'quote', contractInput);
    const delivery = deliverInstallationEvent(instance.id, event);
    await ready;
    const child = await apiChild('before-drain', 0);
    try {
      const next = await archive(slug, [first, sqlFile('INSERT INTO records VALUES (2);', 2)], declarations, source, '2.0.0');
      const { accepted } = await start(next, true, child.origin); expect(accepted.status).toBe(202); const id = (await accepted.json()).data.operationId;
      const barrier = await child.next();
      const paused = await fetch(`${base}/api/v1/extensions/plugin/${slug}/api/status`); expect(paused.status).toBe(503); expect((await paused.json()).error.code).toBe('PLUGIN_MAINTENANCE');
      await expect(callContract(slug, 'shipping', 1, 'quote', contractInput)).rejects.toMatchObject({ code: 'PLUGIN_MAINTENANCE', statusCode: 503 });
      await expect(deliverInstallationEvent(instance.id, event)).rejects.toMatchObject({ code: 'PLUGIN_MAINTENANCE', statusCode: 503 });
      expect((await fetch(`${base}/api/v1/extensions/plugin/${other}/api/status`)).status).toBe(200);
      expect((await fetch(`${base}/api/v1/products/`)).status).toBe(200);
      const namespace = await prisma.pluginNamespace.findUniqueOrThrow({ where: { slug } });
      expect(await prisma.$queryRawUnsafe(`SELECT id FROM "${namespace.schemaName}".records ORDER BY id`)).toEqual([{ id: 1 }]);
      child.release(barrier); expect(await child.draining).toBe(id);
      for (const response of responses) response.end('{}');
      expect((await gateway).status).toBe(200); await contract; await delivery;
      await terminal(id, 'SUCCESS', child.origin);
      expect(await prisma.$queryRawUnsafe(`SELECT id FROM "${namespace.schemaName}".records ORDER BY id`)).toEqual([{ id: 1 }, { id: 2 }]);
    } finally {
      for (const response of responses) response.end('{}');
      await Promise.allSettled([gateway, contract, delivery]); await child.close();
      await new Promise<void>(resolve => latch.close(() => resolve()));
    }
  });
  it('C candidate validation, runtime prewarm and fresh-process startup never re-execute SQL files', async () => {
    const slug = own(), file = sqlFile('CREATE TABLE records (id INTEGER PRIMARY KEY); INSERT INTO records VALUES (1);');
    const source = "module.exports={register(ctx){ctx.http.route({method:'GET',path:'/status',handler:async()=>({ok:true})});}};";
    await install(await archive(slug, [file], {}, source));
    const instance = await prisma.pluginInstallation.findFirstOrThrow({ where: { pluginSlug: slug } });
    const row = await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } });
    await validateCandidateRuntime(slug, row.zipHash!, row.manifestJson as never, instance.id, {});
    const enabled = await fetch(`${base}/api/v1/extensions/plugin/${slug}/instances/${instance.id}`, { method: 'PATCH', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ enabled: true }) }); expect(enabled.status).toBe(200);
    await dropInternalRuntime(instance.id);
    expect((await fetch(`${base}/api/v1/extensions/plugin/${slug}/api/status`)).status).toBe(200);
    const child = await apiChild('unused');
    try { expect((await fetch(`${child.origin}/api/v1/extensions/plugin/${slug}/api/status`)).status).toBe(200); }
    finally { await child.close(); }
    const namespace = await prisma.pluginNamespace.findUniqueOrThrow({ where: { slug } });
    expect(await prisma.pluginMigrationSuccess.count({ where: { namespaceId: namespace.id } })).toBe(1);
    expect(await prisma.pluginMigrationAttempt.count({ where: { namespaceId: namespace.id, order: 1 } })).toBe(1);
    expect(await prisma.$queryRawUnsafe(`SELECT id FROM "${namespace.schemaName}".records`)).toEqual([{ id: 1 }]);
  });
  it('C non-test startup rejects the explicit migration control switch before serving', () => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'tests/helpers/plugin-migration-api-child.ts'], { env: { ...process.env, NODE_ENV: 'production', JIFFOO_TEST_PLUGIN_MIGRATION_CONTROL: '1' }, encoding: 'utf8', windowsHide: true });
    expect(result.status).toBe(1); expect(result.stderr).toContain('Plugin migration test controls are not permitted outside NODE_ENV=test');
  });
  it('H a real lost COMMIT acknowledgement is recorded and reconciled from the ledger before retry', async () => {
    const proxy = await commitAcknowledgementProxy(process.env.DATABASE_URL!);
    const child = await apiChild('before-commit', 1, undefined, proxy.databaseUrl);
    const slug = own();
    try {
      const bytes = await archive(slug, [sqlFile('CREATE TABLE records (id INTEGER PRIMARY KEY); INSERT INTO records VALUES (7);')]);
      const { accepted } = await start(bytes, true, child.origin); expect(accepted.status).toBe(202);
      const id = (await accepted.json()).data.operationId; const barrier = await child.next(); child.release(barrier);
      expect(await proxy.acknowledged).toBe(id);
      const failed = await terminal(id, 'NEEDS_RECOVERY', child.origin); expect(failed.errorCode).toBe('PLUGIN_MIGRATION_OUTCOME_UNKNOWN'); expect(failed.committedPrefix).toBe(1);
      const namespace = await prisma.pluginNamespace.findUniqueOrThrow({ where: { slug } });
      const ledger = await prisma.pluginMigrationSuccess.findMany({ where: { namespaceId: namespace.id } }); expect(ledger).toHaveLength(1);
      expect(await prisma.pluginMigrationAttempt.findFirst({ where: { operationId: id } })).toMatchObject({ status: 'SUCCESS', resolution: 'LEDGER_CONFIRMED', errorCode: 'PLUGIN_MIGRATION_OUTCOME_UNKNOWN' });
      const retry = await fetch(`${base}/api/v1/extensions/plugin/operations/${id}/retry`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ confirmMigrations: true }) });
      expect(retry.status).toBe(202); const retried = await terminal((await retry.json()).data.operationId);
      expect(await prisma.pluginMigrationAttempt.count({ where: { operationId: retried.operationId, order: 1 } })).toBe(0);
      expect(await prisma.pluginMigrationSuccess.findMany({ where: { namespaceId: namespace.id } })).toEqual(ledger);
      expect(await prisma.$queryRawUnsafe(`SELECT id FROM "${namespace.schemaName}".records`)).toEqual([{ id: 7 }]);
    } finally { await child.close(); await proxy.close(); }
  });
  it('H partial success remains paused and same-artifact retry skips the committed prefix', async () => {
    const slug = own(), bytes = await archive(slug, [sqlFile('CREATE TABLE records (id INTEGER PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE gate (value TEXT); INSERT INTO gate VALUES (NULL); INSERT INTO records VALUES (1, \'first\');'), sqlFile('INSERT INTO records VALUES (2, (SELECT value FROM gate));', 2)]);
    const failed = await install(bytes, 'NEEDS_RECOVERY'); expect(failed.committedPrefix).toBe(1);
    const namespace = await prisma.pluginNamespace.findUniqueOrThrow({ where: { slug } });
    const first = await prisma.pluginMigrationSuccess.findMany({ where: { namespaceId: namespace.id } }); expect(first).toHaveLength(1);
    for (const [method, suffix, payload] of [['POST', '/restore', undefined], ['DELETE', '/purge', { confirmationSlug: slug }]] as const) {
      const response = await fetch(`${base}/api/v1/extensions/plugin/${slug}${suffix}`, { method, headers: { authorization: `Bearer ${token}`, ...(payload ? { 'content-type': 'application/json' } : {}) }, body: payload ? JSON.stringify(payload) : undefined });
      expect(response.status).toBe(409); expect((await response.json()).error.code).toBe('PLUGIN_MIGRATION_RECOVERY_REQUIRED');
    }
    const paused = await fetch(`${base}/api/v1/extensions/plugin/${slug}/api/status`, { headers: { authorization: `Bearer ${token}` } });
    expect(paused.status).toBe(503); expect((await paused.json()).error.code).toBe('PLUGIN_MAINTENANCE'); expect(paused.headers.get('retry-after')).toBe('5');
    await prisma.$executeRawUnsafe(`UPDATE "${namespace.schemaName}".gate SET value = 'ready'`);
    const retry = await fetch(`${base}/api/v1/extensions/plugin/operations/${failed.operationId}/retry`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ confirmMigrations: true }) });
    expect(retry.status).toBe(202); const succeeded = await terminal((await retry.json()).data.operationId);
    expect(succeeded.committedPrefix).toBe(2);
    expect(await prisma.pluginMigrationSuccess.findMany({ where: { namespaceId: namespace.id, order: 1 } })).toEqual(first);
    expect(await prisma.$queryRawUnsafe(`SELECT id, value FROM "${namespace.schemaName}".records ORDER BY id`)).toEqual([{ id: 1, value: 'first' }, { id: 2, value: 'ready' }]);
  });
  it('H SUCCESS clears candidate bytes while the complete status result retains the package size', async () => {
    const slug = own(), bytes = await archive(slug, [sqlFile('CREATE TABLE records (id INTEGER);')]);
    const state = await install(bytes);
    const operation = await prisma.pluginMigrationOperation.findUniqueOrThrow({ where: { id: state.operationId } });
    expect(operation.artifactBytes).toBeNull();
    expect(operation.installOptions).toMatchObject({ uploadMetadata: { size: bytes.length } });
    const response = await fetch(`${base}/api/v1/extensions/plugin/operations/${operation.id}`, { headers: { authorization: `Bearer ${token}` } });
    expect(response.status).toBe(200);
    expect((await response.json()).data.result).toMatchObject({ kind: 'plugin', slug, version: '1.0.0', size: bytes.length, warnings: [] });
  });
  it('H FAILED keeps bytes for same-package retry and later SUCCESS clears all superseded failed candidates of only that slug', async () => {
    const slug = own(), other = own(), table = `retention_gate_${randomUUID().replaceAll('-', '')}`;
    await prisma.$executeRawUnsafe(`CREATE TABLE public."${table}" (value TEXT NOT NULL)`);
    try {
      await prisma.$executeRawUnsafe(`INSERT INTO public."${table}" VALUES ('blocked')`);
      const bytes = await archive(slug, [sqlFile(`CREATE TABLE records (id INTEGER); INSERT INTO records SELECT value::integer FROM public."${table}";`)]);
      const unrelatedBytes = await archive(other, [sqlFile('SELECT 1 / 0;')]);
      const unrelated = await install(unrelatedBytes, 'FAILED');
      const first = await install(bytes, 'FAILED');
      expect(Buffer.from((await prisma.pluginMigrationOperation.findUniqueOrThrow({ where: { id: first.operationId } })).artifactBytes!)).toEqual(bytes);
      const retry = async (id: string, expected: string) => {
        const accepted = await fetch(`${base}/api/v1/extensions/plugin/operations/${id}/retry`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ confirmMigrations: true }) });
        expect(accepted.status).toBe(202); return terminal((await accepted.json()).data.operationId, expected);
      };
      const second = await retry(first.operationId, 'FAILED');
      for (const id of [first.operationId, second.operationId]) expect(Buffer.from((await prisma.pluginMigrationOperation.findUniqueOrThrow({ where: { id } })).artifactBytes!)).toEqual(bytes);
      await prisma.$executeRawUnsafe(`UPDATE public."${table}" SET value = '7'`);
      const succeeded = await retry(second.operationId, 'SUCCESS');
      for (const id of [first.operationId, second.operationId]) expect(await prisma.pluginMigrationOperation.findUniqueOrThrow({ where: { id } })).toMatchObject({ phase: 'RECOVERED', artifactBytes: null, recoveryState: `RECOVERED_BY:${succeeded.operationId}` });
      expect((await prisma.pluginMigrationOperation.findUniqueOrThrow({ where: { id: succeeded.operationId } })).artifactBytes).toBeNull();
      expect(Buffer.from((await prisma.pluginMigrationOperation.findUniqueOrThrow({ where: { id: unrelated.operationId } })).artifactBytes!)).toEqual(unrelatedBytes);
      const namespace = await prisma.pluginNamespace.findUniqueOrThrow({ where: { slug } });
      expect(await prisma.$queryRawUnsafe(`SELECT id FROM "${namespace.schemaName}".records`)).toEqual([{ id: 7 }]);
    } finally { await prisma.$executeRawUnsafe(`DROP TABLE public."${table}"`); }
  });
  it('H forward-fix retains NEEDS_RECOVERY bytes before commit and clears them atomically with RECOVERED', async () => {
    const slug = own(), first = sqlFile('CREATE TABLE records (id INTEGER PRIMARY KEY); INSERT INTO records VALUES (1);');
    const bytes = await archive(slug, [first, sqlFile('INSERT INTO records VALUES (1);', 2)]);
    const failed = await install(bytes, 'NEEDS_RECOVERY');
    const child = await apiChild('before-commit', 2);
    try {
      const fixedBytes = await archive(slug, [first, sqlFile('INSERT INTO records VALUES (2);', 2)], {}, undefined, '2.0.0');
      const { accepted } = await start(fixedBytes, true, child.origin); expect(accepted.status).toBe(202);
      const id = (await accepted.json()).data.operationId, barrier = await child.next();
      const retained = await prisma.pluginMigrationOperation.findUniqueOrThrow({ where: { id: failed.operationId } });
      expect(retained.phase).toBe('NEEDS_RECOVERY'); expect(Buffer.from(retained.artifactBytes!)).toEqual(bytes);
      child.release(barrier); await terminal(id, 'SUCCESS', child.origin);
      expect(await prisma.pluginMigrationOperation.findUniqueOrThrow({ where: { id: failed.operationId } })).toMatchObject({ phase: 'RECOVERED', artifactBytes: null, recoveryState: `RECOVERED_BY:${id}` });
      expect((await prisma.pluginMigrationOperation.findUniqueOrThrow({ where: { id } })).artifactBytes).toBeNull();
    } finally { await child.close(); }
  });
  it('H a higher forward fix retains committed bytes and rejects modified or removed applied files', async () => {
    const slug = own(), first = sqlFile('CREATE TABLE records (id INTEGER PRIMARY KEY); INSERT INTO records VALUES (1);');
    const failed = await install(await archive(slug, [first, sqlFile('INSERT INTO records VALUES (1);', 2)]), 'NEEDS_RECOVERY'); expect(failed.committedPrefix).toBe(1);
    for (const files of [[sqlFile('CREATE TABLE other (id INTEGER);')], []]) {
      const rejected = await upload(await archive(slug, files, {}, undefined, '2.0.0'), 'preview'); expect(rejected.status).toBe(409); expect((await rejected.json()).error.code).toBe('PLUGIN_MIGRATION_DRIFT');
    }
    const fixed = await install(await archive(slug, [first, sqlFile('INSERT INTO records VALUES (2);', 2)], {}, undefined, '2.0.0')); expect(fixed.result.version).toBe('2.0.0');
    const namespace = await prisma.pluginNamespace.findUniqueOrThrow({ where: { slug } });
    expect(await prisma.$queryRawUnsafe(`SELECT id FROM "${namespace.schemaName}".records ORDER BY id`)).toEqual([{ id: 1 }, { id: 2 }]);
    expect((await prisma.pluginMigrationSuccess.findMany({ where: { namespaceId: namespace.id }, orderBy: { order: 'asc' } })).map(row => row.packageVersion)).toEqual(['1.0.0', '2.0.0']);
  });
  it('H a partial upgrade blocks enable, restore, purge and old gateway work until forward recovery', async () => {
    const slug = own(), first = sqlFile('CREATE TABLE records (id INTEGER PRIMARY KEY); INSERT INTO records VALUES (1);');
    const source = "module.exports={register(ctx){ctx.http.route({method:'GET',path:'/status',handler:async()=>({ok:true})});}};";
    await install(await archive(slug, [first], {}, source));
    const instance = await prisma.pluginInstallation.findFirstOrThrow({ where: { pluginSlug: slug } });
    const enabled = await fetch(`${base}/api/v1/extensions/plugin/${slug}/instances/${instance.id}`, { method: 'PATCH', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ enabled: true }) }); expect(enabled.status).toBe(200);
    await install(await archive(slug, [first, sqlFile('INSERT INTO records VALUES (2);', 2), sqlFile('INSERT INTO records VALUES (2);', 3)], {}, source, '2.0.0'), 'NEEDS_RECOVERY');
    for (const [method, suffix, body] of [['PATCH', `/instances/${instance.id}`, { enabled: true }], ['POST', '/restore', {}], ['DELETE', '/purge', { confirmationSlug: slug }]] as const) {
      const response = await fetch(`${base}/api/v1/extensions/plugin/${slug}${suffix}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
      expect(response.status).toBe(409); expect((await response.json()).error.code).toBe('PLUGIN_MIGRATION_RECOVERY_REQUIRED');
    }
    const paused = await fetch(`${base}/api/v1/extensions/plugin/${slug}/api/status`); expect(paused.status).toBe(503); expect((await paused.json()).error.code).toBe('PLUGIN_MAINTENANCE');
    expect((await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } })).version).toBe('1.0.0');
    await install(await archive(slug, [first, sqlFile('INSERT INTO records VALUES (2);', 2), sqlFile('INSERT INTO records VALUES (3);', 3)], {}, source, '3.0.0'));
    const resumed = await fetch(`${base}/api/v1/extensions/plugin/${slug}/api/status`); expect(resumed.status).toBe(200); expect(await resumed.json()).toEqual({ ok: true });
  });
});
