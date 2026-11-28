/**
 * Orders by status: a donut of every order, split by where each one stands,
 * with the total in the middle and a legend. Drawn from the order table.
 */

'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { SectionCard } from './section-card'
import { ORDER_STATUSES, ordersByStatusRows } from '@/lib/dashboard-analytics'
import { useT } from 'shared/src/i18n/react'

interface OrdersByStatusCardProps {
  /** Order counts keyed by status, as the core reports them. */
  byStatus?: Record<string, number>
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#94a3b8',
  PAID: '#3b82f6',
  PROCESSING: '#8b5cf6',
  SHIPPED: '#38bdf8',
  DELIVERED: '#14b8a6',
  COMPLETED: '#22c55e',
  CANCELLED: '#cbd5e1',
  REFUNDED: '#f97316',
}

const STATUS_LABEL_KEYS: Record<(typeof ORDER_STATUSES)[number], string> = {
  PENDING: 'merchant.orders.pending',
  PAID: 'merchant.orders.paid',
  PROCESSING: 'merchant.orders.processing',
  SHIPPED: 'merchant.orders.shipped',
  DELIVERED: 'merchant.orders.delivered',
  // The orders page has no label for a completed order; the overview already does.
  COMPLETED: 'merchant.dashboard.overview.statusCompleted',
  CANCELLED: 'merchant.orders.cancelled',
  REFUNDED: 'merchant.orders.refunded',
}

const STATUS_LABEL_FALLBACKS: Record<(typeof ORDER_STATUSES)[number], string> = {
  PENDING: '待处理',
  PAID: '已付款',
  PROCESSING: '处理中',
  SHIPPED: '已发货',
  DELIVERED: '已送达',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  REFUNDED: '已退款',
}

export function OrdersByStatusCard({ byStatus }: OrdersByStatusCardProps) {
  const t = useT()

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const data = ordersByStatusRows(byStatus).map((row) => ({
    status: row.status,
    value: row.count,
    color: STATUS_COLORS[row.status] ?? '#e2e8f0',
    label: (STATUS_LABEL_KEYS as Record<string, string>)[row.status]
      ? getText(STATUS_LABEL_KEYS[row.status as (typeof ORDER_STATUSES)[number]], STATUS_LABEL_FALLBACKS[row.status as (typeof ORDER_STATUSES)[number]])
      : row.status,
  }))
  const total = data.reduce((sum, slice) => sum + slice.value, 0)

  return (
    <SectionCard
      title={getText('merchant.dashboard.overview.ordersByStatus', '订单状态分布')}
      action={{
        label: getText('merchant.dashboard.overview.viewDetails', '查看详情'),
        href: '/orders',
      }}
      className="min-h-[380px]"
    >
      {data.length === 0 ? (
        <div data-testid="status-empty" className="flex flex-1 items-center justify-center px-6 text-center text-sm text-slate-400">
          {getText('merchant.dashboard.overview.noOrdersYet', '还没有订单')}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center gap-4">
          <div className="relative h-[190px] w-[190px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="status"
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={data.length > 1 ? 2 : 0}
                  cornerRadius={5}
                  strokeWidth={0}
                  startAngle={90}
                  endAngle={-270}
                  isAnimationActive={false}
                >
                  {data.map((slice) => (
                    <Cell key={slice.status} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => {
                    const slice = data.find((entry) => entry.status === name)
                    return [`${value} ${getText('merchant.dashboard.overview.ordersUnit', '单')}`, slice ? slice.label : String(name)]
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span data-testid="status-total" className="text-[26px] font-black leading-none text-slate-900">
                {total.toLocaleString()}
              </span>
              <span className="mt-1 text-xs text-slate-400">
                {getText('merchant.dashboard.overview.totalOrdersUnit', '总订单数')}
              </span>
            </div>
          </div>

          <ul className="w-full space-y-2.5" data-testid="status-legend">
            {data.map((slice) => (
              <li key={slice.status} data-status={slice.status} className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
                <span className="min-w-0 flex-1 truncate text-slate-600">{slice.label}</span>
                <span className="font-semibold text-slate-900">{slice.value.toLocaleString()}</span>
                <span className="w-11 text-right text-slate-400">
                  {((slice.value / total) * 100).toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  )
}
