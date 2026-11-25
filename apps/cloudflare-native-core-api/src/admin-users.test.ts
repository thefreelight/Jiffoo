import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The auth chain pulls in worker-only sockets; the deletion guard under test
// needs only the authenticated admin identity and env.DB.
const authenticateNativeAdmin = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeAdmin }));

const { tryNativeAdminUsers } = await import('./admin-users');
const {
  CUSTOMER_DELETE_BY_ORDER,
  CUSTOMER_DELETE_KEEPS,
  analyzeCustomerSchema,
  buildCustomerForceDeletePlan,
  isCustomerSchemaTrustworthy,
  parseForeignKeys,
} = await import('./customer-delete');

const migrations = resolve(import.meta.dirname, '../migrations');

interface Statement { sql: string; args: unknown[] }
interface Row { table?: string; column?: string; count?: number }
interface AuditRow { action: string; actor_user_id: string; staff_email: string; metadata: string | null }

const isQuery = (sql: string) =>
  /^\s*(SELECT|WITH)\b/i.test(sql) || /^\s*PRAGMA\s+(table_info|foreign_key_list|table_list)\b/i.test(sql);

// Minimal faithful D1 surface over node:sqlite so the deletes run with real
// foreign keys and the real migration schema.
function d1(sqlite: DatabaseSync) {
  const query = (bound: Statement) => sqlite.prepare(bound.sql).all(...bound.args) as unknown[];
  const execute = (bound: Statement) => ({
    sql: bound.sql,
    args: bound.args,
    first: async <T,>() => (isQuery(bound.sql) ? (sqlite.prepare(bound.sql).get(...bound.args) ?? null) as T | null : null),
    all: async <T,>() => ({ success: true, results: query(bound) as T[], meta: {} }),
    run: async () => ({ success: true, results: [], meta: { changes: Number(sqlite.prepare(bound.sql).run(...bound.args).changes) } }),
  });
  const prepare = (sql: string) => {
    const base = execute({ sql, args: [] });
    return { ...base, bind: (...args: unknown[]) => execute({ sql, args }) };
  };
  return {
    DB: {
      prepare,
      // D1 runs a batch as one transaction; mirror the all-or-nothing behavior.
      batch: async <T,>(statements: Statement[]) => {
        sqlite.exec('BEGIN');
        try {
          const results = statements.map((statement) => (isQuery(statement.sql)
            ? { success: true, results: query(statement), meta: {} }
            : { success: true, results: [], meta: { changes: Number(sqlite.prepare(statement.sql).run(...statement.args).changes) } }));
          sqlite.exec('COMMIT');
          return results as T[];
        } catch (error) {
          sqlite.exec('ROLLBACK');
          throw error;
        }
      },
    },
  };
}

function openDatabase() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  for (const file of readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(resolve(migrations, file), 'utf8'));
  }
  return sqlite;
}

function schemaOf(sqlite: DatabaseSync) {
  return sqlite.prepare("SELECT name, sql FROM sqlite_master WHERE type IN ('table', 'trigger')").all() as Array<{ name: string; sql: string | null }>;
}

function seedUser(sqlite: DatabaseSync, id: string, role = 'USER') {
  sqlite.prepare(`INSERT INTO native_users (id, email, username, role, password_salt, password_hash, updated_at)
    VALUES (?1, ?2, ?1, ?3, 'salt', 'hash', '2026-01-01T00:00:00Z')`).run(id, `${id}@example.com`, role);
}

function seedOrder(sqlite: DatabaseSync, orderId: string, userId: string) {
  sqlite.prepare(`INSERT INTO native_order_snapshots (id, user_id, status, searchable_text, payload, source_updated_at, imported_at)
    VALUES (?1, ?2, 'PAID', '', '{}', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`).run(orderId, userId);
  sqlite.prepare(`INSERT INTO native_order_metadata (order_id, user_id, total_amount)
    VALUES (?1, ?2, 29)`).run(orderId, userId);
}

const T0 = '2026-01-01T00:00:00Z';
const T1 = '2026-12-31T00:00:00Z';

