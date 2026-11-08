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
import { LOCALES, isSupportedLocale } from 'shared/src/i18n';

export function storeLocales(): readonly string[] {
  const raw = process.env.NEXT_PUBLIC_FALLBACK_SUPPORTED_LOCALES;
  if (!raw) return LOCALES;
  const parsed = raw
    .split(',')
    .map((locale) => locale.trim())
    .filter((locale) => isSupportedLocale(locale));
  return parsed.length > 0 ? parsed : LOCALES;
}
