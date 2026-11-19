import { beforeEach, describe, expect, it, vi } from 'vitest';

const { processBossPaidOrder, syncBossOrderStatuses } = await import('./boss-orders');

type LineStatus = 'pending' | 'created' | 'completed' | 'failed' | 'unverified';

interface LineRow {
  id: string;
  order_id: string;
  line_item_id: string;
  status: LineStatus;
  boss_order_no: string | null;
  boss_odoo_order_name: string | null;
  error: string | null;
  payload_json: string;
}

const metadata = { user_id: 'user-1', payment_status: 'PAID' };
const orderSnapshot = {
  payload: JSON.stringify({
    id: 'ord_1',
    customerEmail: 'buyer@example.com',
    shippingAddress: { name: 'Jordan Buyer' },
  }),
};
const bossProductSnapshot = {
  status_code: 200,
  payload: JSON.stringify({
    success: true,
    data: {
      id: 'boss-HKMO-1GB-7D',
      name: 'HK/MO 1GB 7D',
      typeData: { provider: 'boss', esim: { bossOdooId: 4242, defaultCode: 'HKMO-1GB-7D' } },
    },
  }),
};
const plainProductSnapshot = {
  status_code: 200,
  payload: JSON.stringify({
    success: true,
    data: { id: 'bokmoo-card', name: 'BOKMOO card', typeData: { provider: 'native' } },
  }),
};
const items = [
  { id: 'line-1', product_id: 'boss-HKMO-1GB-7D', quantity: 1, payload: '{}' },
];

function bossOk(data: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ resultCode: '10000', resultMsg: 'ok', data }), { status: 200 });
}

function bossBusinessError(): Response {
  return new Response(JSON.stringify({ resultCode: '10001', resultMsg: 'insufficient stock' }), { status: 200 });
}

function makeDb(options: {
  metadata?: { user_id: string; payment_status: string } | null;
  items?: Array<{ id: string; product_id: string; quantity: number; payload: string }>;
  productSnapshot?: Record<string, unknown> | null;
  lines?: LineRow[];
} = {}) {
  const metadataRow = options.metadata === undefined ? metadata : options.metadata;
  const productSnapshotRow = options.productSnapshot === undefined ? bossProductSnapshot : options.productSnapshot;
  const lines: LineRow[] = options.lines ?? [];
  const db = {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn((...values: unknown[]) => ({
        sql,
        values,
        first: vi.fn(async () => {
          if (sql.includes('FROM native_order_metadata')) return metadataRow;
          if (sql.includes('FROM native_order_snapshots')) return orderSnapshot;
          if (sql.includes('FROM core_api_snapshots')) return productSnapshotRow;
          if (sql.includes('FROM native_boss_order_lines')) {
            return lines.find((line) => line.order_id === values[0] && line.line_item_id === values[1]) ?? null;
          }
          return null;
        }),
        all: vi.fn(async () => {
          if (sql.includes('FROM native_order_items')) return { results: options.items ?? [] };
          if (sql.includes('FROM native_boss_order_lines')) {
            return { results: lines.filter((line) => line.status === 'created' && line.boss_order_no) };
          }
          return { results: [] };
        }),
        run: vi.fn(async () => {
          if (sql.includes('INSERT INTO native_boss_order_lines')) {
            lines.push({
              id: String(values[0]),
              order_id: String(values[1]),
              line_item_id: String(values[2]),
              status: 'pending',
              boss_order_no: null,
              boss_odoo_order_name: null,
              error: null,
              payload_json: '{}',
            });
            return { success: true, meta: { changes: 1 } };
          }
          if (sql.includes('UPDATE native_boss_order_lines')) {
            // Updates key either by (order_id, line_item_id) — last two binds —
            // or by id — last bind (unverified/pending/completed/payload paths).
            const line = sql.includes('WHERE order_id')
              ? lines.find((candidate) => candidate.order_id === String(values[values.length - 2])
                && candidate.line_item_id === String(values[values.length - 1]))
              : lines.find((candidate) => candidate.id === String(values[values.length - 1]));
            if (line) {
              if (sql.includes("status = 'unverified'")) {
                line.status = 'unverified';
                line.error = String(values[0]);
              } else if (sql.includes("status = 'created'")) {
                line.status = 'created';
                line.boss_order_no = String(values[0]);
                line.boss_odoo_order_name = values[1] === null ? null : String(values[1]);
                line.payload_json = String(values[2]);
                line.error = null;
              } else if (sql.includes("status = 'failed'")) {
                line.status = 'failed';
                line.error = String(values[0]);
              } else if (sql.includes("status = 'completed'")) {
                line.status = 'completed';
                line.payload_json = String(values[0]);
              } else if (sql.includes("status = 'pending'")) {
                line.status = 'pending';
                line.error = null;
              } else {
                line.payload_json = String(values[0]);
              }
            }
            return { success: true, meta: { changes: 1 } };
          }
          return { success: true, meta: { changes: 0 } };
        }),
      })),
    })),
  };
  return { db, lines };
}

const env = (db: unknown, apiKey = 'boss-key') => ({ DB: db, JWT_SECRET: 'jwt', BOSS_API_KEY: apiKey }) as never;

