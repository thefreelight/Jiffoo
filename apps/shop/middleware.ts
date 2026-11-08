/**
 * Shop Application Middleware
 *
 * Handles:
 * 1. Theme App forwarding (L4): When activeTheme.type === 'app', proxy all requests to Theme App
 * 2. Locale-based routing: Redirects requests without locale prefix to /{locale}/...
 *
 * Priority: Theme App forwarding > Locale redirect > Pass through
 */

import { DEFAULT_LOCALE, isSupportedLocale } from 'shared/src/i18n';
import { createProxyHandler, type ProxyConfig } from 'shared/src/proxy';
import { NextResponse } from 'next/server';
import { storeLocales } from '@/lib/store-locales';
import {
  buildRedirectTarget,
  countRedirectHit,
  fetchStorefrontRedirects,
  isRedirectCandidate,
  matchStorefrontRedirect,
  type StorefrontRedirect,
} from '@/lib/seo/redirects';

/**
 * Shop proxy configuration
 */
const shopProxyConfig: ProxyConfig = {
  target: 'shop',
  defaultLocale: DEFAULT_LOCALE,
  locales: storeLocales(),
};

/**
 * Storefront SEO redirects (admin-configured 301/302/307/308 mappings).
 *
 * The redirect list is read from the runtime-local SEO surface on a TTL
 * (per isolate): a cold cache awaits the fetch once, then the list is
 * served from memory and refreshed in the background when stale — matching
 * paths must not pay a per-request lookup. When no surface answers
 * (plugin/alias not deployed) the list stays empty and every request
 * passes through unchanged.
 */
const SEO_REDIRECTS_TTL_MS = 5 * 60 * 1000;
let seoRedirects: { items: StorefrontRedirect[]; surface: 'native' | 'core' | null; refreshedAt: number } | null = null;
let seoRedirectsRefresh: Promise<void> | null = null;

async function ensureSeoRedirects(origin: string): Promise<void> {
  const now = Date.now();
  if (seoRedirects && now - seoRedirects.refreshedAt < SEO_REDIRECTS_TTL_MS) return;
  if (seoRedirects && seoRedirectsRefresh) return; // Stale but already refreshing.
  if (!seoRedirects) {
    try {
      const result = await fetchStorefrontRedirects(origin);
      seoRedirects = { ...result, refreshedAt: Date.now() };
    } catch {
      seoRedirects = { items: [], surface: null, refreshedAt: Date.now() };
    }
    return;
  }
  if (!seoRedirectsRefresh) {
    seoRedirectsRefresh = fetchStorefrontRedirects(origin)
      .then((result) => {
        seoRedirects = { ...result, refreshedAt: Date.now() };
      })
      .catch(() => {
        // Keep serving the stale list.
      })
      .finally(() => {
        seoRedirectsRefresh = null;
      });
  }
}

/**
 * Shop middleware handler
 *
 * Request flow:
 * 1. Check if path should never be forwarded (/api/*, /extensions/*, /uploads/*, /theme-app/*)
 * 2. Check if Theme App mode is active -> rewrite to Theme App Gateway
 * 3. Handle locale redirect if no locale prefix
 * 4. Pass through
 */
const baseProxy = createProxyHandler(shopProxyConfig);
type ProxyRequest = Parameters<typeof baseProxy>[0];

/**
 * Locale list sourced from the Store Localization (i18n) plugin.
 *
 * The plugin's `i18n_locales` table is the source of truth for which
 * languages a store offers. The middleware refreshes the enabled-locale
 * list from the plugin's public read route on a TTL (per isolate, never
 * blocking the in-flight request) and falls back to the deployment var,
 * then to the framework-wide list.
 */
const PLUGIN_LOCALES_TTL_MS = 5 * 60 * 1000;
let pluginLocales: readonly string[] | null = null;
let pluginLocalesRefreshedAt = 0;

