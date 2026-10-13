import { expect, it } from 'vitest';
import { Client } from 'pg';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { validateCoreMigrationSql } from '../../../../packages/shared/src/core-migration-sql';
// @ts-expect-error The standalone host executor does not publish TypeScript declarations.
import { executeCoreMigrations, historyTableSql } from '../../../../deploy/release/core-migrations.mjs';

it('backfills random SPUs and globally unique SKUs without changing historical order snapshots', async () => {
  expect(process.env.DATABASE_URL_TEST).toBe('postgresql://postgres:postgres@localhost:5432/jiffoo_core_test');
  const client = new Client({ connectionString: process.env.DATABASE_URL_TEST });
  const schema = 'product_code_' + randomUUID().replaceAll('-', '');
  const query = (sql: string, values?: unknown[]) => client.query(sql.replaceAll('public.', `${schema}.`), values);
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    await query(historyTableSql);
    await query(`
      CREATE TABLE public.products (id text PRIMARY KEY, "createdAt" timestamp NOT NULL);
      CREATE TABLE public.product_variants (id text PRIMARY KEY, "productId" text NOT NULL REFERENCES public.products(id),
        "skuCode" text, "sortOrder" integer NOT NULL, "createdAt" timestamp NOT NULL);
      CREATE INDEX "product_variants_skuCode_idx" ON public.product_variants ("skuCode");
      CREATE TABLE public.admin_audit_events (id text PRIMARY KEY, "actorId" text NOT NULL, action text NOT NULL,
        "targetType" text NOT NULL, "targetId" text NOT NULL, summary jsonb NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE public.order_items (id text PRIMARY KEY, "catalogSnapshot" jsonb NOT NULL);
      INSERT INTO public.products VALUES ('p1', '2026-01-01'), ('p2', '2026-01-02'), ('p3', '2026-01-03');
      INSERT INTO public.product_variants VALUES
        ('a', 'p1', ' Triple ', 0, '2026-01-01'), ('b', 'p2', 'TRIPLE', 0, '2026-01-02'),
        ('c', 'p3', 'triple', 0, '2026-01-03'),
        ('d', 'p1', 'Clash', 1, '2026-01-01'), ('e', 'p2', 'CLASH', 1, '2026-01-02'),
        ('f', 'p3', 'clash-DUP1', 1, '2026-01-01'), ('g', 'p3', ' padded ', 2, '2026-01-01');
      INSERT INTO public.products VALUES ('p4', '2026-01-04');
      INSERT INTO public.product_variants VALUES
        ('n2', 'p4', '   ', 0, '2026-01-02'), ('n1', 'p4', NULL, 0, '2026-01-01');
      INSERT INTO public.order_items VALUES ('item', '{"skuCode":"TRIPLE","productName":"Historical"}');
      SET TIME ZONE 'Pacific/Honolulu';
    `);
    const before = (await query('SELECT "catalogSnapshot"::text AS snapshot FROM public.order_items')).rows;
    const name = '20261013163101_product_spu_variant_sku';
    const sql = readFileSync(`prisma/migrations/${name}/migration.sql`, 'utf8');
    expect(validateCoreMigrationSql(sql).wrapperStripped).toBe(false);
    await executeCoreMigrations({ query }, [{ name, sql, checksum: createHash('sha256').update(sql).digest('hex') }], [], validateCoreMigrationSql, async () => undefined);
    const products = (await query('SELECT * FROM public.products ORDER BY id')).rows;
    expect(new Set(products.map(row => row.spuCode)).size).toBe(4);
    for (const row of products) expect(row.spuCode).toMatch(/^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$/);
    const variants = (await query('SELECT * FROM public.product_variants ORDER BY id')).rows;
    expect(new Set(variants.map(row => row.skuCode.toLowerCase())).size).toBe(variants.length);
    expect(variants.map(row => row.skuCode)).toEqual(['Triple', 'TRIPLE-DUP1', 'triple-DUP2', 'Clash', 'CLASH-DUP2', 'clash-DUP1', 'padded', products[3].spuCode + '-01', products[3].spuCode + '-02']);
    const audits = (await query(`SELECT *, abs(extract(epoch FROM ((clock_timestamp() AT TIME ZONE 'UTC') - "createdAt"))) AS age FROM public.admin_audit_events ORDER BY "targetId"`)).rows;
    expect(audits).toHaveLength(3);
    for (const audit of audits) {
      expect(audit).toMatchObject({ actorId: 'system', action: 'VARIANT_SKU_DEDUPLICATED', targetType: 'variant' });
      expect(Number(audit.age)).toBeLessThan(5);
      expect(audit.summary).toMatchObject({ reason: 'case_insensitive_duplicate', productId: expect.any(String), old: expect.any(String), new: expect.any(String) });
    }
    expect(audits.filter(row => ['b', 'c'].includes(row.targetId))).toHaveLength(2);
    expect((await query('SELECT "catalogSnapshot"::text AS snapshot FROM public.order_items')).rows).toEqual(before);
    const columns = (await client.query(`SELECT table_name, column_name, is_nullable FROM information_schema.columns WHERE table_schema = $1 AND column_name IN ('spuCode', 'skuCode')`, [schema])).rows;
    expect(columns).toHaveLength(2);
    expect(columns.every(row => row.is_nullable === 'NO')).toBe(true);
    const indexes = (await client.query('SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = $1', [schema])).rows;
    expect(indexes.some(row => /migration_tmp/.test(row.indexname))).toBe(false);
    expect(indexes.filter(row => /CREATE UNIQUE INDEX.*lower/.test(row.indexdef))).toHaveLength(2);
    expect((await query("SELECT to_regclass('public.product_spu_code_seq') AS sequence")).rows[0].sequence).toBeNull();
    await expect(query('UPDATE public.products SET "spuCode" = lower($1) WHERE id = $2', [products[0].spuCode, 'p2'])).rejects.toMatchObject({ code: '23505' });
    await expect(query(`UPDATE public.product_variants SET "skuCode" = 'tRiPlE' WHERE id = 'e'`)).rejects.toMatchObject({ code: '23505' });
    await expect(query(`UPDATE public.products SET "spuCode" = NULL WHERE id = 'p1'`)).rejects.toMatchObject({ code: '23502' });
    await expect(query(`UPDATE public.product_variants SET "skuCode" = NULL WHERE id = 'a'`)).rejects.toMatchObject({ code: '23502' });
  } finally {
    try { await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); }
    finally { await client.end(); }
  }
});
