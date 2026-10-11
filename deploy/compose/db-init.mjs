import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const require = createRequire(resolve('package.json'));
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
const migrations = (await readdir('prisma/migrations', { withFileTypes: true }))
  .filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
const sources = await Promise.all(migrations.map(async name => {
  const sql = await readFile(`prisma/migrations/${name}/migration.sql`, 'utf8');
  return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
}));
const fail = message => { throw new Error(`First-install database initialization refused: ${message}. B16 owns database updates; no migration was applied to this existing database.`); };
try {
  await client.connect();
  await client.query('SELECT pg_advisory_lock(824301550)');
  const { rows: tables } = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
  if (tables.length) {
    if (!tables.some(row => row.tablename === '_prisma_migrations')) fail('existing schema has no migration history');
    const { rows: history } = await client.query('SELECT migration_name, checksum, finished_at, rolled_back_at FROM public._prisma_migrations ORDER BY migration_name');
    if (history.length !== sources.length || history.some((row, index) => row.migration_name !== sources[index]?.name || row.checksum !== sources[index]?.checksum || !row.finished_at || row.rolled_back_at)) fail('pending, extra, changed or failed migrations');
  } else {
    const { rows: objects } = await client.query("SELECT 1 FROM pg_namespace WHERE nspname NOT IN ('public', 'information_schema') AND nspname NOT LIKE 'pg_%' UNION ALL SELECT 1 FROM pg_class WHERE relnamespace = 'public'::regnamespace UNION ALL SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace UNION ALL SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace");
    if (objects.length) fail('database is not empty');
    await client.query(`CREATE TABLE public._prisma_migrations (
      id varchar(36) PRIMARY KEY, checksum varchar(64) NOT NULL, finished_at timestamptz,
      migration_name varchar(255) NOT NULL, logs text, rolled_back_at timestamptz,
      started_at timestamptz NOT NULL DEFAULT now(), applied_steps_count integer NOT NULL DEFAULT 0
    )`);
    for (const { name, sql, checksum } of sources) {
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO public._prisma_migrations (id, checksum, migration_name, finished_at, applied_steps_count) VALUES ($1,$2,$3,now(),1)', [randomUUID(), checksum, name]);
        await client.query('COMMIT');
        console.info(`Applied first-install migration ${name}`);
      } catch (error) { await client.query('ROLLBACK'); throw error; }
    }
  }
  const check = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'diff', '--from-url', process.env.DATABASE_URL, '--to-schema-datamodel', 'prisma/schema', '--exit-code'], { encoding: 'utf8' });
  if (check.status !== 0) fail(`schema drift detected (${check.stdout || check.stderr || check.error?.message})`);
  console.info('First-install database ready; migration history and schema match.');
} finally { await client.end(); }
