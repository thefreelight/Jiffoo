/**
 * Top products card: what sold the most units in the last thirty days, with
 * the change against the thirty days before. The rows are the store's own
 * sales; the tile carries the product's name rather than a picture of
 * something else.
 */

'use client'

import { Package, TrendingUp, TrendingDown } from 'lucide-react'
import { SectionCard } from './section-card'
import { useT } from 'shared/src/i18n/react'
import { cn } from '@/lib/utils'

export interface TopProductRow {
  name: string
  sold: number
  /** Units of the period before, to compare with; null when it sold none then. */
  trend: number | null
}

interface TopProductsCardProps {
  rows?: TopProductRow[]
}

const RANK_BADGES: Record<number, string> = {
  1: 'bg-orange-500 text-white',
  2: 'bg-slate-300 text-white',
  3: 'bg-orange-400 text-white',
}

export function TopProductsCard({ rows }: TopProductsCardProps) {
  const t = useT()

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const data = rows ?? []
  const soldLabel = getText('merchant.dashboard.overview.soldUnit', '已售')

  return (
    <SectionCard
      title={getText('merchant.dashboard.overview.topProducts', '热门商品')}
      action={{
        label: getText('merchant.dashboard.overview.viewAll', '查看全部'),
        href: '/products',
      }}
    >
      {data.length === 0 ? (
        <div data-testid="top-products-empty" className="flex flex-1 items-center justify-center px-6 py-10 text-center text-sm text-slate-400">
          {getText('merchant.dashboard.overview.noTopProductsYet', '近 30 天还没有售出的商品')}
        </div>
      ) : (
        <ul className="flex-1 space-y-1" data-testid="top-products">
          {data.map((row, index) => {
            const increased = (row.trend ?? 0) >= 0
            return (
              <li key={`${index}-${row.name}`} data-rank={index + 1} className="flex items-center gap-3 rounded-lg px-1 py-2 transition-colors hover:bg-[#f8fafc]">
                <span
                  className={cn(
                    'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                    RANK_BADGES[index + 1] ?? 'text-slate-400',
                  )}
                >
                  {index + 1}
                </span>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f1f4f9] text-slate-400">
                  <Package className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-slate-900" title={row.name}>
                    {row.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {row.sold.toLocaleString()} {soldLabel}
                  </p>
                </div>
                {row.trend === null ? null : (
                  <span
                    className={cn(
                      'flex items-center gap-0.5 text-xs font-semibold',
                      increased ? 'text-emerald-600' : 'text-red-500',
                    )}
                  >
                    {increased ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {Math.abs(row.trend).toFixed(1)}%
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </SectionCard>
  )
}
