/**
 * Cache Statistics Component
 *
 * Displays Redis cache hit/miss rates and memory usage with i18n support.
 * Shows cache performance metrics from health monitoring data.
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

interface CacheStatsProps {
  metrics: HealthMetricsResponse | undefined
  isLoading?: boolean
}

export function CacheStats({ metrics, isLoading }: CacheStatsProps) {
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  if (isLoading) {
    return (
      <ChartCard title={getText('admin.health.charts.cacheStats', 'Cache Statistics')}>
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg animate-pulse">
          <div className="text-center">
            <p className="text-gray-600">{getText('common.loading', 'Loading...')}</p>
          </div>
        </div>
      </ChartCard>
    )
  }

  const cache = metrics?.cache
  const hitRate = cache?.hitRate || 0
  const missRate = cache?.missRate || 0
  const keyCount = cache?.keyCount || 0
  const memoryUsed = cache?.memoryUsed || 0
  const memoryPeak = cache?.memoryPeak || 0
  const evictedKeys = cache?.evictedKeys || 0
  const connectedClients = cache?.connectedClients || 0

  // Format memory in MB
  const memoryUsedMB = (memoryUsed / 1024 / 1024).toFixed(2)
  const memoryPeakMB = (memoryPeak / 1024 / 1024).toFixed(2)
  const memoryUsagePercent = memoryPeak > 0 ? ((memoryUsed / memoryPeak) * 100).toFixed(1) : '0'

  return (
    <ChartCard title={getText('admin.health.charts.cacheStats', 'Cache Statistics')}>
      <div className="mb-4">
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-600">{getText('admin.health.cache.hitRate', 'Hit Rate')}</span>
            <span className="text-lg font-semibold text-gray-900">{hitRate.toFixed(2)}%</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
            <span className="text-sm text-gray-600">{getText('admin.health.cache.missRate', 'Miss Rate')}</span>
            <span className="text-lg font-semibold text-gray-900">{missRate.toFixed(2)}%</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-sm text-gray-600">{getText('admin.health.cache.keyCount', 'Keys')}</span>
            <span className="text-lg font-semibold text-gray-900">{keyCount.toLocaleString()}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
            <span className="text-sm text-gray-600">{getText('admin.health.cache.memory', 'Memory')}</span>
            <span className="text-lg font-semibold text-gray-900">{memoryUsedMB} MB</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm text-gray-500 pt-2 border-t border-gray-100">
          <div>
            <span className="font-medium">{getText('admin.health.cache.memoryUsage', 'Usage')}: </span>
            <span className="text-gray-700">{memoryUsagePercent}%</span>
          </div>
          <div>
            <span className="font-medium">{getText('admin.health.cache.evicted', 'Evicted')}: </span>
            <span className="text-gray-700">{evictedKeys.toLocaleString()}</span>
          </div>
          <div>
            <span className="font-medium">{getText('admin.health.cache.clients', 'Clients')}: </span>
            <span className="text-gray-700">{connectedClients}</span>
          </div>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          <span className="text-gray-600">{getText('admin.health.charts.realtimeData', 'Real-time cache metrics')}</span>
        </div>
      </div>

      <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
        <div className="text-center">
          <p className="text-gray-600 mb-2">{getText('admin.health.charts.cacheTrend', 'Historical cache performance trends')}</p>
          <p className="text-sm text-gray-500">{getText('admin.health.charts.comingSoon', 'Time-series data coming soon')}</p>
        </div>
      </div>
    </ChartCard>
  )
}
