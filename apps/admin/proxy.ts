/**
 * Admin request proxy for locale routing.
 */
import { NextResponse } from 'next/server';
import { LOCALES, DEFAULT_LOCALE } from 'shared/src/i18n';
import { createProxyHandler, getLocaleFromPathname, type ProxyConfig } from 'shared/src/proxy';
import { pluginShellCsp } from 'shared/src/plugin-pages/csp';

const adminProxyConfig: ProxyConfig = {
  target: 'admin',
  defaultLocale: DEFAULT_LOCALE,
  locales: LOCALES,
};

const proxyHandler = createProxyHandler(adminProxyConfig);

export function proxy(request: Parameters<typeof proxyHandler>[0]) {
  if (request.headers.get('origin') === 'null') {
    return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Request origin is forbidden' } }, { status: 403 });
  }
  if (request.nextUrl.pathname.startsWith('/plugin-downloads/')) return NextResponse.next();
  const locale = getLocaleFromPathname(request.nextUrl.pathname, LOCALES);
  if (locale) {
    const headers = new Headers(request.headers);
    headers.set('x-admin-locale', locale);
    if (/^\/(?:en|zh-Hans|zh-Hant)\/plugins\/[a-z][a-z0-9-]*\/pages(?:\/[a-z][a-z0-9-]*)*$/.test(request.nextUrl.pathname)) {
      const policy = pluginShellCsp(new URL(process.env.ADMIN_URL!).origin);
      headers.set('Content-Security-Policy', policy);
      const response = NextResponse.next({ request: { headers } });
      response.headers.set('Content-Security-Policy', policy);
      return response;
    }
    return NextResponse.next({ request: { headers } });
  }
  return proxyHandler(request);
}

export const config = {
  matcher: ['/((?!api/|health$|favicon.ico).*)'],
};
