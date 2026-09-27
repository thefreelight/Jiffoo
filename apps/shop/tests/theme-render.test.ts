import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import type { ShopTheme, ThemeSection } from '../lib/theme';
import { getShopTheme } from '../lib/theme';
import { themeStyle } from '../lib/theme-style';
import { SectionRenderer, sectionRegistry } from '../components/theme-sections';
import { Header } from '../components/header';
import { Footer } from '../components/footer';
import { ImageCarousel } from '../components/image-carousel';
import { sectionsForPage, themePageSlots } from '../lib/page-classes';
import { ThemeShell } from '../app/[locale]/layout';
import { SECTION_TYPES, themeTokensToCss } from 'shared';
import defaultShop from '../../api/builtin-themes/default-shop/theme.json';
import type { Category, Product, StoreContext } from '../lib/catalog';

vi.mock('server-only', () => ({}));
vi.mock('../lib/storefront-messages', () => ({
  storefrontMessages: () => ({
    navigation: {
      categories: 'Categories', products: 'Products', cart: 'Cart', search: 'Search',
      searchAction: 'Search', language: 'Language', localeNames: { en: 'English', 'zh-Hans': '简体中文', 'zh-Hant': '繁體中文' },
      login: 'Login', register: 'Register', account: 'Account', logout: 'Logout', orders: 'Orders',
    },
    catalog: { empty: 'No products' },
    product: { stock: 'In stock', outOfStock: 'Out of stock' },
  }),
}));
vi.mock('../components/language-switcher', () => ({
  LanguageSwitcher: () => createElement('select', { 'aria-label': 'Language' }),
}));
vi.mock('../components/auth-links', () => ({
  AuthLinks: () => createElement('a', { href: '/en/login' }, 'Login'),
}));

const group: Category = { id: 'c1', slug: 'books', name: 'Books', description: null, productCount: 1 };
const product: Product = {
  id: 'p1', slug: 'novel', name: 'Novel', description: null, categoryName: 'Books',
  categorySlug: 'books', price: 12, images: [], stock: 2,
};
const context: StoreContext = {
  storeName: 'Local Store', logo: null, currency: 'USD', defaultLocale: 'en',
  supportedLocales: ['en', 'zh-Hans', 'zh-Hant'],
};
const section = (type: string, settings: Record<string, unknown>): ThemeSection =>
  ({ id: type, type, settings });
const sections: ThemeSection[] = [
  section('announcement-bar', { text: 'Announcement', link: '/offers' }),
  section('hero-banner', { title: 'Welcome', body: 'New arrivals', image: '/api/v1/themes/sample/1.0.0/assets/hero.png',
    alt: 'Hero picture', link: '/products', buttonLabel: 'Shop now' }),
  section('image-carousel', { slides: [{ image: '/api/v1/themes/sample/1.0.0/assets/slide.png',
    title: 'Slide one', alt: 'Slide picture', link: '/products' }] }),
  section('category-list', { title: 'Browse books', categoryIds: ['c1'] }),
  section('product-grid', { title: 'Featured', source: 'manual', productIds: ['p1'], count: 1, columns: 3 }),
  section('image-with-text', { title: 'Our story', body: 'Made here', image: '/api/v1/themes/sample/1.0.0/assets/story.png',
    alt: 'Workshop', position: 'right', link: '/story' }),
  section('text-block', { title: 'About', body: 'Independent store' }),
  section('feature-list', { items: [{ title: 'Delivery', body: 'Local delivery', icon: 'truck' }] }),
];
const fixture: ShopTheme = {
  target: 'shop', slug: 'sample', version: '1.0.0',
  tokens: { primary: '#123456', 'font-body': 'brand' },
  fonts: [{ id: 'brand', family: 'Brand Sans', url: '/api/v1/themes/sample/1.0.0/fonts/brand.woff2',
    weight: 400, style: 'normal' }],
  copy: {},
  layout: {
    header: { variant: 'logo-center', menu: 'drawer', showSearch: false },
    footer: { columns: [{ title: 'Support', text: 'Help desk', links: [
      { label: 'Contact', href: '/contact' }, { label: 'External', href: 'https://example.org/help' },
    ] }] },
    pages: {
      home: { sections },
      category: { columns: 3, showFilters: false },
      product: { gallery: 'right', showRelatedProducts: true },
    },
    slots: {
      'category.top': [section('text-block', { title: 'Top slot', body: 'Top content' })],
      'category.bottom': [section('text-block', { title: 'Bottom slot', body: 'Bottom content' })],
      'product.bottom': [section('text-block', { title: 'Product slot', body: 'Product content' })],
    },
  },
};
const data = { locale: 'en' as const, currency: 'USD', groups: [group], items: [product] };
const markup = (node: React.ReactNode) => renderToStaticMarkup(createElement('div', null, node));

afterEach(() => vi.restoreAllMocks());

