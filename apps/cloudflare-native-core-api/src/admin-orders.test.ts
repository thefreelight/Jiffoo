import { beforeEach, describe, expect, it, vi } from 'vitest';

const authenticateNativeAdmin = vi.fn();

vi.mock('./auth', () => ({
  authenticateNativeAdmin,
}));

const { tryNativeAdminOrders } = await import('./admin-orders');

interface OrderRow {
  id: string;
  user_id: string;
  payload: string;
  source_updated_at: string;
}

interface UserRow {
  id: string;
  email: string;
  username: string | null;
  avatar: string | null;
}

function fakeEnv(orders: OrderRow[], users: UserRow[]) {
  const prepare = (sql: string) => ({
    sql,
    bind: (...args: unknown[]) => ({
      sql,
      run: async () => ({ meta: {} }),
      first: async () => {
        if (sql.includes('COUNT(*) AS total')) return { total: orders.length };
        if (sql.includes('FROM native_order_snapshots WHERE id =')) {
          const row = orders.find((order) => order.id === args[0]);
          return row ? { payload: row.payload } : null;
        }
        if (sql.includes('FROM native_users WHERE id =')) {
          return users.find((user) => user.id === args[0]) ?? null;
        }
        if (sql.includes('FROM native_users WHERE id IN')) {
          return null;
        }
        return null;
      },
      all: async () => {
        if (sql.includes('FROM native_order_snapshots') && sql.includes('ORDER BY')) {
          return { results: orders.map((order) => ({ payload: order.payload })) };
        }
        if (sql.includes('FROM native_users WHERE id IN')) {
          return { results: users.filter((user) => (args as string[]).includes(user.id)) };
        }
        if (sql.includes('FROM native_shipments WHERE')) return { results: [] };
        if (sql.includes('FROM native_shipment_events WHERE')) return { results: [] };
        if (sql.includes('INSERT INTO native_shipments')) return { meta: {} };
        return { results: [] };
      },
    }),
  });
  const batched: string[] = [];
  const DB = {
    prepare,
    batch: async (statements: Array<{ sql?: string }>) => {
      batched.push(...statements.map((statement) => statement.sql ?? ''));
      return statements;
    },
  };
  return { DB: DB as unknown as Parameters<typeof tryNativeAdminOrders>[1], batched };
}

function nativeCheckoutPayload(orderId: string, userId: string, email: string) {
  return JSON.stringify({
    id: orderId,
    userId,
    status: 'PAID',
    customerEmail: email,
    totalAmount: 20,
    currency: 'USD',
    items: [],
    createdAt: '2026-10-01T00:00:00.000Z',
  });
}

function request(path: string): Request {
  return new Request(`https://api.bokmoo.test${path}`, { headers: { authorization: 'Bearer test-token' } });
}

