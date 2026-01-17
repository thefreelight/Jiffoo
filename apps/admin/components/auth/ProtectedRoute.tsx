/**
 * Protected Route Component
 *
 * Handles authentication and authorization for protected pages with i18n support.
 */

'use client'

import { useEffect, ReactNode, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { Loader2 } from 'lucide-react'
import { useT, useLocale } from 'shared/src/i18n/react'

interface ProtectedRouteProps {
  children: ReactNode
  requireAdmin?: boolean
}

export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, isLoading, isChecking, user, checkAuth } = useAuthStore()
  const [hasInitialized, setHasInitialized] = useState(false)
  const t = useT()
  const locale = useLocale()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  useEffect(() => {
    // Check authentication status on initialization
    const initAuth = async () => {
      await checkAuth()
      setHasInitialized(true)
    }

    if (!hasInitialized) {
      initAuth()
    }
  }, [checkAuth, hasInitialized])

  useEffect(() => {
    // Only perform redirect judgment when initialization is complete and not in loading state
    if (hasInitialized && !isLoading && !isChecking) {
      if (!isAuthenticated) {
        // Save current path for redirect after login
        if (pathname !== `/${locale}/auth/login` && pathname !== '/' && pathname !== `/${locale}`) {
          sessionStorage.setItem('redirectPath', pathname)
        }
        router.replace(`/${locale}/auth/login`)
        return
      }

      if (requireAdmin && user?.role && !['ADMIN', 'SUPER_ADMIN', 'TENANT_ADMIN'].includes(user.role)) {
        console.warn('Access denied - user role:', user?.role, 'required: ADMIN or higher')
        router.replace(`/${locale}/auth/login`)
        return
      }
    }
  }, [hasInitialized, isAuthenticated, isLoading, isChecking, user, requireAdmin, router, pathname])

  // Show loading state: initializing or checking authentication
  if (!hasInitialized || isLoading || isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">{getText('merchant.auth.verifyingIdentity', 'Verifying identity...')}</p>
        </div>
      </div>
    )
  }

  // After authentication check is complete, show redirect prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">{getText('merchant.auth.redirectingToLogin', 'Redirecting to login page...')}</p>
        </div>
      </div>
    )
  }

  // Permission check
  if (requireAdmin && user?.role && !['ADMIN', 'SUPER_ADMIN', 'TENANT_ADMIN'].includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <h2 className="text-lg font-semibold text-red-800 mb-2">{getText('merchant.auth.accessDenied', 'Access Denied')}</h2>
            <p className="text-red-600">{getText('merchant.auth.noPermission', 'You do not have permission to access this page. Admin privileges required.')}</p>
            <p className="text-sm text-gray-500 mt-2">{getText('merchant.auth.currentRole', 'Current role')}: {user?.role || getText('common.unknown', 'Unknown')}</p>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}