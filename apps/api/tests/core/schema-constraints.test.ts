import { laneConfig, validateDatabaseUrl } from '../../src/config/test-lane';
import { expect, it } from 'vitest';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { validateCoreMigrationSql } from '../../../../packages/shared/src/core-migration-sql';

const MIGRATION_NAME = '20261028031500_data_reliability_indexes';

/**
 * The business indexes that Prisma cannot express. They are partial or expression
 * indexes, so the schema engine skips them and they only exist in the migration
 * history. They must survive a data reliability migration.
 */
const RAW_ONLY_BUSINESS_INDEXES = [
  'payment_ledger_one_accepted_capture_per_order',
  'plugin_tasks_due_partial_idx',
  'plugin_tasks_lease_partial_idx',
  'product_variants_skucode_lower_key',
  'products_spucode_lower_key',
  'refunds_one_completed_per_capture',
];

/**
 * The indexes the data reliability migration adds.
 *
 * The staff audit log index constrains the raw "actorUserId" column, so the audit
 * read has to filter that column and not the projected `COALESCE("actorUserId",
 * 'system')` expression.
 */
const NEW_INDEXES = [
  'admin_audit_events_action_createdAt_idx',
  'admin_audit_events_actorId_idx',
  'admin_staff_audit_logs_actorUserId_createdAt_idx',
  'categories_sortOrder_id_idx',
  'notifications_resentFromId_createdAt_idx',
  'order_items_productId_idx',
  'orders_orderNumber_trgm_idx',
  'orders_paymentStatus_status_createdAt_idx',
  'orders_status_createdAt_idx',
  'orders_totalAmount_id_idx',
  'orders_userId_idempotencyKey_key',
  'payment_ledger_succeeded_refund_required_idx',
  'payments_orderId_createdAt_idx',
  'payments_status_reviewResolution_idx',
  'plugin_installations_instanceKey_enabled_deletedAt_idx',
  'plugin_installs_installedAt_idx',
  'plugin_migration_operations_slug_phase_idx',
  'plugin_page_sessions_principalId_idx',
  'product_variants_salePrice_idx',
  'product_variants_skuCode_trgm_idx',
  'product_variants_sortOrder_id_idx',
  'product_variants_stock_idx',
  'products_createdAt_id_idx',
  'products_description_trgm_idx',
  'products_name_id_idx',
  'products_name_trgm_idx',
  'products_spuCode_trgm_idx',
  'products_updatedAt_id_idx',
  'shipments_orderId_shippedAt_idx',
  'users_email_trgm_idx',
  'users_isActive_idx',
  'users_username_trgm_idx',
];

/**
 * The single column indexes the data reliability migration drops. Their composite
 * replacements carry the same leading column, so a filter on that column alone is
 * still served and the single column index is only write cost.
 */
const DROPPED_INDEXES = [
  'notifications_resentFromId_idx',
  'orders_idempotencyKey_key',
  'orders_paymentStatus_idx',
  'orders_status_idx',
];

/**
 * The check constraints the data reliability migration adds. The storage quota
 * accounting carries the same rule since the plugin private storage migration,
 * so its existing constraint is asserted instead of a duplicate.
 *
 * The negative stock and the negative order amount are rejected by the
 * application before they reach the database: the inventory package applies a
 * lower bound to a stock adjustment and the order placement package checks the
 * amounts it takes from the plugin contracts. The constraints are the backstop
 * for a write that bypasses those packages, so the test asserts that they
 * exist and not that the database rejects a reachable write.
 */
const NEW_CHECK_CONSTRAINTS = [
  { table: 'auth_tokens', name: 'auth_tokens_attempts_nonnegative', rule: 'attempts' },
  { table: 'orders', name: 'orders_amounts_nonnegative', rule: 'totalAmount' },
  { table: 'plugin_storage_quotas', name: 'plugin_storage_quotas_nonnegative', rule: 'usedBytes' },
  { table: 'product_variants', name: 'product_variants_stock_nonnegative', rule: 'stock' },
];

async function connect(): Promise<Client> {
  expect(validateDatabaseUrl(process.env.DATABASE_URL_TEST!).pathname).toBe('/' + laneConfig().databaseName);
  const client = new Client({ connectionString: process.env.DATABASE_URL_TEST });
  await client.connect();
  return client;
}

/** The indexed columns of one index, in index order. */
async function indexColumns(client: Client, name: string): Promise<string[]> {
  const rows = (await client.query(
    `SELECT pg_get_indexdef(i.indexrelid, k, true) AS column
       FROM pg_index i
       JOIN pg_class c ON c.oid = i.indexrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN generate_series(1, i.indnkeyatts) AS k ON true
      WHERE n.nspname = 'public' AND c.relname = $1
      ORDER BY k`,
    [name],
  )).rows;
  return rows.map(row => row.column);
}

