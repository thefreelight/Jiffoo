/**
 * Game detail — one item of the theme's own catalogue. The server wrapper
 * gives the page its own title, description and share card from the feed the
 * theme declares; the theme's GameDetailPage component renders client-side.
 */
import type { Metadata } from 'next';
import { getServerStoreContext } from '@/lib/server-store-context';
import { resolvePublicOrigin } from '@/lib/server-api-url';
import { declaredDynamicPages } from '@/lib/seo/dynamic-pages';
import { generateDynamicItemMetadata } from '@/lib/seo/route-metadata';
import GameDetailClient from '../GameDetailClient';

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

const LIST_PATH = '/games';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ locale, id }, context, origin] = await Promise.all([
    params,
    getServerStoreContext({ cache: 'no-store' }),
    resolvePublicOrigin(),
  ]);
  // The declaration whose path starts with this route: `/games/:id`.
  const page = declaredDynamicPages(context?.theme?.slug).find((candidate) => candidate.path.split('/:')[0] === LIST_PATH);
  const canonical = new URL(`/${locale}${LIST_PATH}/${encodeURIComponent(id)}`, origin).toString();
  if (!page) return { title: 'Game', robots: { index: false, follow: false }, alternates: { canonical } };
  return generateDynamicItemMetadata({ page, id, locale, context, origin, fallbackTitle: 'Game' });
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  return <GameDetailClient gameId={id} />;
}
