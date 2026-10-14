// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ProductForm } from '../components/products/ProductForm';
import { AdminNavigation } from '../components/layout/admin-navigation';
import { duplicateDraft, productPayload } from '../lib/product-editor';
import { productListQuery } from '../lib/product-list-state';
import { merchant } from '../../../packages/shared/src/i18n/messages/en/merchant';

const state = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), update: vi.fn(), create: vi.fn(), upload: vi.fn(), currency: 'EUR', query: {} as any }));
vi.mock('next/navigation', () => ({ usePathname: () => '/en/products/product/edit', useRouter: () => ({ push: state.push, replace: state.replace }) }));
vi.mock('next/link', () => ({ default: ({ children, href, ...props }: any) => <a href={href} {...props} onClick={event => { event.preventDefault(); state.push(href); }}>{children}</a> }));
vi.mock('shared/src/i18n/react', () => ({ useLocale: () => 'en', useT: () => (key: string, params?: Record<string, string | number>) => {
  const value = key.split('.').slice(1).reduce<any>((value, part) => value?.[part], merchant);
  return typeof value === 'string' ? value.replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? '{' + name + '}')) : key;
} }));
vi.mock('../lib/hooks/use-api', () => ({
  useOrderStats: () => ({ data: { paymentReviewCount: 0 } }),
  useProductEditorContext: () => ({ data: { currency: state.currency, defaultLocale: 'en' } }),
  useCategories: () => ({ data: [{ id: 'category', name: 'Clothing' }] }),
  useCreateProduct: () => ({ mutateAsync: state.create, isPending: false }),
  useUpdateProduct: () => ({ mutateAsync: state.update, isPending: false }),
  useUploadProductImage: () => ({ mutateAsync: state.upload, isPending: false }),
  useProductNeighbors: (_id: string, query: unknown) => { state.query = query; return { data: { position: 1, total: 2, previousId: null, nextId: 'next' } }; },
}));
vi.mock('../lib/store-time', () => ({ useStoreDate: () => ({ timezone: 'Asia/Shanghai' }) }));
const product = { id: 'product', slug: 'real-slug', currency: 'EUR', name: 'Shirt', spuCode: 'K7M2Q9XA', description: 'Linen', images: ['/a.png', '/b.png'], categoryId: 'category', isActive: true, requiresShipping: true,
  createdAt: '2026-10-14T00:00:00Z', updatedAt: '2026-10-14T01:00:00Z', translations: [{ locale: 'zh-Hans', name: '衬衫', description: '亚麻' }],
  variants: [{ id: 'v1', name: 'Small', skuCode: 'SHIRT-S', salePrice: 10, stock: 2, isActive: true, hasOrders: true, attributes: { size: 'S' } }, { id: 'v2', name: 'Large', skuCode: 'SHIRT-L', salePrice: 12, stock: 3, isActive: false, hasOrders: false, attributes: { size: 'L' } }] };
