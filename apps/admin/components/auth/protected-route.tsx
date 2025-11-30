'use client'

import { useEffect, ReactNode, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  children: ReactNode
  requireSuperAdmin?: boolean
}

export default function ProtectedRoute({ children, requireSuperAdmin = true }: ProtectedRouteProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, isLoading, isChecking, user, checkAuth } = useAuthStore()
  const [hasInitialized, setHasInitialized] = useState(false)

  useEffect(() => {
    // Initialize authentication check
    const initAuth = async () => {
      await checkAuth()
      setHasInitialized(true)
    }

    if (!hasInitialized) {
      initAuth()
    }
  }, [checkAuth, hasInitialized])

  useEffect(() => {
    // Only perform redirect checks when initialization is complete and not loading
    if (hasInitialized && !isLoading && !isChecking) {
      if (!isAuthenticated) {
        // Save current path for redirect after login
        if (pathname !== '/login' && pathname !== '/') {
          sessionStorage.setItem('redirectPath', pathname)
        }
        router.replace('/login')
        return
      }

      if (requireSuperAdmin && user?.role && user.role !== 'SUPER_ADMIN') {
        console.warn('ProtectedRoute: Access denied - user role:', user?.role, 'required: SUPER_ADMIN')
        router.replace('/login')
        return
      }
    }
  }, [hasInitialized, isAuthenticated, isLoading, isChecking, user, requireSuperAdmin, router, pathname])

  // Show loading state: initializing or checking authentication
  if (!hasInitialized || isLoading || isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Verifying authentication...</p>
        </div>
      </div>
    )
  }

  // After authentication check, show redirect message if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Redirecting to login page...</p>
        </div>
      </div>
    )
  }

  // Permission check
  if (requireSuperAdmin && user?.role && user.role !== 'SUPER_ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h2>
            <p className="text-red-600">You don't have permission to access this page. Super Admin role required.</p>
            <p className="text-sm text-gray-500 mt-2">Current role: {user?.role || 'Unknown'}</p>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
