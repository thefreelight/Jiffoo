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
import { useOrderStats } from '@/lib/hooks/use-api'
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
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}

function ChartCard({ title, children, className, action }: ChartCardProps) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

export function SalesChannelChart() {
  const t = useT()
  const { data: orderStats } = useOrderStats()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  const totalRevenue = orderStats?.totalRevenue || 0
  const totalOrders = orderStats?.totalOrders || 0

  return (
    <ChartCard title={getText('merchant.dashboard.charts.monthlyRevenue', 'Monthly Revenue Overview')}>
      <div className="mb-4">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-sm text-gray-600">{getText('merchant.dashboard.totalRevenue', 'Total Revenue')}</span>
            <span className="text-lg font-semibold text-gray-900">¥{(totalRevenue / 1000).toFixed(1)}K</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-300 rounded-full"></div>
            <span className="text-sm text-gray-600">{getText('merchant.dashboard.totalOrders', 'Total Orders')}</span>
            <span className="text-lg font-semibold text-gray-900">{totalOrders}</span>
          </div>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          <span className="text-gray-600">{getText('merchant.dashboard.charts.realtimeData', 'Real-time data from backend')}</span>
        </div>
      </div>

      <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
        <div className="text-center">
          <p className="text-gray-600 mb-2">{getText('merchant.dashboard.charts.revenueBreakdown', 'Detailed revenue breakdown by channel')}</p>
          <p className="text-sm text-gray-500">{getText('merchant.dashboard.charts.comingSoon', 'Coming soon - requires backend API enhancement')}</p>
        </div>
      </div>
    </ChartCard>
  )
}

export function RealTimeOrdersChart() {
  const t = useT()
  const { data: orderStats } = useOrderStats()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  const todayOrders = orderStats?.todayOrders || 0

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
