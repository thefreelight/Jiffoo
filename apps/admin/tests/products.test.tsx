// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import ProductsPage from '../app/[locale]/(themed)/products/page';
import { ProductForm } from '../components/products/ProductForm';
import { merchant } from '../../../packages/shared/src/i18n/messages/en/merchant';
import { merchant as hans } from '../../../packages/shared/src/i18n/messages/zh-Hans/merchant';
import { merchant as hant } from '../../../packages/shared/src/i18n/messages/zh-Hant/merchant';
import { AdminApiError, productsApi } from '../lib/api';
import { common } from '../../../packages/shared/src/i18n/messages/en/common';
const state = vi.hoisted(() => ({ url: '', total: 3, params: {} as any, replace: vi.fn(), update: vi.fn(), remove: vi.fn(), create: vi.fn() }));
vi.mock('shared/src/i18n/react', () => ({ useLocale: () => 'en', useT: () => (key: string, values?: Record<string, string | number>) => {
  const value = key.split('.').reduce<any>((v, k) => v?.[k], { merchant, common });
  return typeof value === 'string' ? value.replace(/\{(\w+)\}/g, (_, k) => String(values?.[k] ?? '{' + k + '}')) : key;
} }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: state.replace, push: vi.fn() }), usePathname: () => '/en/products', useSearchParams: () => new URLSearchParams(state.url) }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return { ...actual, listPreferencesApi: { listViews: vi.fn(async () => ({ success: true, data: { views: [] } })), getPreference: vi.fn(async () => ({ success: true, data: { listKey: 'products', columns: [] } })), setPreference: vi.fn(async () => ({ success: true, data: { listKey: 'products', columns: [] } })) }, unwrapApiResponse: (response: any) => response.data };
});
vi.mock('../components/products/ContentTranslations', () => ({ ContentTranslations: () => null, useStoreDefaultLocale: () => ({ data: 'en' }) }));
vi.mock('../components/ui/dialog', () => ({ Dialog: ({ open, children }: any) => open ? children : null, DialogContent: ({ children }: any) => <div role="dialog">{children}</div>, DialogHeader: ({ children }: any) => children, DialogTitle: ({ children }: any) => <h2>{children}</h2>, DialogDescription: ({ children }: any) => <p>{children}</p>, DialogFooter: ({ children }: any) => children }));
vi.mock('../lib/hooks/use-api', () => ({
  useProducts: (params: any) => { state.params = params; return { data: { data: [
    { id: 'a', name: 'Available', spuCode: 'K7M2Q9XA', hasOrders: true, updatedAt: '2026-10-14T00:00:00Z', isActive: true, stock: 3, variantsCount: 2, priceMin: 10, priceMax: 20, images: [] },
    { id: 'b', name: 'Hidden', hasOrders: false, updatedAt: '2026-10-14T00:00:00Z', isActive: false, stock: 0, variantsCount: 1, priceMin: 10, priceMax: 10, images: [] },
    { id: 'c', name: 'Empty', hasOrders: false, updatedAt: '2026-10-14T00:00:00Z', isActive: true, stock: 0, variantsCount: 1, priceMin: 10, priceMax: 10, images: [] },
  ].map(product => params.page > 1 ? { ...product, id: product.id + '-page-' + params.page, name: product.name + ' page ' + params.page } : product), pagination: { total: state.total, totalPages: Math.ceil(state.total / params.limit) } } }; },
  useProductStats: () => ({ data: { statusCounts: { all: 3, active: 2, inactive: 1, outOfStock: 1 } } }),
  useCategories: () => ({ data: [{ id: 'real-category', name: 'Actual category' }] }),
  useProductNeighbors: () => ({ data: { position: 1, total: 1, previousId: null, nextId: null } }),
  useProductEditorContext: () => ({ data: { currency: 'USD', defaultLocale: 'en' } }),
  useDeleteProduct: () => ({ mutateAsync: state.remove, isPending: false }),
  useUpdateProduct: () => ({ mutateAsync: state.update, isPending: false }),
  useCreateProduct: () => ({ mutateAsync: state.create, isPending: false }),
  useUploadProductImage: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
let root: Root;
let queryClient: QueryClient;
async function mount(element = <ProductsPage />) {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const node = document.createElement('div'); document.body.append(node); root = createRoot(node); await act(async () => root.render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>)); return node;
}
function button(name: string, scope: ParentNode = document) { const result = Array.from(scope.querySelectorAll<HTMLButtonElement>('button')).find(b => b.textContent?.trim() === name || b.getAttribute('aria-label') === name); if (!result) throw new Error('Missing button: ' + name); return result; }
async function openMenu(label: string) {
  await act(async () => button(label).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
}
async function chooseFilter(label: string, text: string) {
  await openMenu(label);
  const option = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')).find(option => option.textContent === text);
  if (!option) throw new Error('Missing option: ' + text);
  await act(async () => option.click());
}
async function input(id: string, value: string) { const node = document.getElementById(id) as HTMLInputElement; await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(node, value); node.dispatchEvent(new Event('input', { bubbles: true })); }); }
beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); state.url = ''; state.total = 3; state.update.mockReset().mockResolvedValue({}); state.remove.mockReset(); state.create.mockReset();
  state.replace.mockReset().mockImplementation((url: string) => { state.url = url.split('?')[1] ?? ''; });
});
afterEach(async () => { if (root) await act(async () => root.unmount()); queryClient?.clear(); document.body.innerHTML = ''; vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks(); });
it.each(['active', 'inactive', 'outOfStock'])('reads server-side status, category and search from the URL: %s', async status => {
  state.url = 'status=' + status + '&category=real-category&search=hello'; await mount();
  expect(state.params).toMatchObject({ status, categoryId: 'real-category', search: 'hello', page: 1 });
});
it('restores product sorting, uncategorized, page size and pagination from the URL', async () => {
  state.url = 'status=inactive&category=none&search=sku&sortBy=price&sortOrder=desc&page=2&pageSize=50';
  await mount(); expect(state.params).toMatchObject({ status: 'inactive', categoryId: 'none', search: 'sku', sortBy: 'price', sortOrder: 'desc', page: 2, limit: 50 });
  expect(sessionStorage.getItem('products-list:en')).toContain('pageSize=50');
});
it('ignores invalid status and renders real categories, price ranges and the three status labels', async () => {
  state.url = 'status=unknown'; const node = await mount(); expect(state.params.status).toBeUndefined();
  expect(node.querySelector('tbody')?.textContent).toContain('From $10.00');
  for (const status of ['Active', 'Inactive', 'Out of stock']) expect(node.querySelector('tbody')?.textContent).toContain(status);
  await openMenu(merchant.catalog.category);
  expect(Array.from(document.querySelectorAll('[role="menuitemradio"]')).map(option => option.textContent)).toContain('Actual category');
  expect(node.querySelector('select')).toBeNull();
});
it('changes tabs and categories, debounces search and preserves other URL parameters', async () => {
  vi.useFakeTimers(); state.url = 'source=overview'; await mount();
  await act(async () => button('Active2').click()); expect(state.params.status).toBe('active');
  await chooseFilter(merchant.catalog.category, 'Actual category');
  expect(state.params.categoryId).toBe('real-category');
  const search = document.querySelector('input')!; await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'boots'); search.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(state.params.search).toBe(''); await act(async () => vi.advanceTimersByTime(300)); expect(state.params.search).toBe('boots');
  expect(state.replace.mock.lastCall?.[0]).toContain('source=overview');
});
it('disables sold-product deletion with its reason before a request can be made', async () => {
  const bulk = vi.spyOn(productsApi, 'bulk'); await mount();
  await openMenu(merchant.catalog.more.replace('{name}', 'Available'));
  const disabled = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(item => item.textContent?.startsWith('Delete'))!;
  expect(disabled.getAttribute('aria-disabled')).toBe('true'); expect(disabled.textContent).toContain(merchant.catalog.soldReason);
  await act(async () => disabled.click()); expect(bulk).not.toHaveBeenCalled();
});
it('keeps all 10000 matching products and cross-page exclusions through paging, sorting and page-size changes', async () => {
  state.total = 10000;
  const bulk = vi.spyOn(productsApi, 'bulk').mockRejectedValue(new AdminApiError('PRIVATE_SQL', 'VALIDATION_ERROR', { limit: 5000, matched: 10000 }, 400));
  const node = await mount();
  const checkbox = (name: string) => node.querySelector<HTMLInputElement>('input[aria-label="' + name + '"]')!;
  await act(async () => checkbox(merchant.catalog.selectPage).click());
  await act(async () => button('Select all 10000 matching products').click());
  expect(node.textContent).toContain('All 10000 products selected');
  await act(async () => checkbox('Select product Available').click());
  await act(async () => button('Next').click());
  expect(state.params.page).toBe(2); expect(node.textContent).toContain('All 9999 products selected');
  expect(checkbox('Select product Available page 2').checked).toBe(true);
  await act(async () => checkbox('Select product Available page 2').click());
  await act(async () => button('Previous').click());
  expect(checkbox('Select product Available').checked).toBe(false);
  expect(node.textContent).toContain('All 9998 products selected');
  await act(async () => button(merchant.catalog.price).click());
  await chooseFilter(merchant.orders.list.perPage, '50');
  expect(state.params).toMatchObject({ page: 1, limit: 50, sortBy: 'price', sortOrder: 'asc' });
  expect(node.textContent).toContain('All 9998 products selected');
  const actions = node.querySelector('[role="region"][aria-label="Bulk actions"]')!;
  await act(async () => button(merchant.catalog.activate, actions).click());
  expect(bulk).toHaveBeenLastCalledWith('activate', { mode: 'filter', filter: { search: '', status: undefined, categoryId: undefined }, excludeIds: ['a', 'a-page-2'] }, {});
  expect(node.querySelector('[role="alert"]')?.textContent).toContain('at most 5000 products');
  expect(node.textContent).toContain('10000 products match'); expect(node.textContent).toContain('Narrow the filters or select fewer products');
  expect(node.textContent).not.toContain('PRIVATE_SQL');
});
it.each(['status=active', 'category=real-category', 'search=boots'])('clears product selection when the effective filter changes: %s', async url => {
  const node = await mount();
  await act(async () => node.querySelector<HTMLInputElement>('input[aria-label="Select product Available"]')!.click());
  expect(node.textContent).toContain('1 products selected');
  state.url = url;
  await act(async () => root.render(<QueryClientProvider client={queryClient}><ProductsPage /></QueryClientProvider>));
  expect(node.querySelector('[role="region"][aria-label="Bulk actions"]')).toBeNull();
  expect(node.querySelector<HTMLInputElement>('input[aria-label="Select product Available"]')!.checked).toBe(false);
});
it('tracks unsaved changes, guards unload only while dirty and sends product and variant visibility', async () => {
  const product = { id: 'p', name: 'Original', description: '', images: [], categoryId: 'real-category', isActive: true, variants: [{ id: 'v', name: 'Standard', salePrice: 12, stock: 2, skuCode: 'ONE', isActive: true }] } as any;
  state.update.mockImplementation(async ({ data }: any) => ({ ...product, ...data }));
  await mount(<ProductForm product={product} />); expect(document.body.textContent).not.toContain('Unsaved changes');
  await input('product-name', 'Edited'); expect(document.body.textContent).toContain('Unsaved changes');
  const dirty = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(dirty); expect(dirty.defaultPrevented).toBe(true);
  await chooseFilter(merchant.catalog.productStatus, 'Inactive');
  await act(async () => (document.getElementById('variant-v-active') as HTMLButtonElement).click());
  await act(async () => document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(state.update.mock.lastCall?.[0]).toMatchObject({ id: 'p', data: { name: 'Edited', isActive: false, categoryId: 'real-category', variants: [{ id: 'v', isActive: false }] } });
  expect(document.body.textContent).not.toContain('Unsaved changes');
  const clean = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(clean); expect(clean.defaultPrevented).toBe(false);
});
it('keeps at least one variant and removes unsupported marketing and fake save copy', async () => {
  await mount(<ProductForm />); expect(document.querySelector<HTMLButtonElement>('button[aria-label="Remove variant Default"]')?.disabled).toBe(true);
  const files = ['../app/[locale]/(themed)/products/page.tsx', '../app/[locale]/(themed)/products/create/page.tsx', '../app/[locale]/(themed)/products/[id]/edit/page.tsx', '../components/products/VariantsEditor.tsx', '../components/products/ProductForm.tsx'];
  for (const file of files) expect(readFileSync(new URL(file, import.meta.url), 'utf8')).not.toMatch(/Inventory Slate|TOTAL_ASSETS|Industrial Power|Auto-save Enabled|Last synced|Product Identity|window.confirm|router.back/);
});

it.each([merchant, hans, hant])('has every catalog key and plain category/order errors in each language', messages => {
  expect(Object.keys(messages.catalog).sort()).toEqual(Object.keys(merchant.catalog).sort());
  for (const value of Object.values(messages.catalog)) expect(value.trim().length).toBeGreaterThan(0);
  expect(messages.contentTranslations.categoryNotEmpty).toBeTruthy(); expect(messages.contentTranslations.productHasOrders).toBeTruthy();
});

it('shows SPU in product metadata and the code search placeholder', async () => {
  const node = await mount();
  expect(node.querySelector('input')?.placeholder).toBe('Search name, SPU or SKU');
  expect(node.querySelector('tbody')?.textContent).toContain('K7M2Q9XA');
});

it.each([
  ['SPU_CODE_TAKEN', 'spuCode', 'product-spu', 'spuCodeTaken'],
  ['SKU_CODE_TAKEN', 'skuCode', 'variant-0-sku', 'skuCodeTaken'],
  ['INVALID_PRODUCT_CODE', 'spuCode', 'product-spu', 'invalidProductCode'],
  ['INVALID_PRODUCT_CODE', 'skuCode', 'variant-0-sku', 'invalidProductCode'],
])('renders %s inline beneath its %s input', async (code, field, id, key) => {
  state.create.mockRejectedValue({ code, details: { field, variantIndex: 0, name: 'Other product' } });
  await mount(<ProductForm />);
  await input('product-name', 'New product'); await input('variant-0-price', '10'); await input(id, 'CLASH');
  expect((document.getElementById('product-spu') as HTMLInputElement).placeholder).toBe(merchant.catalog.spuPlaceholder);
  expect((document.getElementById('variant-0-sku') as HTMLInputElement).placeholder).toBe(merchant.catalog.skuPlaceholder);
  await act(async () => document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  const fieldInput = document.getElementById(id)!;
  expect(fieldInput.getAttribute('aria-invalid')).toBe('true');
  const described = (fieldInput.getAttribute('aria-describedby') ?? '').split(' ').map(id => document.getElementById(id)).filter(node => node?.getAttribute('role') === 'alert');
  expect(described.map(node => node?.textContent)).toEqual([(merchant.catalog as any)[key].replace('{name}', 'Other product')]);
});

it('renders a price the currency cannot represent inline beneath the variant price input', async () => {
  state.create.mockRejectedValue({ code: 'VALIDATION_ERROR', details: { issues: [{ path: 'variants.0.salePrice', message: 'Invalid field', code: 'PRICE_NOT_REPRESENTABLE_IN_JPY' }] } });
  await mount(<ProductForm />);
  await input('product-name', 'New product'); await input('variant-0-price', '100.5');
  await act(async () => document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  const fieldInput = document.getElementById('variant-0-price')!;
  expect(fieldInput.getAttribute('aria-invalid')).toBe('true');
  const described = (fieldInput.getAttribute('aria-describedby') ?? '').split(' ').map(id => document.getElementById(id)).filter(node => node?.getAttribute('role') === 'alert');
  expect(described.map(node => node?.textContent)).toEqual([merchant.catalog.priceNotRepresentable.replace('{currency}', 'JPY')]);
});

it('disables ordered variant removal with its reason before saving', async () => {
  const product = { id: 'p', name: 'Original', spuCode: 'CUSTOM', variants: [{ id: 'v1', name: 'First', salePrice: 12, stock: 1, skuCode: 'SKU1', hasOrders: true }, { id: 'v2', name: 'Second', salePrice: 12, stock: 1, skuCode: 'SKU2' }] } as any;
  await mount(<ProductForm product={product} />);
  const remove = document.querySelector<HTMLButtonElement>('button[aria-label="Remove variant First"]')!;
  expect(remove.disabled).toBe(true); expect(remove.title).toBe(merchant.catalog.orderedVariantRemove);
  await act(async () => remove.click()); expect(state.update).not.toHaveBeenCalled();
  expect(document.getElementById('variant-v1-sku')).not.toBeNull();
});
