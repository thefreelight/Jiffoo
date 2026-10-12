import { afterEach, beforeEach, expect, it } from 'vitest';
import { Client } from 'pg';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { validateCoreMigrationSql } from '../../../../packages/shared/src/core-migration-sql';
import { validateTransactionalMigrationSql } from '../../../../packages/shared/src/plugin-migrations';
// The host executor is deliberately JavaScript and runs from the backend image.
// @ts-expect-error The standalone host module does not publish TypeScript declarations.
import { executeCoreMigrations, historyTableSql } from '../../../../deploy/release/core-migrations.mjs';

let client: Client, schema: string;
const source = (name: string, sql: string) => ({ name, sql, checksum: createHash('sha256').update(sql).digest('hex') });
const query = (sql: string, values?: unknown[]) => client.query(sql.replaceAll('public.', `${schema}.`), values);
beforeEach(async () => {
  expect(process.env.DATABASE_URL_TEST).toBe('postgresql://postgres:postgres@localhost:5432/jiffoo_core_test');
  client = new Client({ connectionString: process.env.DATABASE_URL_TEST }); await client.connect();
  schema = 'core_executor_' + randomUUID().replaceAll('-', '');
  await client.query(`CREATE SCHEMA ${schema}`); await query(historyTableSql);
});
afterEach(async () => { try { await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); } finally { await client.end(); } });

it('strips only the sole outer transaction wrapper and keeps original checksums', async () => {
  const sql = '-- Header\nBEGIN; CREATE TABLE public.probe (id integer PRIMARY KEY); COMMIT; -- Trailer';
  const events: any[] = [], item = source('001', sql);
  await executeCoreMigrations({ query }, [item], [], validateCoreMigrationSql, async (event: any) => events.push(event));
  expect((await query('SELECT checksum FROM public._prisma_migrations')).rows).toEqual([{ checksum: item.checksum }]);
  expect(events[0]).toMatchObject({ status: 'intent', wrapperStripped: true });
  expect((await query("SELECT to_regclass($1) AS name", [`${schema}.probe`])).rows[0].name).toBe(`${schema}.probe`);
  const historical = readFileSync('prisma/migrations/20260928000000_order_state_machine/migration.sql', 'utf8');
  expect(validateCoreMigrationSql(historical).wrapperStripped).toBe(true);
  expect(validateCoreMigrationSql('START TRANSACTION; SELECT 1; END;').wrapperStripped).toBe(true);
});
it.each([
  'BEGIN; SELECT 1; COMMIT; SELECT 2;',
  'BEGIN; SELECT 1; COMMIT; BEGIN; SELECT 2; COMMIT;',
  'BEGIN; SELECT 1;',
  'SELECT 1; COMMIT; SELECT 2;',
  'BEGIN; SELECT 1; COMMIT; SELECT 2; COMMIT;',
  'VACUUM;', 'CLUSTER;', 'CREATE INDEX CONCURRENTLY x ON t(id);',
  'ALTER SYSTEM SET work_mem=1;', 'COPY t FROM STDIN;', 'PREPARE TRANSACTION \'x\';',
])('rejects unsafe top-level SQL without writing history: %s', async sql => {
  await expect(executeCoreMigrations({ query }, [source('001', sql)], [], validateCoreMigrationSql, async () => undefined)).rejects.toThrow('transaction-safe');
  expect((await query('SELECT count(*) FROM public._prisma_migrations')).rows[0].count).toBe('0');
});
it('accepts DO BEGIN and commits SQL with the ledger; failure rolls both back', async () => {
  const sql = 'CREATE TABLE public.probe (id integer PRIMARY KEY); DO $$ BEGIN INSERT INTO public.probe VALUES (1); END $$;';
  expect(validateCoreMigrationSql(sql).wrapperStripped).toBe(false);
  expect(() => validateTransactionalMigrationSql(sql)).toThrow();
  const first = source('001', sql), second = source('002', 'INSERT INTO public.probe VALUES (2); SELECT 1/0;');
  const events: any[] = [];
  await expect(executeCoreMigrations({ query }, [first, second], [], validateCoreMigrationSql, async (event: any) => events.push(event))).rejects.toMatchObject({ code: '22012' });
  expect((await query('SELECT * FROM public.probe')).rows).toEqual([{ id: 1 }]);
  expect((await query('SELECT migration_name FROM public._prisma_migrations')).rows).toEqual([{ migration_name: '001' }]);
  expect(events.at(-1).status).toBe('aborted');
});
it('does not treat quoted words or DO bodies as transaction wrappers', () => {
  for (const sql of ["SELECT 'BEGIN; COMMIT;';", 'DO $body$ BEGIN RAISE NOTICE \'COMMIT;\'; END $body$;', 'SET LOCAL work_mem=\'4MB\';', 'CREATE FUNCTION public.fixture() RETURNS integer LANGUAGE sql AS $$ SELECT 1; $$;']) {
    expect(validateCoreMigrationSql(sql).wrapperStripped).toBe(false);
  }
});
