'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

/**
 * Hook for navigation that preserves tenant query parameter
 * 
 * This ensures that when users navigate within a mall, they stay in the same tenant context.
 * For example, if a user is on /?tenant=1, clicking "Login" will go to /auth/login?tenant=1
 * instead of /auth/login (which would trigger tenant switch detection).
 */
export function useTenantNavigation() {
  const router = useRouter();
  const searchParams = useSearchParams();

  /**
   * Navigate to a path while preserving the tenant parameter
   * @param path - The path to navigate to (e.g., '/auth/login', '/products')
   * @param options - Additional options for navigation
   */
  const push = useCallback((path: string, options?: { scroll?: boolean }) => {
    const tenant = searchParams.get('tenant');
    
    // If tenant exists, append it to the path
    if (tenant) {
      const separator = path.includes('?') ? '&' : '?';
      const fullPath = `${path}${separator}tenant=${tenant}`;
      router.push(fullPath, options);
    } else {
      router.push(path, options);
    }
  }, [router, searchParams]);

  /**
   * Replace current URL while preserving the tenant parameter
   * @param path - The path to replace with
   */
  const replace = useCallback((path: string) => {
    const tenant = searchParams.get('tenant');
    
    if (tenant) {
      const separator = path.includes('?') ? '&' : '?';
      const fullPath = `${path}${separator}tenant=${tenant}`;
      router.replace(fullPath);
    } else {
      router.replace(path);
    }
  }, [router, searchParams]);

  /**
   * Get a URL with tenant parameter appended
   * Useful for Link components
   * @param path - The base path
   * @returns The path with tenant parameter if it exists
   */
  const getHref = useCallback((path: string): string => {
    const tenant = searchParams.get('tenant');
    
    if (tenant) {
      const separator = path.includes('?') ? '&' : '?';
      return `${path}${separator}tenant=${tenant}`;
    }
    
    return path;
  }, [searchParams]);

  /**
   * Get the current tenant ID from URL
   * @returns The tenant ID or null if not present
   */
  const getTenantId = useCallback((): string | null => {
    return searchParams.get('tenant');
  }, [searchParams]);

  return {
    push,
    replace,
    getHref,
    getTenantId,
  };
}

