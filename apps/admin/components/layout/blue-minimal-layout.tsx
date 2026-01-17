/**
 * Blue Minimal Admin Layout Component for Tenant Application
 *
 * Main layout wrapper using Jiffoo Blue Minimal design system.
 * Features fixed sidebar, fixed header, and scrollable content area.
 * Supports responsive design with mobile sidebar overlay.
 */

'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { BlueMinimalSidebar } from './blue-minimal-sidebar'
import { BlueMinimalHeader } from './blue-minimal-header'
import ProtectedRoute from '../auth/ProtectedRoute'
import { useT, useLocale } from 'shared/src/i18n/react'

interface BlueMinimalLayoutProps {
  children: React.ReactNode
}

export function BlueMinimalLayout({ children }: BlueMinimalLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
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

    if (filteredSegments.length === 0) return getText('merchant.nav.dashboard', 'Dashboard')

    const pageMap: Record<string, { key: string; fallback: string }> = {
      'dashboard': { key: 'merchant.nav.dashboard', fallback: 'Dashboard' },
      'products': { key: 'merchant.products.title', fallback: 'Products' },
      'orders': { key: 'merchant.orders.title', fallback: 'Orders' },
      'customers': { key: 'merchant.customers.title', fallback: 'Customers' },
      'analytics': { key: 'common.labels.analytics', fallback: 'Analytics' },
      'marketing': { key: 'merchant.nav.marketing', fallback: 'Marketing' },
      'finance': { key: 'common.labels.finance', fallback: 'Finance' },
      'plugins': { key: 'merchant.plugins.title', fallback: 'Plugin Store' },
      'settings': { key: 'merchant.settings.title', fallback: 'Settings' },
      'agents': { key: 'merchant.agent.title', fallback: 'Agents' },
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

  const handleOpenSidebar = () => setIsSidebarOpen(true)
  const handleCloseSidebar = () => setIsSidebarOpen(false)

  return (
    <ProtectedRoute requireAdmin={false}>
      <div className="flex h-screen overflow-hidden bg-[#F1F5F9] font-sans">
        {/* Sidebar */}
        <BlueMinimalSidebar
          isOpen={isSidebarOpen}
          onClose={handleCloseSidebar}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <BlueMinimalHeader
            title={getPageTitle(pathname)}
            onMenuClick={handleOpenSidebar}
          />

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto p-4 lg:p-8 bg-[#F1F5F9]">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}

