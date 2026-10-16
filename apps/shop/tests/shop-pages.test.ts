import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VariantPicker } from '../components/variant-picker';
import { ProductGallery } from '../components/product-gallery';
import { QuantityStepper } from '../components/quantity-stepper';
import { CartSheet } from '../components/cart-sheet';
import { CatalogControls } from '../components/catalog-controls';
import { CatalogError } from '../components/catalog-error';
import { CatalogLoading } from '../components/catalog-loading';
import { SectionRenderer } from '../components/theme-sections';
import { ProductCard } from '../components/product-card';
import { readCatalogQuery, catalogFilters } from '../lib/catalog-query';
import { useCartUI } from '../lib/cart-ui';
import { storefrontMessages } from '../lib/storefront-messages';
import type { Cart } from '../lib/checkout-types';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), useParams: () => ({ locale: 'en' }) }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-shop-locale': 'en' }) }));
vi.mock('../lib/cart-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/cart-ui')>();
  const read = (selector?: (state: ReturnType<typeof actual.useCartUI.getState>) => unknown) => selector ? selector(actual.useCartUI.getState()) : actual.useCartUI.getState();
  return { useCartUI: Object.assign(read, actual.useCartUI) };
});
vi.mock('../components/ui/sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => children,
  SheetContent: ({ children }: { children: React.ReactNode }) => h('div', { role: 'dialog' }, children),
  SheetTrigger: ({ children, ...props }: React.ComponentProps<'button'>) => h('button', props, children),
  SheetTitle: ({ children }: { children: React.ReactNode }) => h('h2', null, children),
  SheetDescription: ({ children }: { children: React.ReactNode }) => h('p', null, children),
}));
vi.mock('nuqs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('nuqs')>();
  return { ...actual, useQueryStates: () => [{ sort: 'newest', category: '', inStock: false, page: 1 }, vi.fn()] };
});
const render = (node: React.ReactNode) => renderToStaticMarkup(node);
const variant = (stock: number) => ({ id: 'v1', name: 'Standard', skuCode: null, salePrice: 12, stock, attributes: { Size: 'M' } });
const picker = (stock: number) => render(h(VariantPicker, { variants: [variant(stock)], locale: 'en', currency: 'USD', labels: storefrontMessages('en').product, productId: 'p1', slug: 'product', loggedIn: true }));
const product = { id: 'p1', slug: 'product', name: 'Product', description: null, categoryName: 'Books', categorySlug: 'books', price: 12, images: [], stock: 0 };
const cart: Cart = { items: [{ id: 'line', productId: 'p1', productImage: '', variantId: 'v1', productName: 'Product', variantName: 'Size M', price: 12, quantity: 2, maxQuantity: 3, subtotal: 24 }], itemCount: 2, subtotal: 24 };
beforeEach(() => useCartUI.setState({ open: true, lastAdded: null, count: null }));
afterEach(() => useCartUI.setState({ open: false, lastAdded: null, count: null }));

