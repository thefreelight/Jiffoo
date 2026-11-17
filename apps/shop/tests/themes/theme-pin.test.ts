import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function loadThemePinModule() {
  vi.resetModules();
  return import('@/lib/theme-pin');
}

describe('theme pin configuration', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it('returns null when no pin env is configured', async () => {
    delete process.env.THEME_SLUG_PIN;
    delete process.env.THEME_VERSION_PIN;

    const { getThemePin, buildPinnedActiveTheme } = await loadThemePinModule();

    expect(getThemePin()).toBeNull();
    expect(buildPinnedActiveTheme()).toBeNull();
  });

  it('returns null for blank or whitespace-only slug', async () => {
    process.env.THEME_SLUG_PIN = '   ';
    const { getThemePin } = await loadThemePinModule();
    expect(getThemePin()).toBeNull();
  });

  it('reads slug-only pin with no version', async () => {
    process.env.THEME_SLUG_PIN = 'esim';
    delete process.env.THEME_VERSION_PIN;

    const { getThemePin } = await loadThemePinModule();
    expect(getThemePin()).toEqual({ slug: 'esim', version: undefined });
  });

  it('trims slug and version values', async () => {
    process.env.THEME_SLUG_PIN = ' esim ';
    process.env.THEME_VERSION_PIN = ' 0.0.1 ';

    const { getThemePin, buildPinnedActiveTheme } = await loadThemePinModule();

    expect(getThemePin()).toEqual({ slug: 'esim', version: '0.0.1' });
    expect(buildPinnedActiveTheme()).toEqual({
      slug: 'esim',
      version: '0.0.1',
      source: 'installed',
      config: {},
      activatedAt: '',
    });
  });

  it('builds a versionless pinned active theme when only the slug is set', async () => {
    process.env.THEME_SLUG_PIN = 'esim';
    delete process.env.THEME_VERSION_PIN;

    const { buildPinnedActiveTheme } = await loadThemePinModule();
    const pinned = buildPinnedActiveTheme();

    expect(pinned).toMatchObject({ slug: 'esim', version: '', source: 'installed' });
    expect(pinned?.config).toEqual({});
  });
});

describe('applyThemePinToServerStoreContext', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  function makeContext() {
    return {
      storeId: '1',
      storeName: 'Bokmoo',
      logo: null,
      theme: {
        slug: 'bokmoo',
        version: '1.1.52',
        config: { colors: { primary: '#d4af37' } },
        pluginSlug: 'bokmoo',
      },
      settings: {},
      status: 'active',
      defaultLocale: 'en',
      supportedLocales: ['en', 'zh-Hans'],
    };
  }

  it('passes the context through unchanged when no pin is configured', async () => {
    delete process.env.THEME_SLUG_PIN;
    const { applyThemePinToServerStoreContext } = await loadThemePinModule();
    const context = makeContext();

    expect(applyThemePinToServerStoreContext(context)).toBe(context);
    expect(applyThemePinToServerStoreContext(null)).toBeNull();
  });

  it('replaces the API-reported theme with the pinned theme and drops its config', async () => {
    process.env.THEME_SLUG_PIN = 'esim';
    process.env.THEME_VERSION_PIN = '0.0.1';

    const { applyThemePinToServerStoreContext } = await loadThemePinModule();
    const pinned = applyThemePinToServerStoreContext(makeContext() as any) as any;

    expect(pinned.storeName).toBe('Bokmoo');
    expect(pinned.theme).toEqual({
      slug: 'esim',
      version: '0.0.1',
      config: undefined,
      pluginSlug: undefined,
    });
  });

  it('pins a themeless context (API outage fallback path)', async () => {
    process.env.THEME_SLUG_PIN = 'esim';
    process.env.THEME_VERSION_PIN = '0.0.1';

    const { applyThemePinToServerStoreContext } = await loadThemePinModule();
    const context = { ...makeContext(), theme: null } as any;
    const pinned = applyThemePinToServerStoreContext(context) as any;

    expect(pinned.theme).toEqual({
      slug: 'esim',
      version: '0.0.1',
      config: undefined,
      pluginSlug: undefined,
    });
  });
});

describe('getServerStoreContext pin chokepoint', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it('applies the pin to the fallback context when the API is unreachable', async () => {
    process.env.NEXT_PUBLIC_FALLBACK_STORE_NAME = 'Bokmoo';
    process.env.NEXT_PUBLIC_FALLBACK_THEME_SLUG = 'bokmoo';
    process.env.THEME_SLUG_PIN = 'esim';
    process.env.THEME_VERSION_PIN = '0.0.1';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const { getServerStoreContext } = await import('@/lib/server-store-context');
    const context = await getServerStoreContext({ cache: 'no-store' }) as any;

    expect(context).not.toBeNull();
    expect(context.theme).toMatchObject({ slug: 'esim', version: '0.0.1' });
    expect(context.theme.config).toBeUndefined();

    vi.unstubAllGlobals();
  });

  it('leaves unpinned resolution untouched', async () => {
    delete process.env.THEME_SLUG_PIN;
    delete process.env.THEME_VERSION_PIN;
    process.env.NEXT_PUBLIC_FALLBACK_STORE_NAME = 'Bokmoo';
    process.env.NEXT_PUBLIC_FALLBACK_THEME_SLUG = 'bokmoo';
    process.env.NEXT_PUBLIC_FALLBACK_THEME_VERSION = '1.1.52';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const { getServerStoreContext } = await import('@/lib/server-store-context');
    const context = await getServerStoreContext({ cache: 'no-store' }) as any;

    expect(context.theme).toMatchObject({ slug: 'bokmoo', version: '1.1.52' });

    vi.unstubAllGlobals();
  });
});
