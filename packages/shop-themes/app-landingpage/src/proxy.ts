import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const DEFAULT_LOCALE = 'zh-Hant';
const SUPPORTED_LOCALES = ['en', 'zh-Hant'];

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip API routes and static assets.
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js)$/)
  ) {
    return NextResponse.next();
  }

  const pathnameHasLocale = SUPPORTED_LOCALES.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) {
    return NextResponse.next();
  }

  if (pathname === '/') {
    return NextResponse.redirect(new URL(`/${DEFAULT_LOCALE}`, request.url));
  }

  return NextResponse.redirect(new URL(`/${DEFAULT_LOCALE}${pathname}`, request.url));
}

export const config = {
  matcher: ['/((?!_next|api/health).*)'],
};
