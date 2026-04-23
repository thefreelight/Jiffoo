/**
 * Admin Layout Component for Tenant Application
 *
 * Main layout wrapper with sidebar, header, and protected route.
 * Uses i18n for page titles.
 */

'use client'

import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'
import ProtectedRoute from '../auth/ProtectedRoute'
import { useT, useLocale } from 'shared/src/i18n/react'
import { cn } from '@/lib/utils'

interface AdminLayoutProps {
  children: React.ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  const locale = useLocale()
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  // Get page title based on current route with i18n support
  const getPageTitle = (path: string) => {
    const segments = path.split('/').filter(Boolean)
    // Remove locale segment if present
    const filteredSegments = segments.filter(s => s !== locale)

    if (filteredSegments.length === 0) return getText('merchant.nav.dashboard', 'Dashboard')

    const pageMap: Record<string, { key: string; fallback: string }> = {
      'dashboard': { key: 'merchant.nav.dashboard', fallback: 'Dashboard' },
      'products': { key: 'merchant.products.title', fallback: 'Products' },
      'orders': { key: 'merchant.orders.title', fallback: 'Orders' },
      'customers': { key: 'merchant.customers.title', fallback: 'Customers' },
      'staff': { key: 'merchant.nav.staff', fallback: 'Staff' },
      'analytics': { key: 'common.labels.analytics', fallback: 'Analytics' },
      'finance': { key: 'common.labels.finance', fallback: 'Finance' },
      'plugins': { key: 'merchant.nav.plugins', fallback: 'Plugins' },
      'themes': { key: 'merchant.nav.themes', fallback: 'Themes' },
      'settings': { key: 'merchant.settings.title', fallback: 'Settings' }
    }

    const pageInfo = pageMap[filteredSegments[0]]
    if (pageInfo) {
      return getText(pageInfo.key, pageInfo.fallback)
    }
    return filteredSegments[0].charAt(0).toUpperCase() + filteredSegments[0].slice(1)
  }

  // Public routes that don't need authentication
  const publicRoutes = ['/auth/login', '/auth/register']
  const isPublicRoute = publicRoutes.some(route => pathname.includes(route))

  if (isPublicRoute) {
    return <>{children}</>
  }

  return (
    <ProtectedRoute requireAdmin={true}>
      <div className="flex h-screen bg-white dark:bg-gray-950 overflow-hidden">
        {/* Sidebar Overlay (Mobile) */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-sm lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <Sidebar
          className={cn(
            "fixed inset-y-0 left-0 z-50 lg:static lg:block transform transition-transform duration-300 ease-in-out",
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header */}
          <Header
            title={getPageTitle(pathname)}
            onMenuClick={() => setIsMobileMenuOpen(true)}
          />

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}
