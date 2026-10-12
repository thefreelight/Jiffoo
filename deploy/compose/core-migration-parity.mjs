import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { readCoreMigrations, executeCoreMigrations, historyTableSql, coreHistorySql, assertCorePrefix } from '../release/core-migrations.mjs';

const require = createRequire('/app/apps/api/package.json');
const { Client } = require('pg');
const { validateCoreMigrationSql } = require('/app/packages/shared/dist/shared/src/core-migration-sql.js');
assert.equal(process.env.DATABASE_URL_TEST, 'postgresql://postgres:postgres@localhost:5432/jiffoo_core_test');
assert.equal(new URL(process.env.DATABASE_URL).pathname, '/jiffoo_core_test');
const client = new Client({ connectionString: process.env.DATABASE_URL });
const events = [];
try {
  await client.connect();
  assert.equal((await client.query("SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace")).rows[0].count, '0', 'Parity requires an empty isolated database');
  const sources = readCoreMigrations('/app/apps/api/prisma/migrations');
  for (const source of sources) {
    const prepared = validateCoreMigrationSql(source.sql);
    assert.ok(!prepared.wrapperStripped || source.name === '20260928000000_order_state_machine', 'New Core migrations must not contain transaction wrappers: ' + source.name);
  }
  await client.query(historyTableSql);
  await executeCoreMigrations(client, sources, [], validateCoreMigrationSql, async event => events.push(event));
  assertCorePrefix((await client.query(coreHistorySql)).rows, sources, true);
  const diff = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'diff', '--from-url', process.env.DATABASE_URL, '--to-schema-datamodel', 'prisma/schema', '--exit-code'], { cwd: '/app/apps/api', env: process.env, encoding: 'utf8', timeout: 60000 });
  assert.equal(diff.status, 0, diff.stdout + diff.stderr);
  assert.equal(events.filter(event => event.status === 'committed').length, sources.length);
  console.info('CORE_PARITY ' + JSON.stringify({ migrations: sources.length, schemaDiff: 'no difference', events }));
} finally { await client.end(); }
