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
    bind: (...args: unknown[]) => ({
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
        if (sql.includes('FROM native_order_snapshots') && sql.includes('ORDER BY source_updated_at')) {
          return { results: orders.map((order) => ({ payload: order.payload })) };
        }
        if (sql.includes('FROM native_users WHERE id IN')) {
          return { results: users.filter((user) => (args as string[]).includes(user.id)) };
        }
        if (sql.includes('FROM native_shipments WHERE')) return { results: [] };
        if (sql.includes('FROM native_shipment_events WHERE')) return { results: [] };
        return { results: [] };
      },
    }),
  });
  return { DB: { prepare } } as unknown as Parameters<typeof tryNativeAdminOrders>[1];
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

  it('requires admin authentication', async () => {
    authenticateNativeAdmin.mockResolvedValue(null);
    const env = fakeEnv([], []);
    const response = await tryNativeAdminOrders(request('/api/v1/admin/orders'), env, async () => new Response('{}'));
    expect(response.status).toBe(401);
  });
});
