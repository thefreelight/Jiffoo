/**
 * Blue Minimal Admin Layout Component
 *
 * Main layout wrapper using Jiffoo Blue Minimal design system.
 * Features fixed sidebar, fixed header, and scrollable content area.
 * Supports responsive design with mobile sidebar overlay.
 */

'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { BlueMinimalSidebar } from './blue-minimal-sidebar'
import ProtectedRoute from '../auth/ProtectedRoute'
import { isPublicAdminRoute } from './public-routes'

interface BlueMinimalLayoutProps {
  children: React.ReactNode
}

export function BlueMinimalLayout({ children }: BlueMinimalLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const pathname = usePathname()

  if (isPublicAdminRoute(pathname)) {
    return <>{children}</>
  }

  const handleOpenSidebar = () => setIsSidebarOpen(true)
  const handleCloseSidebar = () => setIsSidebarOpen(false)

  return (
    <ProtectedRoute requireAdmin={true}>
      <div className="flex h-screen overflow-hidden bg-[#F1F5F9] font-sans">
          {/* Sidebar */}
          <BlueMinimalSidebar
            isOpen={isSidebarOpen}
            onClose={handleCloseSidebar}
          />

          <div className="flex-1 flex flex-col overflow-hidden bg-white">
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

            {/* Page Content - with skip-to-content target from GitLab */}
            <main id="main" tabIndex={-1} className="flex-1 overflow-y-auto">
              {children}
            </main>
          </div>
      </div>
    </ProtectedRoute>
  )
}
