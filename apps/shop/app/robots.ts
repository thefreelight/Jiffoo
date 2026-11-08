/**
 * Robots route — generates /robots.txt via the Next.js App Router
 * robots.ts convention.
 *
 * Rules follow the technical SEO baseline:
 * - private/tool routes are disallowed per locale directory (explicit
 *   paths, never wildcard patterns spanning locale segments — wildcards
 *   can block legitimate localized pages);
 * - the XML sitemap is referenced with an absolute URL.
 */
import type { MetadataRoute } from 'next';
import { resolvePublicOrigin } from '@/lib/server-api-url';
import { storeLocales } from '@/lib/store-locales';

/** Framework prefixes that never belong in an index. */
const GLOBAL_DISALLOW = [
  '/api/',
  '/plugins/',
  '/extensions/',
  '/uploads/',
  '/media/',
  '/theme-app/',
  '/setup',
  '/install.sh',
  '/official-artifacts/',
];

/** Per-locale private / utility routes (carts, auth, search result pages). */
const LOCALE_PRIVATE_ROUTES = [
  'account',
  'auth',
  'cart',
  'checkout',
  'orders',
  'payment',
  'profile',
  'search',
  'r',
];

export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await resolvePublicOrigin();
  const localeDisallow = storeLocales().flatMap((locale) =>
    LOCALE_PRIVATE_ROUTES.map((route) => `/${locale}/${route}`)
  );

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [...GLOBAL_DISALLOW, ...localeDisallow],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
