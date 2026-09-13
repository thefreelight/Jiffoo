import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it, vi } from 'vitest';

// The worker-only cloudflare:sockets import lives in the auth/plugin-settings
// chain; the wallet primitives under test use only env.DB.
vi.mock('./auth', () => ({ authenticateNativeUser: vi.fn() }));
vi.mock('./plugin-settings', () => ({ getNativeStripeSecret: vi.fn() }));

const { nativeWalletMutate, nativeWalletReserve, nativeWalletFinish } = await import('./native-wallet');

const migrations = resolve(import.meta.dirname, '../migrations');
function join(name: string) { return resolve(migrations, name); }

// The wallet triggers were part of the original 0025 design before the
// d1-compat rewrite moved mutations into native-wallet.ts. Databases created
// while the triggered version shipped kept them, causing code + trigger
// double-application. 2026-09-13 RemoteRadar production measured it: one
// 1,500-credit grant wrote total_credited = 3,000, and pack settlement threw
// PACK_METERING_FAILED. Reproduce the drifted schema without depending on git
// history.
const LEGACY_WALLET_TRIGGERS = `
CREATE TRIGGER native_wallet_ledger_validate
BEFORE INSERT ON native_wallet_ledger
WHEN NEW.operation IN ('credit', 'debit')
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM native_wallet_accounts WHERE user_id = NEW.user_id)
      THEN RAISE(ABORT, 'WALLET_ACCOUNT_NOT_FOUND')
    WHEN NEW.operation = 'debit' AND NOT EXISTS (
      SELECT 1 FROM native_wallet_accounts
      WHERE user_id = NEW.user_id AND balance - reserved_balance >= NEW.amount
    ) THEN RAISE(ABORT, 'INSUFFICIENT_BALANCE')
  END;
END;
CREATE TRIGGER native_wallet_ledger_apply
AFTER INSERT ON native_wallet_ledger
WHEN NEW.operation IN ('credit', 'debit')
BEGIN
  UPDATE native_wallet_accounts SET
    balance = balance + CASE WHEN NEW.operation = 'credit' THEN NEW.amount ELSE -NEW.amount END,
    total_credited = total_credited + CASE WHEN NEW.operation = 'credit' THEN NEW.amount ELSE 0 END,
    total_debited = total_debited + CASE WHEN NEW.operation = 'debit' THEN NEW.amount ELSE 0 END,
    updated_at = NEW.created_at
  WHERE user_id = NEW.user_id;
  UPDATE native_wallet_ledger SET
    balance_after = (SELECT balance FROM native_wallet_accounts WHERE user_id = NEW.user_id)
  WHERE id = NEW.id;
END;
CREATE TRIGGER native_wallet_reservation_validate
BEFORE INSERT ON native_wallet_reservations
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM native_wallet_accounts
    WHERE user_id = NEW.user_id AND balance - reserved_balance >= NEW.amount
  ) THEN RAISE(ABORT, 'INSUFFICIENT_AVAILABLE_BALANCE') END;
END;
CREATE TRIGGER native_wallet_reservation_hold
AFTER INSERT ON native_wallet_reservations
BEGIN
  UPDATE native_wallet_accounts
  SET reserved_balance = reserved_balance + NEW.amount, updated_at = NEW.created_at
  WHERE user_id = NEW.user_id;
END;
CREATE TRIGGER native_wallet_reservation_settle
BEFORE UPDATE OF status ON native_wallet_reservations
WHEN OLD.status = 'reserved' AND NEW.status = 'settled'
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM native_wallet_accounts
    WHERE user_id = OLD.user_id AND reserved_balance >= OLD.amount
  ) THEN RAISE(ABORT, 'WALLET_RESERVATION_INVARIANT') END;
  UPDATE native_wallet_accounts SET
    balance = balance - OLD.amount,
    reserved_balance = reserved_balance - OLD.amount,
    total_debited = total_debited + OLD.amount,
    updated_at = COALESCE(NEW.settled_at, CURRENT_TIMESTAMP)
  WHERE user_id = OLD.user_id;
  INSERT INTO native_wallet_ledger
    (id, user_id, operation, amount, balance_after, type, description, source_plugin, reference_id, metadata, created_at)
  SELECT
    'wallet_tx_' || lower(hex(randomblob(16))), OLD.user_id, 'settlement', OLD.amount, balance,
    'settlement', 'Wallet reservation settled', OLD.source_plugin, OLD.reference_id, '{}',
    COALESCE(NEW.settled_at, CURRENT_TIMESTAMP)
  FROM native_wallet_accounts WHERE user_id = OLD.user_id;
END;
CREATE TRIGGER native_wallet_reservation_release
BEFORE UPDATE OF status ON native_wallet_reservations
WHEN OLD.status = 'reserved' AND NEW.status IN ('released', 'expired')
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM native_wallet_accounts
    WHERE user_id = OLD.user_id AND reserved_balance >= OLD.amount
  ) THEN RAISE(ABORT, 'WALLET_RESERVATION_INVARIANT') END;
  UPDATE native_wallet_accounts SET
    reserved_balance = reserved_balance - OLD.amount,
    updated_at = COALESCE(NEW.released_at, CURRENT_TIMESTAMP)
  WHERE user_id = OLD.user_id;
END;
`;

