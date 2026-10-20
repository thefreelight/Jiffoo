/**
 * Blue Minimal Admin Layout Component for Tenant Application
 *
 * Main layout wrapper using Jiffoo Blue Minimal design system.
 * Chrome per the reference design: fixed sidebar plus a floating top bar with
 * global search (⌘K), language switcher, notifications, and the assistant
 * button. Supports responsive design with mobile sidebar overlay.
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, Search, Bell, Bot, Globe, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { BlueMinimalSidebar } from './blue-minimal-sidebar'
import ProtectedRoute from '../auth/ProtectedRoute'
import { ManagedModeProvider, useManagedMode } from '@/lib/managed-mode'
import { getLanguageSwitcherItems } from 'shared/src/i18n/react'
import { useLocale, useT } from 'shared/src/i18n/react'

interface BlueMinimalLayoutProps {
  children: React.ReactNode
}

/** Language switcher styled as the reference globe + native-name pill. */
function TopBarLanguageSwitcher() {
  const pathname = usePathname()
  const locale = useLocale()
  const t = useT()
  const items = getLanguageSwitcherItems(locale, pathnameWithoutLocale(pathname, locale))

  const current = items.find((item) => item.isActive) ?? items[0]

  return (
    <div className="group relative">
      <button
        type="button"
        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        aria-haspopup="menu"
      >
        <Globe className="h-[18px] w-[18px] text-slate-500" />
        <span>{current?.nativeName ?? 'English'}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>
      <div className="invisible absolute right-0 top-full z-30 mt-1 w-40 rounded-xl border border-slate-100 bg-white p-1.5 opacity-0 shadow-xl transition-all group-hover:visible group-hover:opacity-100">
        {items.map((item) => (
          <Link
            key={item.locale}
            href={item.href}
            className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
              item.isActive
                ? 'bg-[#eef4ff] font-semibold text-blue-600'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {item.nativeName}
          </Link>
        ))}
      </div>
    </div>
  )
}

function pathnameWithoutLocale(pathname: string, locale: string): string {
  const segments = pathname.split('/').filter(Boolean)
  if (segments[0] === locale) {
    return `/${segments.slice(1).join('/')}`.replace(/\/$/, '') || '/'
  }
  return pathname
}

export function BlueMinimalLayout({ children }: BlueMinimalLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const pathname = usePathname()
  const searchRef = useRef<HTMLInputElement>(null)
  const t = useT()

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  // Public routes that don't need authentication
  const publicRoutes = ['/auth/login', '/auth/register', '/install']
  const isPublicRoute = publicRoutes.some(route => pathname.includes(route))

  // ⌘K / Ctrl+K focuses global search.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (isPublicRoute) {
    return <>{children}</>
  }

  const handleOpenSidebar = () => setIsSidebarOpen(true)
  const handleCloseSidebar = () => setIsSidebarOpen(false)

  return (
    <ProtectedRoute requireAdmin={true}>
      <ManagedModeProvider>
        <ManagedDocumentTitle />
        <div className="flex h-screen overflow-hidden bg-[#f5f7fb] font-sans">
          {/* Sidebar */}
          <BlueMinimalSidebar
            isOpen={isSidebarOpen}
            onClose={handleCloseSidebar}
          />

          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            {/* Mobile Menu Button - Fixed at top left, hidden when sidebar is open */}
            {!isSidebarOpen && (
              <button
                onClick={handleOpenSidebar}
                className="lg:hidden fixed top-4 left-4 z-[60] p-3 bg-blue-600 text-white rounded-xl shadow-2xl hover:bg-blue-700 transition-all duration-200 hover:shadow-blue-500/50 hover:scale-105 active:scale-95"
                aria-label="Open menu"
              >
                <Menu className="w-6 h-6" />
              </button>
            )}

            {/* Top bar: global search + locale + notifications + assistant */}
            <div className="flex h-16 shrink-0 items-center justify-between gap-4 px-6">
              <div className="relative w-full max-w-[430px]">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchRef}
                  type="text"
                  className="h-10 w-full rounded-xl border border-transparent bg-white/80 pl-10 pr-14 text-sm text-slate-700 placeholder-slate-400 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-all focus:border-blue-200 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  placeholder={getText('merchant.header.searchPlaceholder', '搜索商品、订单、客户、插件等...')}
                />
                <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-400">
                  ⌘ K
                </kbd>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <TopBarLanguageSwitcher />
                <button
                  type="button"
                  aria-label="Notifications"
                  className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  <Bell className="h-[18px] w-[18px]" />
                  <span aria-hidden className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[#f5f7fb]" />
                </button>
                <button
                  type="button"
                  aria-label="AI assistant"
                  className="ml-1 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md transition-colors hover:bg-slate-700"
                >
                  <Bot className="h-[18px] w-[18px]" />
                </button>
              </div>
            </div>

            {/* Page Content - with skip-to-content target from GitLab */}
            <main id="main" tabIndex={-1} className="flex-1 overflow-y-auto">
              {children}
            </main>
          </div>
        </div>
      </ManagedModeProvider>
    </ProtectedRoute>
  )
}

function ManagedDocumentTitle() {
  const { record, isManaged } = useManagedMode()

  useEffect(() => {
    document.title = isManaged && record
      ? `${record.displayBrandName} · ${record.displaySolutionName}`
      : 'Commerce Admin - Management Dashboard'
  }, [isManaged, record])

  return null
}