/** A customer with one of every kind of record, built around the order chain and the wallet. */
function seedRichCustomer(sqlite: DatabaseSync, userId: string, orderId: string, suffix: string) {
  seedUser(sqlite, userId);
  const s = (name: string) => `${name}-${suffix}`;

  // Personal state: some rows cascade, others only point at the account.
  sqlite.prepare(`INSERT INTO native_carts (id, user_id, created_at, updated_at) VALUES (?1, ?2, '${T0}', '${T0}')`).run(s('cart'), userId);
  sqlite.prepare(`INSERT INTO native_address_book (id, user_id, name, phone, line1, city, country, created_at, updated_at)
    VALUES (?1, ?2, 'Ada', '123', '1 Main St', 'Springfield', 'US', '${T0}', '${T0}')`).run(s('addr'), userId);
  sqlite.prepare(`INSERT INTO native_user_security_events (id, user_id, email, action, created_at)
    VALUES (?1, ?2, ?3, 'login.success', '${T0}')`).run(s('evt'), userId, `${userId}@example.com`);
  sqlite.prepare(`INSERT INTO native_external_identities (id, user_id, provider_slug, issuer, subject, created_at)
    VALUES (?1, ?2, 'google', 'https://accounts.google.com', ?3, '${T0}')`).run(s('idn'), userId, `sub-${suffix}`);

  // The order chain. Items and reservations, refunds and payment sessions,
  // reference each other with NO ACTION foreign keys.
  sqlite.prepare(`INSERT OR IGNORE INTO native_inventory (product_id, variant_id, source_stock, refreshed_at) VALUES ('esim-1gb', 'default', 10, '${T0}')`).run();
  seedOrder(sqlite, orderId, userId);
  sqlite.prepare(`INSERT INTO native_payment_sessions (id, order_id, user_id, provider, idempotency_key, session_url, expires_at, created_at, updated_at)
    VALUES (?1, ?2, ?3, 'stripe', ?4, 'https://pay.example/1', '${T1}', '${T0}', '${T0}')`).run(s('ps'), orderId, userId, s('ik'));
  sqlite.prepare(`INSERT INTO native_refunds (id, order_id, payment_session_id, idempotency_key, amount, currency, status, created_at)
    VALUES (?1, ?2, ?3, ?4, 5, 'USD', 'completed', '${T0}')`).run(s('rf'), orderId, s('ps'), s('irk'));
  sqlite.prepare(`INSERT INTO native_inventory_reservations (id, order_id, product_id, variant_id, quantity, created_at)
    VALUES (?1, ?2, 'esim-1gb', 'default', 1, '${T0}')`).run(s('res'), orderId);
  sqlite.prepare(`INSERT INTO native_order_items (id, order_id, reservation_id, product_id, variant_id, quantity, unit_price, payload)
    VALUES (?1, ?2, ?3, 'esim-1gb', 'default', 1, 29, '{}')`).run(s('item'), orderId, s('res'));

  // The wallet account cascades from the account; the ledger only cascades from the account row.
  sqlite.prepare(`INSERT INTO native_wallet_accounts (user_id, created_at, updated_at) VALUES (?1, '${T0}', '${T0}')`).run(userId);
  sqlite.prepare(`INSERT INTO native_wallet_ledger (id, user_id, operation, amount, type, description, created_at)
    VALUES (?1, ?2, 'credit', 10, 'grant', 'Grant', '${T0}')`).run(s('tx'), userId);

  // An affiliate partner row has no foreign key to the account, while the
  // order references the partner with NO ACTION.
  sqlite.prepare(`INSERT INTO native_affiliate_partners (id, user_id, code) VALUES (?1, ?2, ?3)`).run(s('ap'), userId, `CODE${suffix}`);
  sqlite.prepare('UPDATE native_order_metadata SET affiliate_partner_id = ?1 WHERE order_id = ?2').run(s('ap'), orderId);

  // A RESTRICT chain: the pack charge keeps the grant, the grant keeps the order.
  sqlite.prepare(`INSERT INTO remoteradar_credit_grants (id, user_id, grant_type, credits_total, credits_remaining, source_order_id, expires_at, created_at, updated_at)
    VALUES (?1, ?2, 'credit_pack', 100, 90, ?3, '${T1}', '${T0}', '${T0}')`).run(s('g'), userId, orderId);
  sqlite.prepare(`INSERT INTO remoteradar_application_pack_charges (id, user_id, idempotency_key, operation, grant_id, created_at, updated_at)
    VALUES (?1, ?2, ?3, 'create', ?4, '${T0}', '${T0}')`).run(s('pc'), userId, s('pcik'), s('g'));

  // Queues that key their rows by the order instead of the account.
  sqlite.prepare(`INSERT INTO native_checkout_outbox (id, event_type, aggregate_id, payload, created_at) VALUES (?1, 'payment.succeeded', ?2, '{}', '${T0}')`).run(s('ob1'), orderId);
  sqlite.prepare(`INSERT INTO native_checkout_outbox (id, event_type, aggregate_id, payload, created_at, delivered_at) VALUES (?1, 'order.created', ?2, '{}', '${T0}', '${T0}')`).run(s('ob2'), orderId);
  sqlite.prepare(`INSERT INTO native_email_outbox (id, dedupe_key, message_type, order_id, recipient, subject, text_body, html_body, next_attempt_at, created_at, updated_at)
    VALUES (?1, ?3, 'order_confirmation', ?2, 'buyer@example.com', 'Order', 'Body', '<p>Body</p>', '${T0}', '${T0}', '${T0}')`).run(s('mail'), orderId, s('dedupe'));

  // A bound card is detached, not deleted, when the account goes.
  sqlite.prepare(`INSERT INTO native_bokmoo_cards (id, mid, status, user_id) VALUES (?1, ?3, 'bound', ?2)`).run(s('card'), userId, `8985${suffix}`);
}

interface ColumnInfo { name: string; type: string; notnull: number; dflt_value: string | null; pk: number }

// A column that records who acted last, not who owns the row.
const ACTOR_COLUMN = /(^|_)(updated_by|created_by|deleted_by|actor_id|actor_user_id)$/;
interface ForeignKeyInfo { table: string; from: string; to: string }

