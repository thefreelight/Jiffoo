/**
 * Unified Proxy Utilities for Next.js 16
 *
 * Provides shared proxy logic for shop and admin frontends.
 * Following Next.js 16 best practices:
 * - proxy.ts replaces middleware.ts (file convention change)
 * - proxy runs on Node.js runtime (not Edge)
 * - proxy should only handle network boundary concerns: rewrite/redirect/headers
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/proxy
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ============================================================================
// Types
// ============================================================================

export type ProxyTarget = 'shop' | 'admin';

export interface ActiveThemeInfo {
  type: 'pack' | 'app';
  baseUrl?: string;
  slug?: string;
}

export interface ProxyConfig {
  /** Target frontend: 'shop' or 'admin' */
  target: ProxyTarget;
  /** Default locale for redirects */
  defaultLocale: string;
  /** Supported locales */
  locales: readonly string[];
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Paths that should NEVER be forwarded to Theme App
 * These are handled by next.config.js rewrites to Core API
 */
const NEVER_FORWARD_PREFIXES = ['/api/', '/extensions/', '/uploads/', '/theme-app/'];

// ============================================================================
// Path Utilities
// ============================================================================

/**
 * Check if path should never be forwarded to Theme App
 * These paths are always handled by Core API via next.config.js rewrites
 */
