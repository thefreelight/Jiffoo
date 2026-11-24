import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The auth chain pulls in worker-only sockets; the deletion guard under test
// needs only the authenticated admin identity and env.DB.
const authenticateNativeAdmin = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeAdmin }));

const { tryNativeAdminUsers } = await import('./admin-users');
const { CUSTOMER_DELETE_ERASES, CUSTOMER_DELETE_KEEPS, discoverUserReferences } = await import('./customer-delete');

const migrations = resolve(import.meta.dirname, '../migrations');

interface Statement { sql: string; args: unknown[] }
interface Row { table?: string; column?: string; count?: number; action?: string; actor_user_id?: string; staff_email?: string; email?: string }

const isQuery = (sql: string) => /^\s*(SELECT|PRAGMA|WITH)\b/i.test(sql);

// Minimal faithful D1 surface over node:sqlite so the guarded DELETE runs with
// real foreign keys and the real migration schema.
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

/** Personal state that is expected to go away with the account. */
function seedPersonalState(sqlite: DatabaseSync, userId: string) {
  const suffix = userId.replace(/[^a-z0-9]/gi, '');
  sqlite.prepare(`INSERT INTO native_carts (id, user_id, created_at, updated_at) VALUES (?1, ?2, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`).run(`cart-${suffix}`, userId);
  sqlite.prepare(`INSERT INTO native_address_book (id, user_id, name, phone, line1, city, country, created_at, updated_at)
    VALUES (?1, ?2, 'Ada', '123', '1 Main St', 'Springfield', 'US', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`).run(`addr-${suffix}`, userId);
  sqlite.prepare(`INSERT INTO native_bokmoo_notifications (id, user_id, title, body, created_at)
    VALUES (?1, ?2, 'Welcome', 'Hello', '2026-01-01T00:00:00Z')`).run(`note-${suffix}`, userId);
  sqlite.prepare(`INSERT INTO native_user_security_events (id, user_id, email, action, created_at)
    VALUES (?1, ?2, ?3, 'login.success', '2026-01-01T00:00:00Z')`).run(`evt-${suffix}`, userId, `${userId}@example.com`);
  sqlite.prepare(`INSERT INTO native_external_identities (id, user_id, provider_slug, issuer, subject, created_at)
    VALUES (?1, ?2, 'google', 'https://accounts.google.com', ?3, '2026-01-01T00:00:00Z')`).run(`idn-${suffix}`, userId, `sub-${suffix}`);
}

const count = (sqlite: DatabaseSync, sql: string, ...args: unknown[]) =>
  Number((sqlite.prepare(sql).get(...args) as { n: number }).n);

const ACTOR = { id: 'u-admin', email: 'admin@example.com', username: 'admin', role: 'ADMIN' };
const deleteRequest = (userId: string) =>
  new Request(`https://api.example/api/v1/admin/users/${userId}`, { method: 'DELETE' });

async function deleteUser(sqlite: DatabaseSync, userId: string) {
  const response = await tryNativeAdminUsers(deleteRequest(userId), d1(sqlite));
  return { status: response?.status ?? 0, body: (await response?.json()) as { success: boolean; data?: Record<string, unknown>; error?: { code: string; details?: { blockers?: Row[] } } } };
}

beforeEach(() => {
  authenticateNativeAdmin.mockReset();
  authenticateNativeAdmin.mockResolvedValue(ACTOR);
});

