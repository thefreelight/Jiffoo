/**
 * Home Page for Shop Application
 *
 * Server component that emits page-level SEO metadata (title, description,
 * canonical, hreflang, OG, JSON-LD) and renders the theme-provided home
 * template via the client HomePageClient.
 */

import type { Metadata } from 'next';
import { getServerStoreContext } from '@/lib/server-store-context';
import { resolvePublicOrigin } from '@/lib/server-api-url';
import { homeJsonLd, organizationJsonLd } from '@/lib/seo/public-page-metadata';
import {
  generateThemePageMetadata,
  resolveBrandName,
  resolveThemePageCopy,
} from '@/lib/seo/theme-page-copy';
import HomePageClient from './HomePageClient';

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: HomePageProps): Promise<Metadata> {
  const [{ locale }, context, origin] = await Promise.all([
    params,
    getServerStoreContext({ cache: 'no-store' }),
    resolvePublicOrigin(),
  ]);
  return generateThemePageMetadata({ route: 'home', locale, context, origin });
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  const context = await getServerStoreContext({ cache: 'no-store' });
  const brandName = resolveBrandName(context) || 'BOKMOO';
  const origin = await resolvePublicOrigin();
  // The structured data describes what this storefront's home page actually is.
  const copy = await resolveThemePageCopy({ route: 'home', locale, brandName, themeSlug: context?.theme?.slug });
  const structuredData = `${homeJsonLd(origin, brandName, copy?.description)}\n${organizationJsonLd(origin, brandName)}`;
  return (
    <>
      <HomePageClient />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
    </>
  );
}
