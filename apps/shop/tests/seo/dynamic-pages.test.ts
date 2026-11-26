import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ThemeDynamicPage } from 'shared/src/types/theme';
import { declaredDynamicPages, dynamicPageCopy, dynamicPageItemId, dynamicPagePath } from '@/lib/seo/dynamic-pages';
import { parseDynamicPageDeclarations } from '@/lib/themes/theme-seo';

const ORIGIN = 'https://shop.example';
const CATALOG: ThemeDynamicPage = { path: '/games/:id', sources: ['https://feed.example/featured.json', 'https://feed.example/all.json'], items: 'games', idField: 'id' };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('parseDynamicPageDeclarations', () => {
  it('keeps a well-formed declaration and trims what it names', () => {
    const [page] = parseDynamicPageDeclarations([{ ...CATALOG, titleField: ' title ', changeFrequency: 'daily', priority: 0.6 }]);
    expect(page).toEqual({ ...CATALOG, titleField: 'title', changeFrequency: 'daily', priority: 0.6 });
  });

  it('drops entries that cannot make a page', () => {
    expect(parseDynamicPageDeclarations([
      { path: 'games/:id', sources: ['https://feed.example/a.json'], idField: 'id' },
      { path: '/games', sources: ['https://feed.example/a.json'], idField: 'id' },
      { path: '/games/:id', sources: [], idField: 'id' },
      { path: '/games/:id', sources: ['feed.example/a.json'], idField: 'id' },
      { path: '/games/:id', sources: ['https://feed.example/a.json'] },
    ])).toEqual([]);
    expect(parseDynamicPageDeclarations('none')).toEqual([]);
  });

  it('ignores values outside the declared ranges', () => {
    const [page] = parseDynamicPageDeclarations([{ ...CATALOG, changeFrequency: 'sometimes', priority: 7 }]);
    expect(page?.changeFrequency).toBeUndefined();
    expect(page?.priority).toBeUndefined();
  });
});

describe('dynamicPagePath', () => {
  it('fills each :name segment from the item', () => {
    expect(dynamicPagePath(CATALOG, { id: 'gm-38129' })).toBe('/games/gm-38129');
    expect(dynamicPagePath({ ...CATALOG, path: '/games/:id/:slug' }, { id: 2048, slug: 'number puzzle' })).toBe('/games/2048/number%20puzzle');
  });

  it('gives an item without a value for a segment no page', () => {
    expect(dynamicPagePath(CATALOG, { title: 'no id' })).toBeNull();
    expect(dynamicPagePath(CATALOG, { id: '' })).toBeNull();
  });

  it('reads the id and copy from the fields the theme names', () => {
    expect(dynamicPageItemId({ ...CATALOG, idField: 'slug' }, { slug: 'tetris' })).toBe('tetris');
    expect(dynamicPageItemId(CATALOG, { title: 'no id' })).toBeNull();
    const item = { name: 'Tetris', summary: 'Stack the blocks', thumb: 'https://img.example/tetris.jpg' };
    expect(dynamicPageCopy({ ...CATALOG, titleField: 'name', descriptionField: 'summary' }, item)).toEqual({ title: 'Tetris', description: 'Stack the blocks' });
    expect(dynamicPageCopy(CATALOG, item)).toEqual({ title: undefined, description: undefined });
  });
});

describe('loadDynamicPageItems', () => {
  const respond = (body: unknown, status = 200) => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/all.json')) return new Response(JSON.stringify(body), { status });
      return new Response(JSON.stringify({ games: [{ id: 'featured-1' }, { id: 'featured-2' }, null, 'junk'] }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };

  beforeEach(() => {
    vi.resetModules();
  });

  it('merges every source, follows the items path and keeps only objects', async () => {
    respond({ games: [{ id: 'all-1' }, { id: 'all-2' }] });
    const fresh = await import('@/lib/seo/dynamic-pages');
    expect((await fresh.loadDynamicPageItems(CATALOG, ORIGIN)).map((item) => item.id)).toEqual(['featured-1', 'featured-2', 'all-1', 'all-2']);
  });

  it('reads the document itself when no items path is declared', async () => {
    respond([{ id: 'all-1' }]);
    const fresh = await import('@/lib/seo/dynamic-pages');
    const items = await fresh.loadDynamicPageItems({ path: '/games/:id', sources: ['https://feed.example/all.json'], idField: 'id' }, ORIGIN);
    expect(items.map((item) => item.id)).toEqual(['all-1']);
  });

  it('reads a source given as a path on the storefront itself', async () => {
    respond({ games: [{ id: 'all-1' }] });
    const fresh = await import('@/lib/seo/dynamic-pages');
    const items = await fresh.loadDynamicPageItems({ path: '/games/:id', sources: ['/all.json'], items: 'games', idField: 'id' }, ORIGIN);
    expect(items.map((item) => item.id)).toEqual(['all-1']);
    // The path is resolved against the storefront origin.
    expect(fresh.feedUrl('/extensions/themes/shop/portal/data/games.json', ORIGIN)).toBe(
      'https://shop.example/extensions/themes/shop/portal/data/games.json',
    );
  });

  it('keeps the items of a source that fails and fetches once per feed', async () => {
    const fetchMock = respond({ games: [] }, 503);
    const fresh = await import('@/lib/seo/dynamic-pages');
    const first = await fresh.loadDynamicPageItems(CATALOG, ORIGIN);
    const second = await fresh.loadDynamicPageItems(CATALOG, ORIGIN);
    expect(first.map((item) => item.id)).toEqual(['featured-1', 'featured-2']);
    expect(second).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('declaredDynamicPages', () => {
  it('follows the active theme, then the pinned slug, and is empty for a theme that declares none', () => {
    vi.stubEnv('THEME_SLUG_PIN', 'esim');
    expect(declaredDynamicPages()).toEqual([]);
    vi.stubEnv('THEME_SLUG_PIN', '');
    expect(declaredDynamicPages('esim')).toEqual([]);
    expect(declaredDynamicPages('not-a-theme')).toEqual([]);
  });
});
