/**
 * i18n Middleware Utilities
 * 
 * Provides utilities for creating Next.js middleware that handles
 * locale-based routing and redirects.
 */

import { LOCALES, DEFAULT_LOCALE, isSupportedLocale, normalizeLocale, type Locale } from './config';

/**
 * Extract locale from pathname
 * @param pathname - The URL pathname
 * @returns The locale if found, undefined otherwise
 */
export function getLocaleFromPathname(pathname: string): Locale | undefined {
  const segments = pathname.split('/').filter(Boolean);
  const firstSegment = segments[0];

  if (firstSegment && isSupportedLocale(firstSegment)) {
    return firstSegment;
  }

  return undefined;
}

/**
 * Check if pathname should skip locale handling
 * Used to exclude API routes, static files, etc.
 * @param pathname - The URL pathname
 * @returns True if locale handling should be skipped
 */
export function shouldSkipLocaleHandling(pathname: string): boolean {
  // Skip API routes
  if (pathname.startsWith('/api/')) {
    return true;
  }

  // Skip Next.js internals
  if (pathname.startsWith('/_next/')) {
    return true;
  }

  // Skip static files
  const staticExtensions = [
    '.ico',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.svg',
    '.webp',
    '.css',
    '.js',
    '.json',
    '.xml',
    '.txt',
    '.pdf',
    '.woff',
    '.woff2',
    '.ttf',
    '.eot',
  ];

  if (staticExtensions.some((ext) => pathname.endsWith(ext))) {
    return true;
  }

  // Skip manifest and favicon
  if (pathname === '/manifest.json' || pathname === '/robots.txt' || pathname === '/sitemap.xml') {
    return true;
  }

  return false;
}

/**
 * Get redirect URL for locale-based routing
 * @param pathname - The current pathname
 * @param acceptLanguage - The Accept-Language header value
 * @returns Redirect URL if needed, null otherwise
 */
export function getLocaleRedirectUrl(
  pathname: string,
  acceptLanguage?: string | null
): string | null {
  // Skip if should not handle locale
  if (shouldSkipLocaleHandling(pathname)) {
    return null;
  }

  const pathnameLocale = getLocaleFromPathname(pathname);

  // If pathname already has a valid locale, no redirect needed
  if (pathnameLocale) {
    return null;
  }

  // Determine target locale
  // For now, always redirect to default locale (en)
  // Future: can use acceptLanguage to determine preferred locale
  const targetLocale = DEFAULT_LOCALE;

  // Build redirect URL
  const redirectPath = pathname === '/' ? '' : pathname;
  return `/${targetLocale}${redirectPath}`;
}

/**
 * Remove locale prefix from pathname
 * @param pathname - The pathname with locale prefix
 * @returns Pathname without locale prefix
 */
export function removeLocaleFromPathname(pathname: string): string {
  const locale = getLocaleFromPathname(pathname);
  if (!locale) {
    return pathname;
  }

  const withoutLocale = pathname.replace(`/${locale}`, '') || '/';
  return withoutLocale;
}

/**
 * Add locale prefix to pathname
 * @param pathname - The pathname without locale prefix
 * @param locale - The locale to add
 * @returns Pathname with locale prefix
 */
export function addLocaleToPathname(pathname: string, locale: Locale): string {
  const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `/${locale}${cleanPath === '/' ? '' : cleanPath}`;
}

/**
 * Middleware configuration for locale handling
 */
export const localeMiddlewareConfig = {
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
};

// Re-export for convenience
export { LOCALES, DEFAULT_LOCALE, isSupportedLocale, normalizeLocale };

