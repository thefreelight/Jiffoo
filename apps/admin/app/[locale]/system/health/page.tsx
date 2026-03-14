/**
 * Health Monitoring Dashboard Page
 *
 * Real-time system health monitoring with metrics, charts, and alerts.
 * Displays CPU, memory, disk usage, API response times, error rates, and cache statistics.
 */

'use client'

import { useState } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from 'shared/src/i18n/react'
import { useHealthMetrics, useHealthSummary } from '@/lib/hooks/use-api'
import { MetricsOverview } from '@/components/health-dashboard/metrics-overview'
import { CpuMemoryChart } from '@/components/health-dashboard/cpu-memory-chart'
import { ResponseTimeChart } from '@/components/health-dashboard/response-time-chart'
import { ErrorRateChart } from '@/components/health-dashboard/error-rate-chart'
import { CacheStats } from '@/components/health-dashboard/cache-stats'
import { DatabaseStatus } from '@/components/health-dashboard/database-status'
import { AlertConfig } from '@/components/health-dashboard/alert-config'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function HealthMonitoringPage() {
  const t = useT()
  const [activeTab, setActiveTab] = useState('overview')

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  // Fetch health metrics and summary with auto-refresh
  const { data: metrics, isLoading, error, refetch } = useHealthMetrics()
  const { data: summary, isLoading: summaryLoading } = useHealthSummary()

  const loading = isLoading || summaryLoading

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">{getText('admin.health.loadFailed', 'Failed to load health monitoring data')}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => refetch()}
          >
            {getText('common.retry', 'Retry')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F172A]">
            {getText('admin.health.title', 'System Health Monitoring')}
          </h1>
          <p className="text-[#64748B]">
            {getText('admin.health.subtitle', 'Monitor real-time system performance and health metrics')}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={loading}
          className="border-[#E2E8F0] text-[#0F172A] hover:border-[#3B82F6] hover:text-[#3B82F6]"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {getText('common.refresh', 'Refresh')}
        </Button>
      </div>

      {/* Health Status Summary */}
      {summary && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[#0F172A] mb-2">
                {getText('admin.health.overallStatus', 'Overall Health Status')}
              </h3>
              <div className="flex items-center space-x-4">
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  summary.status === 'healthy'
                    ? 'bg-green-100 text-green-800'
                    : summary.status === 'degraded'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {summary.status.charAt(0).toUpperCase() + summary.status.slice(1)}
                </div>
                <span className="text-sm text-[#64748B]">
                  {summary.alerts?.length ?? 0} {getText('admin.health.activeAlerts', 'active alert(s)')}
                </span>
              </div>
            </div>
            {summary.alerts && summary.alerts.length > 0 && (
              <div className="text-right">
                <p className="text-sm text-[#64748B] mb-1">
                  {getText('admin.health.recentAlerts', 'Recent Alerts')}
                </p>
                <div className="space-y-1">
                  {summary.alerts.slice(0, 3).map((alert, index) => (
                    <div
                      key={index}
                      className={`text-sm px-2 py-1 rounded ${
                        alert.severity === 'critical'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-yellow-50 text-yellow-700'
                      }`}
                    >
                      {alert.type}: {alert.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border border-[#E2E8F0]">
          <TabsTrigger value="overview">
            {getText('admin.health.tabs.overview', 'Overview')}
          </TabsTrigger>
          <TabsTrigger value="details">
            {getText('admin.health.tabs.details', 'Details')}
          </TabsTrigger>
          <TabsTrigger value="alerts">
            {getText('admin.health.tabs.alerts', 'Alert Settings')}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Metrics Overview Cards */}
          <MetricsOverview metrics={metrics} isLoading={loading} />

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CpuMemoryChart metrics={metrics} isLoading={loading} />
            <ResponseTimeChart metrics={metrics} isLoading={loading} />
          </div>
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ErrorRateChart metrics={metrics} isLoading={loading} />
            <CacheStats metrics={metrics} isLoading={loading} />
          </div>
          <DatabaseStatus metrics={metrics} isLoading={loading} />
        </TabsContent>

        {/* Alert Settings Tab */}
        <TabsContent value="alerts">
          <AlertConfig
            initialThresholds={(summary as any)?.thresholds}
            isLoading={loading}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
