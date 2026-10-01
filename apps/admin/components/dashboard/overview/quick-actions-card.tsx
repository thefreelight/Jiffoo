/**
 * Quick actions card: shortcut tiles for the most common operator tasks.
 */

'use client'

import Link from 'next/link'
import { ShoppingBag, ClipboardList, Puzzle, BarChart3 } from 'lucide-react'
import { useT, useLocale } from 'shared/src/i18n/react'

const ACTIONS = [
  {
    key: 'addProduct',
    labelKey: 'merchant.dashboard.overview.actionAddProduct',
    labelFallback: '添加商品',
    href: '/products/new',
    icon: ShoppingBag,
    tile: 'bg-[#e8f0fe]',
    iconColor: 'text-[#3b82f6]',
  },
  {
    key: 'createOrder',
    labelKey: 'merchant.dashboard.overview.actionCreateOrder',
    labelFallback: '创建订单',
    href: '/orders',
    icon: ClipboardList,
    tile: 'bg-[#e5f7eb]',
    iconColor: 'text-[#22c55e]',
  },
  {
    key: 'managePlugins',
    labelKey: 'merchant.dashboard.overview.actionManagePlugins',
    labelFallback: '管理插件',
    href: '/plugins',
    icon: Puzzle,
    tile: 'bg-[#f1ebfe]',
    iconColor: 'text-[#8b5cf6]',
  },
  {
    key: 'viewReports',
    labelKey: 'merchant.dashboard.overview.actionViewReports',
    labelFallback: '查看报表',
    href: '/system/health',
    icon: BarChart3,
    tile: 'bg-[#fdf0e3]',
    iconColor: 'text-[#f97316]',
  },
]

export function QuickActionsCard() {
  const t = useT()
  const locale = useLocale()

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  return (
    <section className="rounded-2xl border border-[#eef1f6] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      <h3 className="text-[15px] font-bold tracking-tight text-gray-900">
        {getText('merchant.dashboard.overview.quickActions', '快捷操作')}
      </h3>
      <div className="mt-4 grid grid-cols-4 gap-3">
        {ACTIONS.map((action) => (
          <Link
            key={action.key}
            href={`/${locale}${action.href}`}
            className="group flex flex-col items-center gap-2"
          >
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${action.tile}`}
            >
              <action.icon className={`h-5 w-5 ${action.iconColor}`} />
            </span>
            <span className="text-center text-xs text-slate-600 transition-colors group-hover:text-slate-900">
              {getText(action.labelKey, action.labelFallback)}
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
