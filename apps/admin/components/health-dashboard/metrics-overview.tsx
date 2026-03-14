/**
 * Metrics Overview Component
 *
 * Displays system health metrics with stats cards using Jiffoo Blue Minimal design system.
 * Shows CPU, memory, disk usage, error rates, response times, and cache statistics.
 */

'use client'

import { Cpu, HardDrive, Activity, Clock, Database, AlertTriangle } from 'lucide-react'
import { StatsCard } from '../dashboard/stats-card'
import { HealthMetricsResponse } from '@/lib/types'
import { useT } from 'shared/src/i18n/react'

interface MetricsOverviewProps {
  metrics: HealthMetricsResponse | undefined
  isLoading?: boolean
}

export function MetricsOverview({ metrics, isLoading }: MetricsOverviewProps) {
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  // Helper to format percentage
  const formatPercent = (value: number): string => {
    return `${value.toFixed(1)}%`
  }

  // Helper to format milliseconds
  const formatMs = (value: number): string => {
    return `${value.toFixed(0)}ms`
  }

  // Helper to calculate change (for now showing 0% as we don't have historical data)
  const getChange = (): string => {
    return '0%'
  }

  // Helper to determine if metric is healthy (decrease is good)
  const getChangeType = (value: number, threshold: number): 'increase' | 'decrease' => {
    return value < threshold ? 'increase' : 'decrease'
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-[#E2E8F0] p-6 animate-pulse"
          >
            <div className="h-24"></div>
          </div>
        ))}
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center p-12 bg-white rounded-xl border border-[#E2E8F0]">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-[#F59E0B] mx-auto mb-4" />
          <p className="text-[#64748B]">{getText('admin.health.noMetrics', 'No metrics available')}</p>
        </div>
      </div>
    )
  }

  // Calculate average response time from all checks
  const avgResponseTime = metrics.responseMetrics.length > 0
    ? metrics.responseMetrics.reduce((sum, check) => sum + check.avgResponseTime, 0) / metrics.responseMetrics.length
    : 0

  // Calculate overall error rate
  const totalCalls = metrics.responseMetrics.reduce((sum, check) => sum + check.totalCalls, 0)
  const totalErrors = metrics.responseMetrics.reduce((sum, check) => sum + check.errorCount, 0)
  const errorRate = totalCalls > 0 ? (totalErrors / totalCalls) * 100 : 0

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* CPU Usage */}
      <StatsCard
        title={getText('admin.health.cpuUsage', 'CPU Usage')}
        value={formatPercent(metrics.system.cpu.usage)}
        change={getChange()}
        changeType={getChangeType(metrics.system.cpu.usage, 80)}
        color="blue"
        icon={<Cpu className="w-5 h-5" />}
      />

      {/* Memory Usage */}
      <StatsCard
        title={getText('admin.health.memoryUsage', 'Memory Usage')}
        value={formatPercent(metrics.system.memory.usage)}
        change={getChange()}
        changeType={getChangeType(metrics.system.memory.usage, 85)}
        color="purple"
        icon={<Activity className="w-5 h-5" />}
      />

      {/* Disk Usage */}
      <StatsCard
        title={getText('admin.health.diskUsage', 'Disk Usage')}
        value={formatPercent(metrics.system.disk?.usage ?? 0)}
        change={getChange()}
        changeType={getChangeType(metrics.system.disk?.usage ?? 0, 90)}
        color="green"
        icon={<HardDrive className="w-5 h-5" />}
      />

      {/* Error Rate */}
      <StatsCard
        title={getText('admin.health.errorRate', 'Error Rate')}
        value={formatPercent(errorRate)}
        change={getChange()}
        changeType={errorRate < 1 ? 'increase' : 'decrease'}
        color={errorRate > 5 ? 'red' : errorRate > 1 ? 'orange' : 'green'}
        icon={<AlertTriangle className="w-5 h-5" />}
      />

      {/* Response Time */}
      <StatsCard
        title={getText('admin.health.responseTime', 'Avg Response Time')}
        value={formatMs(avgResponseTime)}
        change={getChange()}
        changeType={avgResponseTime < 200 ? 'increase' : 'decrease'}
        color={avgResponseTime > 500 ? 'red' : avgResponseTime > 200 ? 'orange' : 'blue'}
        icon={<Clock className="w-5 h-5" />}
      />

      {/* Cache Hit Rate */}
      <StatsCard
        title={getText('admin.health.cacheHitRate', 'Cache Hit Rate')}
        value={formatPercent(metrics.cache.hitRate)}
        change={getChange()}
        changeType={metrics.cache.hitRate > 70 ? 'increase' : 'decrease'}
        color={metrics.cache.hitRate > 80 ? 'green' : metrics.cache.hitRate > 50 ? 'orange' : 'red'}
        icon={<Database className="w-5 h-5" />}
      />
    </div>
  )
}
