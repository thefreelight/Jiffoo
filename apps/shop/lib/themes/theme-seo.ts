/**
 * Page metadata declared by theme packs (`theme.json` → `x-jiffoo-seo`), by slug.
 *
 * This module imports nothing but the packs' manifests. The locale layout and the
 * route wrappers read it from server components while generating metadata, and
 * reaching for the theme registry there would pull the client-side theme runtimes
 * into the server graph, which Next refuses to build. The registry exposes the same
 * declarations as `ThemeMeta.seo` for its own (client-side) consumers.
 */
import type { ThemeDynamicPage, ThemePageSeo, ThemeSeoLocaleEntries, ThemeSeoPages } from 'shared/src/types/theme';
import esimRouteManifest from '@shop-themes/esim/theme-pack/theme.json';

type RouteManifest = { 'x-jiffoo-seo'?: { default?: unknown; pages?: unknown; dynamicPages?: unknown } };

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

const CHANGE_FREQUENCIES = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'] as const;

/** A feed is either an absolute URL or an absolute path on the storefront itself (where the theme asset folder is served). */
const isFeedSource = (source: unknown): source is string =>
  typeof source === 'string' && (/^https?:\/\//.test(source) || /^\/(?!\/)/.test(source));

/** The detail pages a pack feeds from its own data (`x-jiffoo-seo.dynamicPages`); an entry that lacks a path, a source or an id field is not a page. */
export function parseDynamicPageDeclarations(value: unknown): ThemeDynamicPage[] {
  if (!Array.isArray(value)) return [];
  const pages: ThemeDynamicPage[] = [];
  for (const entry of value as Array<Record<string, unknown>>) {
    const { path, sources, idField } = entry;
    if (typeof path !== 'string' || !path.startsWith('/') || !path.includes('/:')) continue;
    if (!Array.isArray(sources) || sources.length === 0 || !sources.every(isFeedSource)) continue;
    if (typeof idField !== 'string' || !idField) continue;
    const optionalText = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);
    const frequency = CHANGE_FREQUENCIES.find((value) => value === entry.changeFrequency);
    pages.push({
      path,
      sources: sources as string[],
      idField,
      ...(optionalText(entry.items) ? { items: optionalText(entry.items) } : {}),
      ...(optionalText(entry.titleField) ? { titleField: optionalText(entry.titleField) } : {}),
      ...(optionalText(entry.descriptionField) ? { descriptionField: optionalText(entry.descriptionField) } : {}),
      ...(optionalText(entry.imageField) ? { imageField: optionalText(entry.imageField) } : {}),
      ...(frequency ? { changeFrequency: frequency } : {}),
      ...(typeof entry.priority === 'number' && entry.priority >= 0 && entry.priority <= 1 ? { priority: entry.priority } : {}),
    });
  }
  return pages;
}

/** Theme slug -> the page metadata its pack declares. */
export const DECLARED_THEME_SEO: Readonly<Record<string, ThemeSeoPages | undefined>> = {
  esim: readDeclaredSeo(esimRouteManifest),
};

/** Theme slug -> the data-fed detail pages its pack declares. */
export const DECLARED_THEME_DYNAMIC_PAGES: Readonly<Record<string, readonly ThemeDynamicPage[] | undefined>> = {
  esim: parseDynamicPageDeclarations((esimRouteManifest as RouteManifest)['x-jiffoo-seo']?.dynamicPages),
};

/** The page metadata a theme pack declares, or undefined when the pack declares none. */
export function getDeclaredThemeSeo(slug: string): ThemeSeoPages | undefined {
  if (Object.prototype.hasOwnProperty.call(DECLARED_THEME_SEO, slug)) return DECLARED_THEME_SEO[slug];
  const runtime = runtimeDeclaration();
  return runtime?.slug === slug ? runtime.seo : undefined;
}

/** The data-fed detail pages a theme pack declares; empty when it declares none. */
export function getDeclaredThemeDynamicPages(slug: string): readonly ThemeDynamicPage[] {
  if (Object.prototype.hasOwnProperty.call(DECLARED_THEME_DYNAMIC_PAGES, slug)) return DECLARED_THEME_DYNAMIC_PAGES[slug] ?? [];
  const runtime = runtimeDeclaration();
  return runtime?.slug === slug ? runtime.dynamicPages : [];
}

/**
 * A deployment can carry its theme's `x-jiffoo-seo` declaration as data:
 * `SHOP_THEME_SEO` holds `{ "slug": "<theme slug>", ...x-jiffoo-seo }`, copied
 * from the pack's theme.json by whoever deploys it. This is for a theme that is
 * served as a packaged runtime from the theme asset library and is not part of
 * this build, so its manifest cannot be imported above. The declarations
 * imported above win for the themes that have them.
 */
interface RuntimeDeclaration {
  slug: string;
  seo: ThemeSeoPages;
  dynamicPages: readonly ThemeDynamicPage[];
}

let runtimeDeclarationCache: RuntimeDeclaration | null | undefined;

function runtimeDeclaration(): RuntimeDeclaration | null {
  if (runtimeDeclarationCache !== undefined) return runtimeDeclarationCache;
  const raw = process.env.SHOP_THEME_SEO;
  // An unset variable is not cached: on a worker it can arrive with the request context.
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { slug?: unknown; default?: unknown; pages?: unknown; dynamicPages?: unknown };
    if (typeof parsed.slug !== 'string' || !parsed.slug) {
      runtimeDeclarationCache = null;
    } else {
      runtimeDeclarationCache = {
        slug: parsed.slug,
        seo: readDeclaredSeo({ 'x-jiffoo-seo': parsed }) ?? {},
        dynamicPages: parseDynamicPageDeclarations(parsed.dynamicPages),
      };
    }
  } catch {
    runtimeDeclarationCache = null;
  }
  return runtimeDeclarationCache;
}
