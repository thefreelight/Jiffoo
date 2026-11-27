/**
 * Dashboard Page for Tenant Application
 *
 * Overview: welcome banner, four figures for the last thirty days with the
 * change against the thirty days before, the sales trend, orders by status,
 * the newest orders, the best sellers, system status and quick actions.
 *
 * Every number on the page is worked out by the core from the store's own
 * data. Nothing stands in for a missing figure: such a place shows "—" or
 * says that there is nothing there yet.
 */

'use client'

import { useMemo } from 'react'
import { AlertTriangle, ClipboardList, ShoppingBag, Users } from 'lucide-react'
import { WelcomeBanner } from '@/components/dashboard/overview/welcome-banner'
import { OverviewStatCard } from '@/components/dashboard/overview/stat-cards'
import { SalesTrendCard } from '@/components/dashboard/overview/sales-trend-card'
import { OrdersByStatusCard } from '@/components/dashboard/overview/orders-by-status-card'
import { RecentOrdersCard, type RecentOrderRow } from '@/components/dashboard/overview/recent-orders-card'
import { TopProductsCard, type TopProductRow } from '@/components/dashboard/overview/top-products-card'
import { SystemStatusCard } from '@/components/dashboard/overview/system-status-card'
import { QuickActionsCard } from '@/components/dashboard/overview/quick-actions-card'
import { PlatformOffersCards } from '@/components/dashboard/PlatformOffersCards'
import { formatCurrency } from '@/lib/utils'
import { useAdminDashboard, useProductStats, useHealthSummary } from '@/lib/hooks/use-api'
import { useT, useLocale } from 'shared/src/i18n/react'
import { LoadingState } from '@/components/ui/state-components'
import { overviewFigures, percentChange, sparkline } from '@/lib/dashboard-analytics'
import { formatRelativeTime } from '@/lib/support-inbox'

/** What the dashboard reads off a recent order; the payload is the order as the core stores it. */
interface RecentOrder {
  id?: unknown
  status?: unknown
  totalAmount?: unknown
  currency?: unknown
  createdAt?: unknown
  itemsCount?: unknown
  items?: Array<{ productName?: unknown }> | null
  customer?: { username?: unknown; email?: unknown } | null
}

const text = (value: unknown): string => (typeof value === 'string' && value ? value : '')

/** Shown where the core reports no figure. */
const NONE = '—'