describe('customer delete guard — schema discovery', () => {
  const sqlite = openDatabase();
  const schema = sqlite.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string; sql: string | null }>;
  const references = discoverUserReferences(schema);
  const key = (table: string, column: string) => references.some(([t, c]) => t === table && c === column);

  it('finds references whether or not the column declares a foreign key', () => {
    expect(key('native_order_metadata', 'user_id')).toBe(true);
    // No FK at all: a bare DELETE would orphan these rows.
    expect(key('native_wallet_ledger', 'user_id')).toBe(true);
    expect(key('native_plugin_payments', 'user_id')).toBe(true);
    // ON DELETE SET NULL: a bare DELETE would silently unbind the card.
    expect(key('native_bokmoo_cards', 'user_id')).toBe(true);
    // Prefixed and non-"user" names.
    expect(key('native_admin_api_tokens', 'admin_user_id')).toBe(true);
    expect(key('native_affiliate_org_commissions', 'beneficiary_user_id')).toBe(true);
    expect(references.some(([table]) => table === 'native_users')).toBe(false);
  });

  it('keeps every foreign key to native_users inside the discovered set', () => {
    // A column named unlike `*user_id` would escape the discovery regex and cascade unnoticed.
    const foreignKeyColumns = new Set<string>();
    for (const file of readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort()) {
      for (const match of readFileSync(resolve(migrations, file), 'utf8').matchAll(/\((\w+)\)\s+REFERENCES\s+native_users\s*\(/gi)) {
        foreignKeyColumns.add(match[1]!);
      }
    }
    expect(foreignKeyColumns.size).toBeGreaterThan(0);
    for (const column of foreignKeyColumns) {
      expect(column, `FK column ${column} must be discoverable`).toMatch(/user_id$/i);
    }
  });

  it('only classifies references that exist in the migration line', () => {
    const known = new Set(references.map(([table, column]) => `${table}:${column}`));
    for (const [table, column] of [...CUSTOMER_DELETE_ERASES, ...CUSTOMER_DELETE_KEEPS]) {
      expect(known, `${table}:${column} is classified but missing from the schema`).toContain(`${table}:${column}`);
    }
  });
});

