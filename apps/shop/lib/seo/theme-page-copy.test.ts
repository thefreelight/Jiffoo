/**
 * Theme-owned page copy (lib/seo/theme-page-copy.ts): the marketing route wrappers and
 * the locale layout's default — theme declaration, plugin override, core defaults — and
 * the server/client import boundary that only a real Next build would otherwise catch.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerStoreContext } from '@/lib/server-store-context';

const mocks = vi.hoisted(() => ({
  getDeclaredThemeSeo: vi.fn(),
  getThemeMessages: vi.fn(),
}));

vi.mock('@/lib/themes/theme-seo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/themes/theme-seo')>()),
  getDeclaredThemeSeo: mocks.getDeclaredThemeSeo,
}));
vi.mock('@/lib/theme-i18n-server', () => ({ getThemeMessages: mocks.getThemeMessages }));

// The mocked declarations module keeps the real constants and only stubs the lookup.
import { DEFAULT_THEME_SEO_ROUTE } from '@/lib/themes/theme-seo';
import {
  generateThemeDefaultMetadata,
  generateThemePageMetadata,
  resolveBrandName,
  resolveThemePageCopy,
} from '@/lib/seo/theme-page-copy';

const ORIGIN = 'https://esim.example.com';
const HOME_EN = {
  title: '{brand} eSIM — One Trip, One eSIM',
  description: 'Route-first eSIM mall by {brand}.',
};
const DEFAULT_EN = {
  title: '{brand} eSIM — Travel eSIM Plans & Data',
  description: 'Destination and regional eSIM plans from {brand}.',
};
const DECLARED = {
  [DEFAULT_THEME_SEO_ROUTE]: {
    en: DEFAULT_EN,
    de: { title: '{brand} eSIM — Tarife und Daten', description: 'Ziel- und Regional-Tarife von {brand}.' },
  },
  home: {
    en: HOME_EN,
    de: { title: '{brand} eSIM — Eine Reise', description: 'Routenbasierter eSIM-Shop von {brand}.' },
  },
};

function context(partial: Partial<ServerStoreContext> = {}): ServerStoreContext {
  return {
    storeId: '1',
    storeName: 'Bokmoo',
    logo: null,
    theme: { slug: 'esim', version: '0.0.25' },
    settings: null,
    status: 'active',
    ...partial,
  } as ServerStoreContext;
}

describe('resolveThemePageCopy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getThemeMessages.mockResolvedValue(null);
    mocks.getDeclaredThemeSeo.mockImplementation((slug: string) => (slug === 'esim' ? DECLARED : undefined));
  });

  it('returns what the theme declares for the locale, with {brand} filled in', async () => {
    await expect(
      resolveThemePageCopy({ route: 'home', locale: 'de', brandName: 'Bokmoo', themeSlug: 'esim' }),
    ).resolves.toEqual({
      title: 'Bokmoo eSIM — Eine Reise',
      description: 'Routenbasierter eSIM-Shop von Bokmoo.',
    });
  });

  it('falls back to the English source for a locale the theme does not declare', async () => {
    const copy = await resolveThemePageCopy({ route: 'home', locale: 'fr', brandName: 'Bokmoo', themeSlug: 'esim' });
    expect(copy).toEqual({ title: 'Bokmoo eSIM — One Trip, One eSIM', description: 'Route-first eSIM mall by Bokmoo.' });
  });

  it('lets the Store Localization plugin override each string by its English source', async () => {
    mocks.getThemeMessages.mockResolvedValue({
      'theme.esim': { [HOME_EN.title]: 'Promo: {brand} Reiseroute' },
    });

    const copy = await resolveThemePageCopy({ route: 'home', locale: 'de', brandName: 'Bokmoo', themeSlug: 'esim' });

    expect(copy).toEqual({
      title: 'Promo: Bokmoo Reiseroute',
      // No plugin entry for the description: the theme's own German stands.
      description: 'Routenbasierter eSIM-Shop von Bokmoo.',
    });
    expect(mocks.getThemeMessages).toHaveBeenCalledWith('de');
  });

  it('only reads the active theme’s own namespace', async () => {
    mocks.getThemeMessages.mockResolvedValue({
      'theme.other': { [HOME_EN.title]: 'Another theme’s title' },
    });

    const copy = await resolveThemePageCopy({ route: 'home', locale: 'de', brandName: 'Bokmoo', themeSlug: 'esim' });

    expect(copy?.title).toBe('Bokmoo eSIM — Eine Reise');
  });

  it('ignores blank plugin entries', async () => {
    mocks.getThemeMessages.mockResolvedValue({ 'theme.esim': { [HOME_EN.title]: '   ' } });

    const copy = await resolveThemePageCopy({ route: 'home', locale: 'de', brandName: 'Bokmoo', themeSlug: 'esim' });

    expect(copy?.title).toBe('Bokmoo eSIM — Eine Reise');
  });

  it('keeps the theme copy when the plugin lookup fails', async () => {
    mocks.getThemeMessages.mockRejectedValue(new Error('plugin down'));

    const copy = await resolveThemePageCopy({ route: 'home', locale: 'de', brandName: 'Bokmoo', themeSlug: 'esim' });

    expect(copy?.title).toBe('Bokmoo eSIM — Eine Reise');
  });

  it('returns null without asking the plugin when there is nothing declared for the route', async () => {
    expect(await resolveThemePageCopy({ route: 'help', locale: 'de', brandName: 'Bokmoo', themeSlug: 'esim' })).toBeNull();
    expect(await resolveThemePageCopy({ route: 'home', locale: 'de', brandName: 'Bokmoo', themeSlug: 'not-embedded' })).toBeNull();
    expect(await resolveThemePageCopy({ route: 'home', locale: 'de', brandName: 'Bokmoo', themeSlug: null })).toBeNull();
    expect(mocks.getThemeMessages).not.toHaveBeenCalled();
  });

  it('does not treat a route as declared when the theme lacks the English source', async () => {
    mocks.getDeclaredThemeSeo.mockReturnValue({ home: { de: { title: 'nur Deutsch', description: 'ohne Quelle' } } });

    expect(await resolveThemePageCopy({ route: 'home', locale: 'de', brandName: 'Bokmoo', themeSlug: 'x' })).toBeNull();
  });
});

describe('generateThemePageMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getThemeMessages.mockResolvedValue(null);
  });

  it('leaves a theme that declares nothing on the core defaults', async () => {
    mocks.getDeclaredThemeSeo.mockReturnValue(undefined);

    const metadata = await generateThemePageMetadata({
      route: 'home',
      locale: 'en',
      context: context({ storeName: 'Demo', theme: { slug: 'builtin-default' } }),
      origin: ORIGIN,
    });

    expect(metadata.title).toBe('Demo – One Card, Connected to Your World');
    expect(metadata.description).toBe(
      'Demo is a physical eSIM card for global travelers. 200+ countries and regions, flexible plans, effortless management.',
    );
  });

  it('builds the metadata from the theme copy for the active theme of the store context', async () => {
    mocks.getDeclaredThemeSeo.mockReturnValue(DECLARED);

    const metadata = await generateThemePageMetadata({ route: 'home', locale: 'de', context: context(), origin: ORIGIN });

    expect(metadata.title).toBe('Bokmoo eSIM — Eine Reise');
    expect(metadata.description).toBe('Routenbasierter eSIM-Shop von Bokmoo.');
    expect(metadata.openGraph?.title).toBe('Bokmoo eSIM — Eine Reise');
    expect(metadata.openGraph?.siteName).toBe('Bokmoo');
    // The theme only supplies words; canonical, hreflang and share image stay the route's own.
    expect(metadata.alternates?.canonical).toBe('https://esim.example.com/de/');
    const images = metadata.openGraph?.images;
    expect(Array.isArray(images) ? (images[0] as { url?: string }).url : images).toBe('https://esim.example.com/icon-512x512.png');
  });

  it('renders even without a store context', async () => {
    mocks.getDeclaredThemeSeo.mockReturnValue(DECLARED);

    const metadata = await generateThemePageMetadata({ route: 'home', locale: 'de', context: null, origin: ORIGIN });

    expect(metadata.title).toBe('BOKMOO – One Card, Connected to Your World');
    expect(mocks.getThemeMessages).not.toHaveBeenCalled();
  });
});

describe('generateThemeDefaultMetadata (locale layout)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getThemeMessages.mockResolvedValue(null);
    mocks.getDeclaredThemeSeo.mockImplementation((slug: string) => (slug === 'esim' ? DECLARED : undefined));
  });

  it('gives pages without their own metadata the declared default, keeping the brand title template', async () => {
    await expect(generateThemeDefaultMetadata({ locale: 'de', context: context() })).resolves.toEqual({
      title: { default: 'Bokmoo eSIM — Tarife und Daten', template: '%s | Bokmoo' },
      description: 'Ziel- und Regional-Tarife von Bokmoo.',
    });
  });

  it('sets only title and description so the root layout survives the shallow merge', async () => {
    // Next replaces a nested openGraph / twitter object wholesale. Returning one here
    // would drop the root layout's share image, site name, URL and card type from every
    // page that sets no metadata of its own.
    const metadata = await generateThemeDefaultMetadata({ locale: 'zh-Hant', context: context() });

    expect(Object.keys(metadata).sort()).toEqual(['description', 'title']);
  });

  it('falls back to the English default', async () => {
    const metadata = await generateThemeDefaultMetadata({ locale: 'zh-Hant', context: context() });

    expect(metadata.title).toEqual({ default: 'Bokmoo eSIM — Travel eSIM Plans & Data', template: '%s | Bokmoo' });
    expect(metadata.description).toBe('Destination and regional eSIM plans from Bokmoo.');
  });

  it('lets the Store Localization plugin override the default by English source', async () => {
    mocks.getThemeMessages.mockResolvedValue({ 'theme.esim': { [DEFAULT_EN.title]: '{brand} Reise-eSIM' } });

    const metadata = await generateThemeDefaultMetadata({ locale: 'de', context: context() });

    expect(metadata.title).toEqual({ default: 'Bokmoo Reise-eSIM', template: '%s | Bokmoo' });
    expect(metadata.description).toBe('Ziel- und Regional-Tarife von Bokmoo.');
  });

  it('answers an empty object so the root layout metadata stays in force', async () => {
    // A theme that declares nothing at all.
    expect(await generateThemeDefaultMetadata({ locale: 'de', context: context({ theme: { slug: 'builtin-default' } }) })).toEqual({});
    // A theme with route copy but no default.
    mocks.getDeclaredThemeSeo.mockImplementation((slug: string) => (slug === 'esim' ? { home: DECLARED.home } : undefined));
    expect(await generateThemeDefaultMetadata({ locale: 'de', context: context() })).toEqual({});
    // No theme, no context.
    expect(await generateThemeDefaultMetadata({ locale: 'de', context: context({ theme: null }) })).toEqual({});
    expect(await generateThemeDefaultMetadata({ locale: 'de', context: null })).toEqual({});
    expect(mocks.getThemeMessages).not.toHaveBeenCalled();
  });

  it('answers an empty object when there is no brand name to build a title template from', async () => {
    expect(await generateThemeDefaultMetadata({ locale: 'de', context: context({ storeName: '', theme: { slug: 'esim' } }) })).toEqual({});
  });
});

describe('server boundary', () => {
  it('keeps the server-side metadata module away from the theme registry and theme runtimes', async () => {
    // Server components import this module to generate metadata. The registry pulls in the
    // client-side theme runtimes, and Next refuses to build that server graph.
    const source = await readFile(path.join(process.cwd(), 'lib', 'seo', 'theme-page-copy.ts'), 'utf8');

    expect(source).not.toMatch(/themes\/registry|@shop-themes\/[^'"]*\/src\/runtime/);
    expect(source).toMatch(/themes\/theme-seo'/);
  });

  it('keeps the locale layout, which generates metadata for every page, away from the theme registry too', async () => {
    const source = await readFile(path.join(process.cwd(), 'app', '[locale]', 'layout.tsx'), 'utf8');

    expect(source).toMatch(/seo\/theme-page-copy'/);
    expect(source).not.toMatch(/themes\/registry|@shop-themes\/[^'"]*\/src\/runtime/);
  });

  it('keeps the declared page metadata module free of anything but type and manifest imports', async () => {
    const source = await readFile(path.join(process.cwd(), 'lib', 'themes', 'theme-seo.ts'), 'utf8');
    const imports = [...source.matchAll(/^import .*;$/gm)].map((match) => match[0]);

    expect(imports.length).toBeGreaterThan(0);
    for (const statement of imports) {
      expect(statement, statement).toMatch(/^import type |\.json';$/);
    }
  });
});

describe('resolveBrandName', () => {
  it('prefers the theme config brand, then the store name, then nothing', () => {
    expect(resolveBrandName(context({ theme: { slug: 'esim', config: { brand: { name: ' Route Mall ' } } } }))).toBe('Route Mall');
    expect(resolveBrandName(context({ storeName: ' Demo ' }))).toBe('Demo');
    expect(resolveBrandName(context({ storeName: 'Demo', theme: { slug: 'x', config: { brand: { name: '   ' } } } }))).toBe('Demo');
    expect(resolveBrandName(null)).toBeUndefined();
    expect(resolveBrandName(context({ storeName: '' }))).toBeUndefined();
  });
});