export function shouldNeverForward(pathname: string): boolean {
  return NEVER_FORWARD_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Check if pathname has a locale prefix
 */
export function getLocaleFromPathname(
  pathname: string,
  locales: readonly string[]
): string | undefined {
  const segments = pathname.split('/').filter(Boolean);
  const firstSegment = segments[0];

  if (firstSegment && locales.includes(firstSegment)) {
    return firstSegment;
  }

  return undefined;
}

/**
 * Check if pathname should skip locale handling
 * (static files, Next.js internals, etc.)
 */
export function shouldSkipLocaleHandling(pathname: string): boolean {
  // Skip API routes (already excluded by matcher, but double-check)
  if (pathname.startsWith('/api/')) {
    return true;
  }

  // Skip Next.js internals
  if (pathname.startsWith('/_next/')) {
    return true;
  }

  // Skip static file extensions
  const staticExtensions = [
    '.ico', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp',
    '.css', '.js', '.json', '.xml', '.txt', '.pdf',
    '.woff', '.woff2', '.ttf', '.eot',
  ];

  if (staticExtensions.some((ext) => pathname.endsWith(ext))) {
    return true;
  }

  // Skip common static files
  if (['/manifest.json', '/robots.txt', '/sitemap.xml'].includes(pathname)) {
    return true;
  }

  return false;
}

// ============================================================================
// Theme App Proxy
// ============================================================================

/**
 * Fetch active theme info from Core API
 *
 * @param request - The incoming request (used for origin)
 * @param target - 'shop' or 'admin'
 * @returns Active theme info or null if unavailable
 */
export async function getActiveThemeInfo(
  request: NextRequest,
  target: ProxyTarget
): Promise<ActiveThemeInfo | null> {
  try {
    // Build API URL using request origin
    const apiUrl = new URL(
      `/api/themes/active?target=${target}`,
      request.nextUrl.origin
    );

    const response = await fetch(apiUrl.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    const data = result.data || result;

    const themeInfo: ActiveThemeInfo = {
      type: data.type || 'pack',
      baseUrl: data.baseUrl,
      slug: data.slug,
    };

    return themeInfo;
  } catch (error) {
    return null;
  }
}

/**
 * Handle Theme App forwarding if active theme is type='app'
 *
 * Instead of directly rewriting to the Theme App's baseUrl (which is 127.0.0.1:port
 * and not reachable from the frontend), we rewrite to the Theme App Gateway on the
 * Core API server. The gateway then proxies the request to the actual Theme App.
 *
 * Flow:
 * 1. Frontend request: GET /products/123
 * 2. Proxy rewrites to: /theme-app/{target}/{slug}/products/123 (same origin)
 * 3. next.config.js rewrites to: {API_SERVICE_URL}/theme-app/{target}/{slug}/products/123
 * 4. API Gateway proxies to: http://127.0.0.1:{port}/products/123
 *
 * This solves the network topology problem where the Theme App runs on the API server's
 * localhost, which is not reachable from frontend containers/processes.
 *
 * @param request - The incoming request
 * @param target - 'shop' or 'admin'
 * @returns NextResponse.rewrite() if forwarding, null otherwise
 */
export async function handleThemeAppProxy(
  request: NextRequest,
  target: ProxyTarget
): Promise<NextResponse | null> {
  const activeTheme = await getActiveThemeInfo(request, target);

  if (activeTheme?.type === 'app' && activeTheme.slug) {
    const { pathname, search } = request.nextUrl;

    // Build gateway URL: /theme-app/{target}/{slug}{pathname}{search}
    // This will be further rewritten by next.config.js to the API server
    const gatewayPath = `/theme-app/${target}/${activeTheme.slug}${pathname}${search}`;
    const targetUrl = new URL(gatewayPath, request.nextUrl.origin);

    // Use rewrite to proxy through the Theme App Gateway
    return NextResponse.rewrite(targetUrl);
  }

  return null;
}

// ============================================================================
// Locale Redirect
// ============================================================================

/**
 * Handle locale redirect if pathname doesn't have a locale prefix
 *
 * @param request - The incoming request
 * @param config - Proxy configuration
 * @returns NextResponse.redirect() if redirect needed, null otherwise
 */
export function handleLocaleRedirect(
  request: NextRequest,
  config: ProxyConfig
): NextResponse | null {
  const { pathname } = request.nextUrl;

  // Skip locale handling for paths that don't need it
  if (shouldSkipLocaleHandling(pathname)) {
    return null;
  }

  // Check if pathname already has a locale
  const pathnameLocale = getLocaleFromPathname(pathname, config.locales);

  if (pathnameLocale) {
    // Locale exists, no redirect needed
    return null;
  }

  // No locale in pathname, redirect to default locale
  const url = request.nextUrl.clone();
  url.pathname = `/${config.defaultLocale}${pathname === '/' ? '' : pathname}`;

  return NextResponse.redirect(url);
}

// ============================================================================
// Unified Proxy Handler
// ============================================================================

/**
 * Create a unified proxy handler for Next.js 16
 *
 * Priority order:
 * 1. Bypass paths (never forward to Theme App)
 * 2. Theme App forwarding (if type='app')
 * 3. Locale redirect (if no locale prefix)
 * 4. Pass through (NextResponse.next())
 *
 * @param config - Proxy configuration
 * @returns Proxy handler function
 */
export function createProxyHandler(config: ProxyConfig) {
  return async function proxy(request: NextRequest): Promise<NextResponse> {
    const { pathname } = request.nextUrl;
    
    // Step 1: Never forward certain paths (handled by Core API)
    // Note: These are also excluded by matcher, but we double-check
    if (shouldNeverForward(pathname)) {
      return NextResponse.next();
    }

    // Step 2: Check if Theme App mode is active
    const themeAppResponse = await handleThemeAppProxy(request, config.target);
    if (themeAppResponse) {
      return themeAppResponse;
    }

    // Step 3: Handle locale redirect (only in Theme Pack mode)
    const localeRedirectResponse = handleLocaleRedirect(request, config);
    if (localeRedirectResponse) {
      return localeRedirectResponse;
    }

    // Step 4: Pass through
    return NextResponse.next();
  };
}

// ============================================================================
// Matcher Configuration
// ============================================================================

/**
 * Unified matcher configuration for proxy.ts
 *
 * IMPORTANT: This matcher MUST NOT exclude /_next/* because Theme App mode
 * needs to forward static resources to the Theme App server.
 *
 * Excluded paths:
 * - /api/* - Core API routes (prevents infinite loop, handled by rewrites)
 * - /extensions/* - Extension static files (handled by rewrites)
 * - /uploads/* - Upload files (handled by rewrites)
 * - /theme-app/* - Theme App Gateway (handled by rewrites, prevents infinite loop)
 * - favicon.ico - Browser default request
 */
export const UNIFIED_PROXY_MATCHER = [
  '/((?!api/|extensions/|uploads/|theme-app/|favicon.ico).*)',
];
