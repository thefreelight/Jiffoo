import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MetadataRoute } from 'next';
import sitemap from '@/app/sitemap';
import robots from '@/app/robots';
import { generatePublicPageMetadata } from '@/lib/seo/public-page-metadata';
import { DECLARED_THEME_DYNAMIC_PAGES } from '@/lib/themes/theme-seo';

const FEED = [{ id: '2048', title: '2048', desc: 'Join the numbers.' }, { id: 'pelican-bike', title: 'Pelican Bike' }, { title: 'no id' }];
const ORIGIN = 'https://shop.example';

/** No SEO plugin surface on this store, so only the host's own routes are listed. */
function stubNetwork() {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url).includes('feed.example')) return new Response(JSON.stringify(FEED), { status: 200 });
    return new Response(null, { status: 404 });
  }));
}

function registerFeedTheme() {
  (DECLARED_THEME_DYNAMIC_PAGES as Record<string, unknown>)['test-portal'] = [
    { path: '/games/:id', sources: ['https://feed.example/games.json'], idField: 'id', priority: 0.5, changeFrequency: 'daily' },
  ];
  vi.stubEnv('THEME_SLUG_PIN', 'test-portal');
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SHOP_URL', ORIGIN);
  stubNetwork();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  delete (DECLARED_THEME_DYNAMIC_PAGES as Record<string, unknown>)['test-portal'];
});

describe('robots', () => {
  it('lets a public storefront be crawled and names its sitemap', async () => {
    const rules = (await robots()) as MetadataRoute.Robots;
    expect(rules.sitemap).toBe(`${ORIGIN}/sitemap.xml`);
    expect(rules.rules).toMatchObject({ userAgent: '*', allow: '/' });
    const disallow: string[] = (rules.rules as { disallow: string[] }).disallow;
    expect(disallow).toEqual(expect.arrayContaining(['/api/', '/en/auth', '/en/profile', '/zh-Hans/checkout']));
  });

  it('keeps a noindex deployment out of every index', async () => {
    vi.stubEnv('SHOP_NOINDEX', '1');
    expect(await robots()).toEqual({ rules: { userAgent: '*', disallow: '/' } });
  });
});

describe('sitemap', () => {
  it('lists the public routes once on a single-locale store, without hreflang alternates', async () => {
    vi.stubEnv('NEXT_PUBLIC_FALLBACK_SUPPORTED_LOCALES', 'zh-Hans');
    const entries: MetadataRoute.Sitemap = await sitemap();
    expect(entries.map((entry) => new URL(entry.url).pathname)).toEqual([
      '/zh-Hans', '/zh-Hans/pricing', '/zh-Hans/how-it-works', '/zh-Hans/contact', '/zh-Hans/help', '/zh-Hans/privacy', '/zh-Hans/terms',
    ]);
    expect(entries.every((entry) => entry.alternates === undefined)).toBe(true);
  });

  it('announces alternates only when the store offers a choice', async () => {
    vi.stubEnv('NEXT_PUBLIC_FALLBACK_SUPPORTED_LOCALES', 'en,zh-Hans');
    const [home] = await sitemap();
    expect(home.alternates?.languages).toEqual({
      en: `${ORIGIN}/en`,
      'zh-Hans': `${ORIGIN}/zh-Hans`,
      'x-default': `${ORIGIN}/en`,
    });
  });

  it('lists every item of the pages the active theme feeds itself', async () => {
    vi.stubEnv('NEXT_PUBLIC_FALLBACK_SUPPORTED_LOCALES', 'zh-Hans');
    registerFeedTheme();
    const entries = await sitemap();
    const game = entries.find((entry) => entry.url === `${ORIGIN}/zh-Hans/games/2048`);
    expect(game).toMatchObject({ changeFrequency: 'daily', priority: 0.5 });
    expect(entries.some((entry) => entry.url === `${ORIGIN}/zh-Hans/games/pelican-bike`)).toBe(true);
    // An item without an id has no page.
    expect(entries.filter((entry) => entry.url.includes('/games/'))).toHaveLength(2);
  });

  it('is empty on a noindex deployment', async () => {
    vi.stubEnv('SHOP_NOINDEX', '1');
    expect(await sitemap()).toEqual([]);
  });
});

describe('generatePublicPageMetadata', () => {
  it('names the offered locales in hreflang, with x-default on the default locale', () => {
    const metadata = generatePublicPageMetadata({ route: 'privacy', locale: 'zh-Hant', origin: ORIGIN });
    expect(metadata.alternates).toEqual({
      canonical: `${ORIGIN}/zh-Hant/privacy`,
      languages: {
        en: `${ORIGIN}/en/privacy`,
        'zh-Hans': `${ORIGIN}/zh-Hans/privacy`,
        'zh-Hant': `${ORIGIN}/zh-Hant/privacy`,
        ja: `${ORIGIN}/ja/privacy`,
        ko: `${ORIGIN}/ko/privacy`,
        fr: `${ORIGIN}/fr/privacy`,
        de: `${ORIGIN}/de/privacy`,
        'x-default': `${ORIGIN}/en/privacy`,
      },
    });
    expect(metadata.openGraph?.locale).toBe('zh_TW');
  });

  it('emits no hreflang on a single-locale store and uses that locale for social', () => {
    vi.stubEnv('NEXT_PUBLIC_FALLBACK_SUPPORTED_LOCALES', 'zh-Hans');
    const metadata = generatePublicPageMetadata({ route: 'home', locale: 'zh-Hans', origin: ORIGIN });
    expect(metadata.alternates).toEqual({ canonical: `${ORIGIN}/zh-Hans/` });
    expect(metadata.openGraph?.locale).toBe('zh_CN');
  });
});
