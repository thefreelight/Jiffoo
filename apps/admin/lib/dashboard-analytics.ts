/**
 * Figures the dashboard draws, worked out from what the core reports. Nothing
 * here invents a value: where the data does not reach, the answer is "none".
 */

import type { DashboardData } from './api';

export type TrendRange = '7d' | '30d' | '90d' | '1y';

export interface TrendPoint {
  /** The day, or the first and last day of a weekly bucket. */
  date: string
  label: string
  current: number
  previous: number
}

const DAY_MS = 86_400_000
const RANGE_DAYS: Record<TrendRange, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }
/** A year on the chart is one bar per week; the shorter ranges one per day. */
const BUCKET_DAYS: Record<TrendRange, number> = { '7d': 1, '30d': 1, '90d': 1, '1y': 7 }

function dayIndex(day: string): number {
  return Math.floor(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / DAY_MS)
}

function dayKey(index: number): string {
  return new Date(index * DAY_MS).toISOString().slice(0, 10)
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * The chart's points for a range, oldest first: each bucket beside the same
 * days one range earlier. The series is per UTC day; days it does not mention
 * had no sales.
 */
export function trendPoints(
  series: Array<{ day: string; revenue: number }>,
  range: TrendRange,
  today: Date = new Date(),
): TrendPoint[] {
  if (series.length === 0) return []
  const days = RANGE_DAYS[range]
  const bucket = BUCKET_DAYS[range]
  const revenueOn = new Map(series.map((point) => [point.day, point.revenue]))
  const sum = (from: number, to: number) => {
    let total = 0
    for (let index = from; index <= to; index += 1) total += revenueOn.get(dayKey(index)) ?? 0
    return total
  }
  // Whole buckets only: a year is fifty-two weeks, not fifty-two and a sixth.
  const todayIndex = dayIndex(`${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`)
  const points: TrendPoint[] = []
  for (let step = Math.floor(days / bucket) - 1; step >= 0; step -= 1) {
    const to = todayIndex - step * bucket
    const from = to - bucket + 1
    const first = dayKey(from)
    const last = dayKey(to)
    points.push({
      date: bucket === 1 ? first : `${first} – ${last}`,
      label: `${Number(first.slice(5, 7))}/${Number(first.slice(8, 10))}`,
      current: round2(sum(from, to)),
      previous: round2(sum(from - days, to - days)),
    })
  }
  return points
}

/** The last `days` daily figures, for the small line under a headline number. */
export function sparkline(series: Array<{ revenue: number; orders: number }>, field: 'revenue' | 'orders', days: number): number[] {
  return series.slice(-days).map((point) => point[field])
}

/** Change from the earlier figure to the later one in percent; null when there is no earlier figure. */
export function percentChange(current: number, previous: number): number | null {
  if (!previous) return null
  return ((current - previous) / previous) * 100
}

/** Order statuses in the order a merchant works through them. */
export const ORDER_STATUSES = ['PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED'] as const

export function ordersByStatusRows(byStatus: Record<string, number> | undefined): Array<{ status: string; count: number }> {
  if (!byStatus) return []
  const known = ORDER_STATUSES.filter((status) => (byStatus[status] ?? 0) > 0).map((status) => ({ status, count: byStatus[status] }))
  // A status this admin does not know still belongs on the chart.
  const other = Object.keys(byStatus)
    .filter((status) => !(ORDER_STATUSES as readonly string[]).includes(status) && byStatus[status] > 0)
    .sort()
    .map((status) => ({ status, count: byStatus[status] }))
  return [...known, ...other]
}

export interface CardFigure {
  value: number
  change: number | null
}

/**
 * The figures the overview cards show, and what they are compared with.
 *
 * With a reported period the cards show that period. A core that reports
 * totals only (the self-hosted line, a core from before the period existed)
 * keeps its totals on the cards, as totals: `periodBased` tells the page which
 * label to use. A figure the core does not report is undefined, never a guess.
 */
export function overviewFigures(data: DashboardData | undefined, lowStock: number | undefined): {
  periodBased: boolean
  revenue: (CardFigure & { currency: string }) | undefined
  orders: CardFigure | undefined
  newCustomers: CardFigure | undefined
  lowStock: CardFigure | undefined
} {
  const period = data?.period
  if (period) {
    return {
      periodBased: true,
      revenue: { value: period.revenue.current, currency: period.currency, change: percentChange(period.revenue.current, period.revenue.previous) },
      orders: { value: period.orders.current, change: percentChange(period.orders.current, period.orders.previous) },
      newCustomers: { value: period.newCustomers.current, change: percentChange(period.newCustomers.current, period.newCustomers.previous) },
      // The core gives a count, nothing to compare it with.
      lowStock: typeof lowStock === 'number' ? { value: lowStock, change: null } : undefined,
    }
  }
  const metrics = data?.metrics
  // A trend reported as exactly zero cannot be told from a core's placeholder, so it is not shown as one.
  const total = (value: number | undefined, trend: number | undefined): CardFigure | undefined =>
    typeof value === 'number' ? { value, change: typeof trend === 'number' && trend !== 0 ? trend : null } : undefined
  return {
    periodBased: false,
    revenue: metrics ? { ...(total(metrics.totalRevenue, metrics.totalRevenueTrend) ?? { value: 0, change: null }), currency: metrics.currency } : undefined,
    orders: total(metrics?.totalOrders, metrics?.totalOrdersTrend),
    newCustomers: total(metrics?.totalUsers, metrics?.totalUsersTrend),
    lowStock: typeof lowStock === 'number' ? { value: lowStock, change: null } : undefined,
  }
}
