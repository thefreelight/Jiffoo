/**
 * Tenant Application Proxy
 *
 * Handles locale-based routing for the tenant dashboard.
 * Redirects requests without locale prefix to /{locale}/...
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  DEFAULT_LOCALE,
  getLocaleFromPathname,
  shouldSkipLocaleHandling,
} from 'shared/src/i18n/middleware';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip locale handling for static files, API routes, etc.
  if (shouldSkipLocaleHandling(pathname)) {
    return NextResponse.next();
  }

  // Check if pathname already has a locale
  const pathnameLocale = getLocaleFromPathname(pathname);

  if (pathnameLocale) {
    // Locale exists, continue with request
    return NextResponse.next();
  }

  // No locale in pathname, redirect to default locale
  const url = request.nextUrl.clone();
  url.pathname = `/${DEFAULT_LOCALE}${pathname === '/' ? '' : pathname}`;

  return NextResponse.redirect(url);
}

export const config = {
  // Match all paths except static files and API routes
  matcher: [
    '/((?!_next/static|_next/image|api|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|json|xml|txt|pdf|woff|woff2|ttf|eot)$).*)',
  ],
};

