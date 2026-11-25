import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ThemeDynamicPage } from 'shared/src/types/theme';
import { generateDynamicItemMetadata, generateThemeRouteMetadata } from '@/lib/seo/route-metadata';
import { DECLARED_THEME_DYNAMIC_PAGES } from '@/lib/themes/theme-seo';

const PAGE: ThemeDynamicPage = {
  path: '/games/:id',
  sources: ['https://feed.example/games.json'],
  idField: 'id',
  titleField: 'title',
  descriptionField: 'desc',
  imageField: 'thumb',
};
const FEED = [{ id: '2048', title: '2048', desc: 'Join the numbers.', thumb: 'https://img.example/2048.jpg' }];

/** The first image of a page's Open Graph card (Next types it as one image or a list). */
const firstImage = (images: unknown): string | undefined => {
  const list = Array.isArray(images) ? images : images ? [images] : [];
  return (list[0] as { url?: string } | undefined)?.url;
};
const CONTEXT = { storeName: 'PLAYGROUND', theme: { slug: 'test-portal' } } as never;

afterEach(() => {
  vi.unstubAllGlobals();
  delete (DECLARED_THEME_DYNAMIC_PAGES as Record<string, unknown>)['test-portal'];
});

function stubFeed() {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(FEED), { status: 200 })));
}

describe('generateThemeRouteMetadata', () => {
  it('uses the fallback copy when the theme declares none for the route', async () => {
    const metadata = await generateThemeRouteMetadata({
      route: 'games',
      path: '/games',
      locale: 'zh-Hans',
      context: CONTEXT,
      origin: 'https://shop.example',
      fallback: { title: 'All games', description: 'Every game on this site.' },
    });
    expect(metadata.title).toBe('All games');
    expect(metadata.alternates?.canonical).toBe('https://shop.example/zh-Hans/games');
    expect(metadata.openGraph?.url).toBeUndefined();
    expect(metadata.openGraph?.images).toMatchObject([{ url: 'https://shop.example/icon-512x512.png', width: 512 }]);
  });
});

describe('generateDynamicItemMetadata', () => {
  it('gives an item its own title, description, canonical URL and share image', async () => {
    stubFeed();
    const metadata = await generateDynamicItemMetadata({ page: PAGE, id: '2048', locale: 'zh-Hans', context: CONTEXT, origin: 'https://shop.example', fallbackTitle: 'Game' });
    expect(metadata.title).toBe('2048');
    expect(metadata.description).toBe('Join the numbers.');
    expect(metadata.alternates?.canonical).toBe('https://shop.example/zh-Hans/games/2048');
    expect(firstImage(metadata.openGraph?.images)).toBe('https://img.example/2048.jpg');
    expect(metadata.robots).toBeUndefined();
  });

  it('keeps an id the feed does not know out of the index', async () => {
    stubFeed();
    const metadata = await generateDynamicItemMetadata({ page: PAGE, id: 'missing', locale: 'zh-Hans', context: CONTEXT, origin: 'https://shop.example', fallbackTitle: 'Game' });
    expect(metadata).toEqual({ title: 'Game', robots: { index: false, follow: false }, alternates: { canonical: 'https://shop.example/zh-Hans/games/missing' } });
  });

  it('still answers with the fallback when the feed cannot be read', async () => {
    // Another feed URL than the other tests use: feeds are cached per URL.
    const fetchMock = vi.fn(async () => new Response(null, { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    const page = { ...PAGE, sources: ['https://feed.example/down.json'] };
    const metadata = await generateDynamicItemMetadata({ page, id: '2048', locale: 'zh-Hans', context: CONTEXT, origin: 'https://shop.example', fallbackTitle: 'Game' });
    expect(metadata.title).toBe('Game');
    expect(metadata.robots).toEqual({ index: false, follow: false });
    // A failed feed is not asked again at once.
    await generateDynamicItemMetadata({ page, id: '2048', locale: 'zh-Hans', context: CONTEXT, origin: 'https://shop.example', fallbackTitle: 'Game' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
