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
import { storeDefaultLocale, storeLocales, unofferedLocaleTarget } from '@/lib/store-locales';
import { STOREFRONT_LOCALE_HEADER, requestLocale } from '@/lib/storefront-locale';
import { legacyRedirectTarget, parseLegacyRedirectRules, type LegacyRedirectRule } from '@/lib/legacy-redirects';
import {
  buildRedirectTarget,
  countRedirectHit,
  fetchStorefrontRedirects,
  isRedirectCandidate,
  matchStorefrontRedirect,
  type StorefrontRedirect,
  type RedirectSurface,
} from '@/lib/seo/redirects';

/**
 * Shop proxy configuration
 */
const shopProxyConfig: ProxyConfig = {
  target: 'shop',
  defaultLocale: storeDefaultLocale(),
  locales: storeLocales(),
};

/**
 * Retired URL shapes (SHOP_LEGACY_REDIRECTS), parsed on first use. The rules
 * are read inside the request so a deployment var that reaches process.env
 * with the request context is seen; an unset var is simply re-read.
 */
let legacyRules: LegacyRedirectRule[] | null = null;
function currentLegacyRules(): LegacyRedirectRule[] {
  if (legacyRules) return legacyRules;
  const raw = process.env.SHOP_LEGACY_REDIRECTS;
  if (!raw) return [];
  legacyRules = parseLegacyRedirectRules(raw);
  return legacyRules;
}

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
let seoRedirects: { items: StorefrontRedirect[]; surface: RedirectSurface | null; refreshedAt: number } | null = null;
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

/**
 * A URL in a language this store does not offer (`/en/games` on a zh-Hans
 * store) answers in the store's default language — or, for a retired URL under
 * that language, at its new address in one hop. Only the retired address moves
 * permanently: the store's language list can change, so a language fallback
 * must not be cached as final.
 */
export function localeFallbackRedirect(
  request: ProxyRequest,
  locales: readonly string[],
  defaultLocale: string,
  rules: LegacyRedirectRule[],
): NextResponse | null {
  const fallback = unofferedLocaleTarget(request.nextUrl.pathname, locales, defaultLocale, rules);
  if (!fallback) return null;
  const target = new URL(fallback.path, request.nextUrl.origin);
  // The request's own query rides along; a rule's query stays on the target.
  for (const [key, value] of request.nextUrl.searchParams) target.searchParams.append(key, value);
  return NextResponse.redirect(target, fallback.permanent ? 301 : undefined);
}

export async function middleware(request: ProxyRequest) {
  const artifactRedirect = officialArtifactRedirect(request);
  if (artifactRedirect) return artifactRedirect;

  if (isInstallRootRequest(request)) {
    return NextResponse.redirect(new URL('/install.sh', request.url));
  }

  // Retired URL shapes are answered with one 301 to their localized page,
  // ahead of the locale redirect and of the exact-match redirect store.
  if (request.method === 'GET' || request.method === 'HEAD') {
    const legacy = legacyRedirectTarget(currentLegacyRules(), request.nextUrl.pathname, shopProxyConfig.defaultLocale);
    if (legacy) {
      const target = new URL(legacy, request.nextUrl.origin);
      for (const [key, value] of request.nextUrl.searchParams) target.searchParams.append(key, value);
      return NextResponse.redirect(target, 301);
    }
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
        void countRedirectHit(origin, seoRedirects.surface, request.nextUrl.pathname);
        const target = buildRedirectTarget(match, request.nextUrl.search, origin);
        return NextResponse.redirect(target, match.statusCode as 301 | 302 | 307 | 308);
      }
    }
  }

  // A URL in a language this store does not offer (`/en/games` on a zh-Hans
  // store) is answered in the store's default language. It follows the locale
  // redirect's status on purpose: the store's language list can change, so
  // the answer must not be cached as permanent.
  if (request.method === 'GET' || request.method === 'HEAD') {
    const fallback = localeFallbackRedirect(request, shopProxyConfig.locales, shopProxyConfig.defaultLocale, currentLegacyRules());
    if (fallback) return fallback;
  }

  const response = await baseProxy(request);
  if (response.headers.get('x-middleware-next') !== 'yes') return response;
  // The root layout reads the page's language off the request; it sits above
  // the [locale] segment and cannot take it from params.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    STOREFRONT_LOCALE_HEADER,
    requestLocale(request.nextUrl.pathname, shopProxyConfig.locales, shopProxyConfig.defaultLocale),
  );
  return NextResponse.next({ request: { headers: requestHeaders } });
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