// Values a required column may take: the ones its CHECK allows first, then the plain ones.
function candidateValues(schema: Array<{ name: string; sql: string | null }>, table: string, column: ColumnInfo): unknown[] {
  const allowed = schema.find((entry) => entry.name === table)?.sql?.match(new RegExp(`CHECK\\s*\\(\\s*"?${column.name}"?\\s+IN\\s*\\(([^)]*)\\)`, 'i'));
  const listed = allowed ? allowed[1]!.split(',').map((value) => value.trim().replace(/^'|'$/g, '')) : [];
  if (/^text$/i.test(column.type)) return [...listed, `value-${column.name}`, '', '0', '1', '2026-01-01T00:00:00Z'];
  if (/^integer$/i.test(column.type)) return [1, 0, 2, 100, -1];
  return [1, 0, 100, 0.5];
}

/**
 * One valid row in every table that references the account or its order, and in every table below
 * those again, so the force delete is tried against the whole schema instead of only the rows this
 * file happens to think of. Keys and foreign keys get real parents; other required columns take the
 * first value the table's constraints accept.
 *
 * `actorNamesAccount` decides whether a column that merely records who acted (updated_by and the
 * like) names the customer or the staff account.
 */
function seedEveryTable(sqlite: DatabaseSync, userId: string, staffId: string, orderId: string, actorNamesAccount: boolean) {
  // The account, a staff account for what must not belong to the customer, and the order.
  seedUser(sqlite, userId);
  seedUser(sqlite, staffId);
  seedOrder(sqlite, orderId, userId);
  const schema = schemaOf(sqlite);
  const references = analyzeCustomerSchema(schema).references;
  const columnsOf = (table: string) => sqlite.prepare(`PRAGMA table_info("${table}")`).all() as ColumnInfo[];
  const foreignKeysOf = (table: string) => sqlite.prepare(`PRAGMA foreign_key_list("${table}")`).all() as unknown as ForeignKeyInfo[];
  const primaryKeyOf = (table: string) => columnsOf(table).filter((column) => column.pk > 0).sort((a, b) => a.pk - b.pk);
  const autoIncrement = (table: string) => primaryKeyOf(table).length === 1 && /^integer$/i.test(primaryKeyOf(table)[0]!.type);
  // The key of each seeded row, so the rows below it can point at it.
  const keys = new Map<string, Record<string, unknown>>([
    ['native_users', { id: userId }],
    ['native_order_snapshots', { id: orderId }],
    ['native_order_metadata', { order_id: orderId }],
  ]);
  const parentValue = (foreignKey: ForeignKeyInfo) => {
    const key = keys.get(foreignKey.table);
    if (key && foreignKey.to in key) return key[foreignKey.to];
    return primaryKeyOf(foreignKey.table).length === 1 ? `row-${foreignKey.table}` : `row-${foreignKey.table}-${foreignKey.to}`;
  };
  const insert = (table: string) => {
    const foreignKeys = foreignKeysOf(table);
    const primaryKey = primaryKeyOf(table);
    const row: Record<string, unknown> = {};
    for (const column of columnsOf(table)) {
      const foreignKey = foreignKeys.find((key) => key.from === column.name);
      // A key that is also a foreign key (user_id PRIMARY KEY) takes the parent's value.
      if (foreignKey) {
        const isMember = table === 'native_admin_memberships' && column.name === 'user_id';
        row[column.name] = foreignKey.table === 'native_users' && (isMember || (ACTOR_COLUMN.test(column.name) && !actorNamesAccount))
          ? staffId
          : parentValue(foreignKey);
        continue;
      }
      // A column that names the account without declaring a foreign key belongs to it all the same.
      if (references.some((reference) => reference.table === table && reference.column === column.name)) {
        row[column.name] = userId;
        continue;
      }
      if (CUSTOMER_DELETE_BY_ORDER.some(([owner, keyed]) => owner === table && keyed === column.name)) {
        row[column.name] = orderId;
        continue;
      }
      if (column.pk > 0) {
        row[column.name] = autoIncrement(table) ? null : primaryKey.length === 1 ? `row-${table}` : `row-${table}-${column.name}`;
        continue;
      }
      if (column.notnull && column.dflt_value === null) row[column.name] = candidateValues(schema, table, column)[0];
    }
    const write = () => {
      const names = Object.keys(row);
      sqlite.prepare(`INSERT INTO "${table}" (${names.map((name) => `"${name}"`).join(', ')}) VALUES (${names.map(() => '?').join(', ')})`)
        .run(...names.map((name) => row[name]));
    };
    try {
      write();
    } catch {
      // A CHECK or UNIQUE constraint: try the column's other plausible values, one plain column at a time.
      const locked = new Set([
        ...primaryKey.map((column) => column.name),
        ...foreignKeys.map((key) => key.from),
        ...references.filter((reference) => reference.table === table).map((reference) => reference.column),
      ]);
      let placed = false;
      for (const column of columnsOf(table)) {
        if (locked.has(column.name) || !(column.name in row)) continue;
        for (const value of candidateValues(schema, table, column).slice(1)) {
          const previous = row[column.name];
          row[column.name] = value;
          try { write(); placed = true; break; } catch { row[column.name] = previous; }
        }
        if (placed) break;
      }
      if (!placed) throw new Error(`Cannot seed "${table}"`);
    }
    keys.set(table, Object.fromEntries(primaryKey.map((column) => [
      column.name,
      autoIncrement(table) ? (sqlite.prepare('SELECT last_insert_rowid() AS id').get() as { id: number }).id : row[column.name],
    ])));
  };
  const seeded = new Set(keys.keys());
  const visit = (table: string, trail: string[]) => {
    if (seeded.has(table) || trail.includes(table)) return;
    for (const parent of foreignKeysOf(table).map((key) => key.table)) visit(parent, [...trail, table]);
    insert(table);
    seeded.add(table);
  };
  sqlite.exec('BEGIN');
  sqlite.exec('PRAGMA defer_foreign_keys = on');
  for (const table of new Set([...references.map((reference) => reference.table), ...CUSTOMER_DELETE_BY_ORDER.map(([table]) => table)])) visit(table, []);
  // Everything below those tables: any table with a foreign key to a seeded table gets a row as well.
  for (let grew = true; grew;) {
    grew = false;
    for (const { name } of sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>) {
      if (seeded.has(name) || !foreignKeysOf(name).some((key) => seeded.has(key.table))) continue;
      visit(name, []);
      grew = true;
    }
  }
  sqlite.exec('COMMIT');
  return references;
}

