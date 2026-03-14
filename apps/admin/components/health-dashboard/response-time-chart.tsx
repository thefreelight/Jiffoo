/**
 * Response Time Chart Component
 *
 * Displays API response time metrics with i18n support.
 * Shows average, min, and max response times for health checks.
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

interface ResponseTimeChartProps {
  metrics: HealthMetricsResponse | undefined
  isLoading?: boolean
}

export function ResponseTimeChart({ metrics, isLoading }: ResponseTimeChartProps) {
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  if (isLoading) {
    return (
      <ChartCard title={getText('admin.health.charts.responseTime', 'API Response Time')}>
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg animate-pulse">
          <div className="text-center">
            <p className="text-gray-600">{getText('common.loading', 'Loading...')}</p>
          </div>
        </div>
      </ChartCard>
    )
  }

  // Calculate overall response time metrics from all health checks
  const responseMetrics = metrics?.responseMetrics || []
  let avgResponseTime = 0
  let minResponseTime = 0
  let maxResponseTime = 0

  if (responseMetrics.length > 0) {
    // Calculate average of all avgResponseTimes
    avgResponseTime = responseMetrics.reduce((sum, m) => sum + m.avgResponseTime, 0) / responseMetrics.length

    // Find overall min and max
    minResponseTime = Math.min(...responseMetrics.map(m => m.minResponseTime))
    maxResponseTime = Math.max(...responseMetrics.map(m => m.maxResponseTime))
  }

  return (
    <ChartCard title={getText('admin.health.charts.responseTime', 'API Response Time')}>
      <div className="mb-4">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-600">{getText('admin.health.avgResponseTime', 'Avg')}</span>
            <span className="text-lg font-semibold text-gray-900">{avgResponseTime.toFixed(0)}ms</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-sm text-gray-600">{getText('admin.health.minResponseTime', 'Min')}</span>
            <span className="text-lg font-semibold text-gray-900">{minResponseTime.toFixed(0)}ms</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
            <span className="text-sm text-gray-600">{getText('admin.health.maxResponseTime', 'Max')}</span>
            <span className="text-lg font-semibold text-gray-900">{maxResponseTime.toFixed(0)}ms</span>
          </div>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          <span className="text-gray-600">{getText('admin.health.charts.realtimeData', 'Real-time API metrics')}</span>
        </div>
      </div>

      <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
        <div className="text-center">
          <p className="text-gray-600 mb-2">{getText('admin.health.charts.responseTrend', 'Historical response time trends')}</p>
          <p className="text-sm text-gray-500">{getText('admin.health.charts.comingSoon', 'Time-series data coming soon')}</p>
        </div>
      </div>
    </ChartCard>
  )
}
