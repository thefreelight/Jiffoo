import { type NativeAuthEnv } from './auth';
import { ADMIN_PERMISSIONS } from './native-rbac';
import { requireAdminPermission } from './admin-access';

type DashboardEnv = NativeAuthEnv & { DB: D1Database };

/**
 * An order counts toward sales once it is paid, up to a refund or a
 * cancellation. Unpaid checkouts are orders, but not sales.
 */
export const PAID_ORDER_STATUSES = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED'] as const;
const PAID_SQL = PAID_ORDER_STATUSES.map((status) => `'${status}'`).join(', ');

/** One period of the overview figures and of the best sellers. */
export const PERIOD_DAYS = 30;
/** Days of daily figures the chart works from: a year, and the year before it to compare against. */
export const SERIES_DAYS = 730;

export interface DailySalesRow {
  day: string | null;
  currency: string | null;
  orders: number | null;
  revenue: number | null;
}

export interface SalesSeriesPoint {
  /** UTC calendar day, `YYYY-MM-DD`. */
  day: string;
  revenue: number;
  orders: number;
}

export interface DashboardPeriod {
  days: number;
  /** The currency most paid revenue came in over the chart window. */
  currency: string;
  revenue: { current: number; previous: number };
  orders: { current: number; previous: number };
  newCustomers: { current: number; previous: number };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight UTC on the day that holds `now`. */
export function utcDayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function shiftDays(day: Date, days: number): Date {
  return new Date(day.getTime() + days * DAY_MS);
}

function dayKey(day: Date): string {
  return day.toISOString().slice(0, 10);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Change from the earlier figure to the later one in percent; undefined when there is no earlier figure. */
export function percentChange(current: number, previous: number): number | undefined {
  if (!previous) return undefined;
  return ((current - previous) / previous) * 100;
}

/**
 * Turns the per-day, per-currency rows the database returns into the daily
 * series and the two-period figures the overview shows. Orders count in any
 * currency; revenue is summed and compared in the store's main currency only.
 */
export function buildSalesAnalytics(
  rows: DailySalesRow[],
  now: Date,
  newCustomers: { current: number; previous: number },
): { series: SalesSeriesPoint[]; period: DashboardPeriod } {
  const today = utcDayStart(now);
  const firstDay = shiftDays(today, -(SERIES_DAYS - 1));
  const currentStart = dayKey(shiftDays(today, -PERIOD_DAYS));
  const previousStart = dayKey(shiftDays(today, -2 * PERIOD_DAYS));
  const lastDay = dayKey(today);

  const byDay = new Map<string, { orders: number; revenue: Map<string, number> }>();
  const revenueByCurrency = new Map<string, number>();
  for (const row of rows) {
    // Rows outside the window (a clock skew, an order back-dated) are not drawn.
    if (!row.day || row.day < dayKey(firstDay) || row.day > lastDay) continue;
    let entry = byDay.get(row.day);
    if (!entry) {
      entry = { orders: 0, revenue: new Map() };
      byDay.set(row.day, entry);
    }
    const revenue = Number(row.revenue ?? 0);
    entry.orders += Number(row.orders ?? 0);
    const currency = row.currency || '';
    entry.revenue.set(currency, (entry.revenue.get(currency) ?? 0) + revenue);
    revenueByCurrency.set(currency, (revenueByCurrency.get(currency) ?? 0) + revenue);
  }

  let currency = 'USD';
  let best = -1;
  for (const [code, revenue] of revenueByCurrency) {
    if (code && revenue > best) {
      best = revenue;
      currency = code;
    }
  }

  const series: SalesSeriesPoint[] = [];
  let revenueCurrent = 0;
  let revenuePrevious = 0;
  let ordersCurrent = 0;
  let ordersPrevious = 0;
  for (let index = 0; index < SERIES_DAYS; index += 1) {
    const key = dayKey(shiftDays(firstDay, index));
    const entry = byDay.get(key);
    const revenue = entry?.revenue.get(currency) ?? 0;
    series.push({ day: key, revenue: round2(revenue), orders: entry?.orders ?? 0 });
    if (key >= currentStart) {
      revenueCurrent += revenue;
      ordersCurrent += entry?.orders ?? 0;
    } else if (key >= previousStart) {
      revenuePrevious += revenue;
      ordersPrevious += entry?.orders ?? 0;
    }
  }

  return {
    series,
    period: {
      days: PERIOD_DAYS,
      currency,
      revenue: { current: round2(revenueCurrent), previous: round2(revenuePrevious) },
      orders: { current: ordersCurrent, previous: ordersPrevious },
      newCustomers,
    },
  };
}

/** Which currency holds the most paid revenue; the platform default when nothing has been sold. */
export function mainCurrency(rows: Array<{ currency: string | null; revenue: number | null }>): string {
  let currency = 'USD';
  let best = -1;
  for (const row of rows) {
    const revenue = Number(row.revenue ?? 0);
    if (row.currency && revenue > best) {
      best = revenue;
      currency = row.currency;
    }
  }
  return currency;
}

export async function tryNativeAdminDashboard(request: Request, env: DashboardEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.pathname !== '/api/v1/admin/dashboard') return null;
  const dashboardGate = await requireAdminPermission(request, env, ADMIN_PERMISSIONS.DASHBOARD_READ);
  if (!dashboardGate.ok) return dashboardGate.response;

  const now = new Date();
  const today = utcDayStart(now);
  const seriesStart = shiftDays(today, -(SERIES_DAYS - 1)).toISOString();
  const previousStart = shiftDays(today, -2 * PERIOD_DAYS);
  const currentStart = shiftDays(today, -PERIOD_DAYS);

  const [users, orders, products, daily, newCustomersNow, newCustomersBefore, bestSellers, allTimeRevenue, byStatusRows, recent] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS count FROM native_users WHERE role = 'USER'").first<{ count: number }>(),
    env.DB.prepare('SELECT COUNT(*) AS count FROM native_order_snapshots').first<{ count: number }>(),
    env.DB.prepare("SELECT payload FROM core_api_snapshots WHERE request_path = '/api/v1/products' LIMIT 1").first<{ payload: string }>(),
    // Paid orders per UTC day and currency, for the chart and the two periods.
    env.DB.prepare(
      `SELECT substr(json_extract(payload, '$.createdAt'), 1, 10) AS day,
              json_extract(payload, '$.currency') AS currency,
              COUNT(*) AS orders,
              SUM(json_extract(payload, '$.totalAmount')) AS revenue
       FROM native_order_snapshots
       WHERE status IN (${PAID_SQL}) AND json_valid(payload)
         AND json_extract(payload, '$.createdAt') >= ?1
       GROUP BY day, currency`,
    ).bind(seriesStart).all<DailySalesRow>(),
    env.DB.prepare(
      "SELECT COUNT(*) AS count FROM native_users WHERE role = 'USER' AND substr(migrated_at, 1, 10) >= ?1",
    ).bind(currentStart.toISOString().slice(0, 10)).first<{ count: number }>(),
    env.DB.prepare(
      "SELECT COUNT(*) AS count FROM native_users WHERE role = 'USER' AND substr(migrated_at, 1, 10) >= ?1 AND substr(migrated_at, 1, 10) < ?2",
    ).bind(previousStart.toISOString().slice(0, 10), currentStart.toISOString().slice(0, 10)).first<{ count: number }>(),
    // Units of each product in paid orders: the current period, and the one before it.
    env.DB.prepare(
      `SELECT json_extract(item.value, '$.productId') AS productId,
              json_extract(item.value, '$.productName') AS name,
              SUM(CASE WHEN o.created >= ?2 THEN COALESCE(json_extract(item.value, '$.quantity'), 0) ELSE 0 END) AS sold,
              SUM(CASE WHEN o.created < ?2 THEN COALESCE(json_extract(item.value, '$.quantity'), 0) ELSE 0 END) AS previousSold
       FROM (SELECT payload, json_extract(payload, '$.createdAt') AS created
             FROM native_order_snapshots
             WHERE status IN (${PAID_SQL}) AND json_valid(payload)
               AND json_extract(payload, '$.createdAt') >= ?1) AS o,
            json_each(o.payload, '$.items') AS item
       GROUP BY productId
       ORDER BY sold DESC, previousSold DESC, productId
       LIMIT 5`,
    ).bind(previousStart.toISOString(), currentStart.toISOString()).all<{
      productId: string | null; name: string | null; sold: number | null; previousSold: number | null;
    }>(),
    env.DB.prepare(
      `SELECT json_extract(payload, '$.currency') AS currency, SUM(json_extract(payload, '$.totalAmount')) AS revenue
       FROM native_order_snapshots
       WHERE status IN (${PAID_SQL}) AND json_valid(payload)
       GROUP BY currency`,
    ).all<{ currency: string | null; revenue: number | null }>(),
    env.DB.prepare('SELECT status, COUNT(*) AS n FROM native_order_snapshots GROUP BY status').all<{ status: string; n: number }>(),
    // The newest orders by the time they were placed, with who placed them.
    env.DB.prepare(
      `SELECT s.payload AS payload, u.email AS email, u.username AS username
       FROM native_order_snapshots s
       LEFT JOIN native_users u ON u.id = s.user_id
       WHERE json_valid(s.payload)
       ORDER BY json_extract(s.payload, '$.createdAt') DESC
       LIMIT 5`,
    ).all<{ payload: string; email: string | null; username: string | null }>(),
  ]);

  let productCount = 0;
  if (products?.payload) {
    try {
      const envelope = JSON.parse(products.payload) as { data?: unknown[] | { items?: unknown[] } };
      productCount = Array.isArray(envelope.data) ? envelope.data.length : Array.isArray(envelope.data?.items) ? envelope.data.items.length : 0;
    } catch { productCount = 0; }
  }
  const ordersByStatus: Record<string, number> = {};
  for (const row of byStatusRows.results) ordersByStatus[row.status] = Number(row.n);

  const revenueRows = allTimeRevenue.results;
  const mainRevenue = revenueRows.find((row) => row.currency === mainCurrency(revenueRows));
  const { series, period } = buildSalesAnalytics(daily.results, now, {
    current: Number(newCustomersNow?.count ?? 0),
    previous: Number(newCustomersBefore?.count ?? 0),
  });
  const topProducts = bestSellers.results.flatMap((row) => {
    const sold = Math.round(Number(row.sold ?? 0));
    const previousSold = Math.round(Number(row.previousSold ?? 0));
    // A product that sold nothing in either period only got here by a data quirk.
    if (sold + previousSold === 0) return [];
    return [{ productId: String(row.productId ?? ''), name: String(row.name ?? ''), sold, previousSold }];
  });
  const recentOrders = recent.results.flatMap((row) => {
    try {
      const order = JSON.parse(row.payload) as Record<string, unknown>;
      // Who placed it, for the list only; nothing else about the account leaves the database here.
      return [{ ...order, customer: { email: row.email, username: row.username } }];
    } catch {
      return [];
    }
  });

  return Response.json({ success: true, data: {
    metrics: {
      totalRevenue: round2(Number(mainRevenue?.revenue ?? 0)), totalOrders: Number(orders?.count ?? 0), totalProducts: productCount,
      totalUsers: Number(users?.count ?? 0), currency: mainCurrency(revenueRows), totalRevenueTrend: 0,
      totalOrdersTrend: 0, totalProductsTrend: 0, totalUsersTrend: 0,
    },
    ordersByStatus,
    recentOrders,
    period,
    series,
    topProducts,
  } }, { headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-dashboard' } });
}
