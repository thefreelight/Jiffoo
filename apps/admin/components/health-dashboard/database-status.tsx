/**
 * Database Connection Pool Status Component
 *
 * Displays database connection pool metrics and usage with i18n support.
 * Shows active/idle connections, pool size, and usage percentage.
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

interface DatabaseStatusProps {
  metrics: HealthMetricsResponse | undefined
  isLoading?: boolean
}

export function DatabaseStatus({ metrics, isLoading }: DatabaseStatusProps) {
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  if (isLoading) {
    return (
      <ChartCard title={getText('admin.health.charts.databaseStatus', 'Database Connection Pool')}>
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg animate-pulse">
          <div className="text-center">
            <p className="text-gray-600">{getText('common.loading', 'Loading...')}</p>
          </div>
        </div>
      </ChartCard>
    )
  }

  const database = metrics?.database
  const active = database?.active || 0
  const idle = database?.idle || 0
  const size = database?.size || 0
  const max = database?.max || 0
  const waiting = database?.waiting || 0
  const usage = database?.usage || 0

  // Determine usage color based on thresholds
  const getUsageColor = () => {
    if (usage >= 90) return 'text-red-600'
    if (usage >= 70) return 'text-orange-600'
    return 'text-green-600'
  }

  return (
    <ChartCard title={getText('admin.health.charts.databaseStatus', 'Database Connection Pool')}>
      <div className="mb-4">
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-sm text-gray-600">{getText('admin.health.database.active', 'Active')}</span>
            <span className="text-lg font-semibold text-gray-900">{active}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-600">{getText('admin.health.database.idle', 'Idle')}</span>
            <span className="text-lg font-semibold text-gray-900">{idle}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
            <span className="text-sm text-gray-600">{getText('admin.health.database.poolSize', 'Pool Size')}</span>
            <span className="text-lg font-semibold text-gray-900">{size}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${usage >= 90 ? 'bg-red-500' : usage >= 70 ? 'bg-orange-500' : 'bg-green-500'}`}></div>
            <span className="text-sm text-gray-600">{getText('admin.health.database.usage', 'Usage')}</span>
            <span className={`text-lg font-semibold ${getUsageColor()}`}>{usage.toFixed(1)}%</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm text-gray-500 pt-2 border-t border-gray-100">
          <div>
            <span className="font-medium">{getText('admin.health.database.maxSize', 'Max Size')}: </span>
            <span className="text-gray-700">{max}</span>
          </div>
          <div>
            <span className="font-medium">{getText('admin.health.database.waiting', 'Waiting')}: </span>
            <span className={`${waiting > 0 ? 'text-orange-600 font-semibold' : 'text-gray-700'}`}>{waiting}</span>
          </div>
          <div>
            <span className="font-medium">{getText('admin.health.database.available', 'Available')}: </span>
            <span className="text-gray-700">{max - size}</span>
          </div>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          <span className="text-gray-600">{getText('admin.health.charts.realtimeData', 'Real-time connection pool metrics')}</span>
        </div>
      </div>

      <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
        <div className="text-center">
          <p className="text-gray-600 mb-2">{getText('admin.health.charts.databaseTrend', 'Historical connection pool trends')}</p>
          <p className="text-sm text-gray-500">{getText('admin.health.charts.comingSoon', 'Time-series data coming soon')}</p>
        </div>
      </div>
    </ChartCard>
  )
}
