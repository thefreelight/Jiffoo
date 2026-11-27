/**
 * Sales trend card: bars and a line of paid revenue per period, beside the same
 * period one range earlier, with range tabs and a hover tooltip. It is drawn
 * from the daily figures the core reports; with none it says so.
 */

'use client'

import { useMemo, useState } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { SectionCard } from './section-card'
import { trendPoints, type TrendPoint, type TrendRange } from '@/lib/dashboard-analytics'
import { formatCurrency } from '@/lib/utils'
import { useT } from 'shared/src/i18n/react'
import { cn } from '@/lib/utils'

const RANGE_TABS = [
  { key: '7d', labelKey: 'merchant.dashboard.overview.range7d', labelFallback: '7天' },
  { key: '30d', labelKey: 'merchant.dashboard.overview.range30d', labelFallback: '30天' },
  { key: '90d', labelKey: 'merchant.dashboard.overview.range90d', labelFallback: '90天' },
  { key: '1y', labelKey: 'merchant.dashboard.overview.range1y', labelFallback: '1年' },
] as const

interface TrendTooltipPayloadEntry {
  dataKey?: string | number
  value?: number | string
  payload?: TrendPoint
}

interface SalesTrendCardProps {
  /** Paid revenue per UTC day, as the core reports it. */
  series?: Array<{ day: string; revenue: number }>
  currency?: string
}

function TrendTooltip({
  active,
  payload,
  label,
  currentLabel,
  previousLabel,
  currency,
}: {
  active?: boolean
  payload?: TrendTooltipPayloadEntry[]
  label?: string
  currentLabel: string
  previousLabel: string
  currency?: string
}) {
  if (!active || !payload?.length) return null

  const current = payload.find((entry) => entry.dataKey === 'current')?.value as number | undefined
  const previous = payload.find((entry) => entry.dataKey === 'previous')?.value as number | undefined
  const point = payload[0]?.payload as TrendPoint | undefined

  return (
    <div className="rounded-xl border border-[#eef1f6] bg-white px-4 py-3 shadow-lg">
      <p className="text-xs font-bold text-slate-900">{point?.date ?? label}</p>
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="h-2 w-2 rounded-full bg-[#3b82f6]" />
          {currentLabel}
          <span className="font-bold text-slate-900">
            {typeof current === 'number' ? formatCurrency(current, currency) : '--'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="h-2 w-2 rounded-full bg-[#c6dbff]" />
          {previousLabel}
          <span className="font-bold text-slate-900">
            {typeof previous === 'number' ? formatCurrency(previous, currency) : '--'}
          </span>
        </div>
      </div>
    </div>
  )
}

export function SalesTrendCard({ series, currency }: SalesTrendCardProps) {
  const t = useT()
  const [range, setRange] = useState<TrendRange>('30d')

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const points = useMemo(() => trendPoints(series ?? [], range), [series, range])
  const currentTotal = points.reduce((sum, point) => sum + point.current, 0)
  const previousTotal = points.reduce((sum, point) => sum + point.previous, 0)
  // With no paid revenue in either period there is nothing honest to draw.
  const hasFigures = currentTotal > 0 || previousTotal > 0

  const currentLabel = getText('merchant.dashboard.overview.currentPeriod', '本期销售额')
  const previousLabel = getText('merchant.dashboard.overview.previousPeriod', '上期销售额')

  return (
    <SectionCard
      title={getText('merchant.dashboard.overview.salesTrend', '销售趋势')}
      className="min-h-[380px]"
      bodyClassName="min-h-0 flex-1"
    >
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        <div className="flex items-center rounded-lg border border-[#eef1f6] bg-[#f8fafc] p-0.5" data-testid="sales-range">
          {RANGE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setRange(tab.key)}
              data-range={tab.key}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                range === tab.key
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800',
              )}
            >
              {getText(tab.labelKey, tab.labelFallback)}
            </button>
          ))}
        </div>
      </div>

      {hasFigures ? (
        <>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="#f1f4f9" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  interval="preserveStartEnd"
                  minTickGap={28}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  width={52}
                  tickFormatter={(value: number) => formatCurrency(Number(value), currency)}
                />
                <Tooltip
                  cursor={{ stroke: '#e2e8f0' }}
                  content={<TrendTooltip currentLabel={currentLabel} previousLabel={previousLabel} currency={currency} />}
                />
                <Bar dataKey="previous" barSize={10} fill="#dbe9ff" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Line
                  type="monotone"
                  dataKey="previous"
                  stroke="#c6dbff"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="current"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ r: 2.5, fill: '#ffffff', stroke: '#3b82f6', strokeWidth: 1.5 }}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-6 border-t border-[#f4f6fa] pt-3">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="h-2 w-2 rounded-full bg-[#3b82f6]" />
              {currentLabel}
              <span data-testid="sales-current" className="font-bold text-slate-900">
                {formatCurrency(Math.round(currentTotal * 100) / 100, currency)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="h-2 w-2 rounded-full bg-[#c6dbff]" />
              {previousLabel}
              <span data-testid="sales-previous" className="font-bold text-slate-900">
                {formatCurrency(Math.round(previousTotal * 100) / 100, currency)}
              </span>
            </div>
          </div>
        </>
      ) : (
        <div data-testid="sales-empty" className="flex h-[292px] items-center justify-center px-6 text-center text-sm text-slate-400">
          {getText('merchant.dashboard.overview.noSalesYet', '所选时间段内还没有已付款的订单')}
        </div>
      )}
    </SectionCard>
  )
}