/** Rows per table, to show that a refused wipe changed nothing. */
function tableCounts(sqlite: DatabaseSync) {
  return Object.fromEntries(
    (sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>)
      .map(({ name }) => [name, count(sqlite, `SELECT COUNT(*) AS n FROM "${name}"`)]),
  );
}

const count = (sqlite: DatabaseSync, sql: string, ...args: unknown[]) =>
  Number((sqlite.prepare(sql).get(...args) as { n: number }).n);

const ACTOR = { id: 'u-admin', email: 'admin@example.com', username: 'admin', role: 'ADMIN' };

async function deleteUser(sqlite: DatabaseSync, userId: string, options: { force?: boolean } = {}) {
  const query = options.force ? '?force=true' : '';
  const response = await tryNativeAdminUsers(
    new Request(`https://api.example/api/v1/admin/users/${userId}${query}`, { method: 'DELETE' }),
    d1(sqlite),
  );
  const body = (await response?.json()) as {
    success: boolean;
    data?: { deleted?: boolean; force?: boolean; removed?: Row[]; detached?: Row[] };
    error?: { code: string; details?: { blockers?: Row[] } };
  };
  return { status: response?.status ?? 0, body };
}

/** Rows still pointing at the account anywhere in the schema, audit and diagnostic logs aside. */
function danglingReferences(sqlite: DatabaseSync, userId: string) {
  const schema = analyzeCustomerSchema(schemaOf(sqlite));
  const kept = new Set(CUSTOMER_DELETE_KEEPS.map(([table, column]) => `${table}:${column}`));
  return schema.references
    .filter((reference) => !kept.has(`${reference.table}:${reference.column}`))
    .map((reference) => ({ ...reference, rows: count(sqlite, `SELECT COUNT(*) AS n FROM "${reference.table}" WHERE "${reference.column}" = ?`, userId) }))
    .filter((reference) => reference.rows > 0)
    .map((reference) => `${reference.table}:${reference.column}`);
}

beforeEach(() => {
  authenticateNativeAdmin.mockReset();
  authenticateNativeAdmin.mockResolvedValue(ACTOR);
});

