'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { authApi } from '../lib/api';

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * Client-side auth guard component
 * Redirects to login if user is not authenticated
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'en';

  useEffect(() => {
    if (!authApi.isAuthenticated()) {
      // Get current path for redirect after login
      const currentPath = window.location.pathname + window.location.search;
      router.replace(`/${locale}/auth/login?next=${encodeURIComponent(currentPath)}`);
    }
  }, [locale, router]);

  // Show nothing while checking auth (avoid flash)
  if (typeof window !== 'undefined' && !authApi.isAuthenticated()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] text-[#bdbdbd] font-mono">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border border-[#2a2a2a] bg-[#1c1c1c] flex items-center justify-center mb-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-[#1c1c1c]"></div>
            <div className="animate-spin rounded-none h-6 w-6 border-b-2 border-[var(--c-fff)]"></div>
          </div>
          <p className="text-[10px] uppercase tracking-widest">Authenticating Connection...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Hook to check auth and redirect
 * Returns true if authenticated, handles redirect if not
 */
export function useRequireAuth(): boolean {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'en';
  const isAuthenticated = typeof window !== 'undefined' ? authApi.isAuthenticated() : false;

  useEffect(() => {
    if (typeof window !== 'undefined' && !authApi.isAuthenticated()) {
      const currentPath = window.location.pathname + window.location.search;
      router.replace(`/${locale}/auth/login?next=${encodeURIComponent(currentPath)}`);
    }
  }, [isAuthenticated, locale, router]);

  return isAuthenticated;
}

/**
 * Hook for add to cart with auth check
 * Returns a function that handles auth redirect before cart action
 */
export function useAuthenticatedAction() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'en';

  const requireAuth = (action: () => void | Promise<void>): void => {
    if (!authApi.isAuthenticated()) {
      const currentPath = window.location.pathname + window.location.search;
      router.push(`/${locale}/auth/login?next=${encodeURIComponent(currentPath)}`);
      return;
    }
    action();
  };

  return { requireAuth, isAuthenticated: authApi.isAuthenticated() };
}
