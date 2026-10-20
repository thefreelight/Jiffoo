/**
 * Overview stat cards: icon tile, label, headline number, period-over-period
 * change, and a mini area sparkline.
 */

'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

type StatTone = 'blue' | 'green' | 'purple' | 'orange'

const TONES: Record<StatTone, { tile: string; icon: string; stroke: string; fill: string }> = {
  blue: { tile: 'bg-[#e8f0fe]', icon: 'text-[#3b82f6]', stroke: '#3b82f6', fill: 'url(#sparkBlue)' },
  green: { tile: 'bg-[#e5f7eb]', icon: 'text-[#22c55e]', stroke: '#22c55e', fill: 'url(#sparkGreen)' },
  purple: { tile: 'bg-[#f1ebfe]', icon: 'text-[#8b5cf6]', stroke: '#8b5cf6', fill: 'url(#sparkPurple)' },
  orange: { tile: 'bg-[#fdf0e3]', icon: 'text-[#f97316]', stroke: '#f97316', fill: 'url(#sparkOrange)' },
}

interface OverviewStatCardProps {
  label: string
  value: string
  change: string
  changeType: 'increase' | 'decrease'
  comparisonLabel: string
  icon: LucideIcon
  tone: StatTone
  sparkline: number[]
  sparkGradientId: string
}

export function OverviewStatCard({
  label,
  value,
  change,
  changeType,
  comparisonLabel,
  icon: Icon,
  tone,
  sparkline,
  sparkGradientId,
}: OverviewStatCardProps) {
  const colors = TONES[tone]
  const data = sparkline.map((point, index) => ({ index, value: point }))

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#eef1f6] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      <div className="flex items-center gap-3">
        <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', colors.tile)}>
          <Icon className={cn('h-6 w-6', colors.icon)} />
        </div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
      </div>

      <p className="mt-3 text-[26px] font-black leading-none tracking-tight text-slate-900">{value}</p>

      <div className="absolute bottom-5 right-5 h-12 w-24">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={sparkGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.stroke} stopOpacity={0.28} />
                <stop offset="100%" stopColor={colors.stroke} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={colors.stroke}
              strokeWidth={2}
              fill={colors.fill}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2.5 flex items-center gap-1.5 text-xs">
        <span
          className={cn(
            'flex items-center gap-0.5 font-semibold',
            changeType === 'increase' ? 'text-emerald-600' : 'text-red-500',
          )}
        >
          {changeType === 'increase' ? (
            <TrendingUp className="h-3.5 w-3.5" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5" />
          )}
          {change}
        </span>
        <span className="text-slate-400">{comparisonLabel}</span>
      </div>
    </div>
  )
}
