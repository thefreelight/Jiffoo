'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from './sidebar'
import { Header } from './header'

interface SuperAdminLayoutProps {
  children: React.ReactNode
}

export function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const pathname = usePathname()
  
  // Get page title based on current route
  const getPageTitle = (path: string) => {
    const segments = path.split('/').filter(Boolean)
    
    if (segments.length === 0) return 'Dashboard'
    
    const pageMap: Record<string, string> = {
      'dashboard': 'Dashboard',
      'tenants': 'Tenant Management',
      'users': 'User Management',
      'analytics': 'Analytics & Reports',
      'system': 'System Management',
      'settings': 'Platform Settings'
    }
    
    return pageMap[segments[0]] || segments[0].charAt(0).toUpperCase() + segments[0].slice(1)
  }

  // Public routes that don't need the admin layout
  const publicRoutes = ['/login', '/auth/login', '/auth/register']
  const isPublicRoute = publicRoutes.includes(pathname)

  if (isPublicRoute) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header title={getPageTitle(pathname)} />
        
        {/* Page content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50">
          <div className="container mx-auto px-6 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
