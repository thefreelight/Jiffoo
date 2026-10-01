/**
 * Shared building blocks for list pages (products / inventory / orders /
 * customers), matching the reference design: gradient page hero with artwork,
 * compact stat cards, and table pagination.
 */

'use client'

import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type HeroArt = 'products' | 'inventory' | 'orders' | 'customers'

function HeroArtwork({ art }: { art: HeroArt }) {
  if (art === 'products') {
    return (
      <svg viewBox="0 0 220 90" fill="none" aria-hidden className="h-full w-auto">
        <rect x="8" y="58" width="18" height="18" rx="5" fill="#cdd9f8" opacity="0.7" />
        <rect x="30" y="44" width="14" height="14" rx="4" fill="#dbe5fb" opacity="0.8" />
        <path d="M150 26 h44 a7 7 0 0 1 7 7 v40 a11 11 0 0 1 -11 11 h-36 a11 11 0 0 1 -11 -11 v-40 a7 7 0 0 1 7 -7 z" fill="#3b82f6" />
        <path d="M160 26 v-9 a12 12 0 0 1 24 0 v9" stroke="#1e40af" strokeWidth="5" strokeLinecap="round" fill="none" />
        <rect x="154" y="42" width="36" height="30" rx="7" fill="#60a5fa" opacity="0.55" />
        <g transform="rotate(10 130 62)">
          <rect x="112" y="46" width="30" height="30" rx="8" fill="#22c55e" />
          <path d="M120 61 l5 5 l9 -10" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
        <rect x="196" y="18" width="16" height="16" rx="5" fill="#dbe5fb" opacity="0.8" />
      </svg>
    )
  }
  if (art === 'inventory') {
    return (
      <svg viewBox="0 0 220 90" fill="none" aria-hidden className="h-full w-auto">
        <rect x="118" y="34" width="34" height="34" rx="7" fill="#3b82f6" />
        <rect x="122" y="38" width="26" height="26" rx="5" fill="#60a5fa" opacity="0.55" />
        <rect x="156" y="44" width="28" height="24" rx="6" fill="#8b5cf6" />
        <rect x="160" y="48" width="20" height="16" rx="4" fill="#a78bfa" opacity="0.55" />
        <rect x="140" y="14" width="22" height="22" rx="6" fill="#93c5fd" />
        <rect x="186" y="26" width="16" height="16" rx="5" fill="#dbe5fb" />
        <rect x="108" y="60" width="20" height="14" rx="4" fill="#cdd9f8" />
        <rect x="16" y="52" width="16" height="16" rx="5" fill="#dbe5fb" opacity="0.7" />
      </svg>
    )
  }
  if (art === 'orders') {
    return (
      <svg viewBox="0 0 220 90" fill="none" aria-hidden className="h-full w-auto">
        <g transform="rotate(-5 150 48)">
          <rect x="120" y="14" width="64" height="66" rx="10" fill="#ffffff" opacity="0.95" />
          <rect x="120" y="14" width="64" height="66" rx="10" stroke="#dbe5fb" />
          <rect x="142" y="8" width="20" height="12" rx="4" fill="#3b82f6" />
          <rect x="130" y="32" width="44" height="6" rx="3" fill="#bfdbfe" />
          <rect x="130" y="44" width="36" height="6" rx="3" fill="#dbe5fb" />
          <rect x="130" y="56" width="40" height="6" rx="3" fill="#dbe5fb" />
        </g>
        <g transform="rotate(8 196 62)">
          <rect x="184" y="48" width="26" height="26" rx="7" fill="#22c55e" />
          <path d="M191 61 l5 5 l8 -9" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
        <rect x="16" y="52" width="16" height="16" rx="5" fill="#dbe5fb" opacity="0.7" />
        <rect x="40" y="38" width="12" height="12" rx="4" fill="#cdd9f8" opacity="0.7" />
      </svg>
    )
  }
  // customers
  return (
    <svg viewBox="0 0 220 90" fill="none" aria-hidden className="h-full w-auto">
      <circle cx="150" cy="40" r="18" fill="#3b82f6" />
      <circle cx="150" cy="34" r="7" fill="#bfdbfe" />
      <path d="M136 52 a14 12 0 0 1 28 0 v4 h-28 z" fill="#bfdbfe" />
      <path d="M150 58 h46 a10 10 0 0 1 10 10 v12 h-56 z" fill="#60a5fa" opacity="0.7" />
      <rect x="16" y="56" width="10" height="18" rx="3" fill="#93c5fd" />
      <rect x="32" y="46" width="10" height="28" rx="3" fill="#bfdbfe" />
      <rect x="48" y="38" width="10" height="36" rx="3" fill="#dbe5fb" />
      <rect x="64" y="28" width="10" height="46" rx="3" fill="#cdd9f8" />
      <rect x="196" y="22" width="14" height="14" rx="5" fill="#dbe5fb" />
    </svg>
  )
}

