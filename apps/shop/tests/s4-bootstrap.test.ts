import { beforeEach, expect, it, vi } from 'vitest';
import { shopBootstrap } from '../lib/server-bootstrap';

const state = vi.hoisted(() => ({
  locale: '', profile: { username: 'buyer', email: 'buyer@example.com', locale: 'en', emailVerified: true } as object | null,
  theme: vi.fn(), categories: vi.fn(), cart: vi.fn(), code: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('react', async (original) => ({ ...await original<typeof import('react')>(), cache: (callback: unknown) => callback }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-shop-locale': state.locale, 'x-shop-return-path': '/missing-top-level' }) }));
vi.mock('../lib/catalog', () => ({ readStoreContext: async () => ({ defaultLocale: 'zh-Hans', supportedLocales: ['en', 'zh-Hans'] }), categories: state.categories }));
vi.mock('../lib/theme', () => ({ getShopTheme: state.theme }));
vi.mock('../lib/storefront-code', () => ({ getStorefrontCode: state.code }));
vi.mock('../lib/server-account', () => ({ accountProfile: async () => state.profile }));
vi.mock('../lib/server-checkout', () => ({ customerCart: state.cart }));
vi.mock('../lib/availability-boundary', () => ({ deferredAvailability: (callback: () => unknown) => callback() }));

beforeEach(() => {
  vi.clearAllMocks(); state.locale = ''; state.profile = { username: 'buyer' };
  state.theme.mockResolvedValue({ darkAvailable: true }); state.categories.mockResolvedValue([{ slug: 'real-category' }]);
  state.cart.mockResolvedValue({ items: [], itemCount: 3, subtotal: 10 }); state.code.mockResolvedValue(null);
});
it('loads the actual default-locale theme and authenticated navigation data for root fallback pages', async () => {
  const result = await shopBootstrap();
  expect(result.locale).toBe('zh-Hans'); expect(result.theme?.darkAvailable).toBe(true);
  expect(state.theme).toHaveBeenCalledWith('zh-Hans'); expect(state.categories).toHaveBeenCalledWith('zh-Hans');
  expect(result.navigation).toEqual([{ slug: 'real-category' }]); expect(result.profile).toEqual({ username: 'buyer' }); expect(result.cart?.itemCount).toBe(3);
});
it('does not read a customer cart for an anonymous root fallback request', async () => {
  state.profile = null;
  const result = await shopBootstrap(); expect(result.profile).toBeNull(); expect(result.cart).toBeNull(); expect(state.cart).not.toHaveBeenCalled();
});
it('keeps an explicit supported route locale instead of replacing it with the default locale', async () => {
  state.locale = 'en';
  const result = await shopBootstrap(); expect(result.locale).toBe('en'); expect(state.theme).toHaveBeenCalledWith('en');
});
