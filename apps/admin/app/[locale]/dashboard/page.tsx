/**
 * Dashboard Page for Tenant Application
 *
 * Displays store overview with stats, charts, and recent orders.
 * Supports i18n through the translation function.
 */

'use client'

import { AlertTriangle, Box, DollarSign, ShoppingBag, Users, Eye, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { StatsCard } from '@/components/dashboard/stats-card'
import { SalesChannelChart, RealTimeOrdersChart } from '@/components/dashboard/charts'
import { ErrorStatsWidget } from '@/components/error-stats'
import { Button } from '@/components/ui/button'
import { formatCurrency, cn } from '@/lib/utils'
import { useAdminDashboard } from '@/lib/hooks/use-api'
import { useT, useLocale } from 'shared/src/i18n/react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { LoadingState, ErrorState } from '@/components/ui/state-components'

export default function DashboardPage() {
  const t = useT()
  const router = useRouter()
  const locale = useLocale()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  // Use API hooks for real data - Single Aggregated Call
  const { data, isLoading, error } = useAdminDashboard()
  const stats = data // Alias for easier access
  const metricStats = stats?.metrics

  const loading = isLoading

  const toTrendDisplay = (value: number | undefined) => {
    const trendValue = value ?? 0
    return {
      change: `${Math.abs(trendValue).toFixed(2)}%`,
      changeType: trendValue >= 0 ? 'increase' as const : 'decrease' as const,
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'processing': return 'bg-blue-100 text-blue-800'
      case 'shipped': return 'bg-purple-100 text-purple-800'
      case 'delivered': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <LoadingState
        type="spinner"
        message={getText('merchant.dashboard.loading', 'Loading dashboard...')}
        fullPage
      />
    )
  }

  if (error) {
    return (
      <ErrorState
        title={getText('merchant.dashboard.loadFailed', 'Failed to load dashboard data')}
        error={error}
        onRetry={() => window.location.reload()}
        fullPage
      />
    )
  }

  return (
    <div className="w-full bg-[#fcfdfe] min-h-screen">
      {/* Header Bar */}
      <div className="sticky top-0 z-50 flex items-center justify-between border-b border-gray-100 bg-white/80 py-4 pl-4 pr-4 backdrop-blur-md sm:pl-20 sm:pr-8 lg:px-8">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight leading-none">
            {getText('merchant.dashboard.title', 'Control Center')}
          </h1>
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-1">Operational Analytics</span>
        </div>
      </div>

      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6">
        {/* Stats Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <StatsCard
            title={getText('merchant.dashboard.totalRevenue', 'Gross Valuation')}
            value={formatCurrency(metricStats?.totalRevenue || 0, metricStats?.currency)}
            change={toTrendDisplay(metricStats?.totalRevenueTrend).change}
            changeType={toTrendDisplay(metricStats?.totalRevenueTrend).changeType}
            comparisonLabel={getText('merchant.dashboard.vsYesterday', 'vs yesterday')}
            color="blue"
            icon={<DollarSign className="w-6 h-6" />}
            className="p-6"
          />
          <StatsCard
            title={getText('merchant.dashboard.totalOrders', 'Transaction Flow')}
            value={metricStats?.totalOrders?.toLocaleString() || '0'}
            change={toTrendDisplay(metricStats?.totalOrdersTrend).change}
            changeType={toTrendDisplay(metricStats?.totalOrdersTrend).changeType}
            comparisonLabel={getText('merchant.dashboard.vsYesterday', 'vs yesterday')}
            color="green"
            icon={<ShoppingBag className="w-6 h-6" />}
            className="p-6"
          />
          <StatsCard
            title={getText('merchant.dashboard.totalProducts', 'Active Assets')}
            value={metricStats?.totalProducts?.toLocaleString() || '0'}
            change={toTrendDisplay(metricStats?.totalProductsTrend).change}
            changeType={toTrendDisplay(metricStats?.totalProductsTrend).changeType}
            comparisonLabel={getText('merchant.dashboard.vsYesterday', 'vs yesterday')}
            color="purple"
            icon={<Box className="w-6 h-6" />}
            className="p-6"
          />
          <StatsCard
            title={getText('merchant.dashboard.totalUsers', 'Identity Nodes')}
            value={metricStats?.totalUsers?.toLocaleString() || '0'}
            change={toTrendDisplay(metricStats?.totalUsersTrend).change}
            changeType={toTrendDisplay(metricStats?.totalUsersTrend).changeType}
            comparisonLabel={getText('merchant.dashboard.vsYesterday', 'vs yesterday')}
            color="orange"
            icon={<Users className="w-6 h-6" />}
            className="p-6"
          />
        </div>

        {/* Analytics Section - Equal Width & Height Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
            <div className="px-8 py-4 border-b border-gray-50 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-bold text-gray-900">Recent Transactions</h3>
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Master Ledger</span>
            </div>
            <div className="flex-grow overflow-auto">
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="bg-gray-50/30">
                    <th className="py-2.5 px-8 text-[10px] font-bold text-gray-400 uppercase tracking-widest">ID</th>
                    <th className="py-2.5 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Health</th>
                    <th className="py-2.5 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Valuation</th>
                    <th className="py-2.5 px-8 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {stats?.recentOrders?.slice(0, 6).map((order) => (
                    <tr key={order.id} className="group hover:bg-blue-50/30 transition-colors">
                      <td className="py-3 px-8">
                        <span className="font-mono text-[10px] font-bold text-gray-400">
                          #{order.id.substring(0, 8).toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-6">
                        <div className={cn(
                          "inline-flex px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border",
                          getStatusColor(order.status)
                        )}>
                          {order.status}
                        </div>
                      </td>
                      <td className="py-3 px-6 font-bold text-gray-900 text-sm">
                        {formatCurrency(order.totalAmount, order.currency)}
                      </td>
                      <td className="py-3 px-8 text-right text-[10px] font-bold text-gray-400">
                        {order.createdAt ? format(new Date(order.createdAt), 'HH:mm') : '--:--'}
                      </td>
                    </tr>
                  ))}
                  {(!stats?.recentOrders || stats.recentOrders.length === 0) && (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-gray-300">
                        <Box className="w-8 h-8 mx-auto mb-2 opacity-20" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">No Signal</span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {stats?.recentOrders && stats.recentOrders.length > 6 && (
              <div className="p-3 border-t border-gray-50 text-center shrink-0">
                <Button variant="ghost" className="h-8 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-blue-600" onClick={() => router.push(`/${locale}/orders`)}>
                  View Full Ledger
                </Button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm flex flex-col min-h-[400px]">
            <div className="flex-grow">
              <SalesChannelChart metrics={stats?.metrics} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
