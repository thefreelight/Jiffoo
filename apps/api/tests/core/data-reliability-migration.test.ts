import { expect, it } from 'vitest';
import { Client } from 'pg';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { validateDatabaseUrl } from '../../src/config/test-lane';
import { validateCoreMigrationSql } from '../../../../packages/shared/src/core-migration-sql';
// @ts-expect-error The standalone migration executor has no TypeScript declarations.
import { executeCoreMigrations, historyTableSql } from '../../../../deploy/release/core-migrations.mjs';

const MIGRATION_NAME = '20261028031500_data_reliability_indexes';

/**
 * The mirror of the real tables: every table the migration touches, with the
 * columns the migration references. The mirror is a hand-written copy, so it is
 * checked against the real database before the migration runs: a column name
 * that only exists in the mirror would let the migration succeed in the test
 * and fail against the real database.
 */
interface MirrorColumn {
  name: string;
  type: string;
  notNull?: boolean;
  default?: string;
}

interface MirrorTable {
  table: string;
  primaryKey?: string[];
  columns: MirrorColumn[];
}

const MIRROR_TABLES: MirrorTable[] = [
  {
    table: 'orders',
    primaryKey: ['id'],
    columns: [
      { name: 'id', type: 'text', notNull: true },
      { name: 'userId', type: 'text', notNull: true },
      { name: 'idempotencyKey', type: 'text' },
      { name: 'order_number', type: 'text' },
      { name: 'status', type: 'text', notNull: true, default: "'PENDING'" },
      { name: 'paymentStatus', type: 'text', notNull: true, default: "'PENDING'" },
      { name: 'subtotalAmount', type: 'numeric(18, 2)', notNull: true, default: '0' },
      { name: 'shippingAmount', type: 'numeric(18, 2)', notNull: true, default: '0' },
      { name: 'taxAmount', type: 'numeric(18, 2)', notNull: true, default: '0' },
      { name: 'totalAmount', type: 'numeric(18, 2)', notNull: true, default: '0' },
      { name: 'createdAt', type: 'timestamp', notNull: true, default: 'now()' },
    ],
  },
  {
    table: 'admin_audit_events',
    primaryKey: ['id'],
    columns: [
      { name: 'id', type: 'text', notNull: true },
      { name: 'actorId', type: 'text' },
      { name: 'action', type: 'text' },
      { name: 'createdAt', type: 'timestamp', notNull: true, default: 'now()' },
    ],
  },
  {
    table: 'admin_staff_audit_logs',
    primaryKey: ['id'],
    columns: [
      { name: 'id', type: 'text', notNull: true },
      { name: 'actorUserId', type: 'text' },
      { name: 'createdAt', type: 'timestamp', notNull: true, default: 'now()' },
    ],
  },
  {
    table: 'categories',
    primaryKey: ['id'],
    columns: [
      { name: 'id', type: 'text', notNull: true },
      { name: 'sortOrder', type: 'integer', notNull: true, default: '0' },
    ],
  },
  {
    table: 'notifications',
    primaryKey: ['id'],
    columns: [
      { name: 'id', type: 'text', notNull: true },
      { name: 'resentFromId', type: 'text' },
      { name: 'createdAt', type: 'timestamp', notNull: true, default: 'now()' },
    ],
  },
  {
    table: 'order_items',
    primaryKey: ['id'],
    columns: [
      { name: 'id', type: 'text', notNull: true },
      { name: 'productId', type: 'text' },
    ],
  },
  {
    table: 'payments',
    primaryKey: ['id'],
    columns: [
      { name: 'id', type: 'text', notNull: true },
      { name: 'orderId', type: 'text' },
      { name: 'status', type: 'text' },
      { name: 'reviewResolution', type: 'text' },
      { name: 'createdAt', type: 'timestamp', notNull: true, default: 'now()' },
    ],
  },
  {
    table: 'plugin_installations',
    primaryKey: ['id'],
    columns: [
      { name: 'id', type: 'text', notNull: true },
      { name: 'instanceKey', type: 'text' },
      { name: 'enabled', type: 'boolean', notNull: true, default: 'true' },
      { name: 'deletedAt', type: 'timestamp' },
    ],
  },
  {
    table: 'plugin_installs',
    primaryKey: ['id'],
    columns: [
      { name: 'id', type: 'text', notNull: true },
      { name: 'installedAt', type: 'timestamp', notNull: true, default: 'now()' },
    ],
  },
  {
    table: 'plugin_migration_operations',
    primaryKey: ['id'],
    columns: [
      { name: 'id', type: 'text', notNull: true },
      { name: 'slug', type: 'text' },
      { name: 'phase', type: 'text' },
    ],
  },
  {
    table: 'plugin_page_sessions',
    primaryKey: ['id'],
    columns: [
      { name: 'id', type: 'text', notNull: true },
      { name: 'principalId', type: 'text' },
    ],
  },
  {
    table: 'product_variants',
    primaryKey: ['id'],
    columns: [
      { name: 'id', type: 'text', notNull: true },
      { name: 'skuCode', type: 'text' },
      { name: 'salePrice', type: 'numeric(18, 2)' },
      { name: 'stock', type: 'integer', notNull: true, default: '0' },
      { name: 'sortOrder', type: 'integer', notNull: true, default: '0' },
    ],
  },
  {
    table: 'products',
    primaryKey: ['id'],
    columns: [
      { name: 'id', type: 'text', notNull: true },
      { name: 'name', type: 'text' },
      { name: 'description', type: 'text' },
      { name: 'spuCode', type: 'text' },
      { name: 'createdAt', type: 'timestamp', notNull: true, default: 'now()' },
      { name: 'updatedAt', type: 'timestamp', notNull: true, default: 'now()' },
    ],
  },
  {
    table: 'shipments',
    primaryKey: ['id'],
    columns: [
      { name: 'id', type: 'text', notNull: true },
      { name: 'orderId', type: 'text' },
      { name: 'shippedAt', type: 'timestamp' },
    ],
  },
  {
    table: 'users',
    primaryKey: ['id'],
    columns: [
      { name: 'id', type: 'text', notNull: true },
      { name: 'email', type: 'text' },
      { name: 'username', type: 'text' },
      { name: 'isActive', type: 'boolean', notNull: true, default: 'true' },
    ],
  },
  {
    table: 'payment_ledger',
    primaryKey: ['id'],
    columns: [
      { name: 'id', type: 'text', notNull: true },
      { name: 'orderId', type: 'text' },
      { name: 'eventType', type: 'text' },
      { name: 'refundRequired', type: 'boolean', notNull: true, default: 'false' },
    ],
  },
  {
    table: 'auth_tokens',
    primaryKey: ['id'],
    columns: [
      { name: 'id', type: 'text', notNull: true },
      { name: 'userId', type: 'text' },
      { name: 'purpose', type: 'text' },
      { name: 'tokenHash', type: 'text' },
      { name: 'attempts', type: 'integer', notNull: true, default: '0' },
      { name: 'expiresAt', type: 'timestamp' },
    ],
  },
];