describe('customer delete — reading the schema', () => {
  const sqlite = openDatabase();
  const schema = schemaOf(sqlite);
  const analysis = analyzeCustomerSchema(schema);
  const has = (table: string, column: string) => analysis.references.some((r) => r.table === table && r.column === column);

  it('finds references whether or not the column declares a foreign key', () => {
    expect(has('native_order_metadata', 'user_id')).toBe(true);
    // No FK to the account at all: a bare DELETE would orphan these rows.
    expect(has('native_wallet_ledger', 'user_id')).toBe(true);
    expect(has('native_plugin_payments', 'user_id')).toBe(true);
    // ON DELETE SET NULL: a bare DELETE would silently unbind the card.
    expect(has('native_bokmoo_cards', 'user_id')).toBe(true);
    expect(has('native_admin_api_tokens', 'admin_user_id')).toBe(true);
    expect(has('native_affiliate_org_commissions', 'beneficiary_user_id')).toBe(true);
    // A foreign key on a column that is not named like an account reference.
    expect(has('remoteradar_job_targets', 'updated_by')).toBe(true);
    expect(analysis.references.some((reference) => reference.table === 'native_users')).toBe(false);
  });

  it('parses every foreign key exactly as SQLite reports it', () => {
    // The force delete orders its statements by these rules; a misparsed one
    // would only show up as a failed wipe in production.
    let total = 0;
    for (const { name, sql } of schema) {
      const key = (fk: { table: string; column: string; parentTable: string; parentColumn: string; onDelete: string }) =>
        `${fk.table}|${fk.column}|${fk.parentTable}|${fk.parentColumn}|${fk.onDelete || 'NO ACTION'}`;
      const parsed = parseForeignKeys(name, sql).map(key).sort();
      const truth = (sqlite.prepare(`PRAGMA foreign_key_list("${name}")`).all() as Array<Record<string, string>>)
        .map((fk) => key({ table: name, column: fk.from!, parentTable: fk.table!, parentColumn: fk.to!, onDelete: fk.on_delete }))
        .sort();
      expect(parsed, name).toEqual(truth);
      total += parsed.length;
    }
    expect(total).toBeGreaterThanOrEqual(100);
  });

  it('yields a trustworthy schema and a force plan for the whole migration line', () => {
    expect(isCustomerSchemaTrustworthy(analysis)).toBe(true);
    // Throws when a RESTRICT child could not be ordered.
    expect(() => buildCustomerForceDeletePlan(analysis)).not.toThrow();
  });

  it('only classifies references that exist in the migration line', () => {
    const known = new Set(analysis.references.map((reference) => `${reference.table}:${reference.column}`));
    for (const [table, column] of CUSTOMER_DELETE_KEEPS) {
      expect(known, `${table}:${column} is kept but missing from the schema`).toContain(`${table}:${column}`);
    }
    for (const [table] of CUSTOMER_DELETE_BY_ORDER) {
      expect(analysis.tables, `${table} is wiped by order but missing from the schema`).toContain(table);
    }
  });

  it('starts the force wipe by deferring checks and closes on the account', () => {
    const plan = buildCustomerForceDeletePlan(analysis);
    expect(plan.statements[0]).toBe('PRAGMA defer_foreign_keys = on');
    expect(plan.statements[plan.accountDelete]).toMatch(/^DELETE FROM native_users/);
    // Only the sweep of what triggers added may run once the account is gone.
    for (const statement of plan.statements.slice(plan.accountDelete + 1)) {
      expect(statement).toMatch(/^DELETE FROM "remoteradar_audit_events" WHERE "user_id" = \?1 AND NOT EXISTS \(SELECT 1 FROM native_users WHERE id = \?1\)$/);
    }
    // Every other statement waits on the account still being deletable.
    for (const statement of plan.statements.slice(1, plan.accountDelete)) {
      expect(statement).toContain('AND EXISTS (SELECT 1 FROM native_users WHERE native_users.id = ?1');
    }
    // RESTRICT children go before the rows they keep in place.
    const charge = plan.statements.findIndex((sql) => sql.startsWith('DELETE FROM "remoteradar_application_pack_charges"'));
    const grant = plan.statements.findIndex((sql) => sql.startsWith('DELETE FROM "remoteradar_credit_grants"'));
    expect(charge).toBeGreaterThan(-1);
    expect(grant).toBeGreaterThan(charge);
    expect(plan.statements.some((sql) => sql.startsWith('DELETE FROM "native_checkout_outbox" WHERE "aggregate_id" IN'))).toBe(true);
  });

  it('does not trust a schema it cannot read', () => {
    const blind = analyzeCustomerSchema([{ name: 'native_users', sql: null }]);
    expect(isCustomerSchemaTrustworthy(blind)).toBe(false);
  });
});

