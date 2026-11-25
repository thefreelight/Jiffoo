/**
 * Credits page — the theme's acknowledgements. Server wrapper for the page
 * metadata; the theme's CreditsPage component renders client-side.
 */
import type { Metadata } from 'next';
import { getServerStoreContext } from '@/lib/server-store-context';
import { resolvePublicOrigin } from '@/lib/server-api-url';
import { generateThemeRouteMetadata } from '@/lib/seo/route-metadata';
import CreditsPageClient from './CreditsPageClient';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ locale }, context, origin] = await Promise.all([
    params,
    getServerStoreContext({ cache: 'no-store' }),
    resolvePublicOrigin(),
  ]);
  return generateThemeRouteMetadata({
    route: 'credits',
    path: '/credits',
    locale,
    context,
    origin,
    fallback: { title: 'Credits', description: 'Where the content on this site comes from.' },
  });
}

export default function Page() {
  return <CreditsPageClient />;
}
