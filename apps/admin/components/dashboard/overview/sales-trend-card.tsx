/**
 * Sales trend card: combined bar + line chart of current vs previous period,
 * with range tabs, channel filter, hover tooltip, and totals legend.
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
import { buildTrendSeries, DEMO_TREND_TOTALS, type TrendPoint } from './overview-data'
import { formatCurrency } from '@/lib/utils'
import { useT } from 'shared/src/i18n/react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const RANGE_TABS = [
  { key: '7d', labelKey: 'merchant.dashboard.overview.range7d', labelFallback: '7天' },
  { key: '30d', labelKey: 'merchant.dashboard.overview.range30d', labelFallback: '30天' },
  { key: '90d', labelKey: 'merchant.dashboard.overview.range90d', labelFallback: '90天' },
  { key: '1y', labelKey: 'merchant.dashboard.overview.range1y', labelFallback: '1年' },
] as const

type RangeKey = (typeof RANGE_TABS)[number]['key']

interface TrendTooltipPayloadEntry {
  dataKey?: string | number
  value?: number | string
  payload?: TrendPoint
}

interface SalesTrendCardProps {
  /** Total for the current period (falls back to the reference demo value). */
  totalCurrent?: number
  /** Total for the previous period. */
  totalPrevious?: number
  currency?: string
}

function TrendTooltip({
  active,
  payload,
  label,
  currentLabel,
  previousLabel,
}: {
  active?: boolean
  payload?: TrendTooltipPayloadEntry[]
  label?: string
  currentLabel: string
  previousLabel: string
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
            {typeof current === 'number' ? `$${current.toFixed(2)}` : '--'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="h-2 w-2 rounded-full bg-[#c6dbff]" />
          {previousLabel}
          <span className="font-bold text-slate-900">
            {typeof previous === 'number' ? `$${previous.toFixed(2)}` : '--'}
          </span>
        </div>
      </div>
    </div>
  )
}

export function SalesTrendCard({ totalCurrent, totalPrevious, currency }: SalesTrendCardProps) {
  const t = useT()
  const [range, setRange] = useState<RangeKey>('30d')
  const [channel, setChannel] = useState('all')

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const currentTotal = totalCurrent ?? DEMO_TREND_TOTALS.current
  const previousTotal = totalPrevious ?? DEMO_TREND_TOTALS.previous

  const series = useMemo(
    () => buildTrendSeries(range, currentTotal, previousTotal),
    [range, currentTotal, previousTotal],
  )

  const currentLabel = getText('merchant.dashboard.overview.currentPeriod', '本期销售额')
  const previousLabel = getText('merchant.dashboard.overview.previousPeriod', '上期销售额')

  return (
    <SectionCard
      title={getText('merchant.dashboard.overview.salesTrend', '销售趋势')}
      className="min-h-[380px]"
      bodyClassName="min-h-0 flex-1"
    >
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        <div className="flex items-center rounded-lg border border-[#eef1f6] bg-[#f8fafc] p-0.5">
          {RANGE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setRange(tab.key)}
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
        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger className="h-8 w-[120px] rounded-lg border-[#eef1f6] bg-[#f8fafc] text-xs font-medium text-slate-600 shadow-none focus:ring-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{getText('merchant.dashboard.overview.allChannels', '全部渠道')}</SelectItem>
            <SelectItem value="online">{getText('merchant.dashboard.overview.onlineStore', 'Online Store')}</SelectItem>
            <SelectItem value="offline">{getText('merchant.dashboard.overview.offline', '线下订单')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
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
              tickFormatter={(value: number) => `$${Number(value).toLocaleString()}`}
            />
            <Tooltip
              cursor={{ stroke: '#e2e8f0' }}
              content={<TrendTooltip currentLabel={currentLabel} previousLabel={previousLabel} />}
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
          <span className="font-bold text-slate-900">{formatCurrency(currentTotal, currency)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="h-2 w-2 rounded-full bg-[#c6dbff]" />
          {previousLabel}
          <span className="font-bold text-slate-900">{formatCurrency(previousTotal, currency)}</span>
        </div>
      </div>
    </SectionCard>
  )
}