describe('DELETE /api/v1/admin/users/:id (native)', () => {
  it('deletes a bare customer, erases personal state, and records who did it', async () => {
    const sqlite = openDatabase();
    seedUser(sqlite, 'u-admin', 'ADMIN');
    seedUser(sqlite, 'u-customer');
    seedUser(sqlite, 'u-bystander');
    sqlite.prepare(`INSERT INTO native_carts (id, user_id, created_at, updated_at) VALUES ('cart-1', 'u-customer', '${T0}', '${T0}')`).run();
    sqlite.prepare(`INSERT INTO native_address_book (id, user_id, name, phone, line1, city, country, created_at, updated_at)
      VALUES ('addr-1', 'u-customer', 'Ada', '123', '1 Main St', 'Springfield', 'US', '${T0}', '${T0}')`).run();
    sqlite.prepare(`INSERT INTO native_carts (id, user_id, created_at, updated_at) VALUES ('cart-2', 'u-bystander', '${T0}', '${T0}')`).run();

    const { status, body } = await deleteUser(sqlite, 'u-customer');

    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, data: { userId: 'u-customer', deleted: true } });
    expect(count(sqlite, 'SELECT COUNT(*) AS n FROM native_users')).toBe(2);
    expect(count(sqlite, "SELECT COUNT(*) AS n FROM native_carts WHERE user_id = 'u-customer'")).toBe(0);
    expect(count(sqlite, "SELECT COUNT(*) AS n FROM native_address_book WHERE user_id = 'u-customer'")).toBe(0);
    // Nobody else's state is touched.
    expect(count(sqlite, "SELECT COUNT(*) AS n FROM native_carts WHERE user_id = 'u-bystander'")).toBe(1);
    const audit = sqlite.prepare('SELECT action, actor_user_id, staff_email FROM native_admin_staff_audit_logs').all() as AuditRow[];
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: 'customer.delete', actor_user_id: 'u-admin', staff_email: 'u-customer@example.com' });
  });

  it('refuses a customer who has orders and leaves everything in place', async () => {
    const sqlite = openDatabase();
    seedUser(sqlite, 'u-admin', 'ADMIN');
    seedUser(sqlite, 'u-buyer');
    seedOrder(sqlite, 'order-1', 'u-buyer');
    sqlite.prepare(`INSERT INTO native_carts (id, user_id, created_at, updated_at) VALUES ('cart-1', 'u-buyer', '${T0}', '${T0}')`).run();

    const { status, body } = await deleteUser(sqlite, 'u-buyer');

    expect(status).toBe(409);
    expect(body.error?.code).toBe('CUSTOMER_HAS_DATA');
    expect(body.error?.details?.blockers).toEqual(expect.arrayContaining([
      { table: 'native_order_metadata', column: 'user_id', count: 1 },
      { table: 'native_order_snapshots', column: 'user_id', count: 1 },
    ]));
    expect(count(sqlite, "SELECT COUNT(*) AS n FROM native_users WHERE id = 'u-buyer'")).toBe(1);
    expect(count(sqlite, "SELECT COUNT(*) AS n FROM native_order_snapshots WHERE id = 'order-1'")).toBe(1);
    // A refused delete must not erase personal state either.
    expect(count(sqlite, "SELECT COUNT(*) AS n FROM native_carts WHERE user_id = 'u-buyer'")).toBe(1);
    expect(count(sqlite, 'SELECT COUNT(*) AS n FROM native_admin_staff_audit_logs')).toBe(0);
  });

  it('refuses a customer whose only business record has no foreign key to users', async () => {
    const sqlite = openDatabase();
    seedUser(sqlite, 'u-admin', 'ADMIN');
    seedUser(sqlite, 'u-ledger');
    // The wallet account cascades, but the ledger rows pointing at it have no FK to
    // native_users: a bare DELETE would leave them orphaned.
    sqlite.prepare(`INSERT INTO native_wallet_accounts (user_id, created_at, updated_at) VALUES ('u-ledger', '${T0}', '${T0}')`).run();
    sqlite.prepare(`INSERT INTO native_wallet_ledger (id, user_id, operation, amount, type, description, created_at)
      VALUES ('tx-1', 'u-ledger', 'credit', 10, 'grant', 'Grant', '${T0}')`).run();

    const { status, body } = await deleteUser(sqlite, 'u-ledger');

    expect(status).toBe(409);
    expect(body.error?.details?.blockers).toEqual(expect.arrayContaining([
      { table: 'native_wallet_accounts', column: 'user_id', count: 1 },
      { table: 'native_wallet_ledger', column: 'user_id', count: 1 },
    ]));
  });

  it('refuses an account that a foreign key on a non-account column points at', async () => {
    const sqlite = openDatabase();
    seedUser(sqlite, 'u-admin', 'ADMIN');
    seedUser(sqlite, 'u-target');
    sqlite.prepare(`INSERT INTO remoteradar_job_targets (job_key, target_url, updated_by, updated_at)
      VALUES ('job-1', 'https://jobs.example/1', 'u-target', '${T0}')`).run();

    const guarded = await deleteUser(sqlite, 'u-target');
    expect(guarded.status).toBe(409);
    expect(guarded.body.error?.details?.blockers).toEqual([{ table: 'remoteradar_job_targets', column: 'updated_by', count: 1 }]);

    // The column cannot be emptied, so the wipe cannot complete; it rolls back whole.
    const forced = await deleteUser(sqlite, 'u-target', { force: true });
    expect(forced.status).toBe(409);
    expect(forced.body.error?.code).toBe('CUSTOMER_DELETE_REFERENCED');
    expect(count(sqlite, "SELECT COUNT(*) AS n FROM native_users WHERE id = 'u-target'")).toBe(1);
    expect(count(sqlite, "SELECT COUNT(*) AS n FROM remoteradar_job_targets WHERE updated_by = 'u-target'")).toBe(1);
  });

  it('never deletes staff, other admins, or the calling admin, with or without force', async () => {
    const sqlite = openDatabase();
    seedUser(sqlite, 'u-admin', 'ADMIN');
    seedUser(sqlite, 'u-owner', 'ADMIN');
    // Staff accounts are role USER plus a membership row.
    seedUser(sqlite, 'u-staff');
    sqlite.prepare(`INSERT INTO native_admin_memberships (id, user_id, role, created_at, updated_at)
      VALUES ('m-1', 'u-staff', 'SUPPORT_AGENT', '${T0}', '${T0}')`).run();

    for (const force of [false, true]) {
      for (const userId of ['u-staff', 'u-owner', 'u-admin']) {
        const { status, body } = await deleteUser(sqlite, userId, { force });
        expect(status, `${userId} force=${force}`).toBe(403);
        expect(body.error?.code, `${userId} force=${force}`).toBe('CUSTOMER_DELETE_NOT_ALLOWED');
      }
    }
    expect(count(sqlite, 'SELECT COUNT(*) AS n FROM native_users')).toBe(3);
    expect(count(sqlite, 'SELECT COUNT(*) AS n FROM native_admin_staff_audit_logs')).toBe(0);
  });

  it('answers 404 for an unknown account and 401 without an admin session', async () => {
    const sqlite = openDatabase();
    seedUser(sqlite, 'u-admin', 'ADMIN');

    expect((await deleteUser(sqlite, 'u-missing')).status).toBe(404);

    authenticateNativeAdmin.mockResolvedValue(null);
    seedUser(sqlite, 'u-customer');
    expect((await deleteUser(sqlite, 'u-customer', { force: true })).status).toBe(401);
    expect(count(sqlite, 'SELECT COUNT(*) AS n FROM native_users')).toBe(2);
  });

  it('refuses to delete when the schema cannot be checked, with or without force', async () => {
    // An instance whose table definitions cannot be read yields no references at all.
    // That must stop the delete, never turn it into an unguarded one.
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = ON;');
    sqlite.exec('CREATE TABLE native_users (id TEXT PRIMARY KEY, email TEXT NOT NULL, username TEXT NOT NULL, role TEXT NOT NULL)');
    sqlite.exec('CREATE TABLE native_admin_memberships (id TEXT PRIMARY KEY, user_id TEXT NOT NULL)');
    const seedBare = (id: string, role = 'USER') =>
      sqlite.prepare('INSERT INTO native_users (id, email, username, role) VALUES (?1, ?2, ?1, ?3)').run(id, `${id}@example.com`, role);
    seedBare('u-admin', 'ADMIN');
    seedBare('u-customer');

    for (const force of [false, true]) {
      const { status, body } = await deleteUser(sqlite, 'u-customer', { force });
      expect(status, `force=${force}`).toBe(500);
      expect(body.error?.code, `force=${force}`).toBe('CUSTOMER_DELETE_GUARD_UNAVAILABLE');
    }
    expect(count(sqlite, 'SELECT COUNT(*) AS n FROM native_users')).toBe(2);
  });
});

