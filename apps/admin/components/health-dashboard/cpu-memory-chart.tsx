/**
 * CPU and Memory Usage Chart Component
 *
 * Displays real-time CPU and memory usage trends with i18n support.
 * Uses area charts to show resource consumption over time.
 */

'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import { HealthMetricsResponse } from '@/lib/types'
import { useT } from 'shared/src/i18n/react'

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

interface CpuMemoryChartProps {
  metrics: HealthMetricsResponse | undefined
  isLoading?: boolean
}

export function CpuMemoryChart({ metrics, isLoading }: CpuMemoryChartProps) {
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  if (isLoading) {
    return (
      <ChartCard title={getText('admin.health.charts.resourceUsage', 'Resource Usage')}>
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg animate-pulse">
          <div className="text-center">
            <p className="text-gray-600">{getText('common.loading', 'Loading...')}</p>
          </div>
        </div>
      </ChartCard>
    )
  }

  const cpuUsage = metrics?.system.cpu.usage || 0
  const memoryUsage = metrics?.system.memory.usage || 0

  return (
    <ChartCard title={getText('admin.health.charts.resourceUsage', 'Resource Usage')}>
      <div className="mb-4">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-sm text-gray-600">{getText('admin.health.cpuUsage', 'CPU Usage')}</span>
            <span className="text-lg font-semibold text-gray-900">{cpuUsage.toFixed(1)}%</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
            <span className="text-sm text-gray-600">{getText('admin.health.memoryUsage', 'Memory Usage')}</span>
            <span className="text-lg font-semibold text-gray-900">{memoryUsage.toFixed(1)}%</span>
          </div>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          <span className="text-gray-600">{getText('admin.health.charts.realtimeData', 'Real-time system metrics')}</span>
        </div>
      </div>

      <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
        <div className="text-center">
          <p className="text-gray-600 mb-2">{getText('admin.health.charts.resourceTrend', 'Historical resource usage trends')}</p>
          <p className="text-sm text-gray-500">{getText('admin.health.charts.comingSoon', 'Time-series data coming soon')}</p>
        </div>
      </div>
    </ChartCard>
  )
}
