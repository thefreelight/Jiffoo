import { beforeEach, describe, expect, it, vi } from 'vitest';

// Human-readable order numbers (migration 0083): format and prefix rules, the
// atomic per-day sequence, lazy numbering of orders that predate the column,
// and the order-creation paths plus the customer/admin order reads.
const { authenticateNativeUser, authenticateNativeAdmin, getNativeStripeSecret, getNativePluginConfig } = vi.hoisted(() => ({
  authenticateNativeUser: vi.fn(),
  authenticateNativeAdmin: vi.fn(),
  getNativeStripeSecret: vi.fn(),
  getNativePluginConfig: vi.fn(),
}));
vi.mock('./auth', () => ({ authenticateNativeUser, authenticateNativeAdmin }));
vi.mock('./plugin-settings', () => ({ getNativeStripeSecret, getNativePluginConfig, getNativePluginSecret: vi.fn() }));
vi.mock('./bokmoo-promotions', () => ({ resolveActivePromotion: vi.fn().mockResolvedValue(null) }));
vi.mock('./native-wallet', () => ({ settleNativeWalletCheckout: vi.fn() }));

import { tryNativeAdminOrders } from './admin-orders';
import { tryNativeCheckout } from './checkout';
import {
  allocateOrderNumber,
  attachOrderNumbers,
  formatOrderNumber,
  orderDay,
  reserveOrderSequence,
  resolveOrderNumberPrefix,
} from './order-numbers';
import { tryNativeOrderRead } from './orders';

interface StoredOrder {
  id: string;
  user_id: string;
  status: string;
  searchable_text: string;
  payload: string;
  source_updated_at: string;
  imported_at: string;
  order_number: string | null;
}

type Order = Record<string, unknown>;

// In-memory stand-in for the D1 statements the order paths issue. It keeps
// the rows, the per-day sequences and every statement seen, and mirrors the
// guards of the numbering SQL: number only while the column is NULL, and
// never rewrite a payload number that already exists.
function orderDb(seed: StoredOrder[] = []) {
  const orders = new Map(seed.map((order) => [order.id, { ...order }]));
  const sequences = new Map<string, number>();
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const hooks = { failReserve: false, failBatch: false, raceNumber: null as string | null };

  const addPayloadCopy = (row: StoredOrder): boolean => {
    try {
      const payload = JSON.parse(row.payload) as Order;
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
      if (typeof payload.orderNumber === 'string' && payload.orderNumber.trim()) return false;
      payload.orderNumber = row.order_number;
      row.payload = JSON.stringify(payload);
      return true;
    } catch {
      return false;
    }
  };
  const execute = (statement: string, values: unknown[]): { rows: unknown[]; changes: number } => {
    calls.push({ sql: statement, values });
    if (statement.includes('native_order_number_sequences')) {
      if (hooks.failReserve) throw new Error('D1_ERROR: sequence unavailable');
      const day = String(values[0]);
      const seq = (sequences.get(day) ?? 0) + Number(values[1]);
      sequences.set(day, seq);
      return { rows: [{ seq }], changes: 1 };
    }
    if (statement.includes('INSERT INTO native_order_snapshots')) {
      const [id, userId, searchableText, payload, at, number] = values as [string, string, string, string, string, string | null];
      orders.set(id, {
        id, user_id: userId, status: 'PENDING', searchable_text: searchableText,
        payload, source_updated_at: at, imported_at: at, order_number: number ?? null,
      });
      return { rows: [], changes: 1 };
    }
    if (statement.includes('SET order_number = ?1')) {
      const row = orders.get(String(values[1]));
      if (!row || row.order_number !== null) return { rows: [], changes: 0 };
      if (hooks.raceNumber) {
        // A concurrent read numbered this order first.
        row.order_number = hooks.raceNumber;
        return { rows: [], changes: 0 };
      }
      row.order_number = String(values[0]);
      addPayloadCopy(row);
      return { rows: [], changes: 1 };
    }
    if (statement.includes("json_set(payload, '$.orderNumber', order_number)")) {
      const row = orders.get(String(values[0]));
      if (!row || row.order_number === null) return { rows: [], changes: 0 };
      return { rows: [], changes: addPayloadCopy(row) ? 1 : 0 };
    }
    if (statement.includes('COUNT(*) AS total')) {
      const mine = statement.includes('user_id = ?1')
        ? [...orders.values()].filter((row) => row.user_id === values[0])
        : [...orders.values()];
      return { rows: [{ total: mine.length }], changes: 0 };
    }
    if (statement.includes('FROM native_order_snapshots')) {
      // Only the columns the statement asks for, like the real database.
      const columns = statement.match(/SELECT\s+(.+?)\s+FROM native_order_snapshots/)![1].split(',').map((column) => column.trim());
      const project = (row: StoredOrder) => (columns.includes('*')
        ? { ...row }
        : Object.fromEntries(columns.filter((column) => column in row).map((column) => [column, row[column]])));
      const all = [...orders.values()];
      if (statement.includes('WHERE id = ?1')) {
        const row = all.find((candidate) => candidate.id === values[0]
          && (!statement.includes('user_id = ?2') || candidate.user_id === values[1]));
        return { rows: row ? [project(row)] : [], changes: 0 };
      }
      const mine = statement.includes('user_id = ?1') ? all.filter((row) => row.user_id === values[0]) : all;
      return { rows: mine.map(project), changes: 0 };
    }
    return { rows: [], changes: 0 };
  };
  const db = {
    prepare: (statement: string) => {
      const make = (...values: unknown[]) => ({
        sql: statement,
        run: async () => {
          const { changes } = execute(statement, values);
          return { success: true, results: [], meta: { changes } };
        },
        first: async () => execute(statement, values).rows[0] ?? null,
        all: async () => ({ success: true, results: execute(statement, values).rows }),
        bind: (...bound: unknown[]) => make(...bound),
      });
      return make();
    },
    batch: async (statements: Array<{ run: () => Promise<unknown> }>) => {
      if (hooks.failBatch) throw new Error('D1_ERROR: batch unavailable');
      return Promise.all(statements.map((bound) => bound.run()));
    },
  };
  const seen = (fragment: string) => calls.filter((call) => call.sql.includes(fragment));
  return { db, orders, sequences, hooks, seen };
}

