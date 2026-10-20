/**
 * Welcome banner for the redesigned dashboard overview.
 *
 * Gradient hero with greeting copy, a date-range pill, and an SVG illustration
 * approximating the reference artwork (floating sales card, shopping bag,
 * geometric cubes).
 */

'use client'

import { CalendarDays, ChevronDown } from 'lucide-react'
import { useT } from 'shared/src/i18n/react'

function formatDate(date: Date): string {
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
}

function monthRange(): string {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return `${formatDate(first)} - ${formatDate(last)}`
}

function HeroIllustration() {
  return (
    <div aria-hidden className="pointer-events-none relative hidden h-full min-w-[300px] flex-1 md:block">
      <svg viewBox="0 0 420 170" fill="none" className="absolute right-0 top-1/2 h-[140px] w-[350px] -translate-y-1/2">
        {/* backdrop cubes */}
        <rect x="18" y="96" width="26" height="26" rx="6" fill="#c7d6f6" opacity="0.55" />
        <rect x="52" y="72" width="20" height="20" rx="5" fill="#d7e2fa" opacity="0.6" />
        <rect x="40" y="122" width="16" height="16" rx="4" fill="#cdd9f8" opacity="0.5" />
        <rect x="356" y="34" width="22" height="22" rx="6" fill="#cdd9f8" opacity="0.6" />
        <rect x="384" y="58" width="16" height="16" rx="5" fill="#dbe5fb" opacity="0.55" />
        {/* floating sales card */}
        <g transform="rotate(-4 250 85)">
          <rect x="160" y="18" width="176" height="112" rx="14" fill="#ffffff" opacity="0.92" />
          <rect x="160" y="18" width="176" height="112" rx="14" stroke="#e3eaf9" />
          <text x="178" y="46" fill="#8a94a6" fontSize="11" fontWeight="600">销售额</text>
          <text x="176" y="72" fill="#1f2937" fontSize="20" fontWeight="800">$8,736</text>
          <rect x="176" y="80" width="46" height="14" rx="7" fill="#e7f8ef" />
          <text x="184" y="90" fill="#16a34a" fontSize="9" fontWeight="700">↑ 12.5%</text>
          {/* mini bars */}
          <rect x="238" y="92" width="9" height="24" rx="3" fill="#bfdbfe" />
          <rect x="252" y="80" width="9" height="36" rx="3" fill="#93c5fd" />
          <rect x="266" y="68" width="9" height="48" rx="3" fill="#60a5fa" />
          <rect x="280" y="56" width="9" height="60" rx="3" fill="#3b82f6" />
          <rect x="294" y="44" width="9" height="72" rx="3" fill="#2563eb" />
          {/* trend line */}
          <path d="M238 96 L252 88 L266 78 L280 64 L294 50" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" />
        </g>
        {/* shopping bag */}
        <g transform="rotate(6 356 120)">
          <path d="M330 96 h52 a8 8 0 0 1 8 8 v46 a12 12 0 0 1 -12 12 h-44 a12 12 0 0 1 -12 -12 v-46 a8 8 0 0 1 8 -8 z" fill="#3b82f6" />
          <path d="M341 96 v-10 a15 15 0 0 1 30 0 v10" stroke="#1e40af" strokeWidth="6" strokeLinecap="round" fill="none" />
          <rect x="336" y="112" width="40" height="34" rx="8" fill="#60a5fa" opacity="0.5" />
        </g>
        {/* green check chip */}
        <g transform="rotate(-8 196 148)">
          <rect x="178" y="132" width="38" height="38" rx="11" fill="#22c55e" />
          <path d="M189 151 l6 6 l11 -12" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
        {/* small bag behind card */}
        <g transform="rotate(-14 128 60)" opacity="0.9">
          <path d="M112 44 h32 a6 6 0 0 1 6 6 v30 a9 9 0 0 1 -9 9 h-26 a9 9 0 0 1 -9 -9 v-30 a6 6 0 0 1 6 -6 z" fill="#93c5fd" />
          <path d="M121 44 v-7 a11 11 0 0 1 22 0 v7" stroke="#3b82f6" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        </g>
      </svg>
    </div>
  )
}

interface WelcomeBannerProps {
  /** Range label shown in the date pill; defaults to the current month. */
  rangeLabel?: string
}

export function WelcomeBanner({ rangeLabel }: WelcomeBannerProps) {
  const t = useT()

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#eaf1ff] via-[#e9edff] to-[#ece7fd] px-7 py-9">
      {/* soft glow accents */}
      <div aria-hidden className="absolute -top-16 right-1/3 h-40 w-40 rounded-full bg-white/50 blur-3xl" />
      <div aria-hidden className="absolute bottom-0 left-1/3 h-24 w-64 rounded-full bg-blue-200/30 blur-3xl" />

      <div className="relative flex items-stretch gap-6">
        <div className="flex min-w-0 flex-col justify-center">
          <p className="text-sm font-medium text-slate-600">
            {getText('merchant.dashboard.overview.welcomeBack', '欢迎回来，Jiffoo Admin 👋')}
          </p>
          <h2 className="mt-1.5 text-[26px] font-black leading-tight tracking-tight text-slate-900 sm:text-[30px]">
            {getText('merchant.dashboard.overview.headline', '让生意更简单、更高效')}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {getText('merchant.dashboard.overview.tagline', '实时掌握店铺动态，数据驱动增长。')}
          </p>
        </div>

        <HeroIllustration />

        <div className="absolute right-0 top-0">
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-[#e6ebf4] bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-white"
          >
            <CalendarDays className="h-4 w-4 text-slate-500" />
            {rangeLabel ?? monthRange()}
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>
        </div>
      </div>
    </section>
  )
}