interface Statement { sql: string; args: unknown[] }

// Minimal faithful D1 surface over node:sqlite so the real runtime SQL (column
// names, trigger side effects, batch behavior) executes exactly as in Cloudflare.
function d1(sqlite: DatabaseSync) {
  // A prepared statement is both executable (first/all/run) and, when passed
  // into batch(), introspectable — so it carries its own sql/args.
  const execute = (bound: Statement) => ({
    sql: bound.sql, args: bound.args,
    first: async <T,>() => (sqlite.prepare(bound.sql).get(...bound.args) ?? null) as T | null,
    all: async <T,>() => ({ results: sqlite.prepare(bound.sql).all(...bound.args) as T[] }),
    run: async () => ({ success: true, meta: { changes: Number(sqlite.prepare(bound.sql).run(...bound.args).changes) } }),
  });
  const prepare = (sql: string) => {
    const base = execute({ sql, args: [] });
    return { ...base, bind: (...args: unknown[]) => execute({ sql, args }) };
  };
  return {
    DB: {
      prepare,
      batch: async (statements: Statement[]) => { for (const s of statements) sqlite.prepare(s.sql).run(...s.args); return []; },
    },
  };
}

function openDatabase(withLegacyTriggers: boolean) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  for (const file of ['0001_native_platform.sql', '0002_native_core.sql', '0003_native_auth.sql', '0025_native_wallet.sql']) {
    sqlite.exec(readFileSync(join(file), 'utf8'));
  }
  if (withLegacyTriggers) sqlite.exec(LEGACY_WALLET_TRIGGERS);
  sqlite.prepare(`INSERT INTO native_users (id, email, username, role, password_salt, password_hash, updated_at)
    VALUES ('u1','u1@example.com','u1','USER','salt','hash','2026-09-13T00:00:00Z')`).run();
  return sqlite;
}

const walletRow = (sqlite: DatabaseSync) => sqlite.prepare(
  `SELECT balance, reserved_balance, total_credited, total_debited FROM native_wallet_accounts WHERE user_id = 'u1'`,
).get() as { balance: number; reserved_balance: number; total_credited: number; total_debited: number };

async function runPackMeteringCycle(env: { DB: ReturnType<typeof d1>['DB'] }) {
  await nativeWalletMutate(env, {
    userId: 'u1', amount: 1500, operation: 'credit', idempotencyKey: 'remoteradar-grant:g1',
    type: 'remoteradar_credit_grant', description: 'RemoteRadar application credits', sourcePlugin: 'remoteradar', referenceId: 'g1',
  });
  const reservation = await nativeWalletReserve(env, {
    userId: 'u1', amount: 1, idempotencyKey: 'remoteradar-pack:c1:1', ttlSeconds: 900,
    sourcePlugin: 'remoteradar', referenceId: 'c1',
  });
  const settled = await nativeWalletFinish(env, {
    userId: 'u1', reservationId: reservation.id, idempotencyKey: 'remoteradar-pack-settle:c1:1', action: 'settle',
  });
  return settled;
}

function applyRetirementMigration(sqlite: DatabaseSync) {
  sqlite.exec(readFileSync(resolve(migrations, '0055_native_wallet_legacy_trigger_retirement.sql'), 'utf8'));
}

describe('native wallet storage semantics', () => {
  it('settles a pack reservation on the current schema with exact ledger accounting', async () => {
    const sqlite = openDatabase(false);
    const env = d1(sqlite);
    const settled = await runPackMeteringCycle(env);
    expect(settled.status).toBe('settled');
    expect(walletRow(sqlite)).toEqual({ balance: 1499, reserved_balance: 0, total_credited: 1500, total_debited: 1 });
    const settlement = sqlite.prepare(
      `SELECT reference_id, source_plugin, operation FROM native_wallet_ledger WHERE operation = 'settlement'`,
    ).get() as { reference_id: string | null; source_plugin: string | null; operation: string };
    expect(settlement).toEqual({ reference_id: 'c1', source_plugin: 'remoteradar', operation: 'settlement' });
  });

  it('retires the legacy wallet triggers and restores single-writer accounting on drifted databases', async () => {
    const sqlite = openDatabase(true);
    const before = sqlite.prepare(`SELECT count(*) AS n FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'native_wallet%'`).get() as { n: number };
    expect(before.n).toBe(6);
    applyRetirementMigration(sqlite);
    const after = sqlite.prepare(`SELECT count(*) AS n FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'native_wallet%'`).get() as { n: number };
    expect(after.n).toBe(0);
    const env = d1(sqlite);
    await runPackMeteringCycle(env);
    expect(walletRow(sqlite)).toEqual({ balance: 1499, reserved_balance: 0, total_credited: 1500, total_debited: 1 });
    const settlementRows = sqlite.prepare(`SELECT count(*) AS n FROM native_wallet_ledger WHERE operation = 'settlement'`).get() as { n: number };
    expect(settlementRows.n).toBe(1);
  });
});