function legacyOrder(id: string, createdAt: string, overrides: Partial<StoredOrder> = {}): StoredOrder {
  const payload = JSON.stringify({ id, userId: 'user-1', status: 'PAID', totalAmount: 20, currency: 'USD', items: [], createdAt });
  return {
    id, user_id: 'user-1', status: 'PAID', searchable_text: id, payload,
    source_updated_at: createdAt, imported_at: createdAt, order_number: null, ...overrides,
  };
}

const parsed = (row: StoredOrder) => JSON.parse(row.payload) as Order;

const product = {
  id: 'plan-1',
  name: 'eSIM 1GB',
  productKind: 'service',
  currency: 'USD',
  stock: 999,
  variants: [{ id: 'plan-1-v1', salePrice: 9, isActive: true }],
};

function createOrder(db: unknown, vars: Record<string, string> = {}, items = [{ productId: 'plan-1', variantId: 'plan-1-v1', quantity: 1 }]) {
  return tryNativeCheckout(
    new Request('https://api.example/api/v1/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items }),
    }),
    { DB: db, NATIVE_CHECKOUT_ENABLED: 'true', ...vars } as never,
    () => Promise.resolve(product),
  );
}

async function listMyOrders(db: unknown): Promise<Order[]> {
  const response = await tryNativeOrderRead(new Request('https://api.example/api/v1/orders'), { DB: db } as never, async () => new Response('{}'));
  return (await response!.json() as { data: { items: Order[] } }).data.items;
}

async function readMyOrder(db: unknown, id: string): Promise<Order> {
  const response = await tryNativeOrderRead(new Request(`https://api.example/api/v1/orders/${id}`), { DB: db } as never, async () => new Response('{}'));
  return (await response!.json() as { data: Order }).data;
}

async function adminRead(db: unknown, path: string): Promise<{ data: Record<string, unknown> }> {
  const response = await tryNativeAdminOrders(new Request(`https://api.example${path}`), { DB: db } as never, async () => new Response('{}'));
  return response!.json() as Promise<{ data: Record<string, unknown> }>;
}

function silence(method: 'error' | 'warn') {
  return vi.spyOn(console, method).mockImplementation(() => {});
}