describe('DELETE /api/v1/admin/users/:id (native)', () => {
  it('deletes a bare customer, erases personal state, and records who did it', async () => {
    const sqlite = openDatabase();
    seedUser(sqlite, 'u-admin', 'ADMIN');
    seedUser(sqlite, 'u-customer');
    seedUser(sqlite, 'u-bystander');
    seedPersonalState(sqlite, 'u-customer');
    seedPersonalState(sqlite, 'u-bystander');

    const { status, body } = await deleteUser(sqlite, 'u-customer');

    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, data: { userId: 'u-customer', deleted: true } });
    expect(count(sqlite, 'SELECT COUNT(*) AS n FROM native_users')).toBe(2);
    for (const table of ['native_carts', 'native_address_book', 'native_bokmoo_notifications', 'native_user_security_events', 'native_external_identities']) {
      expect(count(sqlite, `SELECT COUNT(*) AS n FROM ${table} WHERE user_id = 'u-customer'`), table).toBe(0);
      // Nobody else's state is touched.
      expect(count(sqlite, `SELECT COUNT(*) AS n FROM ${table} WHERE user_id = 'u-bystander'`), table).toBe(1);
    }
    const audit = sqlite.prepare('SELECT action, actor_user_id, staff_email, metadata FROM native_admin_staff_audit_logs').all() as Array<Record<string, string>>;
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: 'customer.delete', actor_user_id: 'u-admin', staff_email: 'u-customer@example.com' });
  });

  it('refuses a customer who has orders and leaves everything in place', async () => {
    const sqlite = openDatabase();
    seedUser(sqlite, 'u-admin', 'ADMIN');
    seedUser(sqlite, 'u-buyer');
    seedOrder(sqlite, 'order-1', 'u-buyer');
    seedPersonalState(sqlite, 'u-buyer');

    const { status, body } = await deleteUser(sqlite, 'u-buyer');

    expect(status).toBe(409);
    expect(body.error?.code).toBe('CUSTOMER_HAS_DATA');
    expect(body.error?.details?.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'native_order_metadata', column: 'user_id', count: 1 }),
      expect.objectContaining({ table: 'native_order_snapshots', column: 'user_id', count: 1 }),
    ]));
    expect(count(sqlite, "SELECT COUNT(*) AS n FROM native_users WHERE id = 'u-buyer'")).toBe(1);
    expect(count(sqlite, "SELECT COUNT(*) AS n FROM native_order_snapshots WHERE id = 'order-1'")).toBe(1);
    // A refused delete must not erase personal state either.
    expect(count(sqlite, "SELECT COUNT(*) AS n FROM native_address_book WHERE user_id = 'u-buyer'")).toBe(1);
    expect(count(sqlite, 'SELECT COUNT(*) AS n FROM native_admin_staff_audit_logs')).toBe(0);
  });

  it('refuses a customer whose only business record has no foreign key to users', async () => {
    const sqlite = openDatabase();
    seedUser(sqlite, 'u-admin', 'ADMIN');
    seedUser(sqlite, 'u-ledger');
    // The wallet account cascades, but the ledger rows pointing at it have no FK to
    // native_users: a bare DELETE would leave them orphaned.
    sqlite.prepare(`INSERT INTO native_wallet_accounts (user_id, created_at, updated_at)
      VALUES ('u-ledger', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`).run();
    sqlite.prepare(`INSERT INTO native_wallet_ledger (id, user_id, operation, amount, type, description, created_at)
      VALUES ('tx-1', 'u-ledger', 'credit', 10, 'grant', 'Grant', '2026-01-01T00:00:00Z')`).run();

    const { status, body } = await deleteUser(sqlite, 'u-ledger');

    expect(status).toBe(409);
    expect(body.error?.details?.blockers).toEqual(expect.arrayContaining([
      { table: 'native_wallet_accounts', column: 'user_id', count: 1 },
      { table: 'native_wallet_ledger', column: 'user_id', count: 1 },
    ]));
  });

  it('never deletes staff, other admins, or the calling admin', async () => {
    const sqlite = openDatabase();
    seedUser(sqlite, 'u-admin', 'ADMIN');
    seedUser(sqlite, 'u-owner', 'ADMIN');
    // Staff accounts are role USER plus a membership row.
    seedUser(sqlite, 'u-staff');
    sqlite.prepare(`INSERT INTO native_admin_memberships (id, user_id, role, created_at, updated_at)
      VALUES ('m-1', 'u-staff', 'SUPPORT_AGENT', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`).run();

    for (const userId of ['u-staff', 'u-owner', 'u-admin']) {
      const { status, body } = await deleteUser(sqlite, userId);
      expect(status, userId).toBe(403);
      expect(body.error?.code, userId).toBe('CUSTOMER_DELETE_NOT_ALLOWED');
      expect(count(sqlite, 'SELECT COUNT(*) AS n FROM native_users'), userId).toBe(3);
    }
    expect(count(sqlite, 'SELECT COUNT(*) AS n FROM native_admin_staff_audit_logs')).toBe(0);
  });

  it('answers 404 for an unknown account and 401 without an admin session', async () => {
    const sqlite = openDatabase();
    seedUser(sqlite, 'u-admin', 'ADMIN');

    expect((await deleteUser(sqlite, 'u-missing')).status).toBe(404);

    authenticateNativeAdmin.mockResolvedValue(null);
    seedUser(sqlite, 'u-customer');
    expect((await deleteUser(sqlite, 'u-customer')).status).toBe(401);
    expect(count(sqlite, 'SELECT COUNT(*) AS n FROM native_users')).toBe(2);
  });

  it('refuses to delete when the schema cannot be checked', async () => {
    // An instance whose table definitions cannot be read yields no blockers at all.
    // That must stop the delete, not turn it into an unguarded one.
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = ON;');
    sqlite.exec('CREATE TABLE native_users (id TEXT PRIMARY KEY, email TEXT NOT NULL, username TEXT NOT NULL, role TEXT NOT NULL)');
    sqlite.exec('CREATE TABLE native_admin_memberships (id TEXT PRIMARY KEY, user_id TEXT NOT NULL)');
    const seedBare = (id: string, role = 'USER') =>
      sqlite.prepare('INSERT INTO native_users (id, email, username, role) VALUES (?1, ?2, ?1, ?3)').run(id, `${id}@example.com`, role);
    seedBare('u-admin', 'ADMIN');
    seedBare('u-customer');

    const { status, body } = await deleteUser(sqlite, 'u-customer');

    expect(status).toBe(500);
    expect(body.error?.code).toBe('CUSTOMER_DELETE_GUARD_UNAVAILABLE');
    expect(count(sqlite, 'SELECT COUNT(*) AS n FROM native_users')).toBe(2);
  });
});
