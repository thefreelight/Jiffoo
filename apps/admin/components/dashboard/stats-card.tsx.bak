'use client'

import { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/outline'
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

const colorClasses = {
  blue: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    chart: '#3B82F6'
  },
  green: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    chart: '#10B981'
  },
  purple: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    chart: '#8B5CF6'
  },
  orange: {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    chart: '#F59E0B'
  },
  red: {
    bg: 'bg-red-50',
    text: 'text-red-700',
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
  const colors = colorClasses[color]

  // 生成默认数据如果没有提供
  const chartData = data || Array.from({ length: 20 }, (_, i) => ({
    value: Math.floor(Math.random() * 100) + 50
  }))

  return (
    <div className={cn(
      "bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow",
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
            <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">
              {title}
            </p>
          </div>
        </div>
        <button className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>
      </div>

      {/* Value */}
      <div className="mb-4">
        <div className="text-3xl font-bold text-gray-900 mb-1">
          {value}
        </div>
        <div className="flex items-center space-x-2">
          <div className={cn(
            "flex items-center space-x-1 text-sm font-medium",
            changeType === 'increase' ? 'text-green-600' : 'text-red-600'
          )}>
            {changeType === 'increase' ? (
              <ArrowTrendingUpIcon className="w-4 h-4" />
            ) : (
              <ArrowTrendingDownIcon className="w-4 h-4" />
            )}
            <span>{change}</span>
          </div>
          <span className="text-sm text-gray-500">from last month</span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-16">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
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
      </div>
    </div>
  )
}
