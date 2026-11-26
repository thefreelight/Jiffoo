/**
 * Sitemap route — generates /sitemap.xml for all indexable storefront URLs.
 * Uses the Next.js App Router sitemap convention (app/sitemap.ts).
 *
 * Contents:
 * - static marketing routes across every store locale, with hreflang
 *   alternates (incl. x-default → the default-locale version);
 * - product detail URLs from the runtime-local SEO surface (native
 *   seo-store adapter or Node core alias), with real `lastmod` timestamps —
 *   a fabricated `now` lastmod makes crawlers ignore the whole sitemap, so
 *   static routes deliberately carry no lastmod at all;
 * - the detail pages the active theme feeds from its own data
 *   (`x-jiffoo-seo.dynamicPages`), such as a game catalog.
 *
 * hreflang alternates are emitted for a choice of locales only: a
 * single-locale store has no alternate to send a crawler to.
 */
import type { MetadataRoute } from 'next';
import { resolvePublicOrigin } from '@/lib/server-api-url';
import { storeDefaultLocale, storeLocales } from '@/lib/store-locales';
import { fetchStorefrontSitemapItems } from '@/lib/seo/sitemap-data';
import { declaredDynamicPages, dynamicPagePath, loadDynamicPageItems } from '@/lib/seo/dynamic-pages';
import { storefrontIsNoindex } from '@/lib/seo/indexing';

const PUBLIC_ROUTES = [
  '',
  'pricing',
  'how-it-works',
  'contact',
  'help',
  'privacy',
  'terms',
];

type SitemapEntry = MetadataRoute.Sitemap[number];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // A noindex deployment offers crawlers nothing.
  if (storefrontIsNoindex()) return [];

  const origin = await resolvePublicOrigin();
  const locales = storeLocales();

  // hreflang values must be absolute URLs (Google rejects relative ones).
  const alternatesFor = (pathFor: (locale: string) => string): SitemapEntry['alternates'] =>
    locales.length > 1
      ? {
          languages: {
            ...Object.fromEntries(
              locales.map((locale) => [locale, new URL(pathFor(locale), origin).toString()])
            ),
            'x-default': new URL(pathFor(storeDefaultLocale(locales)), origin).toString(),
          },
        }
      : undefined;

  const staticEntries: MetadataRoute.Sitemap = PUBLIC_ROUTES.map((route) => {
    const pathFor = (locale: string) => (route ? `/${locale}/${route}` : `/${locale}`);
    return {
      url: new URL(pathFor(storeDefaultLocale(locales)), origin).toString(),
      changeFrequency: 'weekly' as const,
      priority: route === '' ? 1.0 : 0.7,
      alternates: alternatesFor(pathFor),
    };
  });

  const { items: products } = await fetchStorefrontSitemapItems(origin);
  const productEntries: MetadataRoute.Sitemap = products.map((product) => {
    const pathFor = (locale: string) => `/${locale}/products/${product.id}`;
    return {
      url: new URL(pathFor(storeDefaultLocale(locales)), origin).toString(),
      ...(product.lastmod ? { lastModified: new Date(product.lastmod) } : {}),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
      alternates: alternatesFor(pathFor),
    };
  });

  const dynamicEntries: MetadataRoute.Sitemap = [];
  for (const page of declaredDynamicPages()) {
    for (const item of await loadDynamicPageItems(page, origin)) {
      const path = dynamicPagePath(page, item);
      if (!path) continue;
      const pathFor = (locale: string) => `/${locale}${path}`;
      dynamicEntries.push({
        url: new URL(pathFor(storeDefaultLocale(locales)), origin).toString(),
        changeFrequency: page.changeFrequency ?? 'weekly',
        priority: page.priority ?? 0.6,
        alternates: alternatesFor(pathFor),
      });
    }
  }

  return [...staticEntries, ...productEntries, ...dynamicEntries];
}