beforeEach(() => {
  authenticateNativeUser.mockReset();
  authenticateNativeUser.mockResolvedValue({ id: 'user-1', email: 'user-1@example.com', username: 'user-1', role: 'USER' });
  authenticateNativeAdmin.mockReset();
  authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', role: 'SUPER_ADMIN' });
});

describe('order number format', () => {
  it('is PREFIX + UTC creation day + a 4-digit sequence', () => {
    expect(formatOrderNumber('BM', '20261124', 1)).toBe('BM202611240001');
    expect(formatOrderNumber('BM', '20261124', 42)).toBe('BM202611240042');
    expect(formatOrderNumber('BM', '20261124', 9999)).toBe('BM202611249999');
    // Past 9999 a day simply grows to more digits; it never wraps.
    expect(formatOrderNumber('BM', '20261124', 10000)).toBe('BM2026112410000');
  });

  it('accepts a prefix of 2-6 uppercase letters/digits', () => {
    expect(resolveOrderNumberPrefix('BM')).toBe('BM');
    expect(resolveOrderNumberPrefix('A1')).toBe('A1');
    expect(resolveOrderNumberPrefix('BOKMOO')).toBe('BOKMOO');
  });

  it('falls back to the default prefix when the configured one is invalid', () => {
    const warn = silence('warn');
    for (const invalid of [null, '', 'B', 'BOKMOOS', 'bm', 'B-M', 'B_1', ' BM ', 42]) {
      expect(resolveOrderNumberPrefix(invalid)).toBe('JF');
    }
    // A typo is reported (issued numbers can never be renamed); an unset var is not.
    expect(warn).toHaveBeenCalled();
    warn.mockClear();
    expect(resolveOrderNumberPrefix(undefined)).toBe('JF');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('reads the creation day in UTC', () => {
    expect(orderDay('2026-11-24T00:00:00.000Z')).toBe('20261124');
    expect(orderDay('2026-11-23T23:59:59.999Z')).toBe('20261123');
    // 08:00 on Nov 24 in UTC+8 is only midnight in UTC.
    expect(orderDay('2026-11-24T07:59:59+08:00')).toBe('20261123');
    expect(orderDay('2026-11-24T08:00:00+08:00')).toBe('20261124');
    expect(orderDay('2026-11-24')).toBe('20261124');
    expect(orderDay('2026-11-24 23:30:00')).toBe('20261124');
    expect(orderDay('yesterday')).toBeNull();
    expect(orderDay('2026-13-45')).toBeNull();
    expect(orderDay(1763942400000)).toBeNull();
    expect(orderDay(undefined)).toBeNull();
  });
});

describe('per-day order sequence', () => {
  it('reserves 1 then 2 through a single atomic upsert per reservation', async () => {
    const { db, seen } = orderDb();
    expect(await reserveOrderSequence(db as never, '20261124')).toBe(1);
    expect(await reserveOrderSequence(db as never, '20261124')).toBe(2);
    expect(await reserveOrderSequence(db as never, '20261125')).toBe(1);
    const reserves = seen('native_order_number_sequences');
    expect(reserves).toHaveLength(3);
    for (const { sql } of reserves) {
      expect(sql).toContain('ON CONFLICT(day) DO UPDATE SET seq = seq + ?2');
      expect(sql).toContain('RETURNING seq');
    }
  });

  it('allocates BM202611240001 then BM202611240002, and restarts on the next day', async () => {
    const { db } = orderDb();
    const env = { DB: db, ORDER_NUMBER_PREFIX: 'BM' } as never;
    expect(await allocateOrderNumber(env, '2026-11-24T13:45:12.000Z')).toBe('BM202611240001');
    expect(await allocateOrderNumber(env, '2026-11-24T23:59:59.000Z')).toBe('BM202611240002');
    expect(await allocateOrderNumber(env, '2026-11-25T00:00:00.000Z')).toBe('BM202611250001');
  });

  it('numbers with the default prefix when ORDER_NUMBER_PREFIX is missing or invalid', async () => {
    const warn = silence('warn');
    const createdAt = '2026-11-24T13:45:12.000Z';
    expect(await allocateOrderNumber({ DB: orderDb().db } as never, createdAt)).toBe('JF202611240001');
    expect(await allocateOrderNumber({ DB: orderDb().db, ORDER_NUMBER_PREFIX: 'bokmoo!' } as never, createdAt)).toBe('JF202611240001');
    warn.mockRestore();
  });

  it('never hands one number to concurrent allocations', async () => {
    const { db } = orderDb();
    const env = { DB: db } as never;
    const numbers = await Promise.all(Array.from({ length: 25 }, () => allocateOrderNumber(env, '2026-11-24T13:45:12.000Z')));
    expect(numbers).toEqual(Array.from({ length: 25 }, (_, index) => `JF20261124${String(index + 1).padStart(4, '0')}`));
  });

  it('returns null instead of throwing when no sequence can be reserved', async () => {
    const error = silence('error');
    const { db, hooks } = orderDb();
    hooks.failReserve = true;
    expect(await allocateOrderNumber({ DB: db } as never, '2026-11-24T13:45:12.000Z')).toBeNull();
    // A reservation that answers without a row is a failure too.
    const noRows = { prepare: () => ({ bind: () => ({ first: async () => null }) }) };
    expect(await allocateOrderNumber({ DB: noRows } as never, '2026-11-24T13:45:12.000Z')).toBeNull();
    expect(error).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });
});

describe('lazy numbering of orders without a number', () => {
  it('numbers a legacy order once, for its own creation day, and stays stable on re-read', async () => {
    const fake = orderDb([legacyOrder('ord_legacy', '2026-10-01T08:00:00.000Z')]);
    const env = { DB: fake.db } as never;
    const row = fake.orders.get('ord_legacy')!;
    const first = parsed(row);
    await attachOrderNumbers(env, [row], [first]);
    expect(first.orderNumber).toBe('JF202610010001');
    // Persisted in the column and in the payload JSON.
    expect(row.order_number).toBe('JF202610010001');
    expect(parsed(row).orderNumber).toBe('JF202610010001');

    // A re-read of what is stored keeps the number and writes nothing.
    const second = parsed(row);
    await attachOrderNumbers(env, [row], [second]);
    expect(second.orderNumber).toBe('JF202610010001');
    expect(fake.seen('native_order_number_sequences')).toHaveLength(1);
    expect(fake.seen('SET order_number = ?1')).toHaveLength(1);
  });

  it('numbers each order for its own day with one block reservation per day', async () => {
    const fake = orderDb([
      legacyOrder('ord_a', '2026-10-01T08:00:00.000Z'),
      legacyOrder('ord_b', '2026-10-01T09:00:00.000Z'),
      legacyOrder('ord_c', '2026-10-02T09:00:00.000Z'),
    ]);
    const rows = ['ord_a', 'ord_b', 'ord_c'].map((id) => fake.orders.get(id)!);
    const orders = rows.map(parsed);
    await attachOrderNumbers({ DB: fake.db } as never, rows, orders);
    expect(orders.map((order) => order.orderNumber)).toEqual(['JF202610010001', 'JF202610010002', 'JF202610020001']);
    expect(fake.seen('native_order_number_sequences').map((call) => call.values)).toEqual([['20261001', 2], ['20261002', 1]]);
    // One round trip persists the whole page.
    expect(fake.seen('SET order_number = ?1')).toHaveLength(3);
    expect(fake.orders.get('ord_b')!.order_number).toBe('JF202610010002');
  });

  it('continues the day sequence behind numbers issued at creation', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-24T12:00:00.000Z'));
      const now = new Date().toISOString();
      const fake = orderDb([legacyOrder('ord_earlier_today', '2026-11-24T01:00:00.000Z')]);
      const env = { DB: fake.db } as never;
      // An order created after numbering existed took the day's first number.
      expect(await allocateOrderNumber(env, now)).toBe('JF202611240001');
      const row = fake.orders.get('ord_earlier_today')!;
      const order = parsed(row);
      await attachOrderNumbers(env, [row], [order]);
      expect(order.orderNumber).toBe('JF202611240002');
    } finally {
      vi.useRealTimers();
    }
  });

  it('never changes an existing number', async () => {
    const fake = orderDb([
      // Column and payload agree.
      legacyOrder('ord_same', '2026-10-01T08:00:00.000Z', {
        order_number: 'BM202610010005',
        payload: JSON.stringify({ id: 'ord_same', createdAt: '2026-10-01T08:00:00.000Z', orderNumber: 'BM202610010005' }),
      }),
      // The payload lost its copy of an issued number.
      legacyOrder('ord_lost', '2026-10-01T08:00:00.000Z', { order_number: 'BM202610010006' }),
      // A number that only lives in the payload.
      legacyOrder('ord_payload', '2026-10-01T08:00:00.000Z', {
        payload: JSON.stringify({ id: 'ord_payload', createdAt: '2026-10-01T08:00:00.000Z', orderNumber: 'LEGACY-7' }),
      }),
    ]);
    const env = { DB: fake.db } as never;
    const rows = ['ord_same', 'ord_lost', 'ord_payload'].map((id) => fake.orders.get(id)!);
    const orders = rows.map(parsed);
    await attachOrderNumbers(env, rows, orders);
    expect(orders.map((order) => order.orderNumber)).toEqual(['BM202610010005', 'BM202610010006', 'LEGACY-7']);
    // Nothing was allocated, no column was rewritten; only the lost payload copy was restored.
    expect(fake.seen('native_order_number_sequences')).toHaveLength(0);
    expect(fake.seen('SET order_number = ?1')).toHaveLength(0);
    expect(fake.seen("json_set(payload, '$.orderNumber', order_number)").map((call) => call.values)).toEqual([['ord_lost']]);
    expect(rows.map((row) => row.order_number)).toEqual(['BM202610010005', 'BM202610010006', null]);
    expect(parsed(rows[1]!).orderNumber).toBe('BM202610010006');
    // Once restored, a re-read is read-only.
    await attachOrderNumbers(env, rows, rows.map(parsed));
    expect(fake.seen("json_set(payload, '$.orderNumber', order_number)")).toHaveLength(1);
  });

  it('only writes a number while the column is NULL, and never over a payload number', async () => {
    const fake = orderDb([
      legacyOrder('ord_legacy', '2026-10-01T08:00:00.000Z'),
      legacyOrder('ord_lost', '2026-10-01T08:00:00.000Z', { order_number: 'BM202610010009' }),
    ]);
    const rows = [fake.orders.get('ord_legacy')!, fake.orders.get('ord_lost')!];
    await attachOrderNumbers({ DB: fake.db } as never, rows, rows.map(parsed));
    const number = fake.seen('SET order_number = ?1')[0]!.sql;
    expect(number).toContain('WHERE id = ?2 AND order_number IS NULL');
    expect(number).toContain('json_valid(payload)');
    expect(number).toContain("COALESCE(json_extract(payload, '$.orderNumber'), '') = ''");
    const restore = fake.seen("json_set(payload, '$.orderNumber', order_number)")[0]!.sql;
    expect(restore).toContain('WHERE id = ?1 AND order_number IS NOT NULL');
    expect(restore).toContain("COALESCE(json_extract(payload, '$.orderNumber'), '') = ''");
  });

  it('only surfaces a number it stored when a concurrent read numbered the order first', async () => {
    const fake = orderDb([legacyOrder('ord_legacy', '2026-10-01T08:00:00.000Z')]);
    const env = { DB: fake.db } as never;
    fake.hooks.raceNumber = 'JF202610010077';
    const row = fake.orders.get('ord_legacy')!;
    const order = parsed(row);
    await attachOrderNumbers(env, [row], [order]);
    // The number reserved here was never stored, so it is not shown.
    expect(order).not.toHaveProperty('orderNumber');
    expect(row.order_number).toBe('JF202610010077');
    const next = parsed(row);
    await attachOrderNumbers(env, [row], [next]);
    expect(next.orderNumber).toBe('JF202610010077');
  });

  it('keeps the order readable when numbering fails', async () => {
    const error = silence('error');
    const fake = orderDb([legacyOrder('ord_legacy', '2026-10-01T08:00:00.000Z')]);
    const env = { DB: fake.db } as never;
    const row = fake.orders.get('ord_legacy')!;
    const before = row.payload;

    fake.hooks.failReserve = true;
    const order = parsed(row);
    await expect(attachOrderNumbers(env, [row], [order])).resolves.toBeUndefined();
    expect(order).not.toHaveProperty('orderNumber');

    fake.hooks.failReserve = false;
    fake.hooks.failBatch = true;
    await expect(attachOrderNumbers(env, [row], [order])).resolves.toBeUndefined();
    expect(order).not.toHaveProperty('orderNumber');

    expect(row.payload).toBe(before);
    expect(row.order_number).toBeNull();
    expect(error).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });

  it('numbers an order whose payload is not valid JSON without touching the payload', async () => {
    const fake = orderDb([legacyOrder('ord_bad', '2026-10-01T08:00:00.000Z', { payload: '{not json' })]);
    const row = fake.orders.get('ord_bad')!;
    const order: Order = {};
    await attachOrderNumbers({ DB: fake.db } as never, [row], [order]);
    expect(order.orderNumber).toBe('JF202610010001');
    expect(row.order_number).toBe('JF202610010001');
    expect(row.payload).toBe('{not json');
  });

  it('falls back to the import time, then to today, when the creation date is missing', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-24T12:00:00.000Z'));
      const fake = orderDb([
        legacyOrder('ord_imported', 'ignored', { payload: JSON.stringify({ id: 'ord_imported' }), imported_at: '2026-09-15T10:00:00.000Z' }),
        legacyOrder('ord_undated', 'ignored', { payload: JSON.stringify({ id: 'ord_undated' }), imported_at: 'not a date' }),
      ]);
      const orders: Order[] = [{}, {}];
      await attachOrderNumbers({ DB: fake.db } as never, [fake.orders.get('ord_imported')!, fake.orders.get('ord_undated')!], orders);
      expect(orders.map((order) => order.orderNumber)).toEqual(['JF202609150001', 'JF202611240001']);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('order creation issues a number', () => {
  it('stores the number on the checkout order, in the column and the payload, and returns it', async () => {
    const fake = orderDb();
    const response = await createOrder(fake.db, { ORDER_NUMBER_PREFIX: 'BM' });
    expect(response?.status).toBe(201);
    const body = await response!.json() as { data: Order };
    expect(body.data.orderNumber).toMatch(/^BM\d{8}0001$/);
    const row = fake.orders.get(String(body.data.id))!;
    expect(row.order_number).toBe(body.data.orderNumber);
    expect(parsed(row).orderNumber).toBe(body.data.orderNumber);
    const insert = fake.seen('INSERT INTO native_order_snapshots')[0]!;
    expect(insert.sql).toContain('imported_at, order_number)');
    expect(insert.values[5]).toBe(body.data.orderNumber);
  });

  it('uses the default prefix and increments across checkouts', async () => {
    const fake = orderDb();
    const first = await (await createOrder(fake.db))!.json() as { data: Order };
    const second = await (await createOrder(fake.db))!.json() as { data: Order };
    expect(first.data.orderNumber).toMatch(/^JF\d{8}0001$/);
    expect(second.data.orderNumber).toMatch(/^JF\d{8}0002$/);
  });

  it('still creates the order when no number can be reserved', async () => {
    const error = silence('error');
    const fake = orderDb();
    fake.hooks.failReserve = true;
    const response = await createOrder(fake.db);
    expect(response?.status).toBe(201);
    const body = await response!.json() as { data: Order };
    // Unnumbered exactly like an order created before migration 0083.
    expect(body.data).not.toHaveProperty('orderNumber');
    const row = fake.orders.get(String(body.data.id))!;
    expect(row.order_number).toBeNull();
    expect(parsed(row)).not.toHaveProperty('orderNumber');
    error.mockRestore();
  });

  it('does not consume a number for a checkout that is rejected', async () => {
    const fake = orderDb();
    const unknownProduct = await createOrder(fake.db, {}, [{ productId: 'missing', variantId: 'missing-v1', quantity: 1 }]);
    expect(unknownProduct?.status).toBe(404);
    const noItems = await createOrder(fake.db, {}, []);
    expect(noItems?.status).toBe(400);
    expect(fake.seen('native_order_number_sequences')).toHaveLength(0);
  });
});

describe('order reads number legacy orders', () => {
  it('customer list and detail number a legacy order once, then serve the stored number', async () => {
    const fake = orderDb([legacyOrder('ord_legacy', '2026-10-01T08:00:00.000Z')]);
    const items = await listMyOrders(fake.db);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: 'ord_legacy', orderNumber: 'JF202610010001' });

    expect(await readMyOrder(fake.db, 'ord_legacy')).toMatchObject({ id: 'ord_legacy', orderNumber: 'JF202610010001' });
    expect((await listMyOrders(fake.db))[0]).toMatchObject({ orderNumber: 'JF202610010001' });
    expect(fake.seen('native_order_number_sequences')).toHaveLength(1);
    expect(fake.seen('SET order_number = ?1')).toHaveLength(1);
  });

  it('customer detail numbers a legacy order when it is the first read', async () => {
    const fake = orderDb([legacyOrder('ord_legacy', '2026-10-01T08:00:00.000Z')]);
    expect(await readMyOrder(fake.db, 'ord_legacy')).toMatchObject({ id: 'ord_legacy', orderNumber: 'JF202610010001' });
    expect(fake.orders.get('ord_legacy')!.order_number).toBe('JF202610010001');
    expect(fake.seen('native_order_number_sequences')).toHaveLength(1);
  });

  it('serves the stored column number when the payload lost its copy', async () => {
    const lost = () => legacyOrder('ord_lost', '2026-10-01T08:00:00.000Z', { order_number: 'BM202610010005' });
    const list = orderDb([lost()]);
    expect(await listMyOrders(list.db)).toMatchObject([{ id: 'ord_lost', orderNumber: 'BM202610010005' }]);
    // The payload copy is restored from the column; nothing is allocated.
    expect(parsed(list.orders.get('ord_lost')!).orderNumber).toBe('BM202610010005');
    expect(await readMyOrder(orderDb([lost()]).db, 'ord_lost')).toMatchObject({ orderNumber: 'BM202610010005' });
    const admin = orderDb([lost()]);
    expect((await adminRead(admin.db, '/api/v1/admin/orders')).data.items).toMatchObject([{ orderNumber: 'BM202610010005' }]);
    expect((await adminRead(orderDb([lost()]).db, '/api/v1/admin/orders/ord_lost')).data).toMatchObject({ orderNumber: 'BM202610010005' });
    expect(list.seen('native_order_number_sequences')).toHaveLength(0);
  });

  it('serves numbers issued at creation without allocating again', async () => {
    const fake = orderDb();
    const created = await (await createOrder(fake.db))!.json() as { data: Order };
    const items = await listMyOrders(fake.db);
    expect(items[0]).toMatchObject({ id: created.data.id, orderNumber: created.data.orderNumber });
    expect(await readMyOrder(fake.db, String(created.data.id))).toMatchObject({ orderNumber: created.data.orderNumber });
    expect(fake.seen('native_order_number_sequences')).toHaveLength(1);
  });

  it('serves the order as stored when numbering fails', async () => {
    const error = silence('error');
    const fake = orderDb([legacyOrder('ord_legacy', '2026-10-01T08:00:00.000Z')]);
    for (const fail of ['failReserve', 'failBatch'] as const) {
      fake.hooks.failReserve = fail === 'failReserve';
      fake.hooks.failBatch = fail === 'failBatch';
      const items = await listMyOrders(fake.db);
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ id: 'ord_legacy', status: 'PAID', totalAmount: 20 });
      expect(items[0]).not.toHaveProperty('orderNumber');
      expect(await readMyOrder(fake.db, 'ord_legacy')).toMatchObject({ id: 'ord_legacy', status: 'PAID' });
    }
    error.mockRestore();
  });

  it('admin list and detail number legacy orders the same way', async () => {
    const fake = orderDb([legacyOrder('ord_legacy', '2026-10-01T08:00:00.000Z')]);
    const list = await adminRead(fake.db, '/api/v1/admin/orders');
    expect(list.data.items).toMatchObject([{ id: 'ord_legacy', orderNumber: 'JF202610010001' }]);
    const detail = await adminRead(fake.db, '/api/v1/admin/orders/ord_legacy');
    expect(detail.data).toMatchObject({ id: 'ord_legacy', orderNumber: 'JF202610010001' });
    expect(fake.seen('native_order_number_sequences')).toHaveLength(1);
  });

  it('admin detail numbers a legacy order when it is the first read', async () => {
    const fake = orderDb([legacyOrder('ord_legacy', '2026-10-01T08:00:00.000Z')]);
    expect((await adminRead(fake.db, '/api/v1/admin/orders/ord_legacy')).data).toMatchObject({ id: 'ord_legacy', orderNumber: 'JF202610010001' });
    expect(fake.orders.get('ord_legacy')!.order_number).toBe('JF202610010001');
    expect(fake.seen('native_order_number_sequences')).toHaveLength(1);
  });
});
