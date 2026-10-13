// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import ProductsPage from '../app/[locale]/(themed)/products/page';
import { ProductForm } from '../components/products/ProductForm';
import { merchant } from '../../../packages/shared/src/i18n/messages/en/merchant';
import { merchant as hans } from '../../../packages/shared/src/i18n/messages/zh-Hans/merchant';
import { merchant as hant } from '../../../packages/shared/src/i18n/messages/zh-Hant/merchant';
const state = vi.hoisted(() => ({ url: '', params: {} as any, replace: vi.fn(), update: vi.fn(), remove: vi.fn(), create: vi.fn() }));
vi.mock('shared/src/i18n/react', () => ({ useLocale: () => 'en', useT: () => (key: string, values?: Record<string, string | number>) => {
  const value = key.split('.').slice(1).reduce<any>((v, k) => v?.[k], merchant);
  return typeof value === 'string' ? value.replace(/\{(\w+)\}/g, (_, k) => String(values?.[k] ?? '{' + k + '}')) : key;
} }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: state.replace, push: vi.fn() }), usePathname: () => '/en/products', useSearchParams: () => new URLSearchParams(state.url) }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('../components/products/ContentTranslations', () => ({ ContentTranslations: () => null, useStoreDefaultLocale: () => ({ data: 'en' }) }));
vi.mock('../components/ui/dropdown-menu', () => ({ DropdownMenu: ({ children }: any) => children, DropdownMenuTrigger: ({ children }: any) => children, DropdownMenuContent: ({ children }: any) => children, DropdownMenuItem: ({ children, onSelect }: any) => <button onClick={onSelect}>{children}</button> }));
vi.mock('../components/ui/dialog', () => ({ Dialog: ({ open, children }: any) => open ? children : null, DialogContent: ({ children }: any) => <div role="dialog">{children}</div>, DialogHeader: ({ children }: any) => children, DialogTitle: ({ children }: any) => <h2>{children}</h2>, DialogDescription: ({ children }: any) => <p>{children}</p>, DialogFooter: ({ children }: any) => children }));
vi.mock('../lib/hooks/use-api', () => ({
  useProducts: (params: any) => { state.params = params; return { data: { data: [
    { id: 'a', name: 'Available', isActive: true, stock: 3, variantsCount: 2, priceMin: 10, priceMax: 20, images: [] },
    { id: 'b', name: 'Hidden', isActive: false, stock: 0, variantsCount: 1, priceMin: 10, priceMax: 10, images: [] },
    { id: 'c', name: 'Empty', isActive: true, stock: 0, variantsCount: 1, priceMin: 10, priceMax: 10, images: [] },
  ], pagination: { total: 3, totalPages: 1 } } }; },
  useProductStats: () => ({ data: { statusCounts: { all: 3, active: 2, inactive: 1, outOfStock: 1 } } }),
  useCategories: () => ({ data: [{ id: 'real-category', name: 'Actual category' }] }),
  useDeleteProduct: () => ({ mutateAsync: state.remove, isPending: false }),
  useUpdateProduct: () => ({ mutateAsync: state.update, isPending: false }),
  useCreateProduct: () => ({ mutateAsync: state.create, isPending: false }),
  useUploadProductImage: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
let root: Root;
async function mount(element = <ProductsPage />) {
  const node = document.createElement('div'); document.body.append(node); root = createRoot(node); await act(async () => root.render(element)); return node;
}
function button(name: string, scope: ParentNode = document) { const result = Array.from(scope.querySelectorAll<HTMLButtonElement>('button')).find(b => b.textContent?.trim() === name); if (!result) throw new Error('Missing button: ' + name); return result; }
async function input(id: string, value: string) { const node = document.getElementById(id) as HTMLInputElement; await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(node, value); node.dispatchEvent(new Event('input', { bubbles: true })); }); }
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); state.url = ''; state.update.mockReset().mockResolvedValue({}); state.remove.mockReset(); state.create.mockReset();
  state.replace.mockReset().mockImplementation((url: string) => { state.url = url.split('?')[1] ?? ''; root.render(<ProductsPage />); });
});
afterEach(async () => { if (root) await act(async () => root.unmount()); document.body.innerHTML = ''; vi.unstubAllGlobals(); vi.useRealTimers(); });
it.each(['active', 'inactive', 'outOfStock'])('reads server-side status, category and search from the URL: %s', async status => {
  state.url = 'status=' + status + '&category=real-category&search=hello'; await mount();
  expect(state.params).toMatchObject({ status, categoryId: 'real-category', search: 'hello', page: 1 });
});
it('ignores invalid status and renders real categories, price ranges and the three status labels', async () => {
  state.url = 'status=unknown'; const node = await mount(); expect(state.params.status).toBeUndefined();
  expect(Array.from(node.querySelectorAll('option')).map(o => o.textContent)).toEqual(['All categories', 'Actual category']);
  expect(node.querySelector('tbody')?.textContent).toContain('From $10.00');
  for (const status of ['Active', 'Inactive', 'Out of stock']) expect(node.querySelector('tbody')?.textContent).toContain(status);
});
it('changes tabs and categories, debounces search and preserves other URL parameters', async () => {
  vi.useFakeTimers(); state.url = 'source=overview'; await mount();
  await act(async () => button('Active2').click()); expect(state.params.status).toBe('active');
  const select = document.querySelector('select')!; await act(async () => { select.value = 'real-category'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(state.params.categoryId).toBe('real-category');
  const search = document.querySelector('input')!; await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'boots'); search.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(state.params.search).toBe(''); await act(async () => vi.advanceTimersByTime(300)); expect(state.params.search).toBe('boots');
  expect(state.replace.mock.lastCall?.[0]).toContain('source=overview');
});
it('keeps deletion errors inline and offers the existing partial deactivate flow', async () => {
  state.remove.mockRejectedValue({ code: 'PRODUCT_HAS_ORDERS' }); await mount();
  await act(async () => button('Delete').click());
  const dialog = document.querySelector('[role="dialog"]')!;
  await act(async () => button('Delete', dialog).click());
  expect(dialog.textContent).toContain(merchant.contentTranslations.productHasOrders);
  await act(async () => button('Deactivate instead', dialog).click());
  await act(async () => button('Deactivate', document.querySelector('[role="dialog"]')!).click());
  expect(state.update).toHaveBeenCalledWith({ id: 'a', data: { isActive: false } });
});
it('tracks unsaved changes, guards unload only while dirty and sends product and variant visibility', async () => {
  const product = { id: 'p', name: 'Original', description: '', images: [], categoryId: 'real-category', isActive: true, variants: [{ id: 'v', name: 'Standard', salePrice: 12, stock: 2, skuCode: 'ONE', isActive: true }] } as any;
  state.update.mockImplementation(async ({ data }: any) => ({ ...product, ...data }));
  await mount(<ProductForm product={product} />); expect(document.body.textContent).not.toContain('Unsaved changes');
  await input('product-name', 'Edited'); expect(document.body.textContent).toContain('Unsaved changes');
  const dirty = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(dirty); expect(dirty.defaultPrevented).toBe(true);
  await act(async () => (document.getElementById('product-active') as HTMLButtonElement).click());
  await act(async () => (document.getElementById('variant-v-active') as HTMLButtonElement).click());
  await act(async () => document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(state.update.mock.lastCall?.[0]).toMatchObject({ id: 'p', data: { name: 'Edited', isActive: false, categoryId: 'real-category', variants: [{ id: 'v', isActive: false }] } });
  expect(document.body.textContent).not.toContain('Unsaved changes');
  const clean = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(clean); expect(clean.defaultPrevented).toBe(false);
});
it('keeps at least one variant and removes unsupported marketing and fake save copy', async () => {
  await mount(<ProductForm />); expect(button('Delete').disabled).toBe(true);
  const files = ['../app/[locale]/(themed)/products/page.tsx', '../app/[locale]/(themed)/products/create/page.tsx', '../app/[locale]/(themed)/products/[id]/edit/page.tsx', '../components/products/VariantsEditor.tsx', '../components/products/ProductForm.tsx'];
  for (const file of files) expect(readFileSync(new URL(file, import.meta.url), 'utf8')).not.toMatch(/Inventory Slate|TOTAL_ASSETS|Industrial Power|Auto-save Enabled|Last synced|Product Identity|window.confirm|router.back/);
});

it.each([merchant, hans, hant])('has every catalog key and plain category/order errors in each language', messages => {
  expect(Object.keys(messages.catalog).sort()).toEqual(Object.keys(merchant.catalog).sort());
  for (const value of Object.values(messages.catalog)) expect(value.trim().length).toBeGreaterThan(0);
  expect(messages.contentTranslations.categoryNotEmpty).toBeTruthy(); expect(messages.contentTranslations.productHasOrders).toBeTruthy();
});
