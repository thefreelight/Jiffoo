import type { Metadata } from 'next';
import type { ThemeDynamicPage } from 'shared/src/types/theme';
import type { ServerStoreContext } from '@/lib/server-store-context';
import { resolveBrandName, resolveThemePageCopy } from './theme-page-copy';
import { dynamicPageCopy, dynamicPageItemId, dynamicPagePath, loadDynamicPageItems } from './dynamic-pages';
import { NOINDEX_DIRECTIVE } from './indexing';

type StoreContext = ServerStoreContext | null | undefined;

type SocialImage = { url: string; width?: number; height?: number; alt?: string };

/** The icon every storefront ships, used when a page has no picture of its own. */
function storeIcon(origin: string, alt: string): SocialImage {
  return { url: new URL('/icon-512x512.png', origin).toString(), width: 512, height: 512, alt };
}

/**
 * Open Graph and Twitter card for one page. Defining `openGraph` here replaces
 * the root layout's, so the image is spelled out again rather than inherited.
 */
function socialCards(origin: string, title: string, description: string, brandName: string | undefined, image?: string) {
  const images: SocialImage[] = [image ? { url: new URL(image, origin).toString(), alt: title } : storeIcon(origin, brandName || title)];
  return {
    openGraph: { title, description, type: 'website', siteName: brandName, images },
    twitter: { card: 'summary_large_image', title, description, images: images.map((entry) => entry.url) },
  };
}

/**
 * Metadata for a route the host renders on behalf of the theme beyond the
 * marketing pages every storefront has (`/games`, `/credits`). The copy is the
 * theme's declaration for the route and locale, else its English source; a
 * theme that declares none gets `fallback`.
 */
export async function generateThemeRouteMetadata({
  route,
  path,
  locale,
  context,
  origin,
  fallback,
}: {
  route: 'games' | 'credits';
  path: string;
  locale: string;
  context: StoreContext;
  origin: string;
  fallback: { title: string; description: string };
}): Promise<Metadata> {
  const brandName = resolveBrandName(context);
  const copy = (await resolveThemePageCopy({ route, locale, brandName, themeSlug: context?.theme?.slug })) ?? fallback;
  return {
    title: copy.title,
    description: copy.description,
    alternates: { canonical: new URL(`/${locale}${path}`, origin).toString() },
    ...socialCards(origin, copy.title, copy.description, brandName),
  };
}

/**
 * Metadata for one item of a data-fed page: its own title, description and
 * picture from the feed. An id the feed does not know gets the fallback title
 * and `noindex` — the page shows the theme's not-found state, and a search
 * engine should not keep that.
 */
export async function generateDynamicItemMetadata({
  page,
  id,
  locale,
  context,
  origin,
  fallbackTitle,
}: {
  page: ThemeDynamicPage;
  id: string;
  locale: string;
  context: StoreContext;
  origin: string;
  fallbackTitle: string;
}): Promise<Metadata> {
  const brandName = resolveBrandName(context);
  const wanted = safeDecode(id);
  const listPath = page.path.split('/:')[0];
  const canonical = new URL(`/${locale}${listPath}/${encodeURIComponent(wanted)}`, origin).toString();
  const items = await loadDynamicPageItems(page, origin);
  const item = items.find((candidate) => {
    const itemId = dynamicPageItemId(page, candidate);
    return itemId !== null && itemId === wanted && dynamicPagePath(page, candidate) !== null;
  });
  if (!item) {
    return { title: fallbackTitle, robots: NOINDEX_DIRECTIVE, alternates: { canonical } };
  }
  const copy = dynamicPageCopy(page, item);
  const title = copy.title ?? fallbackTitle;
  const description = copy.description ?? '';
  const image = page.imageField && typeof item[page.imageField] === 'string' ? (item[page.imageField] as string) : undefined;
  return { title, description, alternates: { canonical }, ...socialCards(origin, title, description, brandName, image) };
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
