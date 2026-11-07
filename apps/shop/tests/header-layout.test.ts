import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { Header } from '../components/header';
import type { Category, StoreContext } from '../lib/catalog';

vi.mock('server-only', () => ({}));
vi.mock('../components/drawer-menu', () => ({ DrawerMenu: ({ links, showSearch }: { links: Array<{ href: string; label: string }>; showSearch: boolean }) =>
  createElement('details', { 'aria-label': 'Drawer' }, createElement('summary', null, 'Menu'),
    ...links.map(link => createElement('a', { key: link.href, href: link.href }, link.label)),
    showSearch && createElement('input', { 'aria-label': 'Drawer search' })) }));
vi.mock('../components/header-search', () => ({ HeaderSearch: () => createElement('input', { 'aria-label': 'Header search' }) }));
vi.mock('../components/language-switcher', () => ({ LanguageSwitcher: () => createElement('button', null, 'Language') }));
vi.mock('../components/auth-links', () => ({ AuthLinks: () => createElement('button', null, 'Account') }));
vi.mock('../components/plugin-navigation', () => ({ PluginNavigation: () => null }));
vi.mock('../components/cart-sheet', () => ({ CartButton: () => createElement('button', null, 'Cart') }));

const context: StoreContext = {
  storeName: 'An independent store with an unusually long descriptive brand name',
  logo: null, currency: 'USD', timezone: 'UTC', defaultLocale: 'en', supportedLocales: ['en'],
};
const categories: Category[] = Array.from({ length: 200 }, (_, index) => ({
  id: String(index), slug: `category-${index}`, name: `Category ${index}`,
  description: null, productCount: 1,
}));

describe('header navigation composition', () => {
  it('keeps a few short categories inline with wrapping and a mobile drawer', () => {
    const html = renderToStaticMarkup(createElement(Header, { context, locale: 'en', categories: categories.slice(0, 3), loggedIn: false, cartCount: 0 }));
    expect(html).toContain('<nav aria-label="Categories"');
    expect(html).toContain('flex-wrap');
    expect(html).toContain('shrink-0 md:hidden');
    expect(html).not.toContain('overflow-x-auto');
  });

  it('uses a desktop drawer for an individual long category label', () => {
    const html = renderToStaticMarkup(createElement(Header, { context, locale: 'en', categories: [{ ...categories[0], name: 'An unusually long category label' }], loggedIn: false, cartCount: 0 }));
    expect(html).not.toContain('<nav');
    expect(html.split('href="/en/categories/category-0"')).toHaveLength(2);
  });

  it('honors an explicit drawer even for a few short categories', () => {
    const html = renderToStaticMarkup(createElement(Header, { context, locale: 'en', categories: categories.slice(0, 1), loggedIn: false, cartCount: 0, options: { variant: 'logo-left', menu: 'drawer', showSearch: true } }));
    expect(html).not.toContain('<nav');
    expect(html).not.toContain('shrink-0 md:hidden');
  });

  it('retains the full brand and every category with independent action controls', () => {
    const html = renderToStaticMarkup(createElement(Header, { context, locale: 'en', categories, loggedIn: false, cartCount: 0 }));
    expect(html).toContain(`aria-label="${context.storeName}"`);
    expect(html).toContain(`title="${context.storeName}"`);
    const navigation = html.match(/<details\b[^>]*>([\s\S]*?)<\/details>/)?.[1];
    expect(navigation).toBeDefined();
    for (const category of categories) expect(navigation).toContain(`href="/en/categories/${category.slug}"`);
    expect(html).not.toContain('overflow-x-auto');
    expect(html).not.toContain('<nav');
    for (const category of categories) expect(html.split(`href="/en/categories/${category.slug}"`)).toHaveLength(2);
    expect(navigation).not.toContain('Header search');
    expect(navigation).not.toContain('Account');
    for (const action of ['Header search', 'Language', 'Account', 'Cart']) expect(html).toContain(action);
  });

  it.each(['logo-left', 'logo-center'] as const)('preserves drawer navigation and search opt-out for %s', variant => {
    const html = renderToStaticMarkup(createElement(Header, { context, locale: 'en', categories, loggedIn: false, cartCount: 0,
      options: { variant, menu: 'drawer', showSearch: false } }));
    expect(html).not.toContain('<nav');
    expect(html).not.toContain('Header search');
    expect(html).not.toContain('Drawer search');
    expect(html).toContain(`aria-label="${context.storeName}"`);
    for (const category of categories) expect(html).toContain(`href="/en/categories/${category.slug}"`);
    for (const action of ['Language', 'Account', 'Cart']) expect(html).toContain(action);
  });
});
