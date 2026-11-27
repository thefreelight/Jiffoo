import { describe, expect, it } from 'vitest'
import {
  ordersByStatusRows,
  overviewFigures,
  percentChange,
  sparkline,
  trendPoints,
  type TrendRange,
} from '../../lib/dashboard-analytics'
import type { DashboardData } from '../../lib/api'

const TODAY = new Date('2026-11-28T09:00:00Z')
const daysAgo = (days: number) => new Date(TODAY.getTime() - days * 86_400_000).toISOString().slice(0, 10)
const point = (days: number, revenue: number, orders = 1) => ({ day: daysAgo(days), revenue, orders })

describe('sales trend points', () => {
  it('gives each day its revenue beside the same day a range earlier, oldest first', () => {
    const points = trendPoints([point(0, 120), point(3, 50), point(10, 200)], '7d', TODAY)
    expect(points).toHaveLength(7)
    expect(points.map((entry) => entry.date)).toEqual(['2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28'])
    expect(points[3]).toEqual({ date: '2026-11-25', label: '11/25', current: 50, previous: 200 })
    expect(points[6]).toEqual({ date: '2026-11-28', label: '11/28', current: 120, previous: 0 })
    // A day with no sales is a zero, not a gap.
    expect(points[0]).toMatchObject({ current: 0, previous: 0 })
  })

  it('uses one point per day for the short ranges and one per week for a year', () => {
    const series = [point(0, 120), point(3, 50), point(400, 9)]
    expect(trendPoints(series, '30d', TODAY)).toHaveLength(30)
    expect(trendPoints(series, '90d', TODAY)).toHaveLength(90)
    const year = trendPoints(series, '1y', TODAY)
    expect(year).toHaveLength(52)
    // The newest week adds up its days; the same week last year is read from the series too.
    expect(year[51]).toMatchObject({ date: '2026-11-22 – 2026-11-28', current: 170, previous: 0 })
    expect(year.every((entry) => Number.isInteger(Date.parse(`${entry.date.slice(0, 10)}T00:00:00Z`)))).toBe(true)
  })

  it('draws nothing without a series', () => {
    expect(trendPoints([], '30d', TODAY)).toEqual([])
  })

  it('takes the last days for the small line under a number', () => {
    const series = [point(40, 1), point(2, 2), point(1, 3), point(0, 4)]
    expect(sparkline(series, 'revenue', 3)).toEqual([2, 3, 4])
    expect(sparkline(series, 'orders', 30)).toEqual([1, 1, 1, 1])
  })
})

describe('figures for the overview cards', () => {
  it('compares only against an earlier figure', () => {
    expect(percentChange(150, 100)).toBe(50)
    expect(percentChange(80, 100)).toBe(-20)
    expect(percentChange(5, 0)).toBeNull()
  })

  it('lists the statuses a merchant works through, then any other that has orders', () => {
    expect(ordersByStatusRows({ PAID: 4, PENDING: 2, REFUNDED: 0, COMPLETED: 7, HOLD: 1, AWAITING: 3 })).toEqual([
      { status: 'PENDING', count: 2 },
      { status: 'PAID', count: 4 },
      { status: 'COMPLETED', count: 7 },
      { status: 'AWAITING', count: 3 },
      { status: 'HOLD', count: 1 },
    ])
    expect(ordersByStatusRows(undefined)).toEqual([])
  })

  it('takes the figures from the reported period and leaves them out where none is reported', () => {
    const data = {
      period: {
        days: 30, currency: 'USD',
        revenue: { current: 170, previous: 200 },
        orders: { current: 4, previous: 1 },
        newCustomers: { current: 3, previous: 0 },
      },
    } as DashboardData
    expect(overviewFigures(data, 5)).toEqual({
      periodBased: true,
      revenue: { value: 170, currency: 'USD', change: -15 },
      orders: { value: 4, change: 300 },
      newCustomers: { value: 3, change: null },
      lowStock: { value: 5, change: null },
    })
    expect(overviewFigures({} as DashboardData, undefined)).toEqual({ periodBased: false, revenue: undefined, orders: undefined, newCustomers: undefined, lowStock: undefined })
  })

  it('keeps a running total on the cards when that is all the core reports, and never shows its placeholder zero as a trend', () => {
    const totalsOnly = {
      metrics: { totalRevenue: 1234.5, currency: 'EUR', totalOrders: 42, totalUsers: 90, totalRevenueTrend: 12, totalOrdersTrend: 0, totalUsersTrend: -3, totalProducts: 1, totalProductsTrend: 0 },
    } as DashboardData
    expect(overviewFigures(totalsOnly, undefined)).toEqual({
      periodBased: false,
      revenue: { value: 1234.5, currency: 'EUR', change: 12 },
      orders: { value: 42, change: null },
      newCustomers: { value: 90, change: -3 },
      lowStock: undefined,
    })
  })

  it('covers every range the chart offers', () => {
    const ranges: TrendRange[] = ['7d', '30d', '90d', '1y']
    expect(ranges.map((range) => trendPoints([point(0, 1)], range, TODAY).length)).toEqual([7, 30, 90, 52])
  })
})