describe('S3 approved storefront states', () => {
  it.each([6, 5, 1, 0])('renders the approved stock threshold at %s', (stock) => {
    const html = picker(stock);
    expect(html).toContain(stock > 5 ? 'In stock' : stock ? `Only ${stock} left` : 'Sold out');
    if (!stock) expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Sold out/);
    expect(html).toContain(`max="${stock}"`);
  });
  it('disables sold-out variant chips and chooses a stocked variant initially', () => {
    const html = render(h(VariantPicker, { variants: [variant(0), { ...variant(3), id: 'v2', attributes: { Size: 'L' } }], locale: 'en', currency: 'USD', labels: storefrontMessages('en').product, productId: 'p1', slug: 'product', loggedIn: true }));
    expect(html).toMatch(/<input(?=[^>]*value="v1")(?=[^>]*disabled="")/);
    expect(html).toMatch(/checked=""[^>]*value="v2"|value="v2"[^>]*checked=""/);
    expect(html).toContain('Size: L');
    expect(html).toContain('peer-disabled:line-through');
  });
  it('disables increasing quantity at the real stock ceiling', () => {
    const html = render(h(QuantityStepper, { value: 3, max: 3, onChange: vi.fn(), locale: 'en' }));
    expect(html).toMatch(/aria-label="Increase" disabled=""/);
    expect(html).toContain('max="3"');
  });
  it('renders the sold-out product tag with real product fields', () => {
    const html = render(h(ProductCard, { product, locale: 'en', currency: 'USD' }));
    expect(html).toContain('Sold out'); expect(html).toContain('Books'); expect(html).toContain('$12.00');
    expect(html).not.toMatch(/rating|compare-at|sales count/);
  });
  it('renders missing images and named gallery thumbnail controls', () => {
    expect(render(h(ProductGallery, { images: [], name: 'Product', locale: 'en' }))).toContain('No image available');
    const html = render(h(ProductGallery, { images: ['/one.png', '/two.png'], name: 'Product', locale: 'en' }));
    expect(html).toContain('aria-label="Image 2"'); expect(html).toContain('aria-pressed="true"');
  });
  it('renders cart lines, quantity controls, subtotal and checkout shipping note', () => {
    const html = render(h(CartSheet, { locale: 'en', currency: 'USD', loggedIn: true, initial: cart }));
    for (const text of ['Product', 'Size M', '$24.00', 'Subtotal', 'View cart', 'Shipping is calculated at checkout']) expect(html).toContain(text);
    expect(html).toContain('aria-label="Remove Product"'); expect(html).toContain('href="/en/checkout"');
  });
  it('removes closed Sheet controls immediately during navigation', () => {
    useCartUI.setState({ open: false });
    const html = render(h(CartSheet, { locale: 'en', currency: 'USD', loggedIn: true, initial: cart }));
    expect(html).not.toContain('role="dialog"'); expect(html).not.toContain('aria-label="Quantity Product"');
  });
  it('blocks checkout for stale cart quantities and handles empty and loading carts', () => {
    const html = render(h(CartSheet, { locale: 'en', currency: 'USD', loggedIn: true, initial: { ...cart, items: [{ ...cart.items[0], maxQuantity: 1 }] } }));
    expect(html).toContain('Available quantity:'); expect(html).not.toContain('href="/en/checkout"');
    expect(render(h(CartSheet, { locale: 'en', currency: 'USD', loggedIn: true, initial: { items: [], subtotal: 0, itemCount: 0 } }))).toContain('Your cart is empty.');
    expect(render(h(CartSheet, { locale: 'en', currency: 'USD', loggedIn: true }))).toContain('Loading');
  });
  it('stores UI confirmation and count without storing or persisting cart contents', () => {
    useCartUI.getState().added('Size M', 2);
    expect(useCartUI.getState()).toMatchObject({ open: true, lastAdded: 'Size M', count: 2 });
    useCartUI.getState().setOpen(false);
    expect(useCartUI.getState()).toMatchObject({ open: false, lastAdded: null, count: 2 });
    expect(Object.keys(useCartUI.getState())).not.toContain('items');
  });
  it('parses shared URL state and maps only implemented sorting and filters to the API', () => {
    const state = readCatalogQuery({ sort: 'nameDesc', category: 'books', inStock: 'true', page: '2' });
    expect(state).toEqual({ sort: 'nameDesc', category: 'books', inStock: true, page: 2 });
    expect(catalogFilters(state)).toEqual({ category: 'books', inStock: 'true', sortBy: 'name', sortOrder: 'desc' });
    expect(readCatalogQuery({ sort: 'price', page: 'invalid' })).toMatchObject({ sort: 'newest', page: 1 });
  });
  it('shows category radio semantics and hides filters when disabled by the theme', () => {
    const props = { locale: 'en' as const, groups: [{ id: 'books', slug: 'books', name: 'Books', description: null, productCount: 3 }] };
    const html = render(h(CatalogControls, { ...props, showFilters: true }));
    expect(html).toContain('type="radio"'); expect(html).toContain('In stock only');
    expect(html).not.toContain('value="price"');
    expect(render(h(CatalogControls, { ...props, showFilters: false }))).not.toContain('type="radio"');
  });
  it('omits every empty theme section instead of rendering placeholder content', () => {
    const data = { locale: 'en' as const, currency: 'USD', groups: [], items: [] };
    for (const type of ['announcement-bar', 'hero-banner', 'image-carousel', 'category-list', 'product-grid', 'image-with-text', 'text-block', 'feature-list']) {
      expect(render(h(SectionRenderer, { section: { id: type, type, settings: {} }, data }))).toBe('');
    }
  });
  it('renders accessible loading and error recovery states', async () => {
    expect(render(CatalogLoading({ locale: 'en' }))).toContain('aria-busy="true"');
    const html = render(h(CatalogError, { reset: vi.fn() }));
    expect(html).toContain('role="alert"'); expect(html).toContain('Try again');
  });
  it('keeps approved static Chinese board copy byte-identical', () => {
    const root = resolve(__dirname, '../../..');
    const boards = ['Header', 'MobileMenu', 'Home', 'Category', 'Search', 'Product'].map((name) => readFileSync(resolve(root, `docs/design/shop/${name}.dc.html`), 'utf8')).join('\n');
    const t = storefrontMessages('zh-Hans').shop;
    for (const key of ['openMenu', 'closeMenu', 'close', 'filters', 'inStockOnly', 'clearFilters', 'categoryEmpty', 'categoryEmptyBody', 'viewAll', 'viewAllShort', 'accountEntry', 'newProducts', 'searchHint', 'soldOut', 'variantSoldOut', 'related', 'added', 'viewCart', 'shippingAtCheckout'] as const) {
      expect(Buffer.from(boards).includes(Buffer.from(t[key])), key).toBe(true);
    }
    expect(boards).toContain(t.searchCount.replace('{count}', '3').replace('{query}', '杯'));
    expect(boards).toContain(t.noResults.replace('{query}', '露营灯'));
    expect(boards).toContain(t.cartTitle.replace('{count}', '3'));
    expect(boards).toContain(t.apply.replace('{count}', '24'));
    expect(boards).toContain(t.lowStock.replace('{count}', '3'));
  });
});
