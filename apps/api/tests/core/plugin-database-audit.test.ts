import { afterEach, beforeEach, expect, it } from 'vitest';
import { Client } from 'pg';
import { createHash, randomUUID } from 'node:crypto';
import { PassThrough } from 'node:stream';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import archiver from 'archiver';
import { mkdtemp, mkdir, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { PLUGIN_MAX_ENTRY_SIZE, PLUGIN_MAX_DECOMPRESSED_SIZE, PLUGIN_MAX_ZIP_ENTRIES, PLUGIN_MAX_ZIP_SIZE, pluginSchemaName, type PluginManifest } from 'shared/plugin-signing';
import { auditPluginDatabase, pluginDatabaseAuditExitCode, PLUGIN_DATABASE_AUDIT_CODES, setPluginDatabaseAuditTestLimits, setPluginDatabaseAuditTestMigrationRoot } from '@/core/admin/extension-installer/plugin-database-audit';

let client: Client, schema: string, slug: string;
const ownedSchemas = new Set<string>(), ownedRoles = new Set<string>();
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const tables = ['_prisma_migrations', 'plugin_installs', 'plugin_package_blobs', 'plugin_namespaces', 'plugin_migration_successes', 'plugin_migration_operations', 'plugin_migration_attempts', 'plugin_operation_leases', 'core_processes'];
async function zip(entries: Array<{ name: string; content: Buffer }>) {
  const output = new PassThrough(), chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => { output.on('data', chunk => chunks.push(chunk)); output.on('end', () => resolve(Buffer.concat(chunks))); output.on('error', reject); });
  const archive = archiver('zip', { zlib: { level: 9 } }); archive.on('error', error => output.destroy(error)); archive.pipe(output);
  for (const entry of entries) archive.append(entry.content, { name: entry.name });
  await archive.finalize(); return done;
}
async function packageFixture(count = 1, extra: Array<{ name: string; content: Buffer }> = [], version = '1.0.0') {
  const sql = Buffer.from('CREATE TABLE sample (id integer);');
  const declarations = Array.from({ length: count }, (_, index) => ({ id: `m${index + 1}`, order: index + 1, path: `migrations/${index + 1}.sql`, sha256: hash(sql) }));
  const manifest: PluginManifest = { schemaVersion: 1, slug, name: 'Audit fixture', description: '', version, runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1', entryModule: 'index.js', permissions: [], database: { apiVersion: 1, migrations: declarations } };
  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2));
  const bytes = await zip([{ name: 'manifest.json', content: manifestBytes }, { name: 'index.js', content: Buffer.from('throw new Error("Archive JavaScript must never execute");') }, ...declarations.map(item => ({ name: item.path, content: sql })), ...extra]);
  return { bytes, manifest, declarations, packageHash: hash(bytes), manifestDigest: hash(manifestBytes) };
}
async function install(fixture: Awaited<ReturnType<typeof packageFixture>>, builtin = false) {
  await client.query(`INSERT INTO ${schema}.plugin_installs (id,slug,name,version,"zipHash","manifestJson","trustLevel","updatedAt") VALUES ($1,$1,'Audit fixture',$2,$3,$4,$5::public."PluginTrustLevel",now())`, [slug, fixture.manifest.version, fixture.packageHash, fixture.manifest, builtin ? 'builtin' : 'unsigned']);
  await client.query(`INSERT INTO ${schema}.plugin_package_blobs (id,"pluginSlug","zipHash",bytes,"sizeBytes") VALUES ($1,$1,$2,$3,$4)`, [slug, fixture.packageHash, fixture.bytes, fixture.bytes.length]);
}
async function namespace(provisioned = true, actual = true) {
  const name = pluginSchemaName(slug);
  if (actual) { await client.query(`CREATE SCHEMA "${name}"`); ownedSchemas.add(name); }
  await client.query(`INSERT INTO ${schema}.plugin_namespaces (slug,"schemaName","publisherKind","provisionedAt") VALUES ($1,$2,'unsigned',$3)`, [slug, name, provisioned ? new Date() : null]);
  return (await client.query(`SELECT id FROM ${schema}.plugin_namespaces WHERE slug=$1`, [slug])).rows[0].id as number;
}
async function operation(fixture: Awaited<ReturnType<typeof packageFixture>>, phase = 'FAILED', bytes: Buffer | null = fixture.bytes) {
  const id = randomUUID();
  await client.query(`INSERT INTO ${schema}.plugin_migration_operations (id,slug,"actorId","packageHash","packageVersion","manifestDigest",manifest,declarations,"expectedInstall","installOptions","artifactBytes","leaseToken",confirmed,phase) VALUES ($1,$2,'audit',$3,$4,$5,$6,$7,'null','{}',$8,'audit',true,$9)`, [id, slug, fixture.packageHash, fixture.manifest.version, fixture.manifestDigest, fixture.manifest, JSON.stringify(fixture.declarations), bytes, phase]);
  return id;
}
async function ledger(namespaceId: number, fixture: Awaited<ReturnType<typeof packageFixture>>, count = fixture.declarations.length) {
  const operationId = await operation(fixture, count === fixture.declarations.length ? 'SUCCESS' : 'NEEDS_RECOVERY', count === fixture.declarations.length ? null : fixture.bytes);
  for (const item of fixture.declarations.slice(0, count)) await client.query(`INSERT INTO ${schema}.plugin_migration_successes (id,"namespaceId","order","migrationId",path,sha256,"packageHash","packageVersion","manifestDigest","operationId","actorId","durationMs") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'audit',1)`, [randomUUID(), namespaceId, item.order, item.id, item.path, item.sha256, fixture.packageHash, fixture.manifest.version, fixture.manifestDigest, operationId]);
  await client.query(`UPDATE ${schema}.plugin_migration_operations SET "committedPrefix"=$1 WHERE id=$2`, [count, operationId]);
  return operationId;
}
async function audit() { return auditPluginDatabase(client); }
async function cli(limits?: Parameters<typeof setPluginDatabaseAuditTestLimits>[1], databaseUrl = process.env.DATABASE_URL_TEST!, args?: string[]) {
  const child = fork(path.resolve('tests/helpers/plugin-database-audit-child.ts'), [], { execArgv: ['--import', 'tsx'], stdio: ['ignore', 'pipe', 'pipe', 'ipc'], env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, NODE_ENV: 'test', DATABASE_URL: databaseUrl } });
  let stdout = '', stderr = ''; child.stdout!.on('data', value => { stdout += value; }); child.stderr!.on('data', value => { stderr += value; });
  const exited = once(child, 'exit');
  const ready = await Promise.race([once(child, 'message'), exited.then(() => { throw new Error(`Audit child did not initialize: ${stderr}`); })]);
  expect(ready[0]).toEqual({ ready: true }); child.send({ schema, limits, args });
  const [code, signal] = await exited; expect(signal).toBeNull();
  return { code, stdout, stderr, report: stdout ? JSON.parse(stdout) : undefined };
}
beforeEach(async () => {
  const url = new URL(process.env.DATABASE_URL_TEST!); expect(url.pathname).toBe('/jiffoo_core_test');
  client = new Client({ connectionString: url.toString() }); await client.connect();
  schema = `audit_test_${randomUUID().replaceAll('-', '')}`; slug = `audit-${randomUUID().slice(0, 12)}`;
  await client.query(`CREATE SCHEMA ${schema}`); ownedSchemas.add(schema);
  for (const table of tables) await client.query(`CREATE TABLE ${schema}.${table} (LIKE public.${table} INCLUDING DEFAULTS INCLUDING GENERATED INCLUDING IDENTITY)`);
  await client.query(`INSERT INTO ${schema}._prisma_migrations SELECT * FROM public._prisma_migrations`);
  await client.query(`INSERT INTO ${schema}.plugin_namespaces SELECT * FROM public.plugin_namespaces`);
  setPluginDatabaseAuditTestLimits(true, undefined, schema);
});
afterEach(async () => {
  setPluginDatabaseAuditTestLimits(true);
  setPluginDatabaseAuditTestMigrationRoot(true);
  for (const name of ownedSchemas) await client.query(`DROP SCHEMA "${name}" CASCADE`);
  ownedSchemas.clear();
  for (const role of ownedRoles) await client.query(`DROP ROLE "${role}"`);
  ownedRoles.clear(); await client.end();
});

