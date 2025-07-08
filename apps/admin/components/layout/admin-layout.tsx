'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from './sidebar'
import { Header } from './header'
import ProtectedRoute from '../auth/ProtectedRoute'

interface AdminLayoutProps {
  children: React.ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname()
  
  // Get page title based on current route
  const getPageTitle = (path: string) => {
    const segments = path.split('/').filter(Boolean)
    
    if (segments.length === 0) return 'Dashboard'
    
    const pageMap: Record<string, string> = {
      'dashboard': 'Dashboard',
      'products': 'Products',
      'orders': 'Orders',
      'customers': 'Customers',
      'analytics': 'Analytics',
      'marketing': 'Marketing',
      'finance': 'Finance',
      'plugins': 'Plugin Store',
      'settings': 'Settings',
      'licenses': 'Licenses'
    }
    
    return pageMap[segments[0]] || segments[0].charAt(0).toUpperCase() + segments[0].slice(1)
  }

  // 不需要权限验证的页面
  const publicRoutes = ['/auth/login', '/auth/register']
  const isPublicRoute = publicRoutes.includes(pathname)

  if (isPublicRoute) {
    return <>{children}</>
  }

  return (
    <ProtectedRoute requireAdmin={true}>
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
