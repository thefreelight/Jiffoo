import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it, vi } from 'vitest';

// Order-number storage semantics on a real SQLite engine. The behavioural
// tests in order-numbers.test.ts route on SQL fragments; here the 0083 schema
// and the guarded numbering statements themselves execute, so the "number only
// once, never rewrite an existing number" rules are checked by the database.
import { attachOrderNumbers, reserveOrderSequence } from './order-numbers';

const migrations = resolve(import.meta.dirname, '../migrations');

// Only the migrations numbering touches, as in the wallet drift test.
const SCHEMA = ['0001_native_platform.sql', '0002_native_core.sql', '0003_native_auth.sql', '0005_native_order_reads.sql', '0083_native_order_numbers.sql'];

interface Statement { sql: string; args: unknown[] }
interface OrderRow { id: string; payload: string; order_number: string | null; imported_at: string }

// Minimal faithful D1 surface over node:sqlite. A batch is one transaction,
// like on D1, and reports per-statement changes.
function d1(sqlite: DatabaseSync) {
  const changes = (sql: string, args: unknown[]) => Number(sqlite.prepare(sql).run(...args).changes);
  const execute = (bound: Statement) => ({
    sql: bound.sql, args: bound.args,
    first: async <T,>() => (sqlite.prepare(bound.sql).get(...bound.args) ?? null) as T | null,
    all: async <T,>() => ({ results: sqlite.prepare(bound.sql).all(...bound.args) as T[] }),
    run: async () => ({ success: true, results: [], meta: { changes: changes(bound.sql, bound.args) } }),
  });
  const prepare = (sql: string) => {
    const base = execute({ sql, args: [] });
    return { ...base, bind: (...args: unknown[]) => execute({ sql, args }) };
  };
  return {
    prepare,
    batch: async (statements: Statement[]) => {
      sqlite.exec('BEGIN');
      try {
        const results = statements.map((statement) => ({ success: true, results: [], meta: { changes: changes(statement.sql, statement.args) } }));
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

function openDatabase() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  for (const file of SCHEMA) sqlite.exec(readFileSync(resolve(migrations, file), 'utf8'));
  sqlite.prepare(`INSERT INTO native_users (id, email, username, role, password_salt, password_hash, updated_at)
    VALUES ('u1','u1@example.com','u1','USER','salt','hash','2026-11-24T00:00:00Z')`).run();
  return sqlite;
}

const createdAt = '2026-10-01T08:00:00.000Z';
const legacy = (id: string) => ({ id, userId: 'u1', status: 'PAID', totalAmount: 20, currency: 'USD', items: [], createdAt });

function seedOrder(sqlite: DatabaseSync, id: string, payload = JSON.stringify(legacy(id)), orderNumber: string | null = null) {
  sqlite.prepare(`INSERT INTO native_order_snapshots
    (id, user_id, status, searchable_text, payload, source_updated_at, imported_at, order_number)
    VALUES (?1, 'u1', 'PAID', ?2, ?3, ?4, ?4, ?5)`).run(id, id, payload, createdAt, orderNumber);
}

function readOrder(sqlite: DatabaseSync, id: string) {
  return sqlite.prepare('SELECT id, payload, order_number, imported_at FROM native_order_snapshots WHERE id = ?1').get(id) as OrderRow;
}

const sequences = (sqlite: DatabaseSync) => sqlite.prepare('SELECT day, seq FROM native_order_number_sequences ORDER BY day').all();

describe('native order number storage semantics', () => {
  it('applies migration 0083: unique nullable column, per-day sequences, schema marker', () => {
    const sqlite = openDatabase();
    expect(sqlite.prepare('PRAGMA table_info(native_order_snapshots)').all().map((column) => column.name)).toContain('order_number');
    expect(sqlite.prepare("SELECT value FROM runtime_metadata WHERE key = 'core_schema_version'").get()?.value).toBe('0083');
    expect(sqlite.prepare("SELECT sql FROM sqlite_master WHERE name = 'native_order_number_sequences'").get()?.sql).toMatch(/day TEXT PRIMARY KEY/);
    // Orders without a number coexist; an issued number belongs to one order.
    seedOrder(sqlite, 'ord_a');
    seedOrder(sqlite, 'ord_b');
    seedOrder(sqlite, 'ord_c', undefined, 'JF202610010001');
    expect(() => seedOrder(sqlite, 'ord_d', undefined, 'JF202610010001')).toThrow(/UNIQUE constraint failed: native_order_snapshots\.order_number/);
  });

  it('reserves disjoint per-day sequences through one atomic upsert', async () => {
    const DB = d1(openDatabase());
    expect(await reserveOrderSequence(DB as never, '20261124')).toBe(1);
    expect(await reserveOrderSequence(DB as never, '20261124')).toBe(2);
    // A block reservation returns the last reserved slot.
    expect(await reserveOrderSequence(DB as never, '20261124', 3)).toBe(5);
    expect(await reserveOrderSequence(DB as never, '20261125')).toBe(1);
  });

  it('numbers a legacy order into the column and the payload exactly once', async () => {
    const sqlite = openDatabase();
    const DB = d1(sqlite);
    seedOrder(sqlite, 'ord_legacy');
    const first = JSON.parse(readOrder(sqlite, 'ord_legacy').payload);
    await attachOrderNumbers({ DB } as never, [readOrder(sqlite, 'ord_legacy')], [first]);
    expect(first.orderNumber).toBe('JF202610010001');
    expect(readOrder(sqlite, 'ord_legacy').order_number).toBe('JF202610010001');
    expect(JSON.parse(readOrder(sqlite, 'ord_legacy').payload)).toEqual({ ...legacy('ord_legacy'), orderNumber: 'JF202610010001' });

    // A re-read of what is stored is stable and allocates nothing more.
    const second = JSON.parse(readOrder(sqlite, 'ord_legacy').payload);
    await attachOrderNumbers({ DB } as never, [readOrder(sqlite, 'ord_legacy')], [second]);
    expect(second.orderNumber).toBe('JF202610010001');
    expect(sequences(sqlite)).toEqual([{ day: '20261001', seq: 1 }]);
  });

  it('does not surface a number it could not store when another read numbered the order first', async () => {
    const sqlite = openDatabase();
    const DB = d1(sqlite);
    seedOrder(sqlite, 'ord_race');
    const stale = readOrder(sqlite, 'ord_race');
    const order = JSON.parse(stale.payload);
    // A concurrent request numbered the order after this read loaded the row.
    sqlite.prepare('UPDATE native_order_snapshots SET order_number = ?1 WHERE id = ?2').run('JF202610010077', 'ord_race');

    await attachOrderNumbers({ DB } as never, [stale], [order]);
    // The number reserved here was never stored, so it is not shown.
    expect(order).not.toHaveProperty('orderNumber');
    expect(readOrder(sqlite, 'ord_race').order_number).toBe('JF202610010077');
    expect(JSON.parse(readOrder(sqlite, 'ord_race').payload)).toEqual(legacy('ord_race'));
  });

  it('restores a lost payload copy from the column without touching the number', async () => {
    const sqlite = openDatabase();
    const DB = d1(sqlite);
    seedOrder(sqlite, 'ord_lost', JSON.stringify(legacy('ord_lost')), 'BM202610010005');
    const order = JSON.parse(readOrder(sqlite, 'ord_lost').payload);
    await attachOrderNumbers({ DB } as never, [readOrder(sqlite, 'ord_lost')], [order]);
    expect(order.orderNumber).toBe('BM202610010005');
    expect(readOrder(sqlite, 'ord_lost')).toMatchObject({ order_number: 'BM202610010005' });
    expect(JSON.parse(readOrder(sqlite, 'ord_lost').payload)).toEqual({ ...legacy('ord_lost'), orderNumber: 'BM202610010005' });
    // Nothing was allocated.
    expect(sequences(sqlite)).toEqual([]);
  });

  it('never overwrites a payload number that appeared while the request was in flight', async () => {
    const sqlite = openDatabase();
    const DB = d1(sqlite);
    seedOrder(sqlite, 'ord_flight');
    const stale = readOrder(sqlite, 'ord_flight');
    const order = JSON.parse(stale.payload);
    // The payload gained a number (from another writer) while the column stayed NULL.
    sqlite.prepare('UPDATE native_order_snapshots SET payload = ?1 WHERE id = ?2')
      .run(JSON.stringify({ ...legacy('ord_flight'), orderNumber: 'KEPT-1' }), 'ord_flight');

    await attachOrderNumbers({ DB } as never, [stale], [order]);
    expect(readOrder(sqlite, 'ord_flight').order_number).toBe('JF202610010001');
    expect(JSON.parse(readOrder(sqlite, 'ord_flight').payload).orderNumber).toBe('KEPT-1');
  });

  it('numbers an order whose payload is corrupt without rewriting the payload', async () => {
    const sqlite = openDatabase();
    const DB = d1(sqlite);
    seedOrder(sqlite, 'ord_bad', '{not json');
    const order: Record<string, unknown> = {};
    await attachOrderNumbers({ DB } as never, [readOrder(sqlite, 'ord_bad')], [order]);
    expect(order.orderNumber).toBe('JF202610010001');
    expect(readOrder(sqlite, 'ord_bad')).toMatchObject({ order_number: 'JF202610010001', payload: '{not json' });
  });

  it('serves the stored number of an order with a corrupt payload without touching the payload', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const sqlite = openDatabase();
    const DB = d1(sqlite);
    seedOrder(sqlite, 'ord_bad', '{not json', 'BM202610010006');
    const order: Record<string, unknown> = {};
    await attachOrderNumbers({ DB } as never, [readOrder(sqlite, 'ord_bad')], [order]);
    expect(order.orderNumber).toBe('BM202610010006');
    expect(readOrder(sqlite, 'ord_bad').payload).toBe('{not json');
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('changes nothing in the payload except adding the orderNumber key', async () => {
    const sqlite = openDatabase();
    const DB = d1(sqlite);
    const rich = {
      ...legacy('ord_rich'),
      customerEmail: 'a@example.com', locale: 'zh-CN',
      items: [{ id: 'i1', productName: '港澳流量包 1GB/7天 "quoted" \\ slash é 😀', quantity: 1, unitPrice: 2.5, totalPrice: 2.5, attributes: { color: '红', size: null } }],
      shippingAddress: { name: '张三', line1: '路1号' },
      // Numbers of every printed shape, including an integer beyond 2^53.
      big: 2 ** 60, tiny: 0.0000001, exp: 1e21, neg: -0.000001,
    };
    seedOrder(sqlite, 'ord_rich', JSON.stringify(rich));
    const order = JSON.parse(readOrder(sqlite, 'ord_rich').payload);
    await attachOrderNumbers({ DB } as never, [readOrder(sqlite, 'ord_rich')], [order]);
    // Byte-for-byte: numbers, unicode and key order survive untouched.
    expect(readOrder(sqlite, 'ord_rich').payload).toBe(JSON.stringify({ ...rich, orderNumber: 'JF202610010001' }));
  });

  it('fails the whole batch on a number collision, leaves the orders readable, then heals', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const sqlite = openDatabase();
    const DB = d1(sqlite);
    // ord_a holds the day's first number although the sequence row is missing.
    seedOrder(sqlite, 'ord_a', undefined, 'JF202610010001');
    seedOrder(sqlite, 'ord_x');
    seedOrder(sqlite, 'ord_y');
    const rows = () => [readOrder(sqlite, 'ord_x'), readOrder(sqlite, 'ord_y')];
    const orders = rows().map((row) => JSON.parse(row.payload));

    await expect(attachOrderNumbers({ DB } as never, rows(), orders)).resolves.toBeUndefined();
    // 0001 collides, so nothing is stored and nothing is shown.
    expect(orders.map((item) => item.orderNumber)).toEqual([undefined, undefined]);
    expect(rows().map((row) => row.order_number)).toEqual([null, null]);
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();

    // The reservation still advanced the day, so the next read succeeds.
    const retry = rows().map((row) => JSON.parse(row.payload));
    await attachOrderNumbers({ DB } as never, rows(), retry);
    expect(retry.map((item) => item.orderNumber)).toEqual(['JF202610010003', 'JF202610010004']);
    expect(sequences(sqlite)).toEqual([{ day: '20261001', seq: 4 }]);
  });
});
