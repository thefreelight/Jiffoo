/**
 * Admin Application Middleware
 *
 * Handles:
 * 1. Theme App forwarding (L4): When activeTheme.type === 'app', proxy all requests to Theme App
 * 2. Locale-based routing: Redirects requests without locale prefix to /{locale}/...
 *
 * Priority: Theme App forwarding > Locale redirect > Pass through
 *
 * Named middleware.ts (not the Next 16 proxy.ts convention) because
 * @cloudflare/next-on-pages only recognizes the classic middleware contract.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/middleware
 */

import { LOCALES, DEFAULT_LOCALE } from 'shared/src/i18n';
import { createProxyHandler, type ProxyConfig } from 'shared/src/proxy';

/**
 * Admin proxy configuration
 */
const adminProxyConfig: ProxyConfig = {
  target: 'admin',
  defaultLocale: DEFAULT_LOCALE,
  locales: LOCALES,
};

/**
 * Admin proxy handler
 *
 * Request flow:
 * 1. Check if path should never be forwarded (/api/*, /extensions/*, /uploads/*, /theme-app/*)
 * 2. Check if Theme App mode is active -> rewrite to Theme App Gateway
 * 3. Handle locale redirect if no locale prefix
 * 4. Pass through
 */
export const middleware = createProxyHandler(adminProxyConfig);

/**
 * Matcher configuration
 *
 * IMPORTANT: This matcher MUST NOT exclude /_next/* because Theme App mode
 * needs to forward static resources to the Theme App server.
 *
 * Excluded paths (handled by next.config.js rewrites):
 * - /api/* - Core API routes (prevents infinite loop)
 * - /extensions/* - Extension static files
 * - /uploads/* - Upload files
 * - /theme-app/* - Theme App Gateway (prevents infinite loop)
 * - favicon.ico - Browser default request
 *
 * NOTE: Next.js requires matcher to be a static literal, cannot be imported.
 */
export const config = {
  matcher: ['/((?!api/|extensions/|uploads/|theme-app/|favicon.ico|health).*)'],
};
