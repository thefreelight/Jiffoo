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
import {
  generatePublicPageMetadata,
  homeJsonLd,
  organizationJsonLd,
} from '@/lib/seo/public-page-metadata';
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
  const brandName = context?.theme?.config?.brand?.name?.trim() || context?.storeName?.trim() || 'RemoteRadar';
  return generatePublicPageMetadata({ route: 'home', locale, origin, brandName });
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  const origin = await resolvePublicOrigin();
  const structuredData = `${homeJsonLd(origin)}\n${organizationJsonLd(origin)}`;
  return (
    <>
      <HomePageClient />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
    </>
  );
}
