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
    bg: 'bg-[var(--admin-extras-sidebar-active)]',
    text: 'text-foreground',
    chart: 'var(--admin-core-foreground)',
    ring: 'border-active',
    surface: 'from-active/90 via-ground to-ground',
    accent: 'bg-foreground/80',
    micro: 'bg-active/80',
    softText: 'text-foreground/70',
  },
  green: {
    bg: 'bg-raised',
    text: 'text-foreground',
    chart: 'var(--admin-core-muted)',
    ring: 'border-raised',
    surface: 'from-raised/90 via-ground to-ground',
    accent: 'bg-muted-foreground/80',
    micro: 'bg-raised/80',
    softText: 'text-foreground/70',
  },
  purple: {
    bg: 'bg-raised',
    text: 'text-foreground',
    chart: 'var(--admin-core-foreground)',
    ring: 'border-raised',
    surface: 'from-raised/90 via-ground to-ground',
    accent: 'bg-muted-foreground/80',
    micro: 'bg-raised/80',
    softText: 'text-foreground/70',
  },
  orange: {
    bg: 'bg-raised',
    text: 'text-foreground',
    chart: 'var(--admin-core-foreground)',
    ring: 'border-border',
    surface: 'from-attention-soft/90 via-ground to-ground',
    accent: 'bg-foreground/80',
    micro: 'bg-raised/80',
    softText: 'text-foreground/70',
  },
  red: {
    bg: 'bg-border',
    text: 'text-foreground',
    chart: 'var(--admin-core-foreground)',
    ring: 'border-border',
    surface: 'from-raised/90 via-ground to-ground',
    accent: 'bg-foreground/80',
    micro: 'bg-destructive-soft/80',
    softText: 'text-foreground/70',
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

  return (
    <div data-slot="metric-card" className={cn(
      'group relative overflow-hidden rounded-[2rem] border border-raised bg-gradient-to-br p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-foreground/5 sm:p-6',
      colors.surface,
      colors.ring,
      className
    )}>
      <div className={cn('absolute inset-x-0 top-0 h-1', colors.accent)} />
      <div className={cn(
        'absolute -right-6 -top-8 h-28 w-28 rounded-full opacity-[0.14] blur-2xl transition-transform duration-700 group-hover:scale-125',
        colors.bg
      )} />
      <div className="absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-transparent via-ground/80 to-transparent" />

      <div className="relative flex h-full flex-col">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {icon && (
              <div className={cn(
                'flex h-11 w-11 items-center justify-center rounded-2xl border border-ground/80 shadow-sm transition-transform group-hover:scale-105',
                colors.bg
              )}>
                <div className={colors.text}>
                  {icon}
                </div>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                {title}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                {getText('common.status.live', 'Live metric')}
              </p>
            </div>
          </div>

        </div>

        <div className="mb-5">
          <div className="font-mono tabular-nums text-3xl font-semibold tracking-tight text-foreground sm:text-[2rem]">
            {value}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {change && (
              <div className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold shadow-sm',
                changeType === 'increase' ? 'bg-raised text-foreground' : 'bg-raised text-foreground'
              )}>
                {changeType === 'increase' ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                <span>{change}</span>
              </div>
            )}
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {change ? comparisonLabel : null}
            </span>
          </div>
        </div>

        {hasData && <div className="mt-auto rounded-[1.5rem] border border-ground/80 bg-ground/75 p-3 shadow-sm backdrop-blur">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
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
        </div>}
      </div>
    </div>
  )
}
