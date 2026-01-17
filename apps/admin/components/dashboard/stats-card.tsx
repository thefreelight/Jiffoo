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
  change: string
  changeType: 'increase' | 'decrease'
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
  data,
  className,
  icon,
  color = 'blue'
}: StatsCardProps) {
  const t = useT()
  const colors = colorClasses[color]

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  // Only render chart when there is real data, otherwise show "No data"
  const hasData = data && data.length > 0

  return (
    <div className={cn(
      "bg-white rounded-xl border border-[#E2E8F0] p-6 hover:shadow-md transition-shadow",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          {icon && (
            <div className={cn(
              "p-2 rounded-lg",
              colors.bg
            )}>
              <div className={colors.text}>
                {icon}
              </div>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-[#64748B]">
              {title}
            </p>
          </div>
        </div>
      </div>

      {/* Value */}
      <div className="mb-4">
        <div className="text-3xl font-semibold text-[#0F172A] mb-1">
          {value}
        </div>
        <div className="flex items-center space-x-2">
          <div className={cn(
            "flex items-center space-x-1 text-sm font-medium",
            changeType === 'increase' ? 'text-[#166534]' : 'text-[#991B1B]'
          )}>
            {changeType === 'increase' ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            <span>{change}</span>
          </div>
          <span className="text-sm text-[#64748B]">{getText('merchant.dashboard.fromLastMonth', 'from last month')}</span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-16">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={colors.chart}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: colors.chart }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center bg-[#F8FAFC] rounded-lg">
            <p className="text-sm text-[#64748B]">{getText('common.noData', 'No data')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
