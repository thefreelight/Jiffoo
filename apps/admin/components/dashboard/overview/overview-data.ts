/**
 * Demo / fallback data for the redesigned dashboard overview.
 *
 * The overview visual design ships with a fully-populated reference layout.
 * Real API data (metrics, recent orders, product stats, health) overrides the
 * fallbacks wherever an endpoint provides it; the shapes below keep the page
 * complete on fresh instances so operators always see the target layout.
 */

export interface TrendPoint {
  date: string
  label: string
  current: number
  previous: number
}

export interface OrderSourceSlice {
  key: string
  labelKey: string
  labelFallback: string
  value: number
  color: string
}

export interface TopProductRow {
  rank: number
  name: string
  sold: number
  trend: number
  art: string
  icon: 'shirt' | 'sneaker' | 'cap' | 'pants' | 'backpack'
}

export interface RecentOrderRow {
  code: string
  customer: string
  items: { art: string; icon: 'shirt' | 'sneaker' | 'cap' | 'pants' | 'backpack' }[]
  extraItems: number
  amount: number
  currency: string
  status: 'completed' | 'processing' | 'unshipped'
  time: string
}

/** Deterministic pseudo-random generator so charts look organic but stable. */
function seededSeries(count: number, seed: number, min: number, max: number): number[] {
  const values: number[] = []
  let state = seed
  for (let i = 0; i < count; i += 1) {
    state = (state * 9301 + 49297) % 233280
    const normalized = state / 233280
    values.push(Math.round(min + normalized * (max - min)))
  }
  return values
}

function buildSeries(days: number, totalCurrent: number, totalPrevious: number): TrendPoint[] {
  const currentRaw = seededSeries(days, 7, 30, 100)
  const previousRaw = seededSeries(days, 13, 25, 85)
  const currentSum = currentRaw.reduce((sum, value) => sum + value, 0) || 1
  const previousSum = previousRaw.reduce((sum, value) => sum + value, 0) || 1

  const points: TrendPoint[] = []
  const today = new Date()
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    const index = days - 1 - i
    points.push({
      date: `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`,
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      current: Math.round((currentRaw[index] / currentSum) * totalCurrent),
      previous: Math.round((previousRaw[index] / previousSum) * totalPrevious),
    })
  }
  return points
}

const PERIOD_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
}

export function buildTrendSeries(period: string, totalCurrent: number, totalPrevious: number): TrendPoint[] {
  const days = PERIOD_DAYS[period] ?? 30
  if (days > 120) {
    // Weekly buckets keep long ranges readable.
    const weeks = 52
    return buildSeries(weeks, totalCurrent, totalPrevious).map((point, index) => {
      const date = new Date()
      date.setDate(date.getDate() - (weeks - 1 - index) * 7)
      return { ...point, label: `${date.getMonth() + 1}/${date.getDate()}` }
    })
  }
  return buildSeries(days, totalCurrent, totalPrevious)
}

export const DEMO_TREND_TOTALS = { current: 8736.12, previous: 7762.41 }

export const DEMO_ORDER_SOURCES: OrderSourceSlice[] = [
  { key: 'online-store', labelKey: 'merchant.dashboard.overview.onlineStore', labelFallback: 'Online Store', value: 72, color: '#3B82F6' },
  { key: 'bokmoo-connect', labelKey: 'merchant.dashboard.overview.bokmooConnect', labelFallback: 'BOKMOO Connect', value: 36, color: '#8B5CF6' },
  { key: 'odoo', labelKey: 'merchant.dashboard.overview.odoo', labelFallback: 'Odoo', value: 18, color: '#38BDF8' },
  { key: 'offline', labelKey: 'merchant.dashboard.overview.offline', labelFallback: '线下订单', value: 15, color: '#F97316' },
  { key: 'other', labelKey: 'merchant.dashboard.overview.other', labelFallback: '其他', value: 15, color: '#14B8A6' },
]

export const DEMO_TOP_PRODUCTS: TopProductRow[] = [
  { rank: 1, name: '基础款T恤', sold: 320, trend: 12.5, art: 'from-slate-600 to-slate-800', icon: 'shirt' },
  { rank: 2, name: '运动鞋', sold: 286, trend: 8.3, art: 'from-orange-200 to-orange-300', icon: 'sneaker' },
  { rank: 3, name: '棒球帽', sold: 243, trend: 24.8, art: 'from-stone-500 to-stone-700', icon: 'cap' },
  { rank: 4, name: '休闲裤', sold: 190, trend: -6.1, art: 'from-slate-400 to-slate-600', icon: 'pants' },
  { rank: 5, name: '背包', sold: 178, trend: 15.2, art: 'from-neutral-500 to-neutral-700', icon: 'backpack' },
]

export const DEMO_RECENT_ORDERS: RecentOrderRow[] = [
  { code: '#1008', customer: '张三', items: [{ art: 'from-slate-600 to-slate-800', icon: 'shirt' }, { art: 'from-stone-500 to-stone-700', icon: 'cap' }], extraItems: 2, amount: 129, currency: 'USD', status: 'completed', time: '2h' },
  { code: '#1007', customer: '李四', items: [{ art: 'from-orange-200 to-orange-300', icon: 'sneaker' }, { art: 'from-red-400 to-red-500', icon: 'shirt' }], extraItems: 1, amount: 89, currency: 'USD', status: 'processing', time: '3h' },
  { code: '#1006', customer: '王五', items: [{ art: 'from-slate-700 to-slate-900', icon: 'shirt' }, { art: 'from-gray-100 to-gray-200', icon: 'shirt' }], extraItems: 0, amount: 59, currency: 'USD', status: 'completed', time: '5h' },
  { code: '#1005', customer: '赵六', items: [{ art: 'from-gray-100 to-gray-200', icon: 'shirt' }, { art: 'from-slate-300 to-slate-400', icon: 'shirt' }], extraItems: 3, amount: 199, currency: 'USD', status: 'unshipped', time: '1d' },
  { code: '#1004', customer: '陈七', items: [{ art: 'from-stone-500 to-stone-700', icon: 'cap' }, { art: 'from-neutral-500 to-neutral-700', icon: 'backpack' }], extraItems: 0, amount: 39, currency: 'USD', status: 'completed', time: '1d' },
]

export const DEMO_SPARKLINES = {
  revenue: [32, 40, 35, 48, 42, 55, 50, 62, 58, 70],
  orders: [28, 34, 30, 42, 38, 45, 41, 52, 48, 58],
  customers: [22, 30, 26, 38, 34, 46, 42, 55, 50, 64],
  lowStock: [58, 52, 55, 48, 50, 44, 46, 40, 42, 36],
}

export function formatRelativeHours(hours: number, locale: string): string {
  if (locale.startsWith('zh')) {
    if (hours < 1) return '1小时内'
    if (hours < 24) return `${Math.round(hours)}小时前`
    return `${Math.round(hours / 24)}天前`
  }
  if (hours < 1) return 'within an hour'
  if (hours < 24) return `${Math.round(hours)}h ago`
  return `${Math.round(hours / 24)}d ago`
}