/** The legacy indexes the migration drops. They must exist for the DROP to work. */
const LEGACY_INDEXES_SQL = `
CREATE INDEX "orders_status_idx" ON public.orders(status);
CREATE INDEX "orders_paymentStatus_idx" ON public.orders("paymentStatus");
CREATE INDEX "notifications_resentFromId_idx" ON public.notifications("resentFromId");
CREATE UNIQUE INDEX "orders_idempotencyKey_key" ON public.orders("idempotencyKey");
`;

/** The indexes the migration drops. They must be gone once it ran. */
const DROPPED_INDEXES = [
  'notifications_resentFromId_idx',
  'orders_idempotencyKey_key',
  'orders_paymentStatus_idx',
  'orders_status_idx',
];

/** The trigram indexes the migration creates. */
const TRIGRAM_INDEXES = [
  'orders_orderNumber_trgm_idx',
  'product_variants_skuCode_trgm_idx',
  'products_description_trgm_idx',
  'products_name_trgm_idx',
  'products_spuCode_trgm_idx',
  'users_email_trgm_idx',
  'users_username_trgm_idx',
];

/** The `CREATE TABLE` statement of one mirrored table. */
function createTableSql(table: MirrorTable): string {
  const columns = table.columns.map(column => {
    const parts = [`"${column.name}" ${column.type}`];
    if (column.notNull) parts.push('NOT NULL');
    if (column.default !== undefined) parts.push(`DEFAULT ${column.default}`);
    return parts.join(' ');
  });
  if (table.primaryKey?.length) {
    columns.push(`PRIMARY KEY (${table.primaryKey.map(name => `"${name}"`).join(', ')})`);
  }
  return `CREATE TABLE public."${table.table}" (${columns.join(', ')});`;
}

