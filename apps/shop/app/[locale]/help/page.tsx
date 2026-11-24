/**
 * Help Page — server wrapper for page-level SEO metadata.
 */
import type { Metadata } from 'next';
import { getServerStoreContext } from '@/lib/server-store-context';
import { resolvePublicOrigin } from '@/lib/server-api-url';
import { generateThemePageMetadata } from '@/lib/seo/theme-page-copy';
import HelpPageClient from './HelpPageClient';

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ locale }, ctx, origin] = await Promise.all([params, getServerStoreContext({ cache: 'no-store' }), resolvePublicOrigin()]);
  return generateThemePageMetadata({ route: 'help', locale, context: ctx, origin });
}

export default function Page() { return <HelpPageClient />; }