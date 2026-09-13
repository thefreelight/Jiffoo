/**
 * Pricing Page — server wrapper for page-level SEO metadata.
 */
import type { Metadata } from 'next';
import { getServerStoreContext } from '@/lib/server-store-context';
import { resolvePublicOrigin } from '@/lib/server-api-url';
import { generatePublicPageMetadata } from '@/lib/seo/public-page-metadata';
import PricingPageClient from './PricingPageClient';

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ locale }, ctx, origin] = await Promise.all([params, getServerStoreContext({ cache: 'no-store' }), resolvePublicOrigin()]);
  return generatePublicPageMetadata({ route: 'pricing', locale, origin, brandName: ctx?.theme?.config?.brand?.name?.trim() || ctx?.storeName?.trim() });
}

export default function Page() { return <PricingPageClient />; }