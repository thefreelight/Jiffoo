/**
 * Sitemap route — generates /sitemap.xml for all public routes across locales.
 * Uses the Next.js App Router sitemap convention (app/sitemap.ts).
 */
import type { MetadataRoute } from 'next';
import { resolvePublicOrigin } from '@/lib/server-api-url';

const PUBLIC_ROUTES = [
  '',
  'pricing',
  'how-it-works',
  'contact',
  'help',
  'privacy',
  'terms',
];

const LOCALES = ['en', 'zh-Hant'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await resolvePublicOrigin();
  const base = new Date().toISOString();

  return LOCALES.flatMap((locale) =>
    PUBLIC_ROUTES.map((route) => {
      const path = route ? `/${locale}/${route}` : `/${locale}`;
      return {
        url: new URL(path, origin).toString(),
        lastModified: base,
        changeFrequency: 'weekly' as const,
        priority: route === '' ? 1.0 : 0.7,
      };
    }),
  );
}
