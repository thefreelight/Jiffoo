import { afterEach, describe, expect, it, vi } from 'vitest';

const authenticateNativeAdmin = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeAdmin }));

const {
  tryNativeAdminDashboard,
  buildSalesAnalytics,
  percentChange,
  utcDayStart,
  mainCurrency,
  PERIOD_DAYS,
  SERIES_DAYS,
} = await import('./admin-dashboard');

afterEach(() => vi.unstubAllGlobals());

const NOW = new Date('2026-11-28T10:30:00Z');
const daysAgo = (days: number) => new Date(new Date('2026-11-28T12:00:00Z').getTime() - days * 86_400_000).toISOString().slice(0, 10);
const row = (days: number, currency: string, orders: number, revenue: number) => ({ day: daysAgo(days), currency, orders, revenue });

/** Answers by the shape of the statement, the way the endpoint uses it. */
function fakeDb(answers: Record<string, unknown>) {
  const prepare = (sql: string) => {
    const answer = (args: unknown[]) => {
      const pick = (keys: string[]) => keys.find((key) => sql.includes(key));
      const key = pick(['FROM native_admin_memberships WHERE user_id', 'AND substr(migrated_at, 1, 10) >= ?1 AND', 'substr(migrated_at, 1, 10) >= ?1', 'FROM native_users', 'SELECT COUNT(*) AS count FROM native_order_snapshots', 'core_api_snapshots', 'GROUP BY day, currency', 'json_each', 'GROUP BY currency', 'GROUP BY status', 'LEFT JOIN native_users']);
      if (!key) throw new Error(`fakeDb: unhandled SQL: ${sql.slice(0, 80)}`);
      const value = answers[key];
      if (value === undefined) throw new Error(`fakeDb: no answer for ${key}`);
      return typeof value === 'function' ? (value as (a: unknown[]) => unknown)(args) : value;
    };
    const statement = (args: unknown[]) => ({
      first: async () => {
        const value = answer(args) as { first?: unknown } | undefined;
        return value && typeof value === 'object' && 'first' in value ? value.first : null;
      },
      all: async () => {
        const value = answer(args) as { all?: unknown[] } | undefined;
        return { results: value && typeof value === 'object' && 'all' in value ? value.all : [] };
      },
      run: async () => ({}),
    });
    return { ...statement([]), bind: (...args: unknown[]) => statement(args) };
  };
  return { prepare };
}

const dashboardCall = (db: unknown) =>
  tryNativeAdminDashboard(new Request('https://api.example/api/v1/admin/dashboard'), { DB: db } as never);

