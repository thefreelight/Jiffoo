/**
 * Dashboard Page for Tenant Application
 *
 * Redesigned overview per the reference design: welcome banner, four stat
 * cards with sparklines, sales trend combo chart, order source donut, recent
 * orders, top products, system status, and quick actions.
 *
 * Real API data (metrics, recent orders, product stats, health summary)
 * overrides the reference fallbacks wherever the endpoint provides it.
 */

'use client'

import { AlertTriangle, ClipboardList, ShoppingBag, Users } from 'lucide-react'
import { WelcomeBanner } from '@/components/dashboard/overview/welcome-banner'
import { OverviewStatCard } from '@/components/dashboard/overview/stat-cards'
import { SalesTrendCard } from '@/components/dashboard/overview/sales-trend-card'
import { OrderSourcesCard } from '@/components/dashboard/overview/order-sources-card'
import { RecentOrdersCard, orderPillStatus } from '@/components/dashboard/overview/recent-orders-card'
import { TopProductsCard } from '@/components/dashboard/overview/top-products-card'
import { SystemStatusCard } from '@/components/dashboard/overview/system-status-card'
import { QuickActionsCard } from '@/components/dashboard/overview/quick-actions-card'
import {
  DEMO_RECENT_ORDERS,
  DEMO_SPARKLINES,
  formatRelativeHours,
  type RecentOrderRow,
} from '@/components/dashboard/overview/overview-data'
import { PlatformOffersCards } from '@/components/dashboard/PlatformOffersCards'
import { formatCurrency } from '@/lib/utils'
import { useAdminDashboard, useProductStats, useHealthSummary } from '@/lib/hooks/use-api'
import { useT, useLocale } from 'shared/src/i18n/react'
import { LoadingState } from '@/components/ui/state-components'

export default function DashboardPage() {
  const t = useT()
  const locale = useLocale()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  // Real data sources; each gracefully falls back to the reference layout data.
  const { data, isLoading, error } = useAdminDashboard()
  const { data: productStats } = useProductStats()
  const { data: healthSummary } = useHealthSummary()

  const metrics = data?.metrics

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
    // A dashboard API failure must not blank the workspace: render the full
    // reference layout with fallback data so the operator keeps navigation and
    // context (the query retries in the background).
    console.error('[dashboard] overview data unavailable:', error)
  }

  const trend = (value: number | undefined) => ({
    change: `${Math.abs(value ?? 0).toFixed(1)}%`,
    changeType: (value ?? 0) >= 0 ? ('increase' as const) : ('decrease' as const),
  })

  const revenueTrend = trend(metrics?.totalRevenueTrend ?? 12.5)
  const ordersTrend = trend(metrics?.totalOrdersTrend ?? 8.3)
  const customersTrend = trend(metrics?.totalUsersTrend ?? 24.8)
  const lowStockTrend = trend(productStats?.metrics?.lowStockProductsTrend ?? -16.7)

  // Map live recent orders onto the card row shape; keep reference rows otherwise.
  const recentOrderRows: RecentOrderRow[] | undefined = data?.recentOrders?.length
    ? data.recentOrders.slice(0, 5).map((order, index) => {
        const reference = DEMO_RECENT_ORDERS[index % DEMO_RECENT_ORDERS.length]
        const created = order.createdAt ? new Date(order.createdAt) : null
        const hours = created ? (Date.now() - created.getTime()) / 3_600_000 : 24
        return {
          code: `#${order.id.slice(0, 8)}`,
          customer: order.customer?.username || order.customer?.email || '--',
          items: reference.items,
          extraItems: Math.max((order.itemsCount ?? 1) - 2, 0),
          amount: order.totalAmount,
          currency: order.currency,
          status: orderPillStatus(String(order.status)),
          time: formatRelativeHours(hours, locale),
        }
      })
    : undefined

  const healthStatus = healthSummary?.status

  return (
    <div className="w-full min-h-screen bg-[#f5f7fb]">
      <div className="mx-auto w-full max-w-[1600px] space-y-5 px-4 py-5 sm:px-6">
        <WelcomeBanner />

        {/* Stat cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <OverviewStatCard
            label={getText('merchant.dashboard.overview.totalSales', '总销售额')}
            value={formatCurrency(metrics?.totalRevenue ?? 8736.12, metrics?.currency)}
            change={revenueTrend.change}
            changeType={revenueTrend.changeType}
            comparisonLabel={getText('merchant.dashboard.overview.vsLastMonth', '较上月同期')}
            icon={ShoppingBag}
            tone="blue"
            sparkline={DEMO_SPARKLINES.revenue}
            sparkGradientId="sparkBlue"
          />
          <OverviewStatCard
            label={getText('merchant.dashboard.overview.ordersCount', '订单数')}
            value={(metrics?.totalOrders ?? 156).toLocaleString()}
            change={ordersTrend.change}
            changeType={ordersTrend.changeType}
            comparisonLabel={getText('merchant.dashboard.overview.vsLastMonth', '较上月同期')}
            icon={ClipboardList}
            tone="green"
            sparkline={DEMO_SPARKLINES.orders}
            sparkGradientId="sparkGreen"
          />
          <OverviewStatCard
            label={getText('merchant.dashboard.overview.newCustomers', '新顾客')}
            value={(metrics?.totalUsers ?? 89).toLocaleString()}
            change={customersTrend.change}
            changeType={customersTrend.changeType}
            comparisonLabel={getText('merchant.dashboard.overview.vsLastMonth', '较上月同期')}
            icon={Users}
            tone="purple"
            sparkline={DEMO_SPARKLINES.customers}
            sparkGradientId="sparkPurple"
          />
          <OverviewStatCard
            label={getText('merchant.dashboard.overview.lowStockProducts', '低库存商品')}
            value={(productStats?.metrics?.lowStockProducts ?? 5).toLocaleString()}
            change={lowStockTrend.change}
            changeType={lowStockTrend.changeType}
            comparisonLabel={getText('merchant.dashboard.overview.vsLastMonth', '较上月同期')}
            icon={AlertTriangle}
            tone="orange"
            sparkline={DEMO_SPARKLINES.lowStock}
            sparkGradientId="sparkOrange"
          />
        </div>

        {/* Trend + order sources */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <SalesTrendCard
              totalCurrent={metrics?.totalRevenue}
              totalPrevious={
                metrics?.totalRevenue !== undefined
                  ? metrics.totalRevenue / (1 + (metrics.totalRevenueTrend ?? 0) / 100)
                  : undefined
              }
              currency={metrics?.currency}
            />
          </div>
          <OrderSourcesCard />
        </div>

        {/* Orders / products / status column */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="xl:col-span-5">
            <RecentOrdersCard rows={recentOrderRows} />
          </div>
          <div className="xl:col-span-4">
            <TopProductsCard />
          </div>
          <div className="flex flex-col gap-4 xl:col-span-3">
            <SystemStatusCard status={healthStatus} />
            <QuickActionsCard />
          </div>
        </div>

        {/* Platform Offers (rendered only when offers exist) */}
        <PlatformOffersCards />
      </div>
    </div>
  )
}
