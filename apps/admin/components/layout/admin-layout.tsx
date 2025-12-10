/**
 * Admin Layout Component for Tenant Application
 *
 * Main layout wrapper with sidebar, header, and protected route.
 * Uses i18n for page titles.
 */

'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from './sidebar'
import { Header } from './header'
import ProtectedRoute from '../auth/ProtectedRoute'
import { useT, useLocale } from 'shared/src/i18n'

interface AdminLayoutProps {
  children: React.ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname()
  const locale = useLocale()
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  // Get page title based on current route with i18n support
  const getPageTitle = (path: string) => {
    const segments = path.split('/').filter(Boolean)
    // Remove locale segment if present
    const filteredSegments = segments.filter(s => s !== locale)

    if (filteredSegments.length === 0) return getText('tenant.nav.dashboard', 'Dashboard')

    const pageMap: Record<string, { key: string; fallback: string }> = {
      'dashboard': { key: 'tenant.nav.dashboard', fallback: 'Dashboard' },
      'products': { key: 'tenant.products.title', fallback: 'Products' },
      'orders': { key: 'tenant.orders.title', fallback: 'Orders' },
      'customers': { key: 'tenant.customers.title', fallback: 'Customers' },
      'analytics': { key: 'common.labels.analytics', fallback: 'Analytics' },
      'marketing': { key: 'tenant.nav.marketing', fallback: 'Marketing' },
      'finance': { key: 'common.labels.finance', fallback: 'Finance' },
      'plugins': { key: 'tenant.plugins.title', fallback: 'Plugin Store' },
      'settings': { key: 'tenant.settings.title', fallback: 'Settings' },
      'licenses': { key: 'common.labels.licenses', fallback: 'Licenses' }
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
    <ProtectedRoute requireAdmin={false}>
      <div className="flex h-screen bg-gray-50">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <Header title={getPageTitle(pathname)} />

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}
