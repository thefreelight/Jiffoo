import { afterEach, beforeEach, expect, it } from 'vitest';
import { Client } from 'pg';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { validateCoreMigrationSql } from '../../../../packages/shared/src/core-migration-sql';
// @ts-expect-error The standalone host executor does not publish TypeScript declarations.
import { executeCoreMigrations, historyTableSql } from '../../../../deploy/release/core-migrations.mjs';

let client: Client;
let schema: string;
const query = (sql: string, values?: unknown[]) => client.query(sql.replaceAll('public.', `${schema}.`), values);
const migrationName = '20261012124027_order_item_catalog_snapshot';

beforeEach(async () => {
  expect(process.env.DATABASE_URL_TEST).toBe('postgresql://postgres:postgres@localhost:5432/jiffoo_core_test');
  client = new Client({ connectionString: process.env.DATABASE_URL_TEST });
  await client.connect();
  schema = `snapshot_migration_${randomUUID().replaceAll('-', '')}`;
  await client.query(`CREATE SCHEMA ${schema}`);
  await query(historyTableSql);
  await query(`
    CREATE TABLE public.products (id text PRIMARY KEY, name text NOT NULL, "productType" text NOT NULL, "typeData" jsonb);
    CREATE TABLE public.product_variants (id text PRIMARY KEY, "productId" text REFERENCES public.products(id), name text NOT NULL, "skuCode" text, attributes jsonb);
    CREATE TABLE public.product_translations ("productId" text REFERENCES public.products(id), locale text, name text);
    CREATE TABLE public.orders (id text PRIMARY KEY, "totalAmount" numeric(18,2));
    CREATE TABLE public.order_items (id text PRIMARY KEY, "orderId" text REFERENCES public.orders(id),
      "productId" text NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      "variantId" text NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      quantity integer NOT NULL, "unitPrice" numeric(18,2) NOT NULL, "taxAmount" numeric(18,2) NOT NULL,
      currency text NOT NULL, "fulfillmentStatus" text, "shippingCity" text);
    INSERT INTO public.products VALUES ('p', 'Original product', 'physical', '{"images":["one.png",null,4,"two.png"]}');
    INSERT INTO public.product_variants VALUES ('v', 'p', 'Original variant', 'SKU', '{"color":"red"}');
    INSERT INTO public.product_translations VALUES ('p', 'zh-Hans', '商品'), ('p', 'zh-Hant', '商品繁體');
    INSERT INTO public.orders VALUES ('o', 30.42);
    INSERT INTO public.order_items VALUES ('i', 'o', 'p', 'v', 3, 9.99, 0.45, 'USD', 'pending', 'Before'),
      ('j', 'o', 'p', 'v', 1, 0.45, 0, 'USD', 'pending', 'Before');
  `);
  const sql = readFileSync(`prisma/migrations/${migrationName}/migration.sql`, 'utf8');
  expect(validateCoreMigrationSql(sql).wrapperStripped).toBe(false);
  await executeCoreMigrations({ query }, [{ name: migrationName, sql, checksum: createHash('sha256').update(sql).digest('hex') }], [], validateCoreMigrationSql, async () => undefined);
});

afterEach(async () => {
  try { await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); }
  finally { await client.end(); }
});

it('backfills every populated item without changing financial values', async () => {
  const rows = (await query('SELECT * FROM public.order_items ORDER BY id')).rows;
  expect(rows).toHaveLength(2);
  for (const row of rows) {
    expect(row.catalogSnapshot).toEqual({ source: 'catalog-backfill', productId: 'p', variantId: 'v',
      productName: 'Original product', variantName: 'Original variant', skuCode: 'SKU', variantAttributes: { color: 'red' },
      productType: 'physical', productTypeData: { images: ['one.png', null, 4, 'two.png'] },
      productImages: ['one.png', 'two.png'], productTranslations: { 'zh-Hans': '商品', 'zh-Hant': '商品繁體' } });
  }
  expect(rows[0]).toMatchObject({ quantity: 3, unitPrice: '9.99', taxAmount: '0.45', currency: 'USD', lineTotal: '29.97' });
  expect(rows[1]).toMatchObject({ quantity: 1, unitPrice: '0.45', taxAmount: '0.00', currency: 'USD', lineTotal: '0.45' });
  expect((await query('SELECT "totalAmount" FROM public.orders')).rows).toEqual([{ totalAmount: '30.42' }]);
});

it.each([
  ['catalogSnapshot', `"catalogSnapshot" || '{"productName":"Changed"}'::jsonb`],
  ['quantity', 'quantity + 1'], ['unitPrice', '"unitPrice" + 1'], ['taxAmount', '"taxAmount" + 1'],
  ['currency', "'EUR'"], ['lineTotal', '"lineTotal" + 1'], ['productId', "'other-product'"], ['variantId', "'other-variant'"],
])('rejects changes to %s with SQLSTATE 23514', async (column, expression) => {
  await expect(query(`UPDATE public.order_items SET "${column}" = ${expression} WHERE id = 'i'`)).rejects.toMatchObject({ code: '23514' });
});

it('allows fulfillment and shipping updates', async () => {
  await query(`UPDATE public.order_items SET "fulfillmentStatus" = 'shipped', "shippingCity" = 'After' WHERE id = 'i'`);
  expect((await query(`SELECT "fulfillmentStatus", "shippingCity" FROM public.order_items WHERE id = 'i'`)).rows[0]).toEqual({ fulfillmentStatus: 'shipped', shippingCity: 'After' });
});

it.each([
  ['missing productName', `"catalogSnapshot" - 'productName'`],
  ['unknown source', `"catalogSnapshot" || '{"source":"unknown"}'::jsonb`],
  ['null source', `"catalogSnapshot" || '{"source":null}'::jsonb`],
  ['missing source', `"catalogSnapshot" - 'source'`],
])('rejects an inserted snapshot with %s through the shape CHECK', async (_name, expression) => {
  await expect(query(`INSERT INTO public.order_items
    (id, "orderId", "productId", "variantId", quantity, "unitPrice", "taxAmount", currency, "catalogSnapshot", "lineTotal")
    SELECT 'invalid', "orderId", "productId", "variantId", quantity, "unitPrice", "taxAmount", currency, ${expression}, "lineTotal"
    FROM public.order_items WHERE id = 'i'`)).rejects.toMatchObject({ code: '23514', constraint: 'order_items_catalog_snapshot_shape_check' });
});
