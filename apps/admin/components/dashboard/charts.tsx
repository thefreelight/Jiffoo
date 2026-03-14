/**
 * Dashboard Charts Components
 *
 * Displays sales channel and real-time orders charts with i18n support.
 */

'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,

  Area,
  AreaChart
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

import { useT } from 'shared/src/i18n/react'

// Transform order stats into chart data
function transformOrderStatsToChartData(stats: any) {
  if (!stats) return [];

  // Create a simple daily breakdown if available
  // For now, return empty array to show "no data" state
  return [];
}

interface ChartCardProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}

function ChartCard({ title, subtitle, children, className, action }: ChartCardProps) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          {subtitle && <p className="text-gray-400 text-xs mt-1">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

export function SalesChannelChart({ metrics }: { metrics?: { totalRevenue: number, totalOrders: number, currency?: string } }) {
  const t = useT()

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const totalRevenue = metrics?.totalRevenue || 0
  const totalOrders = metrics?.totalOrders || 0

  return (
    <ChartCard
      title={getText('merchant.dashboard.charts.monthlyRevenue', 'Global Matrix')}
      subtitle="Cross-channel signal analysis"
    >
      <div className="space-y-6">
        <div className="bg-gray-50/50 rounded-2xl p-6 border border-gray-100">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{getText('merchant.dashboard.totalRevenue', 'Gross')}</span>
              </div>
              <p className="text-xl font-black text-gray-900">{formatCurrency(totalRevenue, metrics?.currency)}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-300 rounded-full"></div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{getText('merchant.dashboard.totalOrders', 'Orders')}</span>
              </div>
              <p className="text-xl font-black text-gray-900">{totalOrders}</p>
            </div>
          </div>
          <p className="mt-4 text-[9px] font-bold text-blue-600 uppercase tracking-widest border-t border-gray-100 pt-3">
            {getText('merchant.dashboard.charts.realtimeData', 'Live Signal Active')}
          </p>
        </div>

        <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-[2rem] bg-gray-50/30">
          <p className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.2em] mb-1">
            {getText('merchant.dashboard.charts.revenueBreakdown', 'Analysis Pending')}
          </p>
          <p className="text-[9px] font-medium text-gray-400 italic">
            {getText('merchant.dashboard.charts.comingSoon', 'Revenue breakdown sync in progress')}
          </p>
        </div>
      </div>
    </ChartCard>
  )
}

export function RealTimeOrdersChart({ todayOrders = 0 }: { todayOrders?: number }) {
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  // Use props instead of fetching
  // const todayOrders = orderStats?.todayOrders || 0
  // Note: todayOrders is currently 0 in dashboardApi until extended, but we pass it via props

  return (
    <ChartCard
      title={getText('merchant.dashboard.charts.todaysOrders', "Today's Orders")}
    >
      <div className="mb-4">
        <div className="text-2xl font-bold text-gray-900">{todayOrders}</div>
        <div className="flex items-center space-x-2 mt-1">
          <span className="text-gray-600 text-sm">{getText('merchant.dashboard.charts.ordersPlacedToday', 'Orders placed today')}</span>
        </div>
      </div>

      <div className="h-48 flex items-center justify-center bg-gray-50 rounded-lg">
        <div className="text-center">
          <p className="text-gray-600 mb-2">{getText('merchant.dashboard.charts.realtimeTracking', 'Real-time order tracking')}</p>
          <p className="text-sm text-gray-500">{getText('merchant.dashboard.charts.minuteLevelData', 'Minute-level data coming soon')}</p>
        </div>
      </div>
    </ChartCard>
  )
}
