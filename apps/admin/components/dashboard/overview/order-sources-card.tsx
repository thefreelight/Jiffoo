/**
 * Order sources card: donut chart with center total and a per-channel legend.
 */

'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { SectionCard } from './section-card'
import { DEMO_ORDER_SOURCES } from './overview-data'
import { useT } from 'shared/src/i18n/react'

interface OrderSourcesCardProps {
  /** Slice values; defaults to the reference demo distribution. */
  slices?: { key: string; value: number }[]
}

const PALETTE = DEMO_ORDER_SOURCES

export function OrderSourcesCard({ slices }: OrderSourcesCardProps) {
  const t = useT()

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const data = PALETTE.map((slice, index) => ({
    ...slice,
    value: slices?.[index]?.value ?? slice.value,
  }))
  const total = data.reduce((sum, slice) => sum + slice.value, 0) || 1

  return (
    <SectionCard
      title={getText('merchant.dashboard.overview.orderSources', '订单来源')}
      action={{
        label: getText('merchant.dashboard.overview.viewDetails', '查看详情'),
        href: '/orders',
      }}
      className="min-h-[380px]"
    >
      <div className="flex flex-1 flex-col items-center gap-4 lg:flex-col">
        <div className="relative h-[190px] w-[190px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="key"
                innerRadius={58}
                outerRadius={88}
                paddingAngle={2}
                cornerRadius={5}
                strokeWidth={0}
                startAngle={90}
                endAngle={-270}
                isAnimationActive={false}
              >
                {data.map((slice) => (
                  <Cell key={slice.key} fill={slice.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => {
                  const slice = data.find((entry) => entry.key === name)
                  const label = slice ? getText(slice.labelKey, slice.labelFallback) : String(name)
                  return [`${value} ${getText('merchant.dashboard.overview.ordersUnit', '单')}`, label]
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[26px] font-black leading-none text-slate-900">{total}</span>
            <span className="mt-1 text-xs text-slate-400">
              {getText('merchant.dashboard.overview.totalOrdersUnit', '总订单数')}
            </span>
          </div>
        </div>

        <ul className="w-full space-y-2.5">
          {data.map((slice) => (
            <li key={slice.key} className="flex items-center gap-2 text-xs">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
              <span className="min-w-0 flex-1 truncate text-slate-600">
                {getText(slice.labelKey, slice.labelFallback)}
              </span>
              <span className="font-semibold text-slate-900">{slice.value}</span>
              <span className="w-11 text-right text-slate-400">
                {((slice.value / total) * 100).toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </SectionCard>
  )
}
