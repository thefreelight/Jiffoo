import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDeclaredThemeDynamicPages, getDeclaredThemeSeo } from '@/lib/themes/theme-seo';
import { generateThemePageMetadata } from '@/lib/seo/theme-page-copy';
import { declaredDynamicPages } from '@/lib/seo/dynamic-pages';

/**
 * A theme served as a packaged runtime from the asset library is not part of
 * this build, so its SEO declaration arrives as data in `SHOP_THEME_SEO`
 * (`{ slug, ...x-jiffoo-seo }`) instead of an imported manifest.
 */

const DECLARATION = {
  slug: 'remote-portal',
  default: {
    en: { title: 'Free browser games', description: 'Play free games in your browser.' },
    'zh-Hans': { title: '免费网页游戏', description: '免费网页游戏即点即玩。' },
  },
  pages: {
    home: {
      en: { title: 'Games, instantly', description: 'Every game plays on click.' },
      'zh-Hans': { title: '游戏大厅', description: '点开就玩。' },
    },
  },
  dynamicPages: [
    { path: '/games/:id', sources: ['/extensions/themes/shop/remote-portal/data/games.json'], items: 'games', idField: 'id', titleField: 'title' },
    { path: 'games/:id', sources: ['/x.json'], idField: 'id' },
  ],
};

const context = { storeName: 'Remote Portal', theme: { slug: 'remote-portal' } } as never;

afterEach(() => vi.unstubAllEnvs());

describe('runtime theme declaration (SHOP_THEME_SEO)', () => {
  it('is absent while the deployment sets no variable', () => {
    vi.stubEnv('SHOP_THEME_SEO', '');
    expect(getDeclaredThemeSeo('remote-portal')).toBeUndefined();
    expect(getDeclaredThemeDynamicPages('remote-portal')).toEqual([]);
  });

  it('applies to its own slug only, with well-formed dynamic pages', () => {
    vi.stubEnv('SHOP_THEME_SEO', JSON.stringify(DECLARATION));
    expect(getDeclaredThemeSeo('remote-portal')?.home?.['zh-Hans']).toEqual({ title: '游戏大厅', description: '点开就玩。' });
    expect(getDeclaredThemeSeo('someone-else')).toBeUndefined();
    expect(getDeclaredThemeDynamicPages('remote-portal')).toEqual([DECLARATION.dynamicPages[0]]);
    expect(getDeclaredThemeDynamicPages('someone-else')).toEqual([]);
  });

  it('feeds the theme page copy for a store whose active theme is the declared one', async () => {
    vi.stubEnv('SHOP_THEME_SEO', JSON.stringify(DECLARATION));
    const metadata = await generateThemePageMetadata({ route: 'home', locale: 'zh-Hans', context, origin: 'https://portal.example' });
    expect(metadata.title).toBe('游戏大厅');
    expect(metadata.description).toBe('点开就玩。');
  });

  it('drives the sitemap and per-page metadata declarations on a pinned deployment', () => {
    vi.stubEnv('SHOP_THEME_SEO', JSON.stringify(DECLARATION));
    vi.stubEnv('THEME_SLUG_PIN', 'remote-portal');
    expect(declaredDynamicPages().map((page) => page.path)).toEqual(['/games/:id']);
  });

  it('ignores a declaration that is unreadable or names no slug', async () => {
    // The declaration is parsed once per runtime; a fresh module is the honest way to test a first read.
    vi.resetModules();
    vi.stubEnv('SHOP_THEME_SEO', '{not json');
    const unreadable = await import('@/lib/themes/theme-seo');
    expect(unreadable.getDeclaredThemeSeo('remote-portal')).toBeUndefined();

    vi.resetModules();
    vi.stubEnv('SHOP_THEME_SEO', JSON.stringify({ ...DECLARATION, slug: '' }));
    const nameless = await import('@/lib/themes/theme-seo');
    expect(nameless.getDeclaredThemeSeo('remote-portal')).toBeUndefined();
  });

  it('yields to a theme whose manifest is imported in this build', async () => {
    vi.resetModules();
    vi.stubEnv('SHOP_THEME_SEO', JSON.stringify({ ...DECLARATION, slug: 'esim', default: { en: { title: 'Not the pack', description: 'x' } } }));
    const imported = await import('@/lib/themes/theme-seo');
    // esim's imported declaration stands; the variable does not replace any of it.
    expect(imported.getDeclaredThemeSeo('esim')?.default?.en?.title).not.toBe('Not the pack');
    expect(imported.getDeclaredThemeSeo('esim')?.help?.en?.title).toContain('eSIM');
  });
});
