/**
 * Localized Navigation Hook
 * 
 * Provides navigation utilities that preserve both locale and tenant context.
 * This ensures that when users navigate within a mall, they stay in the same
 * language and tenant context.
 * 
 * Example: /zh-Hant/products?tenant=1 -> /zh-Hant/cart?tenant=1
 */

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { useLocale } from 'shared/src/i18n';

export function useLocalizedNavigation() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();

  /**
   * Build a localized path with tenant parameter
   * @param path - The base path (e.g., '/products', '/cart')
   * @returns Full path with locale prefix and tenant param
   */
  const buildLocalizedPath = useCallback((path: string): string => {
    const tenant = searchParams.get('tenant');
    
    // Ensure path starts with /
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    
    // Add locale prefix
    const localizedPath = `/${locale}${normalizedPath}`;
    
    // Add tenant parameter if exists
    if (tenant) {
      const separator = localizedPath.includes('?') ? '&' : '?';
      return `${localizedPath}${separator}tenant=${tenant}`;
    }
    
    return localizedPath;
  }, [locale, searchParams]);

  /**
   * Navigate to a path while preserving locale and tenant
   * @param path - The path to navigate to (e.g., '/cart', '/checkout')
   * @param options - Additional options for navigation
   */
  const push = useCallback((path: string, options?: { scroll?: boolean }) => {
    const fullPath = buildLocalizedPath(path);
    router.push(fullPath, options);
  }, [router, buildLocalizedPath]);

  /**
   * Replace current URL while preserving locale and tenant
   * @param path - The path to replace with
   */
  const replace = useCallback((path: string) => {
    const fullPath = buildLocalizedPath(path);
    router.replace(fullPath);
  }, [router, buildLocalizedPath]);

  /**
   * Get a URL with locale and tenant parameter appended
   * Useful for Link components and sessionStorage redirects
   * @param path - The base path
   * @returns The full path with locale prefix and tenant parameter
   */
  const getHref = useCallback((path: string): string => {
    return buildLocalizedPath(path);
  }, [buildLocalizedPath]);

  /**
   * Get the current tenant ID from URL
   * @returns The tenant ID or null if not present
   */
  const getTenantId = useCallback((): string | null => {
    return searchParams.get('tenant');
  }, [searchParams]);

  /**
   * Get the current locale
   * @returns The current locale string
   */
  const getLocale = useCallback((): string => {
    return locale;
  }, [locale]);

  return {
    push,
    replace,
    getHref,
    getTenantId,
    getLocale,
    locale,
  };
}

