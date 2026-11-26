/**
 * Store-scoped locale list.
 *
 * Locale detection must match against the locales THIS store actually
 * supports (store context `supportedLocales`, mirrored in the deployment's
 * NEXT_PUBLIC_FALLBACK_SUPPORTED_LOCALES var) — not the framework-wide
 * list. Otherwise a zh-Hant-only store sends Simplified-Chinese visitors
 * to /zh-Hans, where the theme's zh-Hant copy never renders. Stores that
 * do not set the var keep the framework-wide behavior.
 *
 * Shared by the middleware (locale redirect detection), the sitemap
 * (URL set + hreflang alternates) and robots (per-locale private paths).
 */
import { DEFAULT_LOCALE, LOCALES, isSupportedLocale } from 'shared/src/i18n';
import { legacyRedirectTarget, type LegacyRedirectRule } from '@/lib/legacy-redirects';

export function storeLocales(): readonly string[] {
  const raw = process.env.NEXT_PUBLIC_FALLBACK_SUPPORTED_LOCALES;
  if (!raw) return LOCALES;
  const parsed = raw
    .split(',')
    .map((locale) => locale.trim())
    .filter((locale) => isSupportedLocale(locale));
  return parsed.length > 0 ? parsed : LOCALES;
}

/**
 * Where a visitor with no language preference is sent: the framework default
 * when this store offers it, otherwise the store's first locale. A single-locale
 * store must not be sent to a locale it does not offer — the locale redirect
 * would prefix that locale again and again without end.
 */
export function storeDefaultLocale(locales: readonly string[] = storeLocales()): string {
  return locales.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : locales[0];
}

/**
 * A URL written for a language this store does not offer — `/en/games` on a
 * zh-Hans-only store. Returns the path without that leading locale, or null
 * when the path is not in this shape. The locale redirect treats an unknown
 * first segment as a page name, so without this the visitor is sent to
 * `/zh-Hans/en/games`, which has no route.
 */
export function unofferedLocalePath(pathname: string, locales: readonly string[] = storeLocales()): string | null {
  const match = /^\/([^/]+)(\/.*)?$/.exec(pathname);
  if (!match) return null;
  let segment = match[1]!;
  try {
    segment = decodeURIComponent(segment);
  } catch {
    return null;
  }
  if (!isSupportedLocale(segment) || locales.includes(segment)) return null;
  return match[2] ?? '/';
}

/**
 * Where a URL in a language the store does not offer goes: a retired URL under
 * that language straight to its new address (a permanent move), anything else
 * to the same page in the store's default language. Null when the URL is not
 * in this shape.
 */
export function unofferedLocaleTarget(
  pathname: string,
  locales: readonly string[],
  defaultLocale: string,
  rules: LegacyRedirectRule[] = [],
): { path: string; permanent: boolean } | null {
  const unoffered = unofferedLocalePath(pathname, locales);
  if (unoffered === null) return null;
  const retired = legacyRedirectTarget(rules, unoffered, defaultLocale);
  return retired
    ? { path: retired, permanent: true }
    : { path: `/${defaultLocale}${unoffered === '/' ? '' : unoffered}`, permanent: false };
}
