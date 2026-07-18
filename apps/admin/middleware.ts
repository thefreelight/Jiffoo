/**
 * Admin request middleware for Cloudflare-compatible locale and theme routing.
 */
import { LOCALES, DEFAULT_LOCALE } from 'shared/src/i18n';
import { createProxyHandler, type ProxyConfig } from 'shared/src/proxy';

const adminProxyConfig: ProxyConfig = {
  target: 'admin',
  defaultLocale: DEFAULT_LOCALE,
  locales: LOCALES,
};

const proxyHandler = createProxyHandler(adminProxyConfig);

export function middleware(request: Parameters<typeof proxyHandler>[0]) {
  return proxyHandler(request);
}

export const config = {
  matcher: ['/((?!api/|extensions/|uploads/|theme-app/|favicon.ico).*)'],
};
