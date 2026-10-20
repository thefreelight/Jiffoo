/**
 * Top products card: ranked best sellers with sold counts and trend deltas.
 */

'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'
import { SectionCard } from './section-card'
import { ProductArt, type ProductIconKind } from './product-art'
import { DEMO_TOP_PRODUCTS, type TopProductRow } from './overview-data'
import { useT } from 'shared/src/i18n/react'
import { cn } from '@/lib/utils'

const RANK_BADGES: Record<number, string> = {
  1: 'bg-orange-500 text-white',
  2: 'bg-slate-300 text-white',
  3: 'bg-orange-400 text-white',
}

interface TopProductsCardProps {
  rows?: TopProductRow[]
}

export function TopProductsCard({ rows }: TopProductsCardProps) {
  const t = useT()

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const data = rows?.length ? rows : DEMO_TOP_PRODUCTS
  const soldLabel = getText('merchant.dashboard.overview.soldUnit', '已售')

  return (
    <SectionCard
      title={getText('merchant.dashboard.overview.topProducts', '热门商品')}
      action={{
        label: getText('merchant.dashboard.overview.viewAll', '查看全部'),
        href: '/products',
      }}
    >
      <ul className="flex-1 space-y-1">
        {data.map((row) => {
          const increased = row.trend >= 0
          return (
            <li key={row.rank} className="flex items-center gap-3 rounded-lg px-1 py-2 transition-colors hover:bg-[#f8fafc]">
              <span
                className={cn(
                  'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                  RANK_BADGES[row.rank] ?? 'text-slate-400',
                )}
              >
                {row.rank}
              </span>
              <ProductArt icon={row.icon as ProductIconKind} art={row.art} className="h-10 w-10" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-slate-900">{row.name}</p>
                <p className="text-xs text-slate-400">
                  {row.sold} {soldLabel}
                </p>
              </div>
              <span
                className={cn(
                  'flex items-center gap-0.5 text-xs font-semibold',
                  increased ? 'text-emerald-600' : 'text-red-500',
                )}
              >
                {increased ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {Math.abs(row.trend).toFixed(1)}%
              </span>
            </li>
          )
        })}
      </ul>
    </SectionCard>
  )
}
