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
    text: 'text-[#3B82F6]',
    chart: '#3B82F6'
  },
  green: {
    bg: 'bg-[#DCFCE7]',
    text: 'text-[#166534]',
    chart: '#22C55E'
  },
  purple: {
    bg: 'bg-[#F3E8FF]',
    text: 'text-[#7C3AED]',
    chart: '#8B5CF6'
  },
  orange: {
    bg: 'bg-[#FEF3C7]',
    text: 'text-[#D97706]',
    chart: '#F59E0B'
  },
  red: {
    bg: 'bg-[#FEE2E2]',
    text: 'text-[#991B1B]',
    chart: '#EF4444'
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
    <div className={cn(
      "bg-white rounded-3xl border border-gray-100 p-8 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 transition-all group relative overflow-hidden",
      className
    )}>
      {/* Decorative background element */}
      <div className={cn(
        "absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-[0.03] group-hover:scale-150 transition-transform duration-700",
        colors.bg
      )} />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          {icon && (
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110",
              colors.bg
            )}>
              <div className={colors.text}>
                {icon}
              </div>
            </div>
          )}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {title}
            </p>
          </div>
        </div>
      </div>

      {/* Value */}
      <div className="mb-6">
        <div className="text-3xl font-black text-gray-900 tracking-tight mb-2">
          {value}
        </div>
        {change && (
          <div className="flex items-center space-x-2">
            <div className={cn(
              "flex items-center space-x-1 text-xs font-bold px-2 py-0.5 rounded-lg",
              changeType === 'increase' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
            )}>
              {changeType === 'increase' ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span>{change}</span>
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{comparisonLabel || getText('merchant.dashboard.fromLastMonth', 'vs last month')}</span>
          </div>
        )}
      </div>

      {/* Chart preview */}
      <div className="h-12 -mx-4">
        {hasData ? (
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
        ) : (
          <div className="h-full border-t border-dashed border-gray-100 mt-4 pt-4 flex items-center justify-center opacity-40">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest italic">{getText('common.noData', 'Stable Node')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
