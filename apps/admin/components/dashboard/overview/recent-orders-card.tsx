/**
 * Recent orders card: compact order table with customer, item thumbnails,
 * amount, status pill, and relative time.
 */

'use client'

import { ChevronRight } from 'lucide-react'
import { SectionCard } from './section-card'
import { ProductArt, type ProductIconKind } from './product-art'
import { DEMO_RECENT_ORDERS, type RecentOrderRow } from './overview-data'
import { formatCurrency } from '@/lib/utils'
import { useT } from 'shared/src/i18n/react'
import { cn } from '@/lib/utils'

export type OrderPillStatus = 'completed' | 'processing' | 'unshipped'

const PILL_CLASSES: Record<OrderPillStatus, string> = {
  completed: 'bg-emerald-50 text-emerald-600',
  processing: 'bg-blue-50 text-blue-600',
  unshipped: 'bg-orange-50 text-orange-600',
}

interface RecentOrdersCardProps {
  /** Rows rendered from the live dashboard payload when available. */
  rows?: RecentOrderRow[]
}

export function orderPillStatus(status: string): OrderPillStatus {
  const normalized = String(status).toUpperCase()
  if (normalized === 'COMPLETED' || normalized === 'DELIVERED') return 'completed'
  if (normalized === 'PROCESSING' || normalized === 'PAID' || normalized === 'SHIPPED') return 'processing'
  return 'unshipped'
}

export function RecentOrdersCard({ rows }: RecentOrdersCardProps) {
  const t = useT()

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const data = rows?.length ? rows : DEMO_RECENT_ORDERS

  const statusLabel = (status: OrderPillStatus): string => {
    if (status === 'completed') return getText('merchant.dashboard.overview.statusCompleted', '已完成')
    if (status === 'processing') return getText('merchant.dashboard.overview.statusProcessing', '处理中')
    return getText('merchant.dashboard.overview.statusUnshipped', '待发货')
  }

  return (
    <SectionCard
      title={getText('merchant.dashboard.overview.recentOrders', '最近订单')}
      action={{
        label: getText('merchant.dashboard.overview.viewAll', '查看全部'),
        href: '/orders',
      }}
    >
      <div className="-mx-5 -my-1 overflow-x-auto px-1">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <thead>
            <tr className="text-xs font-medium text-slate-400">
              <th className="py-2 pl-4 pr-2 font-medium">#</th>
              <th className="px-2 py-2 font-medium">{getText('merchant.dashboard.overview.colCustomer', '客户')}</th>
              <th className="px-2 py-2 font-medium">{getText('merchant.dashboard.overview.colProducts', '商品')}</th>
              <th className="px-2 py-2 font-medium">{getText('merchant.dashboard.overview.colAmount', '金额')}</th>
              <th className="px-2 py-2 font-medium">{getText('merchant.dashboard.overview.colStatus', '状态')}</th>
              <th className="px-2 py-2 text-right font-medium">{getText('merchant.dashboard.overview.colTime', '时间')}</th>
              <th className="w-6" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f4f6fa]">
            {data.map((row) => (
              <tr key={row.code} className="group text-[13px] transition-colors hover:bg-[#f8fafc]">
                <td className="py-3 pl-4 pr-2 font-semibold text-slate-700">{row.code}</td>
                <td className="px-2 py-3 text-slate-600">{row.customer}</td>
                <td className="px-2 py-3">
                  <div className="flex items-center">
                    <div className="flex -space-x-1.5">
                      {row.items.slice(0, 2).map((item, index) => (
                        <ProductArt
                          key={`${row.code}-${index}`}
                          icon={item.icon as ProductIconKind}
                          art={item.art}
                          className="h-7 w-7 ring-2 ring-white"
                        />
                      ))}
                    </div>
                    {row.extraItems > 0 && (
                      <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#f1f4f9] px-1 text-[10px] font-semibold text-slate-500">
                        +{row.extraItems}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-2 py-3 font-semibold text-slate-900">{formatCurrency(row.amount, row.currency)}</td>
                <td className="px-2 py-3">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium',
                      PILL_CLASSES[orderPillStatus(row.status as string)],
                    )}
                  >
                    {statusLabel(orderPillStatus(row.status as string))}
                  </span>
                </td>
                <td className="px-2 py-3 text-right text-xs text-slate-400">{row.time}</td>
                <td className="py-3 pl-1 pr-3 text-right">
                  <ChevronRight className="ml-auto h-4 w-4 text-slate-300 transition-colors group-hover:text-slate-500" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  )
}