export default function DashboardPage() {
  const t = useT()
  const locale = useLocale()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const { data, isLoading, error, refetch } = useAdminDashboard()
  const { data: productStats } = useProductStats()
  const { data: healthSummary } = useHealthSummary()

  const series = data?.series ?? []
  const currency = data?.period?.currency ?? data?.metrics?.currency
  const figures = overviewFigures(data, productStats?.metrics?.lowStockProducts)
  const comparisonLabel = getText('merchant.dashboard.overview.vsLastMonth', '较上月同期')
  // A period is labelled as one; a core's running totals keep their plainer names.
  const cardLabels = figures.periodBased
    ? {
        revenue: getText('merchant.dashboard.overview.salesLast30d', '近 30 天销售额'),
        orders: getText('merchant.dashboard.overview.ordersLast30d', '近 30 天订单'),
        newCustomers: getText('merchant.dashboard.overview.newCustomersLast30d', '近 30 天新顾客'),
      }
    : {
        revenue: getText('merchant.dashboard.overview.totalSales', '总销售额'),
        orders: getText('merchant.dashboard.overview.ordersCount', '订单数'),
        newCustomers: getText('merchant.dashboard.overview.newCustomers', '新顾客'),
      }

  const recentOrderRows = useMemo<RecentOrderRow[]>(() => {
    return (data?.recentOrders ?? []).slice(0, 5).map((entry) => {
      const order = entry as unknown as RecentOrder
      const items = Array.isArray(order.items) ? order.items : []
      const product = text(items.map((item) => item?.productName).find(Boolean))
      const placed = text(order.createdAt)
      return {
        id: text(order.id),
        code: `#${text(order.id).slice(0, 8)}`,
        customer: text(order.customer?.username) || text(order.customer?.email) || '--',
        product: product || '--',
        extraItems: Math.max((items.length || Number(order.itemsCount) || 1) - (product ? 1 : 0), 0),
        amount: Number(order.totalAmount ?? 0),
        currency: text(order.currency) || currency || 'USD',
        status: text(order.status),
        time: placed ? formatRelativeTime(placed, locale) : '',
      }
    })
  }, [data, currency, locale])

  const topProductRows: TopProductRow[] = (data?.topProducts ?? []).map((product) => ({
    name: product.name,
    sold: product.sold,
    trend: percentChange(product.sold, product.previousSold),
  }))

  // Hooks and the figures they feed come before any early return, so their order never changes between renders.
  if (isLoading) {
    return (
      <LoadingState
        type="spinner"
        message={getText('merchant.dashboard.loading', 'Loading dashboard...')}
        fullPage
      />
    )
  }

  if (error) {
    // The page stays usable: every figure simply reads as unknown until the next attempt.
    console.error('[dashboard] overview data unavailable:', error)
  }

  const status = healthSummary?.status

  return (
    <div className="w-full min-h-screen bg-[#f5f7fb]">
      <div className="mx-auto w-full max-w-[1600px] space-y-5 px-4 py-5 sm:px-6">
        <WelcomeBanner />

        {error ? (
          <div
            data-testid="dashboard-error"
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-5 py-3 text-sm text-amber-800"
          >
            <span>{getText('merchant.dashboard.overview.loadFailed', '概览数据取不到，下面的数字暂不可用')}</span>
            <button
              type="button"
              onClick={() => void refetch()}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 shadow-sm transition-colors hover:bg-amber-100"
            >
              {getText('merchant.dashboard.overview.retry', '重试')}
            </button>
          </div>
        ) : null}

        {/* Stat cards: the last thirty days against the thirty days before */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <OverviewStatCard
            testId="stat-revenue"
            label={cardLabels.revenue}
            value={figures.revenue ? formatCurrency(figures.revenue.value, figures.revenue.currency) : NONE}
            change={figures.revenue?.change ?? null}
            comparisonLabel={comparisonLabel}
            icon={ShoppingBag}
            tone="blue"
            sparkline={sparkline(series, 'revenue', 30)}
            sparkGradientId="sparkBlue"
          />
          <OverviewStatCard
            testId="stat-orders"
            label={cardLabels.orders}
            value={figures.orders ? figures.orders.value.toLocaleString() : NONE}
            change={figures.orders?.change ?? null}
            comparisonLabel={comparisonLabel}
            icon={ClipboardList}
            tone="green"
            sparkline={sparkline(series, 'orders', 30)}
            sparkGradientId="sparkGreen"
          />
          <OverviewStatCard
            testId="stat-customers"
            label={cardLabels.newCustomers}
            value={figures.newCustomers ? figures.newCustomers.value.toLocaleString() : NONE}
            change={figures.newCustomers?.change ?? null}
            comparisonLabel={comparisonLabel}
            icon={Users}
            tone="purple"
            sparkGradientId="sparkPurple"
          />
          <OverviewStatCard
            testId="stat-low-stock"
            label={getText('merchant.dashboard.overview.lowStockProducts', '低库存商品')}
            value={figures.lowStock ? figures.lowStock.value.toLocaleString() : NONE}
            change={figures.lowStock?.change ?? null}
            comparisonLabel={comparisonLabel}
            icon={AlertTriangle}
            tone="orange"
            sparkGradientId="sparkOrange"
          />
        </div>

        {/* Trend + orders by status */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <SalesTrendCard series={series} currency={currency} />
          </div>
          <OrdersByStatusCard byStatus={data?.ordersByStatus} />
        </div>

        {/* Orders / products / status column */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="xl:col-span-5">
            <RecentOrdersCard rows={recentOrderRows} />
          </div>
          <div className="xl:col-span-4">
            <TopProductsCard rows={topProductRows} />
          </div>
          <div className="flex flex-col gap-4 xl:col-span-3">
            <SystemStatusCard status={status} />
            <QuickActionsCard />
          </div>
        </div>

        {/* Platform Offers (rendered only when offers exist) */}
        <PlatformOffersCards />
      </div>
    </div>
  )
}
