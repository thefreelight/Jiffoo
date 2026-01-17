/**
 * Localized Navigation Hook
 * 
 * Provides navigation utilities that preserve the current locale context.
 * This ensures that when users navigate within the store, they stay in the same language.
 * 
 * Example: /zh-Hant/products -> /zh-Hant/cart
 */

'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { useLocale } from 'shared/src/i18n/react';

export function useLocalizedNavigation() {
  const router = useRouter();
  const locale = useLocale();

  /**
   * Build a localized path
   * @param path - The base path (e.g., '/products', '/cart')
   * @returns Full path with locale prefix
   */
  const buildLocalizedPath = useCallback((path: string): string => {
    // Ensure path starts with /
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    // Add locale prefix
    const localizedPath = `/${locale}${normalizedPath}`;

    return localizedPath;
  }, [locale]);

  /**
   * Navigate to a path while preserving locale
   * @param path - The path to navigate to (e.g., '/cart', '/checkout')
   * @param options - Additional options for navigation
   */
  const push = useCallback((path: string, options?: { scroll?: boolean }) => {
    const fullPath = buildLocalizedPath(path);
    router.push(fullPath, options);
  }, [router, buildLocalizedPath]);

  /**
   * Replace current URL while preserving locale
   * @param path - The path to replace with
   */
  const replace = useCallback((path: string) => {
    const fullPath = buildLocalizedPath(path);
    router.replace(fullPath);
  }, [router, buildLocalizedPath]);

  /**
   * Get a URL with locale prefix appended
   * Useful for Link components and sessionStorage redirects
   * @param path - The base path
   * @returns The full path with locale prefix
   */
  const getHref = useCallback((path: string): string => {
    return buildLocalizedPath(path);
  }, [buildLocalizedPath]);

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
    getLocale,
    locale,
  };
}

