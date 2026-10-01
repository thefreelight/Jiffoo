/**
 * System status card: overall health banner plus per-service rows.
 */

'use client'

import { CheckCircle2 } from 'lucide-react'
import { SectionCard } from './section-card'
import { useT } from 'shared/src/i18n/react'
import { cn } from '@/lib/utils'

interface SystemStatusCardProps {
  /** Overall health from the health API; defaults to healthy. */
  status?: 'healthy' | 'degraded' | 'unhealthy'
  serviceRows?: { labelKey: string; labelFallback: string; ok: boolean }[]
}

const DEFAULT_SERVICES = [
  { labelKey: 'merchant.dashboard.overview.serviceDatabase', labelFallback: '数据库服务', ok: true },
  { labelKey: 'merchant.dashboard.overview.serviceQueue', labelFallback: '队列服务', ok: true },
  { labelKey: 'merchant.dashboard.overview.servicePlugins', labelFallback: '插件服务', ok: true },
  { labelKey: 'merchant.dashboard.overview.serviceStorage', labelFallback: '存储服务', ok: true },
]

export function SystemStatusCard({ status = 'healthy', serviceRows }: SystemStatusCardProps) {
  const t = useT()

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const healthy = status === 'healthy'
  const services = serviceRows ?? DEFAULT_SERVICES

  return (
    <SectionCard
      title={getText('merchant.dashboard.overview.systemStatus', '系统状态')}
      action={{
        label: getText('merchant.dashboard.overview.viewDetails', '查看详情'),
        href: '/system/health',
      }}
    >
      <div
        className={cn(
          'flex items-center gap-3 rounded-xl px-4 py-3',
          healthy ? 'bg-emerald-50' : 'bg-amber-50',
        )}
      >
        <CheckCircle2 className={cn('h-6 w-6 shrink-0', healthy ? 'text-emerald-500' : 'text-amber-500')} />
        <div className="min-w-0">
          <p className={cn('text-sm font-bold', healthy ? 'text-emerald-600' : 'text-amber-600')}>
            {healthy
              ? getText('merchant.dashboard.overview.allNormal', '运行正常')
              : getText('merchant.dashboard.overview.degraded', '部分异常')}
          </p>
          <p className={cn('truncate text-xs', healthy ? 'text-emerald-500' : 'text-amber-500')}>
            {healthy
              ? getText('merchant.dashboard.overview.allSystemsNormal', '所有系统服务正常运行')
              : getText('merchant.dashboard.overview.degradedHint', '部分服务出现波动，请查看详情')}
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-3">
        {services.map((service) => (
          <li key={service.labelKey} className="flex items-center justify-between text-[13px]">
            <span className="flex items-center gap-2 text-slate-600">
              <span className={cn('h-1.5 w-1.5 rounded-full', service.ok ? 'bg-emerald-500' : 'bg-red-500')} />
              {getText(service.labelKey, service.labelFallback)}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className={cn('h-1.5 w-1.5 rounded-full', service.ok ? 'bg-emerald-500' : 'bg-red-500')} />
              {service.ok
                ? getText('merchant.dashboard.overview.stateNormal', '正常')
                : getText('merchant.dashboard.overview.stateError', '异常')}
            </span>
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}
