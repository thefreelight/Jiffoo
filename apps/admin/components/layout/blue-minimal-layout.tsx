/**
 * Blue Minimal Admin Layout Component for Tenant Application
 *
 * Main layout wrapper using Jiffoo Blue Minimal design system.
 * Features fixed sidebar, fixed header, and scrollable content area.
 * Supports responsive design with mobile sidebar overlay.
 */

'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Bell, ChevronDown, CircleHelp, Menu } from 'lucide-react'
import { BlueMinimalSidebar } from './blue-minimal-sidebar'
import ProtectedRoute from '../auth/ProtectedRoute'
import { ManagedModeProvider, useManagedMode } from '@/lib/managed-mode'
import { AdminLanguageSwitcher } from '@/components/i18n/admin-language-switcher'

interface BlueMinimalLayoutProps {
  children: React.ReactNode
}

export function BlueMinimalLayout({ children }: BlueMinimalLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const pathname = usePathname()

  // Public routes that don't need authentication
  const publicRoutes = ['/auth/login', '/auth/register', '/install']
  const isPublicRoute = publicRoutes.some(route => pathname.includes(route))

  if (isPublicRoute) {
    return <>{children}</>
  }

  const handleOpenSidebar = () => setIsSidebarOpen(true)
  const handleCloseSidebar = () => setIsSidebarOpen(false)

  return (
    <ProtectedRoute requireAdmin={true}>
      <ManagedModeProvider>
        <ManagedDocumentTitle />
        <div className="flex h-screen overflow-hidden bg-[#F1F5F9] font-sans">
          {/* Sidebar */}
          <BlueMinimalSidebar
            isOpen={isSidebarOpen}
            onClose={handleCloseSidebar}
          />

          <div className="flex-1 flex flex-col overflow-hidden bg-white">
            <header className="hidden h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-7 lg:flex">
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <span className="font-medium">Jiffoo Admin</span>
                <span className="text-slate-300">/</span>
                <span className="font-medium capitalize text-slate-900">
                  {pathname.split('/').filter(Boolean).slice(-1)[0]?.replace(/-/g, ' ') || 'Dashboard'}
                </span>
              </div>
              <div className="flex items-center gap-5 text-slate-500">
                <AdminLanguageSwitcher />
                <button type="button" aria-label="Help" className="transition-colors hover:text-slate-900"><CircleHelp className="h-[18px] w-[18px]" /></button>
                <button type="button" aria-label="Notifications" className="transition-colors hover:text-slate-900"><Bell className="h-[18px] w-[18px]" /></button>
                <div className="flex items-center gap-2 border-l border-slate-200 pl-5 text-sm font-medium text-slate-900">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-600 text-xs font-semibold text-white">A</span>
                  <span>Admin</span>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </div>
              </div>
            </header>
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
      </ManagedModeProvider>
    </ProtectedRoute>
  )
}

function ManagedDocumentTitle() {
  const { record, isManaged } = useManagedMode()

  useEffect(() => {
    document.title = isManaged && record
      ? `${record.displayBrandName} · ${record.displaySolutionName}`
      : 'Jiffoo Admin'
  }, [isManaged, record])

  return null
}
