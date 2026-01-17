/**
 * Conditional Layout Component
 *
 * Handles authentication state and renders appropriate layout with i18n support.
 */

'use client';

import { useAuthStore } from '@/lib/store';
import { AdminLayout } from './admin-layout';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useT } from 'shared/src/i18n/react';

interface ConditionalLayoutProps {
  children: React.ReactNode;
}

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  // Login page path
  const isLoginPage = pathname === '/';

  // Initialize authentication check
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Route protection: redirect to login if unauthenticated and accessing protected page
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isLoginPage) {
      router.push('/');
    }
  }, [isLoading, isAuthenticated, isLoginPage, router]);

  // Redirect to dashboard if authenticated and on login page
  useEffect(() => {
    if (!isLoading && isAuthenticated && isLoginPage) {
      router.push('/dashboard');
    }
  }, [isLoading, isAuthenticated, isLoginPage, router]);

  // Show loading screen if auth state is loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600">{getText('common.loading', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  // Show admin layout if authenticated and not on login page
  if (isAuthenticated && !isLoginPage) {
    return <AdminLayout>{children}</AdminLayout>;
  }

  // Only show page content if unauthenticated and on login page
  if (!isAuthenticated && isLoginPage) {
    return <>{children}</>;
  }

  // Other cases (unauthenticated accessing protected page) show loading/redirecting state
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-600">{getText('common.redirecting', 'Redirecting...')}</p>
      </div>
    </div>
  );
}
