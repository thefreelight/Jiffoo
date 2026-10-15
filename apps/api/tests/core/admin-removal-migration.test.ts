import { expect, it } from 'vitest';
import { Client } from 'pg';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { validateCoreMigrationSql } from '../../../../packages/shared/src/core-migration-sql';
// @ts-expect-error The standalone host executor does not publish TypeScript declarations.
import { executeCoreMigrations, historyTableSql } from '../../../../deploy/release/core-migrations.mjs';

it('closes a historically removed administrator, revokes invites once and leaves other accounts untouched', async () => {
  expect(process.env.DATABASE_URL).toBe('postgresql://postgres:postgres@localhost:5432/jiffoo_core_test');
  expect(process.env.DATABASE_URL_TEST).toBe(process.env.DATABASE_URL);
  const client = new Client({ connectionString: process.env.DATABASE_URL_TEST });
  const schema = 'admin_removal_' + randomUUID().replaceAll('-', '');
  const query = (sql: string, values?: unknown[]) => client.query(sql.replaceAll('public.', schema + '.'), values);
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}`);
    await query(historyTableSql);
    await query(`CREATE TABLE public.users (id text PRIMARY KEY, role text NOT NULL, "isActive" boolean NOT NULL, "sessionVersion" integer NOT NULL);
      CREATE TABLE public.admin_staff_audit_logs ("staffUserId" text NOT NULL, action text NOT NULL, "createdAt" timestamp(3) NOT NULL);
      CREATE TABLE public.auth_tokens (id text PRIMARY KEY, "userId" text NOT NULL, purpose text NOT NULL, "consumedAt" timestamp(3));
      INSERT INTO public.users VALUES ('removed', 'ADMIN', true, 7), ('normal', 'ADMIN', true, 11), ('customer', 'USER', true, 21);
      INSERT INTO public.admin_staff_audit_logs VALUES ('removed', 'ADMIN_REMOVED', '2026-10-01 01:00:00'), ('removed', 'ADMIN_REMOVED', '2026-10-10 02:30:00'), ('normal', 'ADMIN_INVITED', '2026-10-12'), ('customer', 'ADMIN_REMOVED', '2026-10-12');
      INSERT INTO public.auth_tokens VALUES ('invite-1', 'removed', 'STAFF_INVITE', NULL), ('invite-2', 'removed', 'STAFF_INVITE', NULL),
        ('used', 'removed', 'STAFF_INVITE', '2026-10-01'), ('normal-invite', 'normal', 'STAFF_INVITE', NULL), ('customer-reset', 'customer', 'PASSWORD_RESET', NULL);`);
    const untouched = (await query(`SELECT * FROM public.users WHERE id <> 'removed' ORDER BY id`)).rows;
    const tokens = (await query(`SELECT * FROM public.auth_tokens WHERE id NOT IN ('invite-1','invite-2') ORDER BY id`)).rows;
    const name = '20261014170556_admin_removed_at', sql = readFileSync(`prisma/migrations/${name}/migration.sql`, 'utf8');
    expect(validateCoreMigrationSql(sql).wrapperStripped).toBe(false);
    await executeCoreMigrations({ query }, [{ name, sql, checksum: createHash('sha256').update(sql).digest('hex') }], [], validateCoreMigrationSql, async () => undefined);
    const result = (await query(`SELECT id, role, "isActive", "sessionVersion", "removedAt"::text FROM public.users WHERE id = 'removed'`)).rows[0];
    expect(result).toEqual({ id: 'removed', role: 'ADMIN', isActive: false, sessionVersion: 8, removedAt: '2026-10-10 02:30:00' });
    expect((await query(`SELECT id, role, "isActive", "sessionVersion" FROM public.users WHERE id <> 'removed' ORDER BY id`)).rows).toEqual(untouched);
    expect((await query(`SELECT "removedAt" FROM public.users WHERE id <> 'removed'`)).rows).toEqual([{ removedAt: null }, { removedAt: null }]);
    expect((await query(`SELECT * FROM public.auth_tokens WHERE id NOT IN ('invite-1','invite-2') ORDER BY id`)).rows).toEqual(tokens);
    expect((await query(`SELECT count(*)::int AS count FROM public.auth_tokens WHERE "userId"='removed' AND "consumedAt" IS NULL`)).rows).toEqual([{ count: 0 }]);
    const after = (await query('SELECT * FROM public.users ORDER BY id')).rows;
    const consumed = (await query('SELECT * FROM public.auth_tokens ORDER BY id')).rows;
    await query(sql.slice(sql.indexOf('WITH latest_removals')));
    expect((await query('SELECT * FROM public.users ORDER BY id')).rows).toEqual(after);
    expect((await query('SELECT * FROM public.auth_tokens ORDER BY id')).rows).toEqual(consumed);
  } finally { try { await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); } finally { await client.end(); } }
});
