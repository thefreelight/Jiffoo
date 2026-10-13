/**
 * Admin request proxy for locale routing.
 */
import { NextResponse } from 'next/server';
import { LOCALES, DEFAULT_LOCALE } from 'shared/src/i18n';
import { createProxyHandler, getLocaleFromPathname, type ProxyConfig } from 'shared/src/proxy';

const adminProxyConfig: ProxyConfig = {
  target: 'admin',
  defaultLocale: DEFAULT_LOCALE,
  locales: LOCALES,
};

const proxyHandler = createProxyHandler(adminProxyConfig);

export function proxy(request: Parameters<typeof proxyHandler>[0]) {
  const locale = getLocaleFromPathname(request.nextUrl.pathname, LOCALES);
  if (locale) {
    const headers = new Headers(request.headers);
    headers.set('x-admin-locale', locale);
    return NextResponse.next({ request: { headers } });
  }
  return proxyHandler(request);
}

export const config = {
  matcher: ['/((?!api/|plugins/|health$|extensions/|uploads/|favicon.ico).*)'],
};
