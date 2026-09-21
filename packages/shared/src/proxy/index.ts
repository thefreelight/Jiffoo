import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export type ProxyTarget = 'shop' | 'admin';

export interface ProxyConfig {
  target: ProxyTarget;
  defaultLocale: string;
  locales: readonly string[];
}

export function shouldNeverForward(pathname: string): boolean {
  return ['/api/', '/plugins/', '/extensions/', '/uploads/'].some((prefix) => pathname.startsWith(prefix));
}

export function getLocaleFromPathname(pathname: string, locales: readonly string[]): string | undefined {
  const locale = pathname.split('/').filter(Boolean)[0];
  return locale && locales.includes(locale) ? locale : undefined;
}

export function shouldSkipLocaleHandling(pathname: string): boolean {
  return pathname.startsWith('/api/') || pathname.startsWith('/_next/') || /\.(?:ico|png|jpg|jpeg|gif|svg|webp|css|js|json|xml|txt|pdf|woff2?|ttf|eot)$/.test(pathname);
}

export function handleLocaleRedirect(request: NextRequest, config: ProxyConfig): NextResponse | null {
  const { pathname } = request.nextUrl;
  if (shouldSkipLocaleHandling(pathname) || getLocaleFromPathname(pathname, config.locales)) return null;
  const url = request.nextUrl.clone();
  url.pathname = `/${config.defaultLocale}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(url);
}

export function createProxyHandler(config: ProxyConfig) {
  return async (request: NextRequest): Promise<NextResponse> => {
    if (shouldNeverForward(request.nextUrl.pathname)) return NextResponse.next();
    return handleLocaleRedirect(request, config) || NextResponse.next();
  };
}

export const UNIFIED_PROXY_MATCHER = ['/((?!api/|extensions/|uploads/|favicon.ico).*)'];
