import defaultShop from '../../api/builtin-themes/default-shop/theme.json';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import { Writable } from 'node:stream';
import CategoryPage from '../app/(storefront)/[locale]/categories/[slug]/page';
import ProductPage from '../app/(storefront)/[locale]/products/[slug]/page';
import type { ShopTheme } from '../lib/theme';
import { storefrontMessages } from '../lib/storefront-messages';
import SearchPage from '../app/(storefront)/[locale]/search/page';
import ProductsPage from '../app/(storefront)/[locale]/products/page';
import { products as readProducts } from '../lib/catalog';

const state = vi.hoisted(() => ({ catalogEmpty: false, searchEmpty: false }));
afterEach(() => { state.catalogEmpty = false; state.searchEmpty = false; vi.clearAllMocks(); });

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', async (importOriginal) => ({ ...await importOriginal<typeof import('next/navigation')>(), useRouter: () => ({ push: vi.fn() }) }));
vi.mock('nuqs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('nuqs')>();
  return { ...actual, useQueryStates: () => [{ sort: 'newest', category: '', inStock: false, page: 1 }, () => Promise.resolve(new URLSearchParams())] };
});

vi.mock('../lib/catalog', () => {
  const group = { id: 'c1', slug: 'books', name: 'Books', description: null, productCount: 2 };
  const primary = {
    id: 'p1', slug: 'novel', name: 'Novel', description: null, categoryName: 'Books',
    categorySlug: 'books', price: 12, stock: 2, images: [],
  };
  const related = { ...primary, id: 'p2', slug: 'sequel', name: 'Sequel' };
  return {
    requireLocale: async () => ({ locale: 'en', context: { currency: 'USD' } }),
    categories: async () => [{ ...group, productCount: state.catalogEmpty ? 0 : 2 }],
    products: vi.fn(async () => ({ items: state.catalogEmpty ? [] : [primary, related], page: 1, totalPages: 1, total: state.catalogEmpty ? 0 : 2 })),
    search: async () => ({ items: state.searchEmpty ? [] : [primary], page: 1, totalPages: 1, total: state.searchEmpty ? 0 : 1 }),
    productBySlug: async () => primary,
    messages: () => storefrontMessages('en'),
  };
});
vi.mock('../lib/server-account', () => ({ accountProfile: async () => null }));

const fixture: ShopTheme = {
  schemaVersion: 2, darkAvailable: false, target: 'shop', slug: 'sample', version: '1.0.0', tokens: defaultShop.tokens, fonts: [], copy: {},
  packageHash: 'a'.repeat(64),
  layout: {
    header: { variant: 'logo-left', menu: 'inline', showSearch: true },
    footer: { columns: [] },
    pages: {
      home: { sections: [] },
      category: { columns: 3, showFilters: false },
      product: { gallery: 'right', showRelatedProducts: true },
    },
    slots: {
      'category.top': [{ id: 'top', type: 'text-block', settings: { title: 'Top slot', body: 'Before products' } }],
      'category.bottom': [{ id: 'bottom', type: 'text-block', settings: { title: 'Bottom slot', body: 'After products' } }],
      'product.bottom': [{ id: 'product', type: 'text-block', settings: { title: 'Product slot', body: 'After detail' } }],
    },
  },
};
vi.mock('../lib/theme', () => ({ getShopTheme: async () => fixture }));

function render(node: React.ReactNode): Promise<string> {
  return new Promise((resolve, reject) => {
    let html = '';
    const sink = new Writable({
      write(chunk, _encoding, next) { html += chunk.toString(); next(); },
      final(next) { resolve(html); next(); },
    });
    const stream = renderToPipeableStream(createElement('div', null, node), {
      onAllReady() { stream.pipe(sink); },
      onError: reject,
    });
  });
}

describe('T2 themed catalog pages', () => {
  it('S3 renders a real category empty state with a link to all products', async () => {
    state.catalogEmpty = true;
    const html = await render(await CategoryPage({ params: Promise.resolve({ locale: 'en', slug: 'books' }), searchParams: Promise.resolve({}) }));
    expect(html).toContain('No products in this category yet');
    expect(html).toContain('0 products'); expect(html).toContain('href="/en/products"');
    expect(html).not.toContain('Novel');
  });

  it('S3 forwards URL sorting, stock and page state to the actual catalog query', async () => {
    const html = await render(await ProductsPage({ params: Promise.resolve({ locale: 'en' }), searchParams: Promise.resolve({ sort: 'nameDesc', inStock: 'true', page: '2', category: 'c1' }) }));
    expect(readProducts).toHaveBeenCalledWith('en', 2, undefined, 12, { category: 'c1', inStock: 'true', sortBy: 'name', sortOrder: 'desc' });
    expect(html).toContain('2 products'); expect(html).toContain('Novel');
  });

  it('S3 renders search results and their real count', async () => {
    const html = await render(await SearchPage({ params: Promise.resolve({ locale: 'en' }), searchParams: Promise.resolve({ q: 'Novel' }) }));
    expect(html).toContain('Results related to “Novel”: 1'); expect(html).toContain('Novel');
    expect(html).not.toContain('New arrivals');
  });

  it('S3 renders no-results category entry points and actual new products', async () => {
    state.searchEmpty = true;
    const html = await render(await SearchPage({ params: Promise.resolve({ locale: 'en' }), searchParams: Promise.resolve({ q: 'missing' }) }));
    expect(html).toContain('No products related to “missing”');
    expect(html).toContain('href="/en/categories/books"'); expect(html).toContain('New arrivals'); expect(html).toContain('Sequel');
  });

  it('G renders category slots around a three-column product grid', async () => {
    const node = await CategoryPage({
      params: Promise.resolve({ locale: 'en', slug: 'books' }),
      searchParams: Promise.resolve({ page: '1' }),
    });
    const html = await render(node);
    expect(html.indexOf('Top slot')).toBeLessThan(html.indexOf('Novel'));
    expect(html.indexOf('Bottom slot')).toBeGreaterThan(html.indexOf('Sequel'));
    expect(html).toContain('sm:grid-cols-3');
  });

  it('G renders right-side gallery, same-category related products, and product slot', async () => {
    const node = await ProductPage({ params: Promise.resolve({ locale: 'en', slug: 'novel' }) });
    const html = await render(node);
    expect(html).toContain('md:order-2');
    expect(html).toContain('Sequel');
    expect(html).toContain('Product slot');
    expect(html.indexOf('Product slot')).toBeGreaterThan(html.indexOf('Sequel'));
  });
});