it('keeps the raw-only business indexes that the schema engine cannot express', async () => {
  const client = await connect();
  try {
    const rows = (await client.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1::text[])`,
      [RAW_ONLY_BUSINESS_INDEXES],
    )).rows.map(row => row.indexname);
    expect([...rows].sort()).toEqual([...RAW_ONLY_BUSINESS_INDEXES].sort());
  } finally {
    await client.end();
  }
});

it('creates every index of the data reliability migration', async () => {
  const client = await connect();
  try {
    const rows = (await client.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1::text[])`,
      [NEW_INDEXES],
    )).rows.map(row => row.indexname);
    expect([...rows].sort()).toEqual([...NEW_INDEXES].sort());
    const scoped = (await client.query(
      `SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'orders_userId_idempotencyKey_key'`,
    )).rows[0]?.indexdef ?? '';
    expect(scoped).toContain('UNIQUE');
    expect(scoped).toContain('"userId"');
    expect(scoped).toContain('"idempotencyKey"');
    const productSort = await indexColumns(client, 'products_createdAt_id_idx');
    expect(productSort).toEqual(['"createdAt"', 'id']);
    const spuSearch = await indexColumns(client, 'products_spuCode_trgm_idx');
    expect(spuSearch).toEqual(['"spuCode"']);
    const spuDefinition = (await client.query(
      `SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'products_spuCode_trgm_idx'`,
    )).rows[0]?.indexdef ?? '';
    expect(spuDefinition).toContain('gin');
    expect(spuDefinition).toContain('gin_trgm_ops');
  } finally {
    await client.end();
  }
});

it('installs the trigram extension the search indexes need', async () => {
  const client = await connect();
  try {
    const rows = (await client.query(
      `SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'`,
    )).rows.map(row => row.extname);
    expect(rows).toEqual(['pg_trgm']);
  } finally {
    await client.end();
  }
});

it('drops the single column indexes that a composite index replaces', async () => {
  const client = await connect();
  try {
    const rows = (await client.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1::text[])`,
      [DROPPED_INDEXES],
    )).rows.map(row => row.indexname);
    expect(rows).toEqual([]);
  } finally {
    await client.end();
  }
});

it('creates every check constraint of the data reliability migration', async () => {
  const client = await connect();
  try {
    const rows = (await client.query(
      `SELECT c.relname AS table, con.conname AS name, pg_get_constraintdef(con.oid) AS definition
         FROM pg_constraint con
         JOIN pg_class c ON c.oid = con.conrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND con.contype = 'c' AND con.conname = ANY($1::text[])`,
      [NEW_CHECK_CONSTRAINTS.map(constraint => constraint.name)],
    )).rows;
    expect(rows.map(row => row.name).sort()).toEqual([...NEW_CHECK_CONSTRAINTS].map(c => c.name).sort());
    for (const constraint of NEW_CHECK_CONSTRAINTS) {
      const row = rows.find(candidate => candidate.name === constraint.name)!;
      expect(row.table).toBe(constraint.table);
      expect(row.definition).toContain(constraint.rule);
    }
  } finally {
    await client.end();
  }
});

it('scopes the order idempotency key to its customer', async () => {
  const client = await connect();
  const suffix = randomUUID().replaceAll('-', '');
  const firstUserId = `schema_user_a_${suffix}`;
  const secondUserId = `schema_user_b_${suffix}`;
  const key = `schema-key-${suffix}`;
  const insertUser = (id: string) =>
    client.query(
      `INSERT INTO users (id, email, username, password, "updatedAt") VALUES ($1, $2, $3, 'not-a-hash', now())`,
      [id, `${id}@example.test`, id],
    );
  const insertOrder = (id: string, userId: string) =>
    client.query(
      `INSERT INTO orders (id, "userId", order_number, "subtotalAmount", "totalAmount", "updatedAt", "idempotencyKey")
       VALUES ($1, $2, $3, 0, 0, now(), $4)`,
      [id, userId, `SCHEMA-${id}`, key],
    );
  try {
    await insertUser(firstUserId);
    await insertUser(secondUserId);
    await insertOrder('schema-order-a', firstUserId);
    await insertOrder('schema-order-b', secondUserId);
    const shared = (await client.query(
      `SELECT "userId" FROM orders WHERE "idempotencyKey" = $1`,
      [key],
    )).rows.map(row => row.userId);
    expect([...shared].sort()).toEqual([firstUserId, secondUserId].sort());
    await expect(insertOrder('schema-order-c', firstUserId)).rejects.toMatchObject({ code: '23505' });
  } finally {
    await client.query(`DELETE FROM orders WHERE "idempotencyKey" = $1`, [key]).catch(() => undefined);
    await client.query(`DELETE FROM users WHERE id = ANY($1::text[])`, [[firstUserId, secondUserId]]).catch(() => undefined);
    await client.end();
  }
});

it('rejects a negative auth token attempt count at the database', async () => {
  // The application only ever increments the attempt counter, so this constraint is a
  // backstop that no reachable write can trip.
  const client = await connect();
  const suffix = randomUUID().replaceAll('-', '');
  const userId = `schema_attempt_user_${suffix}`;
  try {
    await client.query(
      `INSERT INTO users (id, email, username, password, "updatedAt") VALUES ($1, $2, $3, 'not-a-hash', now())`,
      [userId, `${userId}@example.test`, userId],
    );
    await expect(client.query(
      `INSERT INTO auth_tokens (id, "userId", purpose, "tokenHash", attempts, "expiresAt")
       VALUES ($1, $2, 'EMAIL_VERIFICATION', $3, -1, now() + interval '1 hour')`,
      [`schema_attempt_token_${suffix}`, userId, `hash-${suffix}`],
    )).rejects.toMatchObject({ code: '23514' });
  } finally {
    await client.query(`DELETE FROM auth_tokens WHERE id = $1`, [`schema_attempt_token_${suffix}`]).catch(() => undefined);
    await client.query(`DELETE FROM users WHERE id = $1`, [userId]).catch(() => undefined);
    await client.end();
  }
});

it('keeps the data reliability migration transaction safe', () => {
  const sql = readFileSync(`prisma/migrations/${MIGRATION_NAME}/migration.sql`, 'utf8');
  expect(() => validateCoreMigrationSql(sql)).not.toThrow();
  expect(validateCoreMigrationSql(sql).wrapperStripped).toBe(false);
});
