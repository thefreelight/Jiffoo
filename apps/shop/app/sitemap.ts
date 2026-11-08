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
 *   static routes deliberately carry no lastmod at all.
 */
import type { MetadataRoute } from 'next';
import { resolvePublicOrigin } from '@/lib/server-api-url';
import { DEFAULT_LOCALE } from 'shared/src/i18n';
import { storeLocales } from '@/lib/store-locales';
import { fetchStorefrontSitemapItems } from '@/lib/seo/sitemap-data';

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
  const origin = await resolvePublicOrigin();
  const locales = storeLocales();

  // hreflang values must be absolute URLs (Google rejects relative ones).
  const alternatesFor = (pathFor: (locale: string) => string): SitemapEntry['alternates'] => ({
    languages: {
      ...Object.fromEntries(
        locales.map((locale) => [locale, new URL(pathFor(locale), origin).toString()])
      ),
      'x-default': new URL(pathFor(DEFAULT_LOCALE), origin).toString(),
    },
  });

  const staticEntries: MetadataRoute.Sitemap = PUBLIC_ROUTES.map((route) => {
    const pathFor = (locale: string) => (route ? `/${locale}/${route}` : `/${locale}`);
    return {
      url: new URL(pathFor(locales[0] ?? DEFAULT_LOCALE), origin).toString(),
      changeFrequency: 'weekly' as const,
      priority: route === '' ? 1.0 : 0.7,
      alternates: alternatesFor(pathFor),
    };
  });

  const { items: products } = await fetchStorefrontSitemapItems(origin);
  const productEntries: MetadataRoute.Sitemap = products.map((product) => {
    const pathFor = (locale: string) => `/${locale}/products/${product.id}`;
    return {
      url: new URL(pathFor(locales[0] ?? DEFAULT_LOCALE), origin).toString(),
      ...(product.lastmod ? { lastModified: new Date(product.lastmod) } : {}),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
      alternates: alternatesFor(pathFor),
    };
  });

  return [...staticEntries, ...productEntries];
}
