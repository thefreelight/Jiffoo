'use client'

import { AlertTriangle, Database, Plug, RefreshCw, Server } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from 'shared/src/i18n/react'
import { useHealthSummary } from '@/lib/hooks/use-api'

export default function HealthMonitoringPage() {
  const t = useT()
  const { data: summary, isLoading, error, refetch } = useHealthSummary()

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <p className="text-gray-600">{t('merchant.health.loadFailed')}</p>
          <Button className="mt-4" onClick={() => refetch()} variant="outline">
            {t('common.actions.retry')}
          </Button>
        </div>
      </div>
    )
  }

  const components = summary ? [
    { label: t('merchant.health.database'), icon: Database, status: summary.database.status },
    { label: t('merchant.health.redis'), icon: Server, status: summary.redis.status },
    { label: t('merchant.health.pluginRuntime'), icon: Plug, status: summary.pluginRuntime.status },
  ] : []

  const statusClass = summary?.status === 'healthy'
    ? 'bg-green-100 text-green-800'
    : summary?.status === 'degraded'
      ? 'bg-yellow-100 text-yellow-800'
      : 'bg-red-100 text-red-800'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F172A]">
            {t('merchant.health.title')}
          </h1>
          <p className="text-[#64748B]">
            {t('merchant.health.subtitle')}
          </p>
        </div>
        <Button
          className="border-[#E2E8F0] text-[#0F172A] hover:border-[#3B82F6] hover:text-[#3B82F6]"
          disabled={isLoading}
          onClick={() => refetch()}
          size="sm"
          variant="outline"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          {t('common.actions.refresh')}
        </Button>
      </div>

      {summary && (
        <div className="border border-[#E2E8F0] bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-[#64748B]">{t('merchant.health.overallStatus')}</p>
              <span className={`mt-2 inline-flex rounded px-3 py-1 text-sm font-medium ${statusClass}`}>
                {summary.status}
              </span>
            </div>
            <div className="text-sm text-[#64748B]">
              <p>{t('merchant.health.version')}: {summary.version}</p>
              <p>{t('merchant.health.uptime')}: {summary.uptime}s</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {components.map(({ label, icon: Icon, status }) => (
              <div className="flex items-center justify-between border border-[#E2E8F0] p-4" key={label}>
                <span className="flex items-center gap-2 text-sm font-medium text-[#0F172A]">
                  <Icon className="h-4 w-4 text-[#3B82F6]" />
                  {label}
                </span>
                <span className={status === 'ok' ? 'text-sm text-green-700' : 'text-sm text-red-700'}>{status}</span>
              </div>
            ))}
          </div>

          <p className="mt-4 text-sm text-[#64748B]">
            {t('merchant.health.loadedPlugins')}: {summary.pluginRuntime.loaded}
          </p>
        </div>
      )}
    </div>
  )
}
