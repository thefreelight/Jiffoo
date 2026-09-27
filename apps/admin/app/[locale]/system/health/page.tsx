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
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-danger-base" />
          <p className="text-neutral-strong">{t('merchant.health.loadFailed')}</p>
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
    ? 'bg-success-faint text-success-dark'
    : summary?.status === 'degraded'
      ? 'bg-warning-faint text-warning-dark'
      : 'bg-danger-faint text-danger-dark'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text">
            {t('merchant.health.title')}
          </h1>
          <p className="text-text-muted">
            {t('merchant.health.subtitle')}
          </p>
        </div>
        <Button
          className="border-border text-text hover:border-action-base hover:text-action-base"
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
        <div className="border border-border bg-surface p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-text-muted">{t('merchant.health.overallStatus')}</p>
              <span className={`mt-2 inline-flex rounded px-3 py-1 text-sm font-medium ${statusClass}`}>
                {summary.status}
              </span>
            </div>
            <div className="text-sm text-text-muted">
              <p>{t('merchant.health.version')}: {summary.version}</p>
              <p>{t('merchant.health.uptime')}: {summary.uptime}s</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {components.map(({ label, icon: Icon, status }) => (
              <div className="flex items-center justify-between border border-border p-4" key={label}>
                <span className="flex items-center gap-2 text-sm font-medium text-text">
                  <Icon className="h-4 w-4 text-action-base" />
                  {label}
                </span>
                <span className={status === 'ok' ? 'text-sm text-success-deep' : 'text-sm text-danger-deep'}>{status}</span>
              </div>
            ))}
          </div>

          <p className="mt-4 text-sm text-text-muted">
            {t('merchant.health.loadedPlugins')}: {summary.pluginRuntime.loaded}
          </p>
        </div>
      )}
    </div>
  )
}
