/**
 * Games page — a catalogue the theme feeds from its own data
 * (`x-jiffoo-seo.dynamicPages`). Server wrapper for the page metadata; the
 * theme's GamesPage component renders client-side.
 */
import type { Metadata } from 'next';
import { getServerStoreContext } from '@/lib/server-store-context';
import { resolvePublicOrigin } from '@/lib/server-api-url';
import { generateThemeRouteMetadata } from '@/lib/seo/route-metadata';
import GamesPageClient from './GamesPageClient';

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
    route: 'games',
    path: '/games',
    locale,
    context,
    origin,
    fallback: { title: 'Games', description: 'Play free games in your browser.' },
  });
}

export default function Page() {
  return <GamesPageClient />;
}