describe('admin dashboard figures', () => {
  it('works the two periods and the daily series out of the per-day rows', () => {
    vi.useFakeTimers({ now: NOW });
    try {
      const { series, period } = buildSalesAnalytics([
        row(0, 'USD', 2, 120),
        row(0, 'EUR', 1, 30),
        row(3, 'USD', 1, 50),
        row(40, 'USD', 1, 200),
        row(400, 'USD', 1, 10),
        // Outside the chart window: a back-dated order must not be drawn.
        row(800, 'USD', 1, 999),
      ], NOW, { current: 1, previous: 1 });
      expect(period).toEqual({
        days: PERIOD_DAYS, currency: 'USD',
        revenue: { current: 170, previous: 200 },
        orders: { current: 4, previous: 1 },
        newCustomers: { current: 1, previous: 1 },
      });
      expect(series).toHaveLength(SERIES_DAYS);
      // The last day: dollars only for revenue, every order for the count.
      expect(series[SERIES_DAYS - 1]).toEqual({ day: '2026-11-28', revenue: 120, orders: 3 });
      expect(series[SERIES_DAYS - 4]).toEqual({ day: '2026-11-25', revenue: 50, orders: 1 });
      expect(series[SERIES_DAYS - 2]).toEqual({ day: '2026-11-27', revenue: 0, orders: 0 });
      expect(series.some((point) => point.revenue === 999)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps to whole UTC days and compares only against an earlier figure', () => {
    expect(utcDayStart(new Date('2026-11-28T23:59:59Z')).toISOString()).toBe('2026-11-28T00:00:00.000Z');
    expect(utcDayStart(new Date('2026-12-01T00:00:01Z')).toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(80, 100)).toBe(-20);
    expect(percentChange(5, 0)).toBeUndefined();
  });

  it('falls back to the platform currency when nothing has been sold in any', () => {
    expect(mainCurrency([{ currency: 'EUR', revenue: 5 }, { currency: 'USD', revenue: 9 }, { currency: null, revenue: 99 }])).toBe('USD');
    expect(mainCurrency([])).toBe('USD');
  });

  it('serves the figures next to the counts it already gave', async () => {
    vi.useFakeTimers({ now: NOW });
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    try {
      const db = fakeDb({
        'FROM native_admin_memberships WHERE user_id': { first: { role: 'OWNER', status: 'ACTIVE', is_owner: 1, extra_permissions: '[]', revoked_permissions: '[]' } },
        'AND substr(migrated_at, 1, 10) >= ?1 AND': { first: { count: 2 } },
        'substr(migrated_at, 1, 10) >= ?1': { first: { count: 7 } },
        'FROM native_users': { first: { count: 90 } },
        'SELECT COUNT(*) AS count FROM native_order_snapshots': { first: { count: 210 } },
        core_api_snapshots: { first: { payload: JSON.stringify({ data: { items: [{}, {}] } }) } },
        'GROUP BY day, currency': { all: [row(1, 'USD', 1, 40), row(35, 'USD', 2, 80)] },
        json_each: { all: [
          { productId: 'p1', name: 'Japan 5GB', sold: 3, previousSold: 1 },
          { productId: 'p2', name: 'Never sold', sold: 0, previousSold: 0 },
        ] },
        'GROUP BY currency': { all: [{ currency: 'USD', revenue: 500 }, { currency: 'EUR', revenue: 20 }] },
        'GROUP BY status': { all: [{ status: 'PAID', n: 4 }, { status: 'PENDING', n: 1 }] },
        'LEFT JOIN native_users': { all: [
          { payload: JSON.stringify({ id: 'ord_1', status: 'PAID', items: [{ productName: 'Japan 5GB' }] }), email: 'one@example.test', username: 'one' },
          { payload: '{not json', email: null, username: null },
        ] },
      });

      const response = await dashboardCall(db);
      expect(response?.status).toBe(200);
      const body = (await response?.json()) as { data: Record<string, any> };
      expect(body.data.metrics).toMatchObject({ totalRevenue: 500, currency: 'USD', totalOrders: 210, totalUsers: 90, totalProducts: 2 });
      expect(body.data.ordersByStatus).toEqual({ PAID: 4, PENDING: 1 });
      expect(body.data.period).toMatchObject({ currency: 'USD', revenue: { current: 40, previous: 80 }, orders: { current: 1, previous: 2 }, newCustomers: { current: 7, previous: 2 } });
      expect(body.data.series).toHaveLength(SERIES_DAYS);
      // Only products that actually sold are listed.
      expect(body.data.topProducts).toEqual([{ productId: 'p1', name: 'Japan 5GB', sold: 3, previousSold: 1 }]);
      // The newest order with who placed it; the unreadable row is left out.
      expect(body.data.recentOrders).toEqual([{ id: 'ord_1', status: 'PAID', items: [{ productName: 'Japan 5GB' }], customer: { email: 'one@example.test', username: 'one' } }]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('still refuses without the dashboard permission', async () => {
    const gate = await import('./admin-access');
    vi.spyOn(gate, 'requireAdminPermission').mockResolvedValueOnce({ ok: false, response: new Response('no', { status: 403 }) } as never);
    const response = await dashboardCall(fakeDb({}));
    expect(response?.status).toBe(403);
  });
});
