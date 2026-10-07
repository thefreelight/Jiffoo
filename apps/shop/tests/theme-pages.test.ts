import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import { Writable } from 'node:stream';
import CategoryPage from '../app/(storefront)/[locale]/categories/[slug]/page';
import ProductPage from '../app/(storefront)/[locale]/products/[slug]/page';
import type { ShopTheme } from '../lib/theme';

vi.mock('server-only', () => ({}));
vi.mock('../lib/catalog', () => {
  const group = { id: 'c1', slug: 'books', name: 'Books', description: null, productCount: 2 };
  const primary = {
    id: 'p1', slug: 'novel', name: 'Novel', description: null, categoryName: 'Books',
    categorySlug: 'books', price: 12, stock: 2, images: [],
  };
  const related = { ...primary, id: 'p2', slug: 'sequel', name: 'Sequel' };
  return {
    requireLocale: async () => ({ locale: 'en', context: { currency: 'USD' } }),
    categories: async () => [group],
    products: async () => ({ items: [primary, related], page: 1, totalPages: 1, total: 2 }),
    productBySlug: async () => primary,
    messages: () => ({
      home: { products: 'Featured products' },
      product: { stock: 'In stock', outOfStock: 'Out of stock', description: 'Description' },
      catalog: { empty: 'No products' },
    }),
  };
});
vi.mock('../lib/server-account', () => ({ accountProfile: async () => null }));

const fixture: ShopTheme = {
  target: 'shop', slug: 'sample', version: '1.0.0', tokens: {}, fonts: [], copy: {},
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
