/**
 * Recent orders card: compact table of the newest orders with who placed
 * them, what was bought, the amount, the order's status and when it was
 * placed. A row opens the order.
 */

'use client'

import Link from 'next/link'
import { SectionCard } from './section-card'
import { formatCurrency } from '@/lib/utils'
import { useLocale, useT } from 'shared/src/i18n/react'
import { cn } from '@/lib/utils'

export interface RecentOrderRow {
  id: string
  code: string
  customer: string
  /** Name of the first item; the other items are counted. */
  product: string
  extraItems: number
  amount: number
  currency: string
  status: string
  time: string
}

interface RecentOrdersCardProps {
  rows?: RecentOrderRow[]
}

type PillTone = 'completed' | 'paid' | 'shipped' | 'pending' | 'cancelled' | 'refunded'

/** The order status keys carry every label but a completed order; the overview has that one. */
const STATUS_LABEL_KEYS: Record<string, { key: string; fallback: string; tone: PillTone }> = {
  PENDING: { key: 'merchant.orders.pending', fallback: '待处理', tone: 'pending' },
  PAID: { key: 'merchant.orders.paid', fallback: '已付款', tone: 'paid' },
  PROCESSING: { key: 'merchant.orders.processing', fallback: '处理中', tone: 'paid' },
  SHIPPED: { key: 'merchant.orders.shipped', fallback: '已发货', tone: 'shipped' },
  DELIVERED: { key: 'merchant.orders.delivered', fallback: '已送达', tone: 'completed' },
  COMPLETED: { key: 'merchant.dashboard.overview.statusCompleted', fallback: '已完成', tone: 'completed' },
  CANCELLED: { key: 'merchant.orders.cancelled', fallback: '已取消', tone: 'cancelled' },
  REFUNDED: { key: 'merchant.orders.refunded', fallback: '已退款', tone: 'refunded' },
}

const PILL_CLASSES: Record<PillTone, string> = {
  completed: 'bg-emerald-50 text-emerald-600',
  paid: 'bg-blue-50 text-blue-600',
  shipped: 'bg-sky-50 text-sky-600',
  pending: 'bg-slate-100 text-slate-500',
  cancelled: 'bg-slate-100 text-slate-400',
  refunded: 'bg-orange-50 text-orange-600',
}

export function RecentOrdersCard({ rows }: RecentOrdersCardProps) {
  const t = useT()
  const locale = useLocale()

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const statusOf = (status: string) => STATUS_LABEL_KEYS[String(status).toUpperCase()]

  return (
    <SectionCard
      title={getText('merchant.dashboard.overview.recentOrders', '最近订单')}
      action={{
        label: getText('merchant.dashboard.overview.viewAll', '查看全部'),
        href: '/orders',
      }}
    >
      {!rows || rows.length === 0 ? (
        <div data-testid="recent-orders-empty" className="flex flex-1 items-center justify-center px-6 py-10 text-center text-sm text-slate-400">
          {getText('merchant.dashboard.overview.noOrdersYet', '还没有订单')}
        </div>
      ) : (
        <div className="-mx-5 -my-1 px-1">
          {/* Fixed shares per column: a long name or a large amount is cut short
              with an ellipsis instead of pushing the table out of its card. */}
          <table className="w-full table-fixed border-collapse text-left" data-testid="recent-orders">
            <colgroup>
              <col className="w-[27%]" />
              <col className="w-[33%]" />
              <col className="w-[20%]" />
              <col className="w-[20%]" />
            </colgroup>
            <thead>
              <tr className="text-xs font-medium text-slate-400">
                <th className="py-2 pl-4 pr-1 text-left font-medium">{getText('merchant.dashboard.overview.colOrder', '订单')}</th>
                <th className="px-1 py-2 text-left font-medium">{getText('merchant.dashboard.overview.colProducts', '商品')}</th>
                <th className="px-1 py-2 text-left font-medium">{getText('merchant.dashboard.overview.colAmount', '金额')}</th>
                <th className="py-2 pl-1 pr-3 text-left font-medium">{getText('merchant.dashboard.overview.colStatus', '状态')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f4f6fa]">
              {rows.map((row) => {
                const status = statusOf(row.status)
                return (
                  <tr key={row.id} data-order={row.id} className="text-[13px] transition-colors hover:bg-[#f8fafc]">
                    {/* The order and who placed it share a cell so the table fits a laptop window. */}
                    <td className="py-3 pl-4 pr-1">
                      <Link
                        href={`/${locale}/orders/${encodeURIComponent(row.id)}`}
                        className="block truncate font-semibold text-slate-700 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        {row.code}
                      </Link>
                      <span className="block truncate text-xs text-slate-400" title={row.customer}>
                        {row.customer}
                      </span>
                    </td>
                    <td className="px-1 py-3 text-slate-600">
                      <div className="flex min-w-0 items-center gap-1">
                        <span className="min-w-0 truncate" title={row.product}>
                          {row.product}
                        </span>
                        {row.extraItems > 0 && (
                          <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#f1f4f9] px-1 text-[10px] font-semibold text-slate-500">
                            +{row.extraItems}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="truncate px-1 py-3 font-semibold text-slate-900">{formatCurrency(row.amount, row.currency)}</td>
                    {/* When it was placed sits under where it stands. */}
                    <td className="py-3 pl-1 pr-3">
                      <span
                        data-status={row.status}
                        className={cn(
                          'inline-flex max-w-full items-center whitespace-nowrap rounded-md px-1.5 py-1 text-xs font-medium',
                          PILL_CLASSES[status?.tone ?? 'pending'],
                        )}
                      >
                        {status ? getText(status.key, status.fallback) : row.status}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-400" title={getText('merchant.dashboard.overview.colTime', '时间')}>
                        {row.time}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  )
}