function shipRequest(path: string, body: Record<string, unknown>): Request {
  return new Request(`https://api.bokmoo.test${path}`, {
    method: 'POST',
    headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  authenticateNativeAdmin.mockReset();
  authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', role: 'SUPER_ADMIN' });
});

describe('tryNativeAdminOrders', () => {
  it('enriches native checkout payloads with a customer object joined from native_users', async () => {
    const env = fakeEnv(
      [{ id: 'ord-1', user_id: 'u-1', payload: nativeCheckoutPayload('ord-1', 'u-1', 'shopper@jiffoo.test'), source_updated_at: '2026-10-01T00:00:00Z' }],
      [{ id: 'u-1', email: 'shopper@jiffoo.test', username: 'shopper', avatar: null }],
    );
    const response = await tryNativeAdminOrders(request('/api/v1/admin/orders'), env, async () => new Response('{}'));
    const body = await response.json() as { data: { items: Array<{ customer?: { username?: string; email?: string } }> } };
    expect(body.data.items[0].customer).toEqual({
      id: 'u-1',
      email: 'shopper@jiffoo.test',
      username: 'shopper',
    });
  });

  it('falls back to the payload customerEmail when the user row is gone', async () => {
    const env = fakeEnv(
      [{ id: 'ord-2', user_id: 'u-gone', payload: nativeCheckoutPayload('ord-2', 'u-gone', 'ghost@jiffoo.test'), source_updated_at: '2026-10-02T00:00:00Z' }],
      [],
    );
    const response = await tryNativeAdminOrders(request('/api/v1/admin/orders'), env, async () => new Response('{}'));
    const body = await response.json() as { data: { items: Array<{ customer?: { id?: string | null; email?: string | null; username?: string | null } }> } };
    expect(body.data.items[0].customer).toEqual({ id: 'u-gone', email: 'ghost@jiffoo.test', username: null });
  });

  it('leaves an existing customer object untouched', async () => {
    const payload = JSON.stringify({
      id: 'ord-3',
      status: 'PAID',
      customer: { id: 'u-9', email: 'kept@jiffoo.test', username: 'kept' },
      customerEmail: 'kept@jiffoo.test',
    });
    const env = fakeEnv(
      [{ id: 'ord-3', user_id: 'u-9', payload, source_updated_at: '2026-10-03T00:00:00Z' }],
      [{ id: 'u-9', email: 'kept@jiffoo.test', username: 'kept', avatar: null }],
    );
    const response = await tryNativeAdminOrders(request('/api/v1/admin/orders'), env, async () => new Response('{}'));
    const body = await response.json() as { data: { items: Array<{ customer: { username: string } }> } };
    expect(body.data.items[0].customer).toEqual({ id: 'u-9', email: 'kept@jiffoo.test', username: 'kept' });
  });

  it('enriches the detail response and 404s unknown orders', async () => {
    const env = fakeEnv(
      [{ id: 'ord-1', user_id: 'u-1', payload: nativeCheckoutPayload('ord-1', 'u-1', 'shopper@jiffoo.test'), source_updated_at: '2026-10-01T00:00:00Z' }],
      [{ id: 'u-1', email: 'shopper@jiffoo.test', username: 'shopper', avatar: null }],
    );
    const detail = await tryNativeAdminOrders(request('/api/v1/admin/orders/ord-1'), env, async () => new Response('{}'));
    const detailBody = await detail.json() as { data: { customer?: { username?: string } } };
    expect(detailBody.data.customer?.username).toBe('shopper');

    const missing = await tryNativeAdminOrders(request('/api/v1/admin/orders/nope'), env, async () => new Response('{}'));
    expect(missing.status).toBe(404);
  });

  it('records a manual shipment, marks the order SHIPPED, and notifies the customer', async () => {
    const env = fakeEnv(
      [{ id: 'ord-ship-1', user_id: 'u-1', payload: nativeCheckoutPayload('ord-ship-1', 'u-1', 'shopper@jiffoo.test'), source_updated_at: '2026-10-01T00:00:00Z' }],
      [{ id: 'u-1', email: 'shopper@jiffoo.test', username: 'shopper', avatar: null }],
    );
    const response = await tryNativeAdminOrders(
      shipRequest('/api/v1/admin/orders/ord-ship-1/ship', { carrier: '顺丰速运', trackingNumber: 'SF1234567890', scope: 'domestic' }),
      env,
      async () => new Response('{}'),
    );
    expect(response?.status).toBe(200);
    const body = await response.json() as { data: { status: string; shipments: Array<{ trackingNumber: string; status: string }> } };
    expect(body.data.status).toBe('SHIPPED');
    expect(env.batched.some((sql) => sql.includes('UPDATE native_order_snapshots SET status'))).toBe(true);
    expect(env.batched.some((sql) => sql.includes('INSERT INTO native_bokmoo_notifications'))).toBe(true);
  });

  it('rejects a shipment without carrier or tracking number', async () => {
    const env = fakeEnv(
      [{ id: 'ord-ship-2', user_id: 'u-1', payload: nativeCheckoutPayload('ord-ship-2', 'u-1', 'shopper@jiffoo.test'), source_updated_at: '2026-10-01T00:00:00Z' }],
      [],
    );
    const response = await tryNativeAdminOrders(
      shipRequest('/api/v1/admin/orders/ord-ship-2/ship', { carrier: '' }),
      env,
      async () => new Response('{}'),
    );
    expect(response?.status).toBe(400);
    const body = await response.json() as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('requires admin authentication', async () => {
    authenticateNativeAdmin.mockResolvedValue(null);
    const env = fakeEnv([], []);
    const response = await tryNativeAdminOrders(request('/api/v1/admin/orders'), env, async () => new Response('{}'));
    expect(response.status).toBe(401);
  });
});
