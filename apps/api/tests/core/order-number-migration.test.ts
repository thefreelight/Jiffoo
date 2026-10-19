import { expect, it } from 'vitest';
import { Client } from 'pg';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { validateDatabaseUrl } from '../../src/config/test-lane';
import { validateCoreMigrationSql } from '../../../../packages/shared/src/core-migration-sql';
// @ts-expect-error The standalone migration executor has no TypeScript declarations.
import { executeCoreMigrations, historyTableSql } from '../../../../deploy/release/core-migrations.mjs';

it.each(['America/New_York', null])('backfills stable daily sequences and seeds counters with timezone %s', async timezone => {
  validateDatabaseUrl(process.env.DATABASE_URL_TEST!);
  const client = new Client({ connectionString: process.env.DATABASE_URL_TEST });
  const schema = 'order_number_' + randomUUID().replaceAll('-', '');
  await client.connect();
  const query = (sql: string, values?: unknown[]) => client.query(sql.replaceAll('public.', schema + '.'), values);
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}`);
    await query(historyTableSql);
    await query(`CREATE TABLE public.orders (id text PRIMARY KEY, "createdAt" timestamp NOT NULL);
      CREATE TABLE public.system_settings (id text PRIMARY KEY, settings jsonb);
      INSERT INTO public.orders VALUES ('b', '2026-10-16 03:30:00'), ('a', '2026-10-16 03:30:00'), ('c', '2026-10-16 05:00:00');`);
    if (timezone) await query(`INSERT INTO public.system_settings VALUES ('system', $1::jsonb)`, [JSON.stringify({ 'localization.timezone': timezone })]);
    await client.query(`SET TIME ZONE 'Pacific/Honolulu'`);
    const name = '20261019021115_order_numbers';
    const sql = readFileSync(`prisma/migrations/${name}/migration.sql`, 'utf8');
    await executeCoreMigrations({ query }, [{ name, sql, checksum: createHash('sha256').update(sql).digest('hex') }], [], validateCoreMigrationSql, async () => undefined);
    const rows = (await query('SELECT id, order_number FROM public.orders ORDER BY id')).rows;
    expect(rows).toEqual([
      { id: 'a', order_number: `JF-${timezone ? '20261015' : '20261016'}-0001` },
      { id: 'b', order_number: `JF-${timezone ? '20261015' : '20261016'}-0002` },
      { id: 'c', order_number: `JF-20261016-${timezone ? '0001' : '0003'}` },
    ]);
    expect((await query('SELECT * FROM public.order_number_counters ORDER BY day')).rows).toEqual(timezone
      ? [{ day: '20261015', last_value: 2 }, { day: '20261016', last_value: 1 }]
      : [{ day: '20261016', last_value: 3 }]);
    await expect(query(`INSERT INTO public.orders (id, "createdAt") VALUES ('missing', now())`)).rejects.toMatchObject({ code: '23502' });
    await expect(query(`INSERT INTO public.orders VALUES ('duplicate', now(), $1)`, [rows[0].order_number])).rejects.toMatchObject({ code: '23505' });
  } finally {
    try { await client.query(`DROP SCHEMA ${schema} CASCADE`); } finally { await client.end(); }
  }
});
