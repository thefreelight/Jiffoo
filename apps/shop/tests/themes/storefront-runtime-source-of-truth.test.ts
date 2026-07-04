import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const storeContextResponse = vi.fn();
const activeThemeResponse = vi.fn();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const shopRootLayoutPath = path.resolve(__dirname, '../../app/layout.tsx');

vi.mock('@/lib/api', () => ({
  storeContextApi: {
    getContext: storeContextResponse,
  },
  themesApi: {
    getActiveTheme: activeThemeResponse,
  },
}));

describe('storefront runtime source of truth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('https://yevbi.com/'),
    });
  });

  it('returns the API store context unchanged on branded storefront hosts', async () => {
    const apiContext = {
      storeId: 'store_1',
      storeName: 'API Store Name',
      domain: 'yevbi.com',
      logo: null,
      theme: {
        slug: 'modelsfind',
        version: '0.1.4',
        source: 'official-market',
        type: 'pack',
        config: {
          brand: {
            name: 'ModelsFind',
            primaryColor: '#111111',
          },
        },
      },
      settings: {},
      status: 'active',
      currency: 'USD',
      defaultLocale: 'en',
      supportedLocales: ['en'],
    };
    storeContextResponse.mockResolvedValue({ success: true, data: apiContext });

    const { fetchStoreContext } = await import('@/lib/store-context');

    const result = await fetchStoreContext();

    expect(result.context?.storeName).toBe('API Store Name');
    expect(result.context?.theme).toEqual(apiContext.theme);
  });

  it('returns the API active theme unchanged on branded storefront hosts', async () => {
    const apiActiveTheme = {
      slug: 'modelsfind',
      version: '0.1.4',
      source: 'official-market',
      type: 'pack',
      config: {
        brand: {
          name: 'ModelsFind',
          primaryColor: '#111111',
        },
      },
      activatedAt: '2026-06-02T00:00:00.000Z',
    };
    activeThemeResponse.mockResolvedValue({ success: true, data: apiActiveTheme });

    const { fetchActiveTheme } = await import('@/lib/theme-pack/loader');

    await expect(fetchActiveTheme()).resolves.toEqual(apiActiveTheme);
  });

  it('does not globally import host-bundled official theme tokens in the shop root layout', () => {
    const source = readFileSync(shopRootLayoutPath, 'utf8');

    expect(source).toContain("import '@/styles/globals.css';");
    expect(source).not.toMatch(/@shop-themes\/[^'"]+\/tokens\.css/);
  });
});