/** The schema the `pg_trgm` extension is installed in, or null when it is absent. */
async function extensionSchema(client: Client): Promise<string | null> {
  const rows = (await client.query(
    `SELECT n.nspname AS schema
       FROM pg_extension e
       JOIN pg_namespace n ON n.oid = e.extnamespace
      WHERE e.extname = 'pg_trgm'`,
  )).rows;
  return rows[0]?.schema ?? null;
}

it('mirrors the columns of the real tables the migration touches', async () => {
  validateDatabaseUrl(process.env.DATABASE_URL_TEST!);
  const client = new Client({ connectionString: process.env.DATABASE_URL_TEST });
  await client.connect();
  try {
    for (const table of MIRROR_TABLES) {
      const real = (await client.query(
        `SELECT table_name FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = $1`,
        [table.table],
      )).rows;
      expect(real.map(row => row.table_name), `the table ${table.table} of the mirror`).toEqual([table.table]);
      for (const column of table.columns) {
        const mirrored = (await client.query(
          `SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
          [table.table, column.name],
        )).rows;
        expect(
          mirrored.map(row => row.column_name),
          `the column ${table.table}.${column.name} of the mirror`,
        ).toEqual([column.name]);
      }
    }
  } finally {
    await client.end();
  }
});

it('applies the data reliability migration to a scratch schema', async () => {
  validateDatabaseUrl(process.env.DATABASE_URL_TEST!);
  const client = new Client({ connectionString: process.env.DATABASE_URL_TEST });
  const schema = 'data_reliability_' + randomUUID().replaceAll('-', '');
  await client.connect();
  // The executor reads and writes `public._prisma_migrations`, so every
  // `public.` reference is rewritten to the scratch schema.
  const query = (sql: string, values?: unknown[]) => client.query(sql.replaceAll('public.', schema + '.'), values);
  // The extension may be absent from the shared database. The migration then
  // installs it into the scratch schema, and the cleanup has to take it away
  // again so that the shared database keeps the state it was found in.
  let extensionBefore: string | null = null;
  try {
    extensionBefore = await extensionSchema(client);
    await client.query(`CREATE SCHEMA ${schema}`);
    // The trigram operator class lives in the schema of the installed extension,
    // so the search path has to reach it.
    await client.query(`SET search_path TO ${schema}, public`);
    await query(historyTableSql);
    await query(MIRROR_TABLES.map(createTableSql).join('\n'));
    await query(LEGACY_INDEXES_SQL);

    const name = MIGRATION_NAME;
    const sql = readFileSync(`prisma/migrations/${name}/migration.sql`, 'utf8');
    await executeCoreMigrations(
      { query },
      [{ name, sql, checksum: createHash('sha256').update(sql).digest('hex') }],
      [],
      validateCoreMigrationSql,
      async () => undefined,
    );

    // The scoped idempotency index accepts one customer key per customer.
    const insertOrder = (id: string, userId: string, idempotencyKey: string) =>
      query(
        `INSERT INTO public.orders (id, "userId", "idempotencyKey", order_number, "subtotalAmount", "shippingAmount", "taxAmount", "totalAmount")
         VALUES ($1, $2, $3, $4, 0, 0, 0, 0)`,
        [id, userId, idempotencyKey, `DR-${id}`],
      );
    await insertOrder('order-a', 'user-a', 'shared-key');
    await insertOrder('order-b', 'user-b', 'shared-key');
    await expect(insertOrder('order-c', 'user-a', 'shared-key')).rejects.toMatchObject({ code: '23505' });

    // The check constraints reject the writes they backstop.
    await expect(query(
      `INSERT INTO public.product_variants (id, stock) VALUES ('variant-a', -1)`,
    )).rejects.toMatchObject({ code: '23514' });
    await expect(query(
      `INSERT INTO public.orders (id, "userId", "subtotalAmount", "shippingAmount", "taxAmount", "totalAmount")
       VALUES ('order-negative', 'user-a', 0, 0, 0, -1)`,
    )).rejects.toMatchObject({ code: '23514' });
    await expect(query(
      `INSERT INTO public.auth_tokens (id, "userId", purpose, "tokenHash", attempts, "expiresAt")
       VALUES ('token-a', 'user-a', 'EMAIL_VERIFICATION', 'hash-a', -1, now() + interval '1 hour')`,
    )).rejects.toMatchObject({ code: '23514' });

    // The trigram extension is installed in a schema of the search path that
    // created the search indexes.
    const extensionAfter = await extensionSchema(client);
    expect(extensionAfter).not.toBeNull();
    const searchPath = (await client.query(`SELECT current_schemas(false) AS schemas`)).rows[0].schemas as string[];
    expect(searchPath).toContain(extensionAfter);

    const trigram = (await client.query(
      `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = $1 AND indexname = ANY($2::text[])`,
      [schema, TRIGRAM_INDEXES],
    )).rows;
    expect(trigram.map(row => row.indexname).sort()).toEqual([...TRIGRAM_INDEXES].sort());
    for (const row of trigram) {
      expect(row.indexdef).toContain('gin');
      expect(row.indexdef).toContain('gin_trgm_ops');
    }

    // The single column indexes the migration drops are gone.
    const dropped = (await client.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname = $1 AND indexname = ANY($2::text[])`,
      [schema, DROPPED_INDEXES],
    )).rows.map(row => row.indexname);
    expect(dropped).toEqual([]);

    // The migration history records the migration.
    const history = (await query(
      `SELECT migration_name, checksum, finished_at FROM public._prisma_migrations WHERE migration_name = $1`,
      [name],
    )).rows;
    expect(history).toHaveLength(1);
    expect(history[0].migration_name).toBe(name);
    expect(history[0].finished_at).toBeTruthy();
  } finally {
    try {
      if (extensionBefore === null) {
        // The migration installed the extension into the scratch schema. It goes
        // before the schema, so the shared database never loses the extension it
        // needs.
        await client.query(`DROP EXTENSION IF EXISTS pg_trgm`);
      }
    } catch { /* The schema drop below removes the scratch schema either way. */ }
    try { await client.query(`DROP SCHEMA ${schema} CASCADE`); } finally { await client.end(); }
  }
});

it('keeps the data reliability migration transaction safe', () => {
  const sql = readFileSync(`prisma/migrations/${MIGRATION_NAME}/migration.sql`, 'utf8');
  // The executor owns the transaction: the migration must not open one itself.
  expect(() => validateCoreMigrationSql(sql)).not.toThrow();
  expect(validateCoreMigrationSql(sql).wrapperStripped).toBe(false);
  expect(sql).not.toMatch(/^\s*(BEGIN|START\s+TRANSACTION|COMMIT|END|ROLLBACK|ABORT)\b/im);
  // `CREATE INDEX CONCURRENTLY` cannot run inside the transaction of the executor.
  expect(sql).not.toMatch(/CONCURRENTLY/i);
});
