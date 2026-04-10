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
    bg: 'bg-[#EFF6FF]',
    text: 'text-[#2563EB]',
    chart: '#3B82F6',
    ring: 'border-blue-100',
    surface: 'from-blue-50/90 via-white to-white',
    accent: 'bg-blue-500/80',
    micro: 'bg-blue-200/80',
    softText: 'text-blue-600/70',
  },
  green: {
    bg: 'bg-[#DCFCE7]',
    text: 'text-[#15803D]',
    chart: '#22C55E',
    ring: 'border-green-100',
    surface: 'from-green-50/90 via-white to-white',
    accent: 'bg-green-500/80',
    micro: 'bg-green-200/80',
    softText: 'text-green-600/70',
  },
  purple: {
    bg: 'bg-[#F3E8FF]',
    text: 'text-[#7C3AED]',
    chart: '#8B5CF6',
    ring: 'border-purple-100',
    surface: 'from-purple-50/90 via-white to-white',
    accent: 'bg-purple-500/80',
    micro: 'bg-purple-200/80',
    softText: 'text-purple-600/70',
  },
  orange: {
    bg: 'bg-[#FEF3C7]',
    text: 'text-[#D97706]',
    chart: '#F59E0B',
    ring: 'border-orange-100',
    surface: 'from-orange-50/90 via-white to-white',
    accent: 'bg-orange-500/80',
    micro: 'bg-orange-200/80',
    softText: 'text-orange-600/70',
  },
  red: {
    bg: 'bg-[#FEE2E2]',
    text: 'text-[#991B1B]',
    chart: '#EF4444',
    ring: 'border-red-100',
    surface: 'from-red-50/90 via-white to-white',
    accent: 'bg-red-500/80',
    micro: 'bg-red-200/80',
    softText: 'text-red-600/70',
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
      'group relative overflow-hidden rounded-[2rem] border border-gray-100 bg-gradient-to-br p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-500/5 sm:p-6',
      colors.surface,
      colors.ring,
      className
    )}>
      <div className={cn('absolute inset-x-0 top-0 h-1', colors.accent)} />
      <div className={cn(
        'absolute -right-6 -top-8 h-28 w-28 rounded-full opacity-[0.14] blur-2xl transition-transform duration-700 group-hover:scale-125',
        colors.bg
      )} />
      <div className="absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent" />

      <div className="relative flex h-full flex-col">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {icon && (
              <div className={cn(
                'flex h-11 w-11 items-center justify-center rounded-2xl border border-white/80 shadow-sm transition-transform group-hover:scale-105',
                colors.bg
              )}>
                <div className={colors.text}>
                  {icon}
                </div>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">
                {title}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-gray-400">
                {getText('common.status.live', 'Live metric')}
              </p>
            </div>
          </div>
          {icon && (
            <span className={cn(
              'inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] shadow-sm backdrop-blur',
              colors.softText
            )}>
              <span className={cn('h-2 w-2 rounded-full', colors.accent)} />
              {getText('common.status.active', 'Active')}
            </span>
          )}
        </div>

        <div className="mb-5">
          <div className="text-3xl font-black tracking-tight text-gray-900 sm:text-[2rem]">
            {value}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {change && (
              <div className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold shadow-sm',
                changeType === 'increase' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
              )}>
                {changeType === 'increase' ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                <span>{change}</span>
              </div>
            )}
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
              {comparisonLabel || getText('merchant.dashboard.fromLastMonth', 'vs last month')}
            </span>
          </div>
        </div>

        <div className="mt-auto rounded-[1.5rem] border border-white/80 bg-white/75 p-3 shadow-sm backdrop-blur">
          {hasData ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
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
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
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
                      index % 2 === 0 ? colors.micro : 'bg-gray-100'
                    )}
                    style={{ height }}
                  />
                ))}
              </div>
              <p className="text-[11px] font-medium text-gray-400">
                {getText('merchant.dashboard.awaitingTrend', 'Awaiting enough activity to render a recent trend line.')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
