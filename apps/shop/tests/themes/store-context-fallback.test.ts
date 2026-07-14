import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function loadStoreContextModule() {
  vi.resetModules();
  return import('@/lib/store-context');
}

describe('store context fallback configuration', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it('keeps the generic Jiffoo fallback when no brand fallback env is configured', async () => {
    delete process.env.NEXT_PUBLIC_FALLBACK_STORE_NAME;
    delete process.env.NEXT_PUBLIC_FALLBACK_THEME_SLUG;

    const { DEFAULT_STORE_CONTEXT, getConfiguredFallbackStoreContext } = await loadStoreContextModule();

    expect(DEFAULT_STORE_CONTEXT.storeName).toBe('Jiffoo Store');
    expect(DEFAULT_STORE_CONTEXT.theme?.slug).toBe('default');
    expect(getConfiguredFallbackStoreContext()).toBeNull();
  });

  it('uses branded fallback context when env vars are configured', async () => {
    process.env.NEXT_PUBLIC_FALLBACK_STORE_NAME = 'Bokmoo';
    process.env.NEXT_PUBLIC_FALLBACK_THEME_SLUG = 'bokmoo';
    process.env.NEXT_PUBLIC_FALLBACK_THEME_VERSION = '1.0.0';
    process.env.NEXT_PUBLIC_FALLBACK_DEFAULT_LOCALE = 'en';
    process.env.NEXT_PUBLIC_FALLBACK_SUPPORTED_LOCALES = 'en,zh-Hant';
    process.env.NEXT_PUBLIC_FALLBACK_POWERED_BY_JIFFOO = '0';

    const { DEFAULT_STORE_CONTEXT, getConfiguredFallbackStoreContext } = await loadStoreContextModule();
    const configuredFallback = getConfiguredFallbackStoreContext();

    expect(DEFAULT_STORE_CONTEXT.storeName).toBe('Bokmoo');
    expect(DEFAULT_STORE_CONTEXT.theme).toMatchObject({
      slug: 'bokmoo',
      version: '1.0.0',
    });
    expect(DEFAULT_STORE_CONTEXT.defaultLocale).toBe('en');
    expect(DEFAULT_STORE_CONTEXT.supportedLocales).toEqual(['en', 'zh-Hant']);
    expect(DEFAULT_STORE_CONTEXT.platformBranding?.showPoweredByJiffoo).toBe(false);
    expect(configuredFallback?.theme?.slug).toBe('bokmoo');
  });
});
