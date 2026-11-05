import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--help') {
  process.stdout.write('Usage: node scripts/plugin-action-policy-bootstrap.mjs --database-url-env=ENV_NAME --expected-database=NAME --admin-id=ID [--dry-run|--apply]\nDefault: dry-run. Requires a built Core and exact migration/schema preflight.\n');
  process.exit(0);
}
const allowed = ['--admin-id', '--database-url-env', '--expected-database'];
const values = new Map();
for (const arg of args) {
  if (['--apply', '--dry-run'].includes(arg)) { if (values.has(arg)) throw new Error('Duplicate flag'); values.set(arg, true); continue; }
  const split = arg.indexOf('=');
  const key = arg.slice(0, split), value = arg.slice(split + 1);
  if (split < 0 || !allowed.includes(key) || !value || values.has(key)) throw new Error('Expected unique --database-url-env=ENV_NAME --expected-database=NAME --admin-id=ID [--dry-run|--apply]');
  values.set(key, value);
}
if (allowed.some(key => !values.has(key)) || values.has('--apply') && values.has('--dry-run')) throw new Error('Explicit database environment name, expected database and administrator are required');
const id = values.get('--admin-id'), expectedDatabase = values.get('--expected-database'), envName = values.get('--database-url-env');
if (!/^[A-Z_][A-Z0-9_]*$/.test(envName)) throw new Error('Invalid database environment variable name');
const databaseUrl = process.env[envName];
if (!databaseUrl) throw new Error('Named database environment variable is not set');
const url = new URL(databaseUrl);
if (!['postgres:', 'postgresql:'].includes(url.protocol) || decodeURIComponent(url.pathname.slice(1)) !== expectedDatabase) throw new Error('Database URL does not match the explicitly expected database');
const { validateDatabaseUrl, assertCurrentDatabase } = createRequire(import.meta.url)('./lane-config.cjs');
const testLane = envName === 'DATABASE_URL_TEST' || expectedDatabase.startsWith('jiffoo_core_test');
if (testLane) validateDatabaseUrl(databaseUrl);
const { PrismaClient } = require('@prisma/client');
const { bootstrapPluginPolicyAuthority } = require(fileURLToPath(new URL('../apps/api/dist/core/auth/plugin-action-policy-bootstrap.js', import.meta.url)));
const { AdminAuditService } = require(fileURLToPath(new URL('../apps/api/dist/core/admin/audit-events/service.js', import.meta.url)));
const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
try {
  const actualDatabase = (await client.$queryRawUnsafe('SELECT current_database() AS name'))[0].name;
  if (actualDatabase !== expectedDatabase) throw new Error('Connected database differs from the explicitly expected database');
  if (testLane) assertCurrentDatabase(actualDatabase);
  const migrationRoot = new URL('../apps/api/prisma/migrations/', import.meta.url);
  const names = (await readdir(migrationRoot, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  const applied = await client.$queryRawUnsafe('SELECT migration_name, checksum, finished_at, rolled_back_at FROM public._prisma_migrations ORDER BY migration_name');
  if (applied.length !== names.length) throw new Error('Migration drift: migration count differs');
  for (const name of names) {
    const row = applied.find(value => value.migration_name === name);
    const checksum = createHash('sha256').update(await readFile(new URL(`${name}/migration.sql`, migrationRoot))).digest('hex');
    if (!row?.finished_at || row.rolled_back_at || row.checksum !== checksum) throw new Error('Migration drift: history or checksum differs');
  }
  const diff = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'diff', '--from-url', databaseUrl, '--to-schema-datamodel', fileURLToPath(new URL('../apps/api/prisma/schema/', import.meta.url)), '--exit-code'], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000, windowsHide: true });
  if (diff.status !== 0) throw new Error('Schema drift or failed schema preflight; no bootstrap was applied');
  process.stdout.write(`${JSON.stringify(await bootstrapPluginPolicyAuthority(client, { databaseUrl, expectedDatabase, principalId: id, apply: values.has('--apply') }, AdminAuditService.record))}\n`);
}
finally { await client.$disconnect(); }