describe('DELETE /api/v1/admin/users/:id?force=true (native)', () => {
  it('removes the account with everything it owns and leaves nobody else touched', async () => {
    const sqlite = openDatabase();
    seedUser(sqlite, 'u-admin', 'ADMIN');
    seedRichCustomer(sqlite, 'u-rich', 'o-rich', 'r');
    seedRichCustomer(sqlite, 'u-other', 'o-other', 'o');
    const before = danglingReferences(sqlite, 'u-other');
    expect(before.length).toBeGreaterThan(5);

    // The guarded delete still refuses the same account.
    const guarded = await deleteUser(sqlite, 'u-rich');
    expect(guarded.status).toBe(409);

    const { status, body } = await deleteUser(sqlite, 'u-rich', { force: true });

    expect(status).toBe(200);
    expect(body.data).toMatchObject({ deleted: true, force: true });
    const removed = new Map(body.data?.removed?.map((row) => [row.table, row.count]));
    expect(removed.get('native_order_metadata')).toBe(1);
    expect(removed.get('native_payment_sessions')).toBe(1);
    expect(removed.get('native_wallet_ledger')).toBe(1);
    expect(removed.get('remoteradar_credit_grants')).toBe(1);
    expect(removed.get('native_checkout_outbox')).toBe(2);
    // A row the wipe only unlinks is reported apart from what it removed.
    expect(removed.has('native_bokmoo_cards')).toBe(false);
    expect(body.data?.detached).toEqual([{ table: 'native_bokmoo_cards', count: 1 }]);

    expect(count(sqlite, "SELECT COUNT(*) AS n FROM native_users WHERE id = 'u-rich'")).toBe(0);
    expect(danglingReferences(sqlite, 'u-rich')).toEqual([]);
    // The order chain, the queues keyed by the order, and the RESTRICT chain are all gone.
    for (const [table, column, value] of [
      ['native_order_snapshots', 'id', 'o-rich'],
      ['native_payment_sessions', 'order_id', 'o-rich'],
      ['native_refunds', 'order_id', 'o-rich'],
      ['native_order_items', 'order_id', 'o-rich'],
      ['native_inventory_reservations', 'order_id', 'o-rich'],
      ['native_checkout_outbox', 'aggregate_id', 'o-rich'],
      ['native_email_outbox', 'order_id', 'o-rich'],
      ['remoteradar_application_pack_charges', 'user_id', 'u-rich'],
      ['native_affiliate_partners', 'user_id', 'u-rich'],
    ] as const) {
      expect(count(sqlite, `SELECT COUNT(*) AS n FROM ${table} WHERE ${column} = ?`, value), `${table}.${column}`).toBe(0);
    }
    // A bound card is detached, not deleted; shared inventory stays.
    const card = sqlite.prepare("SELECT user_id FROM native_bokmoo_cards WHERE mid = '8985r'").get() as { user_id: string | null };
    expect(card.user_id).toBeNull();
    expect(count(sqlite, "SELECT COUNT(*) AS n FROM native_inventory WHERE product_id = 'esim-1gb'")).toBe(1);

    // The other customer is exactly as they were.
    expect(count(sqlite, "SELECT COUNT(*) AS n FROM native_users WHERE id = 'u-other'")).toBe(1);
    expect(count(sqlite, "SELECT COUNT(*) AS n FROM native_order_metadata WHERE order_id = 'o-other'")).toBe(1);
    expect(danglingReferences(sqlite, 'u-other')).toEqual(before);

    // The wipe is audited with what it removed and what it only unlinked.
    const audit = sqlite.prepare('SELECT action, actor_user_id, staff_email, metadata FROM native_admin_staff_audit_logs').all() as AuditRow[];
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: 'customer.force_delete', actor_user_id: 'u-admin', staff_email: 'u-rich@example.com' });
    expect(JSON.parse(audit[0]!.metadata ?? '{}')).toMatchObject({
      force: true,
      removed: expect.arrayContaining([{ table: 'native_order_metadata', count: 1 }]),
      detached: [{ table: 'native_bokmoo_cards', count: 1 }],
    });
  });

  it('removes a bare account just like the guarded delete', async () => {
    const sqlite = openDatabase();
    seedUser(sqlite, 'u-admin', 'ADMIN');
    seedUser(sqlite, 'u-customer');
    sqlite.prepare(`INSERT INTO native_carts (id, user_id, created_at, updated_at) VALUES ('cart-1', 'u-customer', '${T0}', '${T0}')`).run();

    const { status, body } = await deleteUser(sqlite, 'u-customer', { force: true });

    expect(status).toBe(200);
    expect(body.data).toMatchObject({ deleted: true, force: true });
    expect(count(sqlite, "SELECT COUNT(*) AS n FROM native_users WHERE id = 'u-customer'")).toBe(0);
    expect(count(sqlite, "SELECT COUNT(*) AS n FROM native_carts WHERE user_id = 'u-customer'")).toBe(0);
  });

  it('clears a row from every table the schema hangs on an account, or on its order', async () => {
    const sqlite = openDatabase();
    seedUser(sqlite, 'u-admin', 'ADMIN');
    const references = seedEveryTable(sqlite, 'u-wide', 'u-staff', 'o-wide', false);

    // The fixture reached every table it was after.
    const kept = new Set(CUSTOMER_DELETE_KEEPS.map(([table, column]) => `${table}:${column}`));
    for (const { table, column } of references) {
      // The staff row and the audit-like columns are the customer's only by name of the staff account here.
      if (kept.has(`${table}:${column}`) || table === 'native_admin_memberships' || ACTOR_COLUMN.test(column)) continue;
      expect(count(sqlite, `SELECT COUNT(*) AS n FROM "${table}" WHERE "${column}" = ?`, 'u-wide'), `${table}.${column}`).toBeGreaterThan(0);
    }
    for (const [table, column] of CUSTOMER_DELETE_BY_ORDER) {
      expect(count(sqlite, `SELECT COUNT(*) AS n FROM "${table}" WHERE "${column}" = ?`, 'o-wide'), table).toBeGreaterThan(0);
    }
    expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);

    expect((await deleteUser(sqlite, 'u-wide')).status).toBe(409);
    const { status, body } = await deleteUser(sqlite, 'u-wide', { force: true });

    expect(status).toBe(200);
    expect(body.data?.deleted).toBe(true);
    expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    expect(danglingReferences(sqlite, 'u-wide')).toEqual([]);
    for (const [table, column] of CUSTOMER_DELETE_BY_ORDER) {
      expect(count(sqlite, `SELECT COUNT(*) AS n FROM "${table}" WHERE "${column}" = ?`, 'o-wide'), table).toBe(0);
    }
    // What is not the customer's survives: the staff account, the membership whose audit columns
    // name the customer, and a card that only lost its link.
    expect(count(sqlite, "SELECT COUNT(*) AS n FROM native_users WHERE id = 'u-staff'")).toBe(1);
    expect(count(sqlite, "SELECT COUNT(*) AS n FROM native_admin_memberships WHERE created_by_user_id = 'u-wide'")).toBe(1);
    expect(count(sqlite, 'SELECT COUNT(*) AS n FROM native_bokmoo_cards WHERE user_id IS NULL')).toBe(1);
  });

  it('sweeps the rows a trigger adds while the account goes', async () => {
    const sqlite = openDatabase();
    seedUser(sqlite, 'u-admin', 'ADMIN');
    seedUser(sqlite, 'u-cv');
    // Deleting a resume records an audit event that names the account.
    sqlite.prepare(`INSERT INTO native_rr_resumes (id, user_id, name, created_at, updated_at) VALUES ('cv-1', 'u-cv', 'CV', ?, ?)`).run(T0, T0);

    const { status } = await deleteUser(sqlite, 'u-cv', { force: true });

    expect(status).toBe(200);
    expect(count(sqlite, "SELECT COUNT(*) AS n FROM native_rr_resumes WHERE user_id = 'u-cv'")).toBe(0);
    expect(count(sqlite, "SELECT COUNT(*) AS n FROM remoteradar_audit_events WHERE user_id = 'u-cv'")).toBe(0);
    expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });

  it('changes nothing when a record that cannot be unlinked still names the account', () => {
    const sqlite = openDatabase();
    seedEveryTable(sqlite, 'u-wide', 'u-staff', 'o-wide', true);
    const before = tableCounts(sqlite);

    const { statements } = buildCustomerForceDeletePlan(analyzeCustomerSchema(schemaOf(sqlite)));
    sqlite.exec('BEGIN');
    sqlite.exec('PRAGMA defer_foreign_keys = on');
    for (const statement of statements) sqlite.prepare(statement).run(...(statement.includes('?1') ? ['u-wide'] : []));
    expect(() => sqlite.exec('COMMIT')).toThrow(/FOREIGN KEY constraint failed/);
    sqlite.exec('ROLLBACK');

    expect(tableCounts(sqlite)).toEqual(before);
  });
});
