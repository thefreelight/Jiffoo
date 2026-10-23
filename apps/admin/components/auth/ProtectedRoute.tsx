/**
 * Protected Route Component
 *
 * Handles authentication and authorization for protected pages with i18n support.
 */

'use client'

import { useEffect, ReactNode, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { apiClient } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { hasAdminWorkspaceAccess } from '@/lib/admin-access'
import { Loader2 } from 'lucide-react'
import { SessionLoading } from './session-loading'
import { useT, useLocale } from 'shared/src/i18n/react'

interface ProtectedRouteProps {
  children: ReactNode
  requireAdmin?: boolean
}

export default function ProtectedRoute({
  children,
  requireAdmin = false,
}: ProtectedRouteProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, isLoading, isChecking, authError, user, checkAuth } = useAuthStore()
  const [hasInitialized, setHasInitialized] = useState(false)
  const t = useT()
  const locale = useLocale()
  const hasAdminAccess = hasAdminWorkspaceAccess(user)
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!hasInitialized || !isAuthenticated || !requireAdmin) return;
    let stopped = false, busy = false;
    const verifySession = async () => {
      if (busy || queryClient.isMutating({ mutationKey: ['account-password-change'] })) return;
      busy = true;
      const token = apiClient.getToken();
      try {
        const response = await fetch('/api/v1/auth/me', { cache: 'no-store', credentials: 'same-origin', headers: token ? { Authorization: 'Bearer ' + token } : {} });
        if (!stopped && !queryClient.isMutating({ mutationKey: ['account-password-change'] }) && token === apiClient.getToken() && (response.status === 401 || response.status === 403)) useAuthStore.getState().logout('expired');
      } catch { /* A transport outage does not revoke an otherwise valid session. */ }
      finally { busy = false; }
    };
    const timer = setInterval(() => void verifySession(), 2000);
    window.addEventListener('focus', verifySession);
    return () => { stopped = true; clearInterval(timer); window.removeEventListener('focus', verifySession); };
  }, [hasInitialized, isAuthenticated, requireAdmin, queryClient]);

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

    void initAuth()
  }, [checkAuth])

  useEffect(() => {
    // Only perform redirect judgment when initialization is complete and not in loading state
    if (hasInitialized && !isLoading && !isChecking && !authError) {
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

    }
  }, [
    hasAdminAccess,
    authError,
    hasInitialized,
    isAuthenticated,
    isChecking,
    isLoading,
    locale,
    pathname,
    requireAdmin,
    router,
    user,
  ])

  if (authError) return <div role="alert" className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-ground text-foreground">
    <p>{getText('merchant.authFlow.failed', 'Unable to restore your session.')}</p>
    <button type="button" onClick={() => void checkAuth()}>{getText('merchant.authFlow.retry', 'Retry')}</button>
  </div>;

  // Keep the target URL while the server establishes identity and current access.
  if (!hasInitialized || isLoading || isChecking) {
    return <SessionLoading />
  }

  // After authentication check is complete, show redirect prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-foreground">{getText('merchant.auth.redirectingToLogin', 'Redirecting to login page...')}</p>
        </div>
      </div>
    )
  }

  // Admin account check
  if (requireAdmin && !hasAdminAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="bg-destructive-soft border border-destructive-soft rounded-lg p-6 max-w-md">
            <h2 className="text-lg font-semibold text-destructive mb-2">{getText('merchant.auth.accessDenied', 'Access Denied')}</h2>
            <p className="text-destructive">{getText('merchant.auth.noPermission', 'You do not have permission to access this page. Admin privileges required.')}</p>
            <p className="text-sm text-muted-foreground mt-2">{getText('merchant.auth.currentRole', 'Current role')}: {user?.role || getText('common.unknown', 'Unknown')}</p>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
