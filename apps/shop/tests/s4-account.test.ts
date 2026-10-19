import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import OrdersPage from '../app/(storefront)/[locale]/account/orders/page';
import { AccountManagement } from '../components/account-management';
import { NotFoundContent } from '../components/not-found-content';
import { CheckoutHeader } from '../components/checkout-header';
import { storefront } from '../../../packages/shared/src/i18n/messages/en/storefront';
import GlobalNotFound from '../app/global-not-found';
import RootNotFound from '../components/root-not-found';

const state = vi.hoisted(() => ({ items: [{ id: 'cm9abcdefghijklmnopqrstuv', orderNumber: 'JF-20261012-0001', createdAt: '2026-10-12T00:15:00Z', status: 'SHIPPED', paymentStatus: 'PAID', currency: 'USD', totalAmount: 24 }], page: 0, locale: 'zh-Hans' }));
vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ useParams: () => ({}), useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-shop-locale': state.locale }) }));
vi.mock('../lib/server-bootstrap', () => ({ shopBootstrap: async () => ({ context: { storeName: 'Shop', logo: null, currency: 'USD', timezone: 'UTC', defaultLocale: 'en', supportedLocales: ['en', 'zh-Hans'] }, locale: state.locale === 'zh-Hans' ? 'zh-Hans' : 'en', theme: null, navigation: [], profile: null, cart: null }) }));
vi.mock('../lib/theme', () => ({ getShopTheme: async () => null }));
vi.mock('../components/locale-layout', () => ({ ThemeShell: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('../lib/catalog', () => ({ requireLocale: async () => ({ locale: 'en', context: { timezone: 'Asia/Shanghai' } }), messages: () => storefront }));
vi.mock('../lib/server-account', () => ({ accountProfile: async () => ({ username: 'buyer', email: 'buyer@example.com', locale: 'en', emailVerified: true }) }));
vi.mock('../lib/server-checkout', () => ({ customerOrders: async (page: number) => { state.page = page; return { items: state.items, totalPages: 3 }; } }));
vi.mock('../lib/client-availability', () => ({ availabilityFetch: vi.fn(), useShopAvailability: () => ({ blocked: false, message: '', clear: vi.fn(), capture: vi.fn() }) }));

it('renders desktop order rows and phone order cards with the same real amount, status, link and store-zone time', async () => {
  const result = await OrdersPage({ params: Promise.resolve({ locale: 'en' }), searchParams: Promise.resolve({ page: '2' }) });
  const html = renderToStaticMarkup(result);
  expect(state.page).toBe(2);
  expect(html).toContain('JF-20261012-0001');
  expect(html).toContain('<table'); expect(html).toContain('<ul');
  expect(html.match(/href="\/en\/account\/orders\/cm9abcdefghijklmnopqrstuv"/g)).toHaveLength(2);
  expect(html.match(/\$24.00/g)).toHaveLength(2);
  expect(html).toContain('Shipped'); expect(html).toContain('Asia/Shanghai'); expect(html.match(/2026-10-12 08:15/g)).toHaveLength(2);
  expect(html).toContain('page=1'); expect(html).toContain('page=3');
});
it('shows the verified profile, editable username and sign-in hint without changing identity fields', () => {
  const html = renderToStaticMarkup(createElement(AccountManagement, { locale: 'en', locales: ['en'], labels: storefront.account, navigation: null, profile: { username: 'buyer', email: 'buyer@example.com', locale: 'en', emailVerified: true } }));
  expect(html).toContain('Verified'); expect(html).toContain('Username'); expect(html).toContain(storefront.s4.usernameHint);
  expect(html).toMatch(/value="buyer@example.com"[^>]*disabled=""|disabled=""[^>]*value="buyer@example.com"/);
  expect(html).toContain('name="username"'); expect(html).not.toContain('name="name"');
});
it('uses the default locale for a non-locale not-found page with both recovery links', () => {
  const html = renderToStaticMarkup(createElement(NotFoundContent, { locale: 'en' }));
  expect(html).toContain('Page not found'); expect(html).toContain('href="/en"'); expect(html).toContain('href="/en/search"');
});
it('keeps the checkout header slim with a real logo name, steps and back-to-cart link', () => {
  const html = renderToStaticMarkup(createElement(CheckoutHeader, { locale: 'en', context: { storeName: 'Real shop', logo: null, currency: 'USD', timezone: 'UTC', defaultLocale: 'en', supportedLocales: ['en'] } }));
  expect(html).toContain('Real shop'); expect(html).toContain('aria-current="step"'); expect(html).toContain('Back to cart');
  expect(html).not.toContain('All products'); expect(html).not.toContain('<footer');
});
it('localizes unknown locale paths from the trusted route header and uses the store default for non-locale paths', async () => {
  state.locale = 'zh-Hans';
  const localized = renderToStaticMarkup(await GlobalNotFound());
  expect(localized).toContain('lang="zh-Hans"'); expect(localized).toContain('href="/zh-Hans/search"');
  state.locale = '';
  const global = renderToStaticMarkup(await GlobalNotFound());
  expect(global).toContain('lang="en"'); expect(global).toContain('href="/en/search"');
});
it('renders the approved root fallback inside its existing document rather than a nested HTML document', async () => {
  state.locale = '';
  const html = renderToStaticMarkup(await RootNotFound());
  expect(html).toContain('Page not found'); expect(html).toContain('href="/en/search"'); expect(html).not.toContain('<html');
});
