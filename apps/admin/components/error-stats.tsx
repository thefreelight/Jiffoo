/**
 * Error Statistics Widget Component
 *
 * Displays error tracking stats, trends chart, and top errors list on the dashboard.
 * Uses recharts for visualization and TanStack Query for data fetching.
 */

'use client'

import { AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useErrorStats } from '@/lib/hooks/use-api'
import { useT } from 'shared/src/i18n/react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import Link from 'next/link'
import { format } from 'date-fns'

interface ErrorStatsWidgetProps {
  className?: string
}

export function ErrorStatsWidget({ className }: ErrorStatsWidgetProps) {
  const t = useT()
  const { data: stats, isLoading, error } = useErrorStats()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-800'
      case 'error': return 'bg-orange-100 text-orange-800'
      case 'warning': return 'bg-yellow-100 text-yellow-800'
      case 'info': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (isLoading) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">{getText('merchant.errors.loading', 'Loading error stats...')}</p>
          </div>
        </div>
      </Card>
    )
  }

  if (error || !stats) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-600">{getText('merchant.errors.loadFailed', 'Failed to load error stats')}</p>
          </div>
        </div>
      </Card>
    )
  }

  const criticalCount = stats.bySeverity?.critical || 0
  const errorCount = stats.bySeverity?.error || 0
  const warningCount = stats.bySeverity?.warning || 0
  const infoCount = stats.bySeverity?.info || 0

  // Calculate trend (compare first and last data points)
  const trendData = stats.recentTrend || []
  const hasTrend = trendData.length >= 2
  let trendPercent = 0
  let trendDirection: 'up' | 'down' | 'stable' = 'stable'

  if (hasTrend) {
    const firstCount = trendData[0].count
    const lastCount = trendData[trendData.length - 1].count
    if (firstCount > 0) {
      trendPercent = Math.round(((lastCount - firstCount) / firstCount) * 100)
      if (trendPercent > 5) trendDirection = 'up'
      else if (trendPercent < -5) trendDirection = 'down'
    }
  }

  return (
    <Card className={`${className}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {getText('merchant.errors.title', 'Error Tracking')}
            </h3>
            <p className="text-sm text-gray-500">
              {getText('merchant.errors.subtitle', 'Last 24 hours')}
            </p>
          </div>
          <Link href="/errors">
            <Button variant="outline" size="sm">
              {getText('merchant.errors.viewAll', 'View All')}
            </Button>
          </Link>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">
              {getText('merchant.errors.total', 'Total Errors')}
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.total || 0}</div>
            {hasTrend && (
              <div className="flex items-center mt-1">
                {trendDirection === 'up' && (
                  <>
                    <TrendingUp className="w-4 h-4 text-red-500 mr-1" />
                    <span className="text-sm text-red-600">+{Math.abs(trendPercent)}%</span>
                  </>
                )}
                {trendDirection === 'down' && (
                  <>
                    <TrendingDown className="w-4 h-4 text-green-500 mr-1" />
                    <span className="text-sm text-green-600">{trendPercent}%</span>
                  </>
                )}
                {trendDirection === 'stable' && (
                  <span className="text-sm text-gray-600">
                    {getText('merchant.errors.stable', 'Stable')}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="bg-red-50 rounded-lg p-4">
            <div className="text-sm text-red-600 mb-1">
              {getText('merchant.errors.critical', 'Critical')}
            </div>
            <div className="text-2xl font-bold text-red-700">{criticalCount}</div>
          </div>

          <div className="bg-orange-50 rounded-lg p-4">
            <div className="text-sm text-orange-600 mb-1">
              {getText('merchant.errors.errors', 'Errors')}
            </div>
            <div className="text-2xl font-bold text-orange-700">{errorCount}</div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-sm text-green-600 mb-1">
              {getText('merchant.errors.resolved', 'Resolved')}
            </div>
            <div className="text-2xl font-bold text-green-700">{stats.byStatus?.resolved || 0}</div>
          </div>
        </div>

        {/* Trend Chart */}
        {trendData.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              {getText('merchant.errors.trendChart', 'Error Trends')}
            </h4>
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="errorGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  tickFormatter={(value) => {
                    try {
                      return format(new Date(value), 'MMM d')
                    } catch {
                      return value
                    }
                  }}
                />
                <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  labelFormatter={(value) => {
                    try {
                      return format(new Date(value), 'MMM d, yyyy')
                    } catch {
                      return value
                    }
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#ef4444"
                  fillOpacity={1}
                  fill="url(#errorGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top Errors List */}
        {stats.topErrors && stats.topErrors.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              {getText('merchant.errors.topErrors', 'Top Errors')}
            </h4>
            <div className="space-y-2">
              {stats.topErrors.slice(0, 5).map((error: any) => (
                <div
                  key={error.errorHash}
                  className="flex items-start justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {error.message}
                    </p>
                    <div className="flex items-center mt-1 space-x-2">
                      <span className="text-xs text-gray-500">
                        {error.count} {getText('merchant.errors.occurrences', 'occurrences')}
                      </span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-500">
                        {getText('merchant.errors.lastSeen', 'Last seen')}: {format(new Date(error.lastSeenAt), 'MMM d, HH:mm')}
                      </span>
                    </div>
                  </div>
                  <div className="ml-3 flex-shrink-0">
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-md">
                      {error.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {stats.total === 0 && (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">
              <AlertTriangle className="w-12 h-12 mx-auto" />
            </div>
            <p className="text-gray-600">{getText('merchant.errors.noErrors', 'No errors in the last 24 hours')}</p>
            <p className="text-sm text-gray-500">{getText('merchant.errors.allGood', 'Everything is running smoothly!')}</p>
          </div>
        )}
      </div>
    </Card>
  )
}