interface PageHeroProps {
  title: string
  description: string
  art: HeroArt
}

export function PageHero({ title, description, art }: PageHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#eaf1ff] via-[#e9edff] to-[#ece7fd] px-7 py-6">
      <div aria-hidden className="absolute -top-12 right-1/3 h-32 w-32 rounded-full bg-white/50 blur-3xl" />
      <div className="relative flex items-center justify-between gap-6">
        <div className="min-w-0 py-1">
          <h2 className="text-2xl font-black tracking-tight text-slate-900">{title}</h2>
          <p className="mt-1.5 text-sm text-slate-500">{description}</p>
        </div>
        <div aria-hidden className="hidden h-[88px] shrink-0 md:block">
          <HeroArtwork art={art} />
        </div>
      </div>
    </section>
  )
}

export type StatTone = 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'slate'

const TONES: Record<StatTone, string> = {
  blue: 'bg-[#e8f0fe] text-[#3b82f6]',
  green: 'bg-[#e5f7eb] text-[#22c55e]',
  purple: 'bg-[#f1ebfe] text-[#8b5cf6]',
  orange: 'bg-[#fdf0e3] text-[#f97316]',
  red: 'bg-[#fdeaea] text-[#ef4444]',
  slate: 'bg-[#f1f4f9] text-slate-500',
}

interface MiniStatCardProps {
  label: string
  value: string
  change?: string
  changeType?: 'increase' | 'decrease'
  note?: string
  icon: LucideIcon
  tone: StatTone
}

export function MiniStatCard({ label, value, change, changeType, note, icon: Icon, tone }: MiniStatCardProps) {
  return (
    <div className="flex items-center gap-3.5 rounded-xl border border-[#eef1f6] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', TONES[tone])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-400">{label}</p>
        <p className="mt-0.5 text-xl font-black leading-none tracking-tight text-slate-900">{value}</p>
        {(change || note) && (
          <p className="mt-1 flex items-center gap-1 text-[11px] font-medium">
            {change && (
              <span className={cn('flex items-center gap-0.5', changeType === 'decrease' ? 'text-red-500' : 'text-emerald-600')}>
                {changeType === 'decrease' ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                {change}
              </span>
            )}
            {note && <span className="text-amber-500">{note}</span>}
          </p>
        )}
      </div>
    </div>
  )
}

interface TablePaginationProps {
  total: number
  page: number
  pageSize: number
  totalPages: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  totalLabel: string
  perPageLabel: string
}

export function TablePagination({
  total,
  page,
  pageSize,
  totalPages,
  onPageChange,
  onPageSizeChange,
  totalLabel,
  perPageLabel,
}: TablePaginationProps) {
  const pages: (number | 'ellipsis')[] = []
  const windowed = new Set<number>([1, 2, 3, 4, 5, page, totalPages].filter((p) => p >= 1 && p <= totalPages))
  const sorted = [...windowed].sort((a, b) => a - b)
  let previous = 0
  for (const p of sorted) {
    if (p - previous > 1) pages.push('ellipsis')
    pages.push(p)
    previous = p
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#f4f6fa] px-4 py-3">
      <p className="text-xs text-slate-400">
        {totalLabel} <span className="font-semibold text-slate-600">{total.toLocaleString()}</span>
      </p>
      <div className="flex items-center gap-3">
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {pages.map((p, index) =>
            p === 'ellipsis' ? (
              <span key={`ellipsis-${index}`} className="px-1 text-xs text-slate-300">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={cn(
                  'flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors',
                  p === page ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                {p}
              </button>
            ),
          )}
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5 text-xs text-slate-400">
            <select
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="h-8 rounded-lg border border-[#eef1f6] bg-white px-2 text-xs text-slate-600 outline-none focus:border-blue-300"
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            {perPageLabel}
          </label>
        )}
      </div>
    </div>
  )
}

/** Sortable-looking table header cell (decorative sort affordance). */
export function SortableTh({ label, className }: { label: string; className?: string }) {
  return (
    <th className={cn('px-3 py-3', className)}>
      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
        {label}
        <svg viewBox="0 0 12 12" className="h-3 w-3 text-slate-300" fill="none" aria-hidden>
          <path d="M6 2.5v7M6 2.5L3.5 5M6 2.5L8.5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6 9.5L3.5 7M6 9.5L8.5 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </th>
  )
}