describe('T2 Shop theme rendering', () => {
  it('A renders declared content for all eight registered section types', () => {
    expect(Object.keys(sectionRegistry).sort()).toEqual([...SECTION_TYPES].sort());
    const html = markup(sections.map((item) => createElement(SectionRenderer, { key: item.id, section: item, data })));
    for (const content of ['Announcement', 'Welcome', 'New arrivals', 'Shop now', 'Slide one',
      'Browse books', 'Books', 'Featured', 'Novel', 'Our story', 'Made here', 'About',
      'Independent store', 'Delivery', 'Local delivery']) expect(html).toContain(content);
    expect(html).toContain('alt="Hero picture"');
    expect(html).toContain('alt="Slide picture"');
    expect(html).toContain('alt="Workshop"');
    expect(html).toContain('/en/products');
    expect(markup(createElement(SectionRenderer, { section: section('hero-banner',
      { title: 'No alt', image: '/api/v1/themes/sample/1.0.0/assets/hero.png' }), data }))).toContain('alt=""');
  });

  it('B renders accessible manual carousel controls without scheduling autoplay', () => {
    const timer = vi.spyOn(globalThis, 'setInterval');
    const timeout = vi.spyOn(globalThis, 'setTimeout');
    const html = markup(createElement(ImageCarousel, { slides: [
      { image: '/api/v1/themes/sample/1.0.0/assets/slide.png', title: 'Slide one' },
      { image: '/api/v1/themes/sample/1.0.0/assets/second.png', title: 'Slide two' },
    ] }));
    expect(html).toContain('aria-label="Previous slide"');
    expect(html).toContain('aria-label="Next slide"');
    expect(html).toContain('type="button"');
    expect(timer).not.toHaveBeenCalled();
    expect(timeout).not.toHaveBeenCalled();
  });

  it('C renders header modes and footer links with external isolation', () => {
    const header = markup(createElement(Header, { context, locale: 'en', categories: [group],
      loggedIn: false, cartCount: 0, options: fixture.layout.header }));
    expect(header).toContain('aria-expanded="false"');
    expect(header).toContain('justify-center');
    expect(header).not.toContain('role="search"');
    const inline = markup(createElement(Header, { context, locale: 'en', categories: [group],
      loggedIn: false, cartCount: 0, options: { variant: 'logo-left', menu: 'inline', showSearch: true } }));
    expect(inline).toContain('role="search"');
    expect(inline).toContain('aria-label="Categories"');
    const footer = markup(createElement(Footer, { locale: 'en', columns: fixture.layout.footer.columns }));
    expect(footer).toContain('Support');
    expect(footer).toContain('/en/contact');
    expect(footer).toContain('rel="noopener noreferrer"');
  });

  it('D emits only validated token CSS and font-face data in the layout style', () => {
    const poisoned: ShopTheme = { ...fixture, tokens: { ...fixture.tokens, primary: '#fff;} body{', unknown: 'url(x)' } };
    const css = themeStyle(poisoned);
    expect(css).toContain(themeTokensToCss('shop', poisoned.tokens,
      (id) => poisoned.fonts.find((font) => font.id === id)?.family));
    expect(css).toContain('@font-face{font-family:"Brand Sans"');
    expect(css).toContain('--shop-primary: #166b52;');
    expect(css).not.toContain('#fff;} body{');
    expect(css).not.toContain('url(x)');
    expect(css).not.toContain('--shop-unknown');
    const html = markup(createElement(ThemeShell, { context, locale: 'en', navigation: [group],
      theme: poisoned, loggedIn: false, cartCount: 0 }, createElement('main', null, 'Body')));
    expect(html.match(/<style/g)).toHaveLength(1);
  });

  it('G emits complete built-in font stacks for Shop', () => {
    for (const [id, stack] of Object.entries({
      'system-sans': 'system-ui, -apple-system, sans-serif',
      'system-serif': 'Georgia, "Times New Roman", serif',
      outfit: '"Outfit", system-ui, sans-serif',
    })) {
      expect(themeTokensToCss('shop', { 'font-body': id, 'font-heading': id }))
        .toContain(`--shop-font-body: ${stack};\n--shop-font-heading: ${stack};`);
    }
  });

  it('H uses the declared packaged font family with a sans-serif fallback', () => {
    expect(themeStyle(fixture)).toContain('--shop-font-body: "Brand Sans", sans-serif;');
  });

  it('I records exact default Shop font output before and after serialization', () => {
    const css = themeStyle(defaultShop as unknown as ShopTheme);
    const previous = '--shop-font-body: "system-sans";\n--shop-font-heading: "system-sans";';
    expect(css).not.toContain(previous);
    expect(css).toContain('--shop-font-body: system-ui, -apple-system, sans-serif;');
    expect(css).toContain('--shop-font-heading: system-ui, -apple-system, sans-serif;');
  });

  it('E falls back to Core defaults when the theme fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const theme = await getShopTheme('en');
    expect(theme).toBeNull();
    expect(log).toHaveBeenCalled();
    const html = markup(createElement(ThemeShell, { context, locale: 'en', navigation: [group],
      theme, loggedIn: false, cartCount: 0 }, createElement('main', null, 'Store works')));
    expect(html).toContain('Store works');
    expect(html).toContain('Local Store');
    expect(html).not.toContain('@font-face');
    expect(themeStyle(theme)).toBe('');
  });

  it('F never assigns sections to cart, checkout, payment, or account pages', () => {
    expect(sectionsForPage('home', fixture.layout)).toHaveLength(8);
    for (const page of ['cart', 'checkout', 'payment', 'account'] as const) {
      expect(themePageSlots[page]).toEqual([]);
      expect(sectionsForPage(page, fixture.layout)).toEqual([]);
    }
  });

  it('G selects category and product slots and honors columns and gallery options', () => {
    expect(sectionsForPage('category', fixture.layout).map((item) => item.settings.title))
      .toEqual(['Top slot', 'Bottom slot']);
    expect(sectionsForPage('product', fixture.layout).map((item) => item.settings.title))
      .toEqual(['Product slot']);
    expect(markup(createElement(SectionRenderer, { section: sections[4], data }))).toContain('sm:grid-cols-3');
    expect(markup(createElement(SectionRenderer, { section: sections[5], data }))).toContain('md:order-2');
    expect(fixture.layout.pages.product.gallery).toBe('right');
    expect(fixture.layout.pages.product.showRelatedProducts).toBe(true);
  });
});
