/**
 * Error Rate Monitoring Chart Component
 *
 * Displays error rate metrics with i18n support.
 * Shows error counts, rates, and last error information from health checks.
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

interface ErrorRateChartProps {
  metrics: HealthMetricsResponse | undefined
  isLoading?: boolean
}

export function ErrorRateChart({ metrics, isLoading }: ErrorRateChartProps) {
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  if (isLoading) {
    return (
      <ChartCard title={getText('admin.health.charts.errorRate', 'Error Rate Monitor')}>
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg animate-pulse">
          <div className="text-center">
            <p className="text-gray-600">{getText('common.loading', 'Loading...')}</p>
          </div>
        </div>
      </ChartCard>
    )
  }

  // Calculate overall error metrics from all health checks
  const responseMetrics = metrics?.responseMetrics || []
  let totalCalls = 0
  let totalErrors = 0
  let totalSuccess = 0
  let overallErrorRate = 0
  let lastError: { message: string; timestamp: string } | undefined

  if (responseMetrics.length > 0) {
    totalCalls = responseMetrics.reduce((sum, m) => sum + m.totalCalls, 0)
    totalErrors = responseMetrics.reduce((sum, m) => sum + m.errorCount, 0)
    totalSuccess = responseMetrics.reduce((sum, m) => sum + m.successCount, 0)

    if (totalCalls > 0) {
      overallErrorRate = (totalErrors / totalCalls) * 100
    }

    // Find most recent error
    const metricsWithErrors = responseMetrics.filter(m => m.lastError)
    if (metricsWithErrors.length > 0) {
      const sorted = metricsWithErrors.sort((a, b) => {
        const timeA = a.lastError ? new Date(a.lastError.timestamp).getTime() : 0
        const timeB = b.lastError ? new Date(b.lastError.timestamp).getTime() : 0
        return timeB - timeA
      })
      lastError = sorted[0].lastError
    }
  }

  const successRate = totalCalls > 0 ? ((totalSuccess / totalCalls) * 100).toFixed(1) : '0'

  return (
    <ChartCard title={getText('admin.health.charts.errorRate', 'Error Rate Monitor')}>
      <div className="mb-4">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="text-sm text-gray-600">{getText('admin.health.errorRate', 'Error Rate')}</span>
            <span className="text-lg font-semibold text-gray-900">{overallErrorRate.toFixed(2)}%</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
            <span className="text-sm text-gray-600">{getText('admin.health.totalErrors', 'Total Errors')}</span>
            <span className="text-lg font-semibold text-gray-900">{totalErrors}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-600">{getText('admin.health.successRate', 'Success Rate')}</span>
            <span className="text-lg font-semibold text-gray-900">{successRate}%</span>
          </div>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          {lastError ? (
            <div className="text-red-600">
              <span className="font-medium">{getText('admin.health.lastError', 'Last error')}: </span>
              <span className="text-gray-600">{lastError.message}</span>
              <span className="text-gray-400 ml-2">({new Date(lastError.timestamp).toLocaleString()})</span>
            </div>
          ) : (
            <span className="text-gray-600">{getText('admin.health.charts.realtimeData', 'Real-time error monitoring')}</span>
          )}
        </div>
      </div>

      <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
        <div className="text-center">
          <p className="text-gray-600 mb-2">{getText('admin.health.charts.errorTrend', 'Historical error rate trends')}</p>
          <p className="text-sm text-gray-500">{getText('admin.health.charts.comingSoon', 'Time-series data coming soon')}</p>
        </div>
      </div>
    </ChartCard>
  )
}
