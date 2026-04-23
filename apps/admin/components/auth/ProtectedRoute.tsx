/**
 * Protected Route Component
 *
 * Handles authentication and authorization for protected pages with i18n support.
 */

'use client'

import { useEffect, ReactNode, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import {
  canAccessAnyPermission,
  getFirstAccessibleAdminPath,
  getRequiredPermissionsForAdminPath,
  hasAdminWorkspaceAccess,
} from '@/lib/admin-access'
import { Loader2 } from 'lucide-react'
import { useT, useLocale } from 'shared/src/i18n/react'
import type { AdminPermission } from 'shared'

interface ProtectedRouteProps {
  children: ReactNode
  requireAdmin?: boolean
  requiredPermissions?: readonly AdminPermission[]
}

export default function ProtectedRoute({
  children,
  requireAdmin = false,
  requiredPermissions,
}: ProtectedRouteProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, isLoading, isChecking, user, checkAuth } = useAuthStore()
  const [hasInitialized, setHasInitialized] = useState(false)
  const t = useT()
  const locale = useLocale()
  const resolvedPermissions = requiredPermissions
    ?? (requireAdmin ? getRequiredPermissionsForAdminPath(pathname, locale) : undefined)
  const hasAdminAccess = hasAdminWorkspaceAccess(user)
  const hasRequiredPermissions = canAccessAnyPermission(user, resolvedPermissions)

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
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

      if (requireAdmin && !hasAdminAccess) {
        console.warn('Access denied - user has no admin workspace access:', user?.role)
        return
      }

      if (requireAdmin && resolvedPermissions && !hasRequiredPermissions) {
        console.warn('Access denied - missing permissions:', resolvedPermissions, 'role:', user?.role)
        return
      }
    }
  }, [
    hasAdminAccess,
    hasInitialized,
    hasRequiredPermissions,
    isAuthenticated,
    isChecking,
    isLoading,
    locale,
    pathname,
    requireAdmin,
    resolvedPermissions,
    router,
    user,
  ])

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
  // Permission check
  if (requireAdmin && !hasAdminAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <h2 className="text-lg font-semibold text-red-800 mb-2">{getText('merchant.auth.accessDenied', 'Access Denied')}</h2>
            <p className="text-red-600">{getText('merchant.auth.noPermission', 'You do not have permission to access this page. Admin workspace access is required.')}</p>
            <p className="text-sm text-gray-500 mt-2">{getText('merchant.auth.currentRole', 'Current role')}: {user?.role || getText('common.unknown', 'Unknown')}</p>
          </div>
        </div>
      </div>
    )
  }

  if (requireAdmin && resolvedPermissions && !hasRequiredPermissions) {
    const landingPath = getFirstAccessibleAdminPath(user, locale)

    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <h2 className="text-lg font-semibold text-red-800 mb-2">{getText('merchant.auth.accessDenied', 'Access Denied')}</h2>
            <p className="text-red-600">{getText('merchant.auth.noPermission', 'You do not have permission to access this page.')}</p>
            <p className="text-sm text-gray-500 mt-2">{getText('merchant.auth.currentRole', 'Current role')}: {user?.role || getText('common.unknown', 'Unknown')}</p>
            <button
              type="button"
              onClick={() => router.replace(landingPath)}
              className="mt-4 inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
            >
              {getText('merchant.auth.backToDashboard', 'Go to an accessible page')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
