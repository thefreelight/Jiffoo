/**
 * Page metadata declared by theme packs (`theme.json` → `x-jiffoo-seo`), by slug.
 *
 * This module imports nothing but the packs' manifests. The locale layout and the
 * route wrappers read it from server components while generating metadata, and
 * reaching for the theme registry there would pull the client-side theme runtimes
 * into the server graph, which Next refuses to build. The registry exposes the same
 * declarations as `ThemeMeta.seo` for its own (client-side) consumers.
 */
import type { ThemePageSeo, ThemeSeoLocaleEntries, ThemeSeoPages } from 'shared/src/types/theme';
import esimRouteManifest from '@shop-themes/esim/theme-pack/theme.json';

/**
 * Target holding the copy for pages that set no metadata of their own. The locale
 * layout applies it, so a storefront's secondary pages do not fall back to a bare
 * brand title. Its shape is identical to a route's.
 */
export const DEFAULT_THEME_SEO_ROUTE = 'default';

function readLocaleEntries(value: unknown): ThemeSeoLocaleEntries | undefined {
  if (!value || typeof value !== 'object') return undefined;

  const declared: ThemeSeoLocaleEntries = {};
  for (const [locale, entry] of Object.entries(value as Record<string, Partial<ThemePageSeo> | null>)) {
    if (typeof entry?.title === 'string' && typeof entry.description === 'string') {
      declared[locale] = { title: entry.title, description: entry.description };
    }
  }
  // A target only counts when the pack declares the English source for it, since that
  // is the key the Store Localization (i18n) plugin overrides are keyed by.
  return declared.en ? declared : undefined;
}

function readDeclaredSeo(manifest: { 'x-jiffoo-seo'?: { default?: unknown; pages?: unknown } }): ThemeSeoPages | undefined {
  const seo: ThemeSeoPages = {};

  const defaults = readLocaleEntries(manifest['x-jiffoo-seo']?.default);
  if (defaults) seo[DEFAULT_THEME_SEO_ROUTE] = defaults;

  const pages = manifest['x-jiffoo-seo']?.pages;
  if (pages && typeof pages === 'object') {
    for (const [route, locales] of Object.entries(pages as Record<string, unknown>)) {
      const declared = readLocaleEntries(locales);
      if (declared) seo[route] = declared;
    }
  }

  return Object.keys(seo).length > 0 ? seo : undefined;
}

/** Theme slug -> the page metadata its pack declares. */
export const DECLARED_THEME_SEO: Readonly<Record<string, ThemeSeoPages | undefined>> = {
  esim: readDeclaredSeo(esimRouteManifest),
};

/** The page metadata a theme pack declares, or undefined when the pack declares none. */
export function getDeclaredThemeSeo(slug: string): ThemeSeoPages | undefined {
  return Object.prototype.hasOwnProperty.call(DECLARED_THEME_SEO, slug) ? DECLARED_THEME_SEO[slug] : undefined;
}