async function refreshPluginLocales(request: ProxyRequest): Promise<void> {
  if (pluginLocales && Date.now() - pluginLocalesRefreshedAt < PLUGIN_LOCALES_TTL_MS) return;
  pluginLocalesRefreshedAt = Date.now();
  try {
    // Same-origin subrequest: the middleware runtime does not expose
    // wrangler vars on process.env, and /api/* re-enters this worker's
    // API proxy to the Core API without recursing into the middleware.
    const response = await fetch(`${request.nextUrl.origin}/api/v1/plugins/i18n/store/locales`, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return;
    const body = await response.json();
    const items = body?.data?.items;
    if (!Array.isArray(items)) return;
    const locales = items
      .filter((item: { isEnabled?: boolean }) => item.isEnabled !== false)
      .map((item: { locale?: string }) => item.locale)
      .filter((locale: unknown): locale is string => typeof locale === 'string' && isSupportedLocale(locale));
    if (locales.length > 0) {
      pluginLocales = locales;
      shopProxyConfig.locales = locales;
    }
  } catch {
    // Plugin unavailable (not installed / DB error): keep the current list.
  }
}


function isInstallRootRequest(request: ProxyRequest): boolean {
  const host = request.headers.get('host')?.split(':')[0]?.toLowerCase();
  const pathname = request.nextUrl.pathname;

  if (host !== 'get.jiffoo.com') {
    return false;
  }

  return pathname === '/' || pathname === `/${DEFAULT_LOCALE}`;
}

function isOfficialArtifactRequest(request: ProxyRequest): boolean {
  const host = request.headers.get('host')?.split(':')[0]?.toLowerCase();
  return host === 'get.jiffoo.com' && request.nextUrl.pathname.startsWith('/official-artifacts/');
}

export function officialArtifactRedirect(request: ProxyRequest): NextResponse | null {
  if (!isOfficialArtifactRequest(request)) return null;
  const target = new URL(`https://artifacts.jiffoo.com${request.nextUrl.pathname}`);
  target.search = request.nextUrl.search;
  return NextResponse.redirect(target, 307);
}

export async function middleware(request: ProxyRequest) {
  const artifactRedirect = officialArtifactRedirect(request);
  if (artifactRedirect) return artifactRedirect;

  if (isInstallRootRequest(request)) {
    return NextResponse.redirect(new URL('/install.sh', request.url));
  }

  // Storefront SEO redirects run ahead of the locale redirect: a legacy URL
  // must land on its configured target, not on a locale-prefixed 404.
  if (isRedirectCandidate(request.nextUrl.pathname, request.method)) {
    const origin = request.nextUrl.origin;
    await ensureSeoRedirects(origin);
    const list = seoRedirects?.items ?? [];
    if (list.length > 0) {
      const match = matchStorefrontRedirect(list, request.nextUrl.pathname);
      if (match && seoRedirects?.surface) {
        if (seoRedirects.surface === 'native' || seoRedirects.surface === 'core') {
          void countRedirectHit(origin, seoRedirects.surface, request.nextUrl.pathname);
        }
        const target = buildRedirectTarget(match, request.nextUrl.search, origin);
        return NextResponse.redirect(target, match.statusCode as 301 | 302 | 307 | 308);
      }
    }
  }

  return baseProxy(request);
}

/**
 * Matcher configuration
 *
 * IMPORTANT: This matcher MUST NOT exclude /_next/* because Theme App mode
 * needs to forward static resources to the Theme App server.
 *
 * Excluded paths:
 * - /api/* - Core API routes (prevents infinite loop)
 * - /plugins/* - Plugin runtime mount for storefront slots
 * - /extensions/* - Extension static files
 * - /uploads/* - Upload files
 * - /media/* - Core API media (proxied by app/media route handler; the locale
 *   redirect must not prefix it, the path has no route in the shop app)
 * - /theme-app/* - Theme App Gateway (prevents infinite loop)
 * - favicon.ico - Browser default request
 *
 * NOTE: Next.js requires matcher to be a static literal, cannot be imported.
 */
export const config = {
  matcher: ['/((?!api/|plugins/|extensions/|uploads/|media/|theme-app/|favicon.ico).*)'],
};
