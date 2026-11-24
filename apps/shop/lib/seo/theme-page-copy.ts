/**
 * Theme-owned page metadata.
 *
 * The host renders a few marketing routes (home, help, terms, …) on behalf of the
 * active theme, so their title and description have to come from the theme rather
 * than from one set of defaults. A theme declares them in its pack
 * (`theme.json` → `x-jiffoo-seo.pages`), read through lib/themes/theme-seo.ts.
 * A theme may also declare a default (`x-jiffoo-seo.default`) that the locale
 * layout applies to every page that sets no metadata of its own.
 *
 * Resolution for one target and locale, the same order the theme runtime's
 * `pickCopy` applies to storefront copy:
 *   1. the Store Localization (i18n) plugin — namespace `theme.<slug>`, keyed by
 *      the theme's English source string (the operator's override);
 *   2. the theme's own declaration for the locale, else its English source;
 *   3. nothing — the caller keeps the core defaults.
 */

import type { Metadata } from 'next';
import type { ServerStoreContext } from '@/lib/server-store-context';
// Server components import this module to generate metadata, so it must not reach the
// theme registry and its client-side theme runtimes (lib/themes/theme-seo.ts is import-free).
import { DEFAULT_THEME_SEO_ROUTE, getDeclaredThemeSeo } from '@/lib/themes/theme-seo';
import { getThemeMessages } from '@/lib/theme-i18n-server';
import { generatePublicPageMetadata, ogLocale, type PageCopy, type PageRoute } from './public-page-metadata';

type StoreContext = ServerStoreContext | null | undefined;

/** Brand name the route wrappers derive for metadata and structured data. */
export function resolveBrandName(context: StoreContext): string | undefined {
  const themeBrand = context?.theme?.config?.brand?.name;
  return (typeof themeBrand === 'string' ? themeBrand.trim() : '') || context?.storeName?.trim() || undefined;
}

/** What the active theme declares for: a marketing route, or its default for pages without their own. */
export type ThemeSeoTarget = PageRoute | typeof DEFAULT_THEME_SEO_ROUTE;

/** The active theme's page copy for a target, or null when the theme declares nothing for it. */
export async function resolveThemePageCopy({
  route,
  locale,
  brandName,
  themeSlug,
}: {
  route: ThemeSeoTarget;
  locale: string;
  brandName?: string;
  themeSlug?: string | null;
}): Promise<PageCopy | null> {
  const declared = themeSlug ? getDeclaredThemeSeo(themeSlug)?.[route] : undefined;
  const source = declared?.en;
  if (!declared || !source || !themeSlug) return null;

  // Fails open: without the plugin, or when it cannot be reached, the theme's own copy
  // stands. Page metadata must never be the reason a route fails to render.
  let overrides: Record<string, string> | undefined;
  try {
    overrides = (await getThemeMessages(locale))?.[`theme.${themeSlug}`];
  } catch {
    overrides = undefined;
  }
  const pick = (english: string, localized: string | undefined) =>
    overrides?.[english]?.trim() || localized?.trim() || english;
  const brand = brandName?.trim() || 'BOKMOO';
  const fill = (value: string) => value.split('{brand}').join(brand);

  return {
    title: fill(pick(source.title, declared[locale]?.title)),
    description: fill(pick(source.description, declared[locale]?.description)),
  };
}

/** Metadata for a host-rendered marketing route of the active theme. */
export async function generateThemePageMetadata({
  route,
  locale,
  context,
  origin,
}: {
  route: PageRoute;
  locale: string;
  context: StoreContext;
  origin: string;
}): Promise<Metadata> {
  const brandName = resolveBrandName(context);
  const copy = await resolveThemePageCopy({ route, locale, brandName, themeSlug: context?.theme?.slug });
  return generatePublicPageMetadata({ route, locale, origin, brandName, copy });
}

/**
 * Metadata for the locale layout. Pages that set none of their own (the plans
 * listing, destinations, search, …) would otherwise inherit the root layout's bare
 * brand title. Returns an empty object when the theme declares no default, so the
 * root layout's metadata stays in force for that storefront.
 */
export async function generateThemeDefaultMetadata({
  locale,
  context,
}: {
  locale: string;
  context: StoreContext;
}): Promise<Metadata> {
  const brandName = resolveBrandName(context);
  if (!brandName) return {};

  const copy = await resolveThemePageCopy({ route: DEFAULT_THEME_SEO_ROUTE, locale, brandName, themeSlug: context?.theme?.slug });
  if (!copy) return {};

  return {
    title: { default: copy.title, template: `%s | ${brandName}` },
    description: copy.description,
    openGraph: { title: copy.title, description: copy.description, locale: ogLocale(locale) },
    twitter: { title: copy.title, description: copy.description },
  };
}