it('J complete reports preserve version, scope, caller authority and zero exit status', async () => {
  const fixture = await packageFixture(); await install(fixture); await ledger(await namespace(), fixture);
  const report = await audit();
  expect(report).toMatchObject({ reportVersion: 1, scope: 'plugin-database-integrity', complete: true, database: { name: 'jiffoo_core_test', schemaState: 'current' }, processQuiescence: { proven: false, authority: 'caller' }, counts: { plugins: 1, blocking: 0 } });
  expect(Date.parse(report.finishedAt)).toBeGreaterThanOrEqual(Date.parse(report.startedAt)); expect(pluginDatabaseAuditExitCode(report)).toBe(0);
});
it('J ledger identity and order gaps are blocking mismatches', async () => {
  const fixture = await packageFixture(2); await install(fixture); await ledger(await namespace(), fixture);
  for (const [column, value] of [['migrationId', 'changed'], ['path', 'migrations/other.sql'], ['sha256', 'a'.repeat(64)], ['order', 4]] as const) {
    await client.query('BEGIN');
    try {
      await client.query(`UPDATE ${schema}.plugin_migration_successes SET "${column}"=$1 WHERE "order"=1`, [value]);
      // The auditor owns its transaction; commit the isolated fixture mutation.
      await client.query('COMMIT');
      const report = await audit(); expect(report.findings).toContainEqual(expect.objectContaining({ code: 'PLUGIN_DB_LEDGER_MISMATCH', severity: 'blocking', slug }));
    } finally {
      await client.query(`DELETE FROM ${schema}.plugin_migration_successes`);
      await ledger((await client.query(`SELECT id FROM ${schema}.plugin_namespaces WHERE slug=$1`, [slug])).rows[0].id, fixture);
    }
  }
});
it('J uncommitted declarations and missing namespace claims block upgrades', async () => {
  const fixture = await packageFixture(); await install(fixture);
  const report = await audit();
  expect(report.findings).toEqual(expect.arrayContaining(['PLUGIN_DB_LEDGER_INCOMPLETE', 'PLUGIN_DB_NAMESPACE_CLAIM_MISSING'].map(code => expect.objectContaining({ code, severity: 'blocking', slug }))));
  expect(pluginDatabaseAuditExitCode(report)).toBe(1);
});
it('J a retained pending upgrade prefix is explained without a ledger mismatch', async () => {
  const installed = await packageFixture(1), candidate = await packageFixture(3, [], '2.0.0');
  await install(installed); const operationId = await ledger(await namespace(), candidate, 2);
  const report = await audit();
  expect(report.findings).toContainEqual(expect.objectContaining({ code: 'PLUGIN_DB_PENDING_UPGRADE_LEDGER', severity: 'blocking', slug, operationId }));
  expect(report.findings.filter(item => item.slug === slug).map(item => item.code)).not.toContain('PLUGIN_DB_LEDGER_MISMATCH');
});
it('J namespace existence disagreement and unclaimed schemas are blocking', async () => {
  await namespace(true, false);
  const unclaimed = `plugin_audit_orphan_${randomUUID().replaceAll('-', '')}`; await client.query(`CREATE SCHEMA ${unclaimed}`); ownedSchemas.add(unclaimed);
  const report = await audit();
  expect(report.findings).toContainEqual(expect.objectContaining({ code: 'PLUGIN_DB_NAMESPACE_MISMATCH', severity: 'blocking', slug }));
  expect(report.findings).toContainEqual(expect.objectContaining({ code: 'PLUGIN_DB_UNCLAIMED_SCHEMA', severity: 'blocking', evidence: { schema: unclaimed } }));
});
it('J retained purge ledgers are verified and namespace-only provisioning has no false findings', async () => {
  const fixture = await packageFixture(); await ledger(await namespace(), fixture);
  let report = await audit(); expect(report.findings.filter(item => item.slug === slug)).toEqual([expect.objectContaining({ code: 'PLUGIN_DB_RETAINED_NAMESPACE', severity: 'warning' })]); expect(pluginDatabaseAuditExitCode(report)).toBe(0);
  await client.query(`UPDATE ${schema}.plugin_migration_successes SET sha256=repeat('a',64)`);
  report = await audit();
  expect(report.findings).toContainEqual(expect.objectContaining({ code: 'PLUGIN_DB_LEDGER_MISMATCH', severity: 'blocking', slug }));
  expect(report.findings.filter(item => item.slug === slug).map(item => item.code)).not.toContain('PLUGIN_DB_RETAINED_NAMESPACE');
  await client.query(`DELETE FROM ${schema}.plugin_migration_successes`);
  report = await audit(); expect(report.findings).toContainEqual(expect.objectContaining({ code: 'PLUGIN_DB_LEDGER_MISMATCH', severity: 'blocking', slug }));
  await client.query(`DELETE FROM ${schema}.plugin_migration_operations`);
  report = await audit(); expect(report.findings.filter(item => item.slug === slug)).toEqual([]);
  expect(pluginDatabaseAuditExitCode(report)).toBe(0);
});
it('J incomplete operations, recovery, UNKNOWN attempts and invocation markers all block', async () => {
  const fixture = await packageFixture(), namespaceId = await namespace();
  const operationId = await operation(fixture, 'MIGRATING'); const recoveryId = await operation(fixture, 'NEEDS_RECOVERY');
  await client.query(`INSERT INTO ${schema}.plugin_migration_attempts (id,"namespaceId","operationId","order","migrationId",path,sha256) VALUES ('attempt',$1,$2,1,'m1','migrations/1.sql',$3)`, [namespaceId, operationId, fixture.declarations[0].sha256]);
  for (const expired of [true, false]) await client.query(`INSERT INTO ${schema}.plugin_operation_leases (slug,token,operation,"acquiredAt","expiresAt") VALUES ($1,'audit',$2,now(),$3)`, [`marker-${expired}`, `plugin-invocation:${slug}`, new Date(Date.now() + (expired ? -60_000 : 60_000))]);
  const report = await audit();
  for (const code of ['PLUGIN_DB_OPERATION_INCOMPLETE', 'PLUGIN_DB_RECOVERY_REQUIRED', 'PLUGIN_DB_ATTEMPT_UNKNOWN', 'PLUGIN_DB_INVOCATION_MARKER_PRESENT']) expect(report.findings).toContainEqual(expect.objectContaining({ code, severity: 'blocking', slug }));
  expect(report.findings.find(row => row.code === 'PLUGIN_DB_RECOVERY_REQUIRED')?.operationId).toBe(recoveryId);
  expect(report.findings.filter(row => row.code === 'PLUGIN_DB_INVOCATION_MARKER_PRESENT')).toHaveLength(2);
});
it('K candidate retention is required for failure and warned on terminal publication', async () => {
  const fixture = await packageFixture();
  for (const phase of ['FAILED', 'NEEDS_RECOVERY']) { const id = await operation(fixture, phase, null); expect((await audit()).findings).toContainEqual(expect.objectContaining({ code: 'PLUGIN_DB_CANDIDATE_BYTES_MISSING', severity: 'blocking', operationId: id })); }
  for (const phase of ['SUCCESS', 'RECOVERED']) { const id = await operation(fixture, phase); expect((await audit()).findings).toContainEqual(expect.objectContaining({ code: 'PLUGIN_DB_CANDIDATE_BYTES_RETAINED', severity: 'warning', operationId: id })); }
});
it('K builtins require verified database blobs and archive JavaScript is never executed', async () => {
  const fixture = await packageFixture(0); await install(fixture, true); await namespace();
  expect((await audit()).findings.filter(item => item.slug === slug)).toEqual([]);
  await client.query(`DELETE FROM ${schema}.plugin_package_blobs`);
  expect((await audit()).findings).toContainEqual(expect.objectContaining({ code: 'PLUGIN_DB_PACKAGE_BLOB_MISSING', severity: 'blocking', slug }));
});
it('K size, archive hash, manifest identity and original manifest digest corruption block', async () => {
  const fixture = await packageFixture(0); await install(fixture); const id = await operation(fixture, 'SUCCESS', null);
  for (const mutation of [
    `UPDATE ${schema}.plugin_package_blobs SET "sizeBytes"="sizeBytes"+1`,
    `UPDATE ${schema}.plugin_package_blobs SET bytes=decode(repeat('00',"sizeBytes"),'hex')`,
    `UPDATE ${schema}.plugin_installs SET "manifestJson"=jsonb_set("manifestJson",'{name}','"Changed"')`,
    `UPDATE ${schema}.plugin_migration_operations SET "manifestDigest"=repeat('a',64) WHERE id='${id}'`,
  ]) {
    await client.query(mutation);
    expect((await audit()).findings).toContainEqual(expect.objectContaining({ code: 'PLUGIN_DB_PACKAGE_BLOB_INVALID', severity: 'blocking', slug }));
    await client.query(`UPDATE ${schema}.plugin_package_blobs SET bytes=$1,"sizeBytes"=$2`, [fixture.bytes, fixture.bytes.length]);
    await client.query(`UPDATE ${schema}.plugin_installs SET "manifestJson"=$1`, [fixture.manifest]);
    await client.query(`UPDATE ${schema}.plugin_migration_operations SET "manifestDigest"=$1`, [fixture.manifestDigest]);
  }
});
it('K migration SQL bytes and declared hashes are checked without executing SQL', async () => {
  const fixture = await packageFixture();
  const bytes = await zip([{ name: 'manifest.json', content: Buffer.from(JSON.stringify(fixture.manifest)) }, { name: 'index.js', content: Buffer.from('throw new Error("never run");') }, { name: 'migrations/1.sql', content: Buffer.from('DROP TABLE secret;') }]);
  await install({ ...fixture, bytes, packageHash: hash(bytes) });
  expect((await audit()).findings).toContainEqual(expect.objectContaining({ code: 'PLUGIN_DB_PACKAGE_BLOB_INVALID', severity: 'blocking', slug }));
});
it.each(['entry', 'total', 'count', 'archive'] as const)('K B7a %s decompression and archive caps are enforced', async kind => {
  const extra = kind === 'entry' ? [{ name: 'large.js', content: Buffer.alloc(PLUGIN_MAX_ENTRY_SIZE + 1) }]
    : kind === 'total' ? [1, 2, 3].map(index => ({ name: `large${index}.js`, content: Buffer.alloc(Math.floor(PLUGIN_MAX_DECOMPRESSED_SIZE / 3) + 1) }))
    : kind === 'count' ? Array.from({ length: PLUGIN_MAX_ZIP_ENTRIES }, (_, index) => ({ name: `entry${index}.js`, content: Buffer.from('ok') })) : [];
  let fixture = await packageFixture(0, extra);
  if (kind === 'archive') { const bytes = Buffer.alloc(PLUGIN_MAX_ZIP_SIZE + 1); fixture = { ...fixture, bytes, packageHash: hash(bytes) }; }
  await install(fixture);
  expect((await audit()).findings).toContainEqual(expect.objectContaining({ code: 'PLUGIN_DB_PACKAGE_BLOB_INVALID', severity: 'blocking', slug }));
});
it('L CLI under a real read-only role preserves rows and hashes of every checked table', async () => {
  const fixture = await packageFixture(); await install(fixture); await ledger(await namespace(), fixture);
  const role = `audit_role_${randomUUID().replaceAll('-', '')}`; ownedRoles.add(role);
  await client.query(`CREATE ROLE ${role} LOGIN PASSWORD 'audit-test-only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT`);
  await client.query(`GRANT USAGE ON SCHEMA ${schema} TO ${role}`); await client.query(`GRANT SELECT ON ALL TABLES IN SCHEMA ${schema} TO ${role}`);
  const snapshot = async () => Promise.all(tables.map(async table => { const rows = (await client.query(`SELECT to_jsonb(t) AS row FROM ${schema}.${table} t`)).rows.map(row => JSON.stringify(row.row)).sort(); return { table, rows, hash: hash(Buffer.from(JSON.stringify(rows))) }; }));
  const before = await snapshot();
  const url = new URL(process.env.DATABASE_URL_TEST!); url.username = role; url.password = 'audit-test-only';
  const readonly = new Client({ connectionString: url.toString() }); await readonly.connect();
  try {
    expect((await readonly.query('SELECT current_user AS role')).rows[0].role).toBe(role);
    await expect(readonly.query(`UPDATE ${schema}.plugin_installs SET name='forbidden'`)).rejects.toMatchObject({ code: '42501' });
  } finally { await readonly.end(); }
  const result = await cli(undefined, url.toString()); expect(result.code).toBe(0); expect(result.stderr).toBe(''); expect(result.report.complete).toBe(true);
  expect(await snapshot()).toEqual(before);
});
it('L CLI uses all exit codes and invalid arguments never disclose the URL', async () => {
  expect((await cli()).code).toBe(0);
  await install(await packageFixture()); expect((await cli()).code).toBe(1);
  await client.query(`ALTER TABLE ${schema}.plugin_installs DROP COLUMN "zipHash"`); expect((await cli()).code).toBe(2);
  const result = await cli(undefined, 'postgresql://secret:password@localhost/jiffoo_core_test', ['unexpected']);
  expect(result.code).toBe(3); expect(result.stdout).toBe(''); expect(result.stderr).not.toContain('password'); expect(result.stderr).not.toContain('secret');
  expect((await cli(undefined, 'invalid-url')).code).toBe(3);
});
it('M partially migrated schemas stop before querying missing columns', async () => {
  await client.query(`DELETE FROM ${schema}._prisma_migrations WHERE migration_name='20260922000000_baseline'`);
  const migrationState = await cli(); expect(migrationState.code).toBe(2);
  expect(migrationState.report.findings).toContainEqual(expect.objectContaining({ code: 'PLUGIN_DB_SCHEMA_INCOMPLETE', evidence: { reason: 'migration-state' } }));
  await client.query(`INSERT INTO ${schema}._prisma_migrations SELECT * FROM public._prisma_migrations WHERE migration_name='20260922000000_baseline'`);
  await client.query(`ALTER TABLE ${schema}.plugin_migration_operations DROP COLUMN "ownerBootNonce"`);
  const result = await cli(); expect(result.code).toBe(2);
  expect(result.report).toMatchObject({ complete: false, database: { schemaState: 'incomplete' } });
  expect(result.report.findings).toContainEqual(expect.objectContaining({ code: 'PLUGIN_DB_SCHEMA_INCOMPLETE', severity: 'blocking', evidence: { missing: [`plugin_migration_operations.ownerBootNonce`] } }));
});
it('M restricted permissions produce an incomplete safe report and exit code two', async () => {
  const role = `audit_role_${randomUUID().replaceAll('-', '')}`; ownedRoles.add(role);
  await client.query(`CREATE ROLE ${role} LOGIN PASSWORD 'audit-test-only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT`);
  const url = new URL(process.env.DATABASE_URL_TEST!); url.username = role; url.password = 'audit-test-only';
  const result = await cli(undefined, url.toString()); expect(result.code).toBe(2);
  expect(result.report.findings).toContainEqual(expect.objectContaining({ code: 'PLUGIN_DB_SCHEMA_INCOMPLETE', severity: 'blocking', evidence: { reason: 'database-inspection-unavailable', sqlstate: '42501' } }));
  expect(result.stdout).not.toContain('audit-test-only');
});
it('M real lock timeouts and resource limits cannot produce a complete audit', async () => {
  const locker = new Client({ connectionString: process.env.DATABASE_URL_TEST }); await locker.connect();
  try {
    await locker.query('BEGIN'); await locker.query(`LOCK TABLE ${schema}.plugin_installs IN ACCESS EXCLUSIVE MODE`);
    for (const limits of [{ lockMs: 20, statementMs: 100 }, { lockMs: 100, statementMs: 20 }]) {
      const result = await cli(limits); expect(result.code).toBe(2);
      expect(result.report.findings).toContainEqual(expect.objectContaining({ code: 'PLUGIN_DB_AUDIT_LIMIT_REACHED', severity: 'blocking' }));
    }
  } finally { await locker.query('ROLLBACK'); await locker.end(); }
  setPluginDatabaseAuditTestLimits(true, { rows: 1 }, schema);
  const report = await audit(); expect(report.complete).toBe(false); expect(pluginDatabaseAuditExitCode(report)).toBe(2);
  expect(report.findings).toContainEqual(expect.objectContaining({ code: 'PLUGIN_DB_AUDIT_LIMIT_REACHED', severity: 'blocking' }));
  await install(await packageFixture()); setPluginDatabaseAuditTestLimits(true, { bytes: 1 }, schema);
  const byteLimited = await audit(); expect(byteLimited.complete).toBe(false);
  expect(byteLimited.findings).toContainEqual(expect.objectContaining({ code: 'PLUGIN_DB_AUDIT_LIMIT_REACHED', severity: 'blocking' }));
});
it('J stable findings include exactly the approved machine-readable codes', () => {
  expect(PLUGIN_DATABASE_AUDIT_CODES).toEqual([
    'PLUGIN_DB_LEDGER_MISMATCH', 'PLUGIN_DB_LEDGER_INCOMPLETE', 'PLUGIN_DB_PENDING_UPGRADE_LEDGER', 'PLUGIN_DB_NAMESPACE_MISMATCH', 'PLUGIN_DB_NAMESPACE_CLAIM_MISSING', 'PLUGIN_DB_UNCLAIMED_SCHEMA', 'PLUGIN_DB_OPERATION_INCOMPLETE', 'PLUGIN_DB_RECOVERY_REQUIRED', 'PLUGIN_DB_ATTEMPT_UNKNOWN', 'PLUGIN_DB_INVOCATION_MARKER_PRESENT', 'PLUGIN_DB_CANDIDATE_BYTES_MISSING', 'PLUGIN_DB_CANDIDATE_BYTES_RETAINED', 'PLUGIN_DB_PACKAGE_BLOB_MISSING', 'PLUGIN_DB_PACKAGE_BLOB_INVALID', 'PLUGIN_DB_RETAINED_NAMESPACE', 'PLUGIN_DB_SCHEMA_INCOMPLETE', 'PLUGIN_DB_AUDIT_LIMIT_REACHED',
  ]);
  const environment = process.env.NODE_ENV; process.env.NODE_ENV = 'production';
  try { expect(() => setPluginDatabaseAuditTestLimits(true, { lockMs: 1 })).toThrow('explicit test switch'); }
  finally { process.env.NODE_ENV = environment; }
});
it('F runtime migration folders admit a newly recorded migration without editing the auditor', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'jiffoo-audit-inventory-'));
  try {
    for (const name of (await readdir(path.resolve('prisma/migrations'), { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name)) {
      await mkdir(path.join(root, name)); await writeFile(path.join(root, name, 'migration.sql'), '-- Inventory fixture only\n');
    }
    const added = '20990101000000_inventory_fixture';
    await mkdir(path.join(root, added)); await writeFile(path.join(root, added, 'migration.sql'), '-- Inventory fixture only\n');
    setPluginDatabaseAuditTestMigrationRoot(true, root);
    expect(pluginDatabaseAuditExitCode(await audit())).toBe(2);
    await client.query(`INSERT INTO ${schema}._prisma_migrations (id,checksum,migration_name,started_at,finished_at,applied_steps_count) VALUES ($1,$2,$3,now(),now(),1)`, [randomUUID(), 'a'.repeat(64), added]);
    expect(pluginDatabaseAuditExitCode(await audit())).toBe(0);
    await rm(path.join(root, added, 'migration.sql'));
    expect(pluginDatabaseAuditExitCode(await audit())).toBe(2);
    setPluginDatabaseAuditTestMigrationRoot(true, path.join(root, 'absent'));
    expect(pluginDatabaseAuditExitCode(await audit())).toBe(2);
    const file = path.join(root, 'not-a-directory'); await writeFile(file, 'fixture');
    setPluginDatabaseAuditTestMigrationRoot(true, file);
    const unavailable = await audit(); expect(pluginDatabaseAuditExitCode(unavailable)).toBe(2);
    expect(unavailable.findings).toContainEqual(expect.objectContaining({ code: 'PLUGIN_DB_SCHEMA_INCOMPLETE', evidence: { reason: 'migration-inventory-unavailable' } }));
  } finally { setPluginDatabaseAuditTestMigrationRoot(true); await rm(root, { recursive: true, force: true }); }
});