describe('BOSS paid-order fulfillment', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('skips cleanly when the BOSS API key is not configured', async () => {
    const { db } = makeDb();
    await expect(processBossPaidOrder(env(db, ''), 'ord_1', 'evt_1')).rejects.toThrow('BOSS_NOT_CONFIGURED');
    await expect(processBossPaidOrder({ DB: db, JWT_SECRET: 'jwt' } as never, 'ord_1', 'evt_1')).rejects.toThrow('BOSS_NOT_CONFIGURED');
  });

  it('treats orders without BOSS-managed lines as legitimate non-targets', async () => {
    const { db } = makeDb({ productSnapshot: plainProductSnapshot });
    await expect(processBossPaidOrder(env(db), 'ord_1', 'evt_1')).rejects.toThrow('BOSS_ORDER_NOT_ELIGIBLE');
  });

  it('places a BOSS order for a paid eSIM line and records the orderNo', async () => {
    const fetchMock = vi.fn(async () => bossOk({ orderNo: 'BOSS-1', odooOrderName: 'S00123', status: 'CREATED', amount: 4.9, productName: 'HK/MO 1GB 7D', quantity: 1 }));
    vi.stubGlobal('fetch', fetchMock);
    const { db, lines } = makeDb({ items });
    const result = await processBossPaidOrder(env(db), 'ord_1', 'evt_1');
    expect(result).toEqual({ placed: 1, skipped: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('/bs/openapi/order/create');
    const body = JSON.parse(String(init!.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      productOdooId: 4242,
      quantity: 1,
      customerName: 'Jordan Buyer',
      remark: 'ord_1/line-1',
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ status: 'created', boss_order_no: 'BOSS-1', boss_odoo_order_name: 'S00123' });
  });

  it('is idempotent when the line was already fulfilled on a prior attempt', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { db } = makeDb({
      items,
      lines: [{ id: 'boss_line_1', order_id: 'ord_1', line_item_id: 'line-1', status: 'created', boss_order_no: 'BOSS-1', boss_odoo_order_name: null, error: null, payload_json: '{}' }],
    });
    const result = await processBossPaidOrder(env(db), 'ord_1', 'evt_2');
    expect(result).toEqual({ placed: 0, skipped: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('parks unresolved creates as unverified instead of re-ordering', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { db, lines } = makeDb({
      items,
      lines: [{ id: 'boss_line_1', order_id: 'ord_1', line_item_id: 'line-1', status: 'pending', boss_order_no: null, boss_odoo_order_name: null, error: null, payload_json: '{}' }],
    });
    await expect(processBossPaidOrder(env(db), 'ord_1', 'evt_2')).rejects.toThrow('BOSS_ORDER_UNVERIFIED');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(lines[0]!.status).toBe('unverified');
  });

  it('re-drives a line that previously failed upstream', async () => {
    const fetchMock = vi.fn(async () => bossOk({ orderNo: 'BOSS-2', odooOrderName: 'S00124', status: 'CREATED' }));
    vi.stubGlobal('fetch', fetchMock);
    const { db, lines } = makeDb({
      items,
      lines: [{ id: 'boss_line_1', order_id: 'ord_1', line_item_id: 'line-1', status: 'failed', boss_order_no: null, boss_odoo_order_name: null, error: 'BOSS create failed: HTTP 500', payload_json: '{}' }],
    });
    const result = await processBossPaidOrder(env(db), 'ord_1', 'evt_2');
    expect(result).toEqual({ placed: 1, skipped: false });
    expect(lines[0]).toMatchObject({ status: 'created', boss_order_no: 'BOSS-2', error: null });
  });

  it('marks the line failed and rethrows when BOSS rejects the order', async () => {
    const fetchMock = vi.fn(async () => bossBusinessError());
    vi.stubGlobal('fetch', fetchMock);
    const { db, lines } = makeDb({ items });
    await expect(processBossPaidOrder(env(db), 'ord_1', 'evt_1')).rejects.toThrow('business error 10001');
    expect(lines[0]).toMatchObject({ status: 'failed' });
    expect(lines[0]!.error).toContain('10001');
  });
});

describe('BOSS order status sweep', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('marks created lines completed when BOSS reports a terminal status', async () => {
    const fetchMock = vi.fn(async () => bossOk({ found: true, status: 'DELIVERED', iccids: ['8986000'] }));
    vi.stubGlobal('fetch', fetchMock);
    const { db, lines } = makeDb({
      lines: [{ id: 'boss_line_1', order_id: 'ord_1', line_item_id: 'line-1', status: 'created', boss_order_no: 'BOSS-1', boss_odoo_order_name: null, error: null, payload_json: '{}' }],
    });
    const result = await syncBossOrderStatuses(env(db));
    expect(result).toEqual({ checked: 1, completed: 1 });
    expect(lines[0]).toMatchObject({ status: 'completed' });
    const payload = JSON.parse(lines[0]!.payload_json) as { lastStatusRecord?: { status?: string } };
    expect(payload.lastStatusRecord?.status).toBe('DELIVERED');
  });

  it('keeps created lines open on non-terminal statuses', async () => {
    const fetchMock = vi.fn(async () => bossOk({ found: true, status: 'PROVISIONING' }));
    vi.stubGlobal('fetch', fetchMock);
    const { db, lines } = makeDb({
      lines: [{ id: 'boss_line_1', order_id: 'ord_1', line_item_id: 'line-1', status: 'created', boss_order_no: 'BOSS-1', boss_odoo_order_name: null, error: null, payload_json: '{}' }],
    });
    const result = await syncBossOrderStatuses(env(db));
    expect(result).toEqual({ checked: 1, completed: 0 });
    expect(lines[0]!.status).toBe('created');
  });

  it('does nothing when the BOSS API key is not configured', async () => {
    const { db } = makeDb();
    await expect(syncBossOrderStatuses(env(db, ''))).resolves.toEqual({ checked: 0, completed: 0 });
  });
});