let root: Root | undefined;
async function mount(props: Partial<React.ComponentProps<typeof ProductForm>> = { product }) {
  const node = document.createElement('div'); document.body.append(node); root = createRoot(node);
  await act(async () => root!.render(<><AdminNavigation storeName="Local Store" storeUrl="http://shop.test/en" /><ProductForm storefrontUrl="http://shop.test/en" {...props} /></>)); return node;
}
const button = (name: string, scope: ParentNode = document) => {
  const found = Array.from(scope.querySelectorAll<HTMLButtonElement>('button')).find(control => control.textContent?.trim() === name || control.getAttribute('aria-label') === name);
  if (!found) throw new Error('Missing button: ' + name); return found;
};
async function fill(id: string, value: string) {
  const field = document.getElementById(id) as HTMLInputElement;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true })); });
}
async function openMenu(name: string) { await act(async () => button(name).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))); }
async function selectItem(name: string, role = 'menuitem') {
  const item = Array.from(document.querySelectorAll<HTMLElement>('[role="' + role + '"]')).find(item => item.textContent?.trim() === name)!;
  if (!item) throw new Error('Missing item: ' + name); await act(async () => item.click());
}
beforeEach(() => {
  sessionStorage.clear(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  state.push.mockReset(); state.replace.mockReset(); state.upload.mockReset(); state.currency = 'EUR';
  state.update.mockReset().mockImplementation(async ({ data }: any) => ({ ...product, ...data, updatedAt: '2026-10-14T02:00:00Z' }));
  state.create.mockReset().mockImplementation(async (data: any) => ({ ...product, ...data, id: 'created', spuCode: 'NEWCODE8', updatedAt: '2026-10-14T02:00:00Z' }));
});
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; document.body.innerHTML = ''; vi.unstubAllGlobals(); });
it('tracks real dirty state, store-local saved time and discard, including translations', async () => {
  await mount(); expect(button('Save').disabled).toBe(true); expect(document.body.textContent).toContain('Saved · 2026-10-14 09:00');
  await fill('product-name', 'Edited'); expect(button('Save').disabled).toBe(false);
  const unload = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(unload); expect(unload.defaultPrevented).toBe(true);
  const language = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(control => control.textContent?.includes('Simplified Chinese'))!;
  await act(async () => language.click()); await fill('translation-zh-Hans-name', '修改');
  expect(product.translations[0].name).toBe('衬衫'); await act(async () => button('Discard changes').click());
  expect((document.getElementById('product-name') as HTMLInputElement).value).toBe('Shirt'); expect((document.getElementById('translation-zh-Hans-name') as HTMLInputElement).value).toBe('衬衫'); expect(button('Save').disabled).toBe(true);
});
it.each(['keep', 'leave', 'save', 'fail'])('guards sidebar navigation and handles %s without losing inputs', async decision => {
  await mount(); await fill('product-name', 'Edited');
  if (decision === 'fail') state.update.mockRejectedValue({ code: 'SKU_CODE_TAKEN', details: { field: 'skuCode', variantIndex: 1, name: 'Other' } });
  await act(async () => document.querySelector<HTMLAnchorElement>('a[aria-label="Orders"]')!.click());
  expect(document.querySelector('[role="alertdialog"]')).toBeTruthy(); expect(state.push).not.toHaveBeenCalled();
  await act(async () => button(decision === 'keep' ? 'Keep editing' : decision === 'leave' ? 'Leave without saving' : 'Save and leave').click());
  if (decision === 'leave' || decision === 'save') expect(state.push).toHaveBeenCalledWith('/en/orders');
  else { expect(state.push).not.toHaveBeenCalled(); expect((document.getElementById('product-name') as HTMLInputElement).value).toBe('Edited'); }
  expect(state.update).toHaveBeenCalledTimes(decision === 'save' || decision === 'fail' ? 1 : 0);
  if (decision === 'fail') expect(document.body.textContent).toContain('Your entries are still here.');
});
it('duplicates values and attributes without ids, order flags, SPU/SKU or active status', async () => {
  const draft = duplicateDraft(product, 'Default'); expect(draft).toMatchObject({ name: 'Shirt', images: ['/a.png', '/b.png'], categoryId: 'category', spuCode: '', isActive: false });
  expect(draft.variants[0]).toMatchObject({ name: 'Small', salePrice: 10, stock: 2, skuCode: '', attributes: { size: 'S' } }); expect(draft.variants[0]).not.toHaveProperty('id'); expect(productPayload(draft).variants[0]).not.toHaveProperty('hasOrders');
  await mount({ source: product }); expect((document.getElementById('product-spu') as HTMLInputElement).value).toBe('');
  await act(async () => button('Save').click()); expect(state.create.mock.lastCall?.[0]).toMatchObject({ isActive: false, spuCode: '', variants: [{ skuCode: '' }, { skuCode: '' }] });
  expect(state.replace).toHaveBeenCalledWith('/en/products/created/edit');
});
it('guards duplicate navigation and leaves the original saved product intact', async () => {
  await mount(); await fill('product-name', 'Unsaved'); await openMenu('More product actions'); await selectItem('Duplicate product');
  expect(document.querySelector('[role="alertdialog"]')).toBeTruthy(); await act(async () => button('Leave without saving').click());
  expect(state.push).toHaveBeenCalledWith('/en/products/create?duplicate=product'); expect(state.create).not.toHaveBeenCalled(); expect(state.update).not.toHaveBeenCalled();
});
it('defers imperative account-menu navigation and its side effects until the leave decision', async () => {
  await mount(); await fill('product-name', 'Edited');
  await openMenu('Account menu'); await selectItem('My account'); expect(state.push).not.toHaveBeenCalled();
  await act(async () => button('Keep editing').click()); expect(state.push).not.toHaveBeenCalled();
  await openMenu('Account menu'); await selectItem('My account'); await act(async () => button('Leave without saving').click());
  expect(state.push).toHaveBeenCalledOnce(); expect(state.push).toHaveBeenCalledWith('/en/profile');
});
it('supports cover and move menus, optional bulk fields and currency from settings', async () => {
  await mount(); expect(document.getElementById('variant-v1-price')?.parentElement?.textContent).toContain('€');
  await openMenu(merchant.catalog.imageActions.replace('{n}', '2')); await selectItem('Set cover');
  expect(document.querySelector('img[alt="Product image 1"]')?.getAttribute('src')).toBe('/b.png');
  await openMenu(merchant.catalog.imageActions.replace('{n}', '1')); await selectItem('Move later');
  expect(document.querySelector('img[alt="Product image 1"]')?.getAttribute('src')).toBe('/a.png');
  await act(async () => button('Bulk price / stock').click()); await fill('bulk-price', '7.25'); await act(async () => button('Apply').click());
  await act(async () => button('Save').click()); expect(state.update.mock.lastCall?.[0].data.variants).toMatchObject([{ salePrice: 7.25, stock: 2 }, { salePrice: 7.25, stock: 3 }]);
  expect(button('Save').disabled).toBe(true);
});
it('keeps the selected category for Save and add another and generates a fresh form', async () => {
  await mount({ categoryId: 'category' }); await fill('product-name', 'New'); await fill('variant-0-price', '4');
  await act(async () => button('Save and add another').click()); expect(state.create.mock.lastCall?.[0].categoryId).toBe('category');
  expect((document.getElementById('product-name') as HTMLInputElement).value).toBe(''); expect(button('Category').textContent).toContain('Clothing');
  await openMenu('Category'); expect(document.querySelector('[role="menuitemradio"][aria-checked="true"]')?.textContent).toBe('Clothing');
  expect(state.replace).toHaveBeenCalledWith('/en/products/create?categoryId=category');
});
it('maps the exact SKU index, preserves fields and focuses the first invalid input from the banner', async () => {
  state.update.mockRejectedValue({ code: 'SKU_CODE_TAKEN', details: { field: 'skuCode', variantIndex: 1, name: 'Other' } });
  await mount(); await fill('product-name', 'Edited'); await act(async () => button('Save').click());
  const field = document.getElementById('variant-v2-sku')!; expect(field.getAttribute('aria-invalid')).toBe('true'); expect(document.getElementById('variant-v1-sku')?.getAttribute('aria-invalid')).toBe('false');
  expect(document.body.textContent).toContain(merchant.catalog.skuCodeTaken.replace('{name}', 'Other'));
  await act(async () => button('Go fix →').click()); expect(document.activeElement).toBe(field); expect(field.scrollIntoView).toHaveBeenCalled();
  expect((document.getElementById('product-name') as HTMLInputElement).value).toBe('Edited');
});
it('validates every required input before a request and focuses the first field in display order', async () => {
  await mount({}); await act(async () => button('Save').click()); expect(state.create).not.toHaveBeenCalled();
  await act(async () => button('Go fix →').click()); expect(document.activeElement?.id).toBe('product-name');
});
it('continues multiple uploads after each per-file error', async () => {
  state.upload.mockResolvedValueOnce({ url: '/one.png' }).mockResolvedValueOnce({ url: '/two.webp' });
  await mount({}); const input = document.getElementById('product-images') as HTMLInputElement;
  Object.defineProperty(input, 'files', { configurable: true, value: [new File(['a'], 'one.png', { type: 'image/png' }), new File(['x'], 'bad.txt', { type: 'text/plain' }), new File(['b'], 'two.webp', { type: 'image/webp' })] });
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
  expect(state.upload).toHaveBeenCalledTimes(2); expect(document.body.textContent).toContain('bad.txt: JPG, PNG or WebP'); expect(document.querySelectorAll('img')).toHaveLength(2);
});
it('builds the same product query from a saved filtered list and uses a real storefront slug', async () => {
  sessionStorage.setItem('products-list:en', '/en/products?status=active&category=category&sortBy=price&sortOrder=desc&page=2');
  await mount(); expect(state.query).toMatchObject({ status: 'active', categoryId: 'category', sortBy: 'price', sortOrder: 'desc' });
  expect(document.querySelector('a[aria-label="Next product"]')?.getAttribute('href')).toContain('/en/products/next/edit?status=active');
  await openMenu('More product actions'); const view = Array.from(document.querySelectorAll('a')).find(link => link.textContent === 'View in store')!;
  expect(view.getAttribute('href')).toBe('http://shop.test/en/products/real-slug'); expect(view.target).toBe('_blank'); expect(view.rel).toBe('noopener noreferrer');
  expect(productListQuery('/en/products?sortBy=invalid')).toMatchObject({ sortBy: 'stock', sortOrder: 'asc' });
});
