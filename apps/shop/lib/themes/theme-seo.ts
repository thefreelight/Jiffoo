/**
 * Page metadata declared by theme packs (`theme.json` → `x-jiffoo-seo.pages`), by slug.
 *
 * This module imports nothing but the packs' manifests. The route wrappers read it
 * from server components while generating metadata, and reaching for the theme
 * registry there would pull the client-side theme runtimes into the server graph,
 * which Next refuses to build. The registry exposes the same declarations as
 * `ThemeMeta.seo` for its own (client-side) consumers.
 */
import type { ThemePageSeo, ThemeSeoPages } from 'shared/src/types/theme';
import esimRouteManifest from '@shop-themes/esim/theme-pack/theme.json';

/**
 * A route only counts when the pack declares the English source for it, since
 * that is the key the Store Localization (i18n) plugin overrides are keyed by.
 * Other locales are kept as declared.
 */
function readDeclaredSeo(manifest: { 'x-jiffoo-seo'?: { pages?: unknown } }): ThemeSeoPages | undefined {
  const pages = manifest['x-jiffoo-seo']?.pages;
  if (!pages || typeof pages !== 'object') return undefined;

  const seo: ThemeSeoPages = {};
  for (const [route, locales] of Object.entries(pages as Record<string, unknown>)) {
    if (!locales || typeof locales !== 'object') continue;
    const declared: Partial<Record<string, ThemePageSeo>> = {};
    for (const [locale, entry] of Object.entries(locales as Record<string, Partial<ThemePageSeo> | null>)) {
      if (typeof entry?.title === 'string' && typeof entry.description === 'string') {
        declared[locale] = { title: entry.title, description: entry.description };
      }
    }
    if (declared.en) seo[route] = declared;
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
