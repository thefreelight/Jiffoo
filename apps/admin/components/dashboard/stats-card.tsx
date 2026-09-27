/**
 * Stats Card Component
 *
 * Displays statistics with trend indicators using Jiffoo Blue Minimal design system.
 */

'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'
import { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { useT } from 'shared/src/i18n/react'

import { LineChart, Line, ResponsiveContainer } from 'recharts'

interface StatsCardProps {
  title: string
  value: string
  change?: string
  changeType?: 'increase' | 'decrease'
  comparisonLabel?: string
  data?: Array<{ value: number }>
  className?: string
  icon?: ReactNode
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red'
}

// Blue Minimal design system colors
const colorClasses = {
  blue: {
    bg: 'bg-sidebar-active-bg',
    text: 'text-info',
    chart: 'var(--admin-primary)',
    ring: 'border-action-faint',
    surface: 'from-action-veil/90 via-surface to-surface',
    accent: 'bg-action-base/80',
    micro: 'bg-action-soft/80',
    softText: 'text-action-strong/70',
  },
  green: {
    bg: 'bg-success-faint',
    text: 'text-success-deep',
    chart: 'var(--admin-success-base)',
    ring: 'border-success-faint',
    surface: 'from-success-veil/90 via-surface to-surface',
    accent: 'bg-success-base/80',
    micro: 'bg-success-soft/80',
    softText: 'text-success-strong/70',
  },
  purple: {
    bg: 'bg-highlight-faint-extra',
    text: 'text-highlight-icon',
    chart: 'var(--admin-chart-violet-base)',
    ring: 'border-highlight-faint',
    surface: 'from-highlight-veil/90 via-surface to-surface',
    accent: 'bg-highlight-base/80',
    micro: 'bg-highlight-soft/80',
    softText: 'text-highlight-strong/70',
  },
  orange: {
    bg: 'bg-alert-faint',
    text: 'text-warning',
    chart: 'var(--admin-chart-amber-base)',
    ring: 'border-caution-faint',
    surface: 'from-caution-veil/90 via-surface to-surface',
    accent: 'bg-caution-base/80',
    micro: 'bg-caution-soft/80',
    softText: 'text-caution-strong/70',
  },
  red: {
    bg: 'bg-danger-faint',
    text: 'text-danger-dark',
    chart: 'var(--admin-danger-base)',
    ring: 'border-danger-faint',
    surface: 'from-danger-veil/90 via-surface to-surface',
    accent: 'bg-danger-base/80',
    micro: 'bg-danger-soft/80',
    softText: 'text-danger-strong/70',
  }
}

export function StatsCard({
  title,
  value,
  change,
  changeType,
  comparisonLabel,
  data,
  className,
  icon,
  color = 'blue'
}: StatsCardProps) {
  const t = useT()
  const colors = colorClasses[color]

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  // Only render chart when there is real data, otherwise show "No data"
  const hasData = data && data.length > 0
  const previewBars = [18, 26, 20, 34, 24, 30]

  return (
    <div className={cn(
      'group relative overflow-hidden rounded-[2rem] border border-neutral-faint bg-gradient-to-br p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-action-base/5 sm:p-6',
      colors.surface,
      colors.ring,
      className
    )}>
      <div className={cn('absolute inset-x-0 top-0 h-1', colors.accent)} />
      <div className={cn(
        'absolute -right-6 -top-8 h-28 w-28 rounded-full opacity-[0.14] blur-2xl transition-transform duration-700 group-hover:scale-125',
        colors.bg
      )} />
      <div className="absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-transparent via-surface/80 to-transparent" />

      <div className="relative flex h-full flex-col">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {icon && (
              <div className={cn(
                'flex h-11 w-11 items-center justify-center rounded-2xl border border-surface/80 shadow-sm transition-transform group-hover:scale-105',
                colors.bg
              )}>
                <div className={colors.text}>
                  {icon}
                </div>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-light">
                {title}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-neutral-light">
                {getText('common.status.live', 'Live metric')}
              </p>
            </div>
          </div>
          {icon && (
            <span className={cn(
              'inline-flex items-center gap-2 rounded-full border border-surface/80 bg-surface/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] shadow-sm backdrop-blur',
              colors.softText
            )}>
              <span className={cn('h-2 w-2 rounded-full', colors.accent)} />
              {getText('common.status.active', 'Active')}
            </span>
          )}
        </div>

        <div className="mb-5">
          <div className="text-3xl font-black tracking-tight text-neutral-deepest sm:text-[2rem]">
            {value}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {change && (
              <div className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold shadow-sm',
                changeType === 'increase' ? 'bg-success-veil text-success-strong' : 'bg-danger-veil text-danger-strong'
              )}>
                {changeType === 'increase' ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                <span>{change}</span>
              </div>
            )}
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-light">
              {comparisonLabel || getText('merchant.dashboard.fromLastMonth', 'vs last month')}
            </span>
          </div>
        </div>

        <div className="mt-auto rounded-[1.5rem] border border-surface/80 bg-surface/75 p-3 shadow-sm backdrop-blur">
          {hasData ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-light">
                  {getText('merchant.dashboard.trend', 'Trend')}
                </span>
                <span className={cn('text-[10px] font-bold uppercase tracking-[0.18em]', colors.softText)}>
                  {getText('merchant.dashboard.recentPeriod', 'Recent period')}
                </span>
              </div>
              <div className="h-14">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}>
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={colors.chart}
                      strokeWidth={3}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-light">
                  {getText('common.noData', 'No recent points')}
                </span>
                <span className={cn('text-[10px] font-bold uppercase tracking-[0.18em]', colors.softText)}>
                  {getText('merchant.dashboard.stable', 'Stable')}
                </span>
              </div>
              <div className="flex h-14 items-end gap-1.5">
                {previewBars.map((height, index) => (
                  <div
                    key={`${title}-${index}`}
                    className={cn(
                      'flex-1 rounded-full',
                      index % 2 === 0 ? colors.micro : 'bg-neutral-faint'
                    )}
                    style={{ height }}
                  />
                ))}
              </div>
              <p className="text-[11px] font-medium text-neutral-light">
                {getText('merchant.dashboard.awaitingTrend', 'Awaiting enough activity to render a recent trend line.')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
