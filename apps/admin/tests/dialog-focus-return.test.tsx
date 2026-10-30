// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CategoriesPage from '../app/[locale]/(themed)/products/categories/page';
import CustomerDetailPage from '../app/[locale]/(themed)/customers/[id]/page';
import StaffPage from '../app/[locale]/(themed)/staff/page';
import { ApiTokenPanel } from '../components/settings/ApiTokenPanel';

const mocks = vi.hoisted(() => ({
  categories: [{ id: 'category', name: 'Books', slug: 'books', description: null, translations: [], productCount: 0, childCount: 0 }],
  pending: false, get: vi.fn(), post: vi.fn(), put: vi.fn(), remove: vi.fn(), invalidate: vi.fn(), mutate: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'customer' }), useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => '/en/staff', useSearchParams: () => new URLSearchParams() }));
vi.mock('shared/src/i18n/react', () => ({ useLocale: () => 'en', useT: () => (key: string, values?: Record<string, string | number>) => key + (values ? ' ' + Object.values(values).join(' ') : '') }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: mocks.invalidate }) }));
vi.mock('../components/products/ContentTranslations', () => ({ useStoreDefaultLocale: () => ({ data: 'en' }), ContentTranslations: () => null }));
vi.mock('../lib/store', () => ({ useAuthStore: (select: (state: { user: { id: string } }) => unknown) => select({ user: { id: 'owner' } }) }));
vi.mock('../lib/api', () => ({ apiClient: { get: mocks.get, post: mocks.post, put: mocks.put, delete: mocks.remove }, usersApi: {}, unwrapApiResponse: <T,>(response: { data: T }) => response.data }));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));
vi.mock('../lib/hooks/use-api', async () => {
  const { useState } = await import('react');
  return {
    useCategories: () => ({ data: mocks.categories, isLoading: false }),
    useUser: () => ({ data: { id: 'customer', username: 'Buyer', email: 'buyer@example.com', isActive: true, orderCount: 0, paidTotal: 0, currency: 'USD', recentOrders: [], latestShippingAddress: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' }, isLoading: false }),
    useUpdateUser: () => ({ isPending: mocks.pending, mutateAsync: mocks.mutate }),
    useDeleteUser: () => ({ isPending: false }), useCustomerNeighbors: () => ({ data: { position: 1, total: 1 } }),
    useStaff: () => ({ data: { data: [], pagination: { total: 0, page: 1 }, statusCounts: { all: 0, active: 0, invited: 0, removed: 0 } }, isLoading: false }),
    useCreateStaff: () => {
      const [isPending, setPending] = useState(false);
      return { isPending, mutateAsync: async (input: { email: string; username: string }) => {
        setPending(true);
        try { return await mocks.mutate(input); } finally { setPending(false); }
      } };
    },
  };
});

let root: Root, container: HTMLDivElement;
const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
const buttons = (name: string) => Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).filter(button => (button.getAttribute('aria-label') ?? button.textContent) === name);
const button = (name: string) => { const found = buttons(name)[0]; expect(found, name).toBeDefined(); return found; };
const click = async (target: HTMLElement) => { await act(async () => { target.focus(); target.click(); }); await settle(); };
async function escape() { await act(async () => { document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); }); await settle(); }
async function render(node: ReactNode) { await act(async () => root.render(node)); await settle(); }
function dialog() { const found = document.body.querySelector<HTMLElement>('[role="dialog"]'); expect(found).not.toBeNull(); return found!; }
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
async function fill(input: HTMLInputElement, value: string) {
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
}
async function submit(modal: HTMLElement) {
  await act(async () => { modal.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }); await settle();
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mocks.pending = false;
  mocks.post.mockReset(); mocks.put.mockReset(); mocks.mutate.mockReset();
  mocks.categories = [{ id: 'category', name: 'Books', slug: 'books', description: null, translations: [], productCount: 0, childCount: 0 }];
  mocks.get.mockImplementation(async (url: string) => ({ data: url === '/admin/api-tokens' ? [] : mocks.categories[0] }));
  mocks.remove.mockImplementation(async () => { mocks.categories = []; return { data: null }; });
  mocks.invalidate.mockResolvedValue(undefined);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); await settle(); container.remove(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('Dialog focus returns to its actual entry point', () => {
  const cases = [
    { name: 'category creation', node: <CategoriesPage />, entry: 'merchant.catalog.addCategory', cancel: 'merchant.catalog.cancel', close: 'merchant.catalog.close' },
    { name: 'customer rename', node: <CustomerDetailPage />, entry: 'merchant.customers.workspace.modify', cancel: 'merchant.customers.cancel' },
    { name: 'staff invitation', node: <StaffPage />, entry: 'merchant.staffView.invite', cancel: 'common.actions.cancel' },
    { name: 'token creation', node: <ApiTokenPanel />, entry: 'merchant.settingsView.createToken', cancel: 'merchant.settingsView.cancel', close: 'Close' },
  ];
  for (const test of cases) {
    for (const method of ['Escape', 'Cancel', ...(test.close ? ['Close'] : [])]) {
      it(`${test.name}: restores focus after ${method}`, async () => {
        await render(test.node); const trigger = button(test.entry); await click(trigger);
        expect(dialog().contains(document.activeElement)).toBe(true);
        if (method === 'Escape') await escape(); else await click(button(method === 'Cancel' ? test.cancel : test.close!));
        expect(document.body.querySelector('[role="dialog"]')).toBeNull(); expect(document.activeElement).toBe(trigger);
      });
    }
    it(`${test.name}: traps forward and reverse Tab at dialog boundaries`, async () => {
      await render(test.node); await click(button(test.entry)); const modal = dialog();
      const controls = Array.from(modal.querySelectorAll<HTMLElement>('input, textarea, button, a[href]')).filter(control => control.tabIndex >= 0 && !control.hasAttribute('disabled') && !control.hidden);
      const first = controls[0], last = controls.at(-1)!;
      await act(async () => { last.focus(); last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })); });
      expect(document.activeElement).toBe(first);
      await act(async () => { first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })); });
      expect(document.activeElement).toBe(last);
    });
  }

  it.each([0, 1])('returns category name editing to the same responsive entry %s', async index => {
    await render(<CategoriesPage />); const trigger = buttons('Books')[index]; await click(trigger); await escape(); expect(document.activeElement).toBe(trigger);
  });
  it.each([0, 1])('returns menu editing to its own More button %s without competing menu autofocus', async index => {
    await render(<CategoriesPage />); const trigger = buttons('merchant.catalog.more Books')[index];
    await act(async () => { trigger.focus(); trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); }); await settle();
    const edit = Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(item => item.textContent === 'merchant.catalog.edit')!;
    await click(edit); expect(dialog().contains(document.activeElement)).toBe(true);
    await escape(); expect(document.activeElement).toBe(trigger);
  });
  it('returns successful category deletion to Add when the row is removed', async () => {
    await render(<CategoriesPage />); const trigger = button('merchant.catalog.more Books'), add = button('merchant.catalog.addCategory');
    await act(async () => { trigger.focus(); trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); }); await settle();
    const remove = Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(item => item.textContent === 'merchant.catalog.delete')!;
    await click(remove); await click(button('merchant.catalog.delete'));
    expect(trigger.isConnected).toBe(false); expect(document.body.querySelector('[role="dialog"]')).toBeNull(); expect(document.activeElement).toBe(add);
  });
  it('preserves the customer pending-close guard', async () => {
    await render(<CustomerDetailPage />); const trigger = button('merchant.customers.workspace.modify'); await click(trigger);
    mocks.pending = true; await render(<CustomerDetailPage />); await escape(); expect(dialog()).toBeDefined(); expect(button('merchant.customers.cancel').disabled).toBe(true);
    mocks.pending = false; await render(<CustomerDetailPage />); await click(button('merchant.customers.cancel')); expect(document.activeElement).toBe(trigger);
  });
  it('keeps category editing open while its save request is unresolved', async () => {
    const request = deferred<{ data: null }>(); mocks.post.mockReturnValueOnce(request.promise);
    await render(<CategoriesPage />); const trigger = button('merchant.catalog.addCategory'); await click(trigger);
    const modal = dialog(); await fill(modal.querySelector<HTMLInputElement>('#category-name')!, 'New books'); await fill(modal.querySelector<HTMLInputElement>('#category-slug')!, 'new-books');
    try {
      await submit(modal); expect(mocks.post).toHaveBeenCalledWith('/admin/products/categories', { name: 'New books', slug: 'new-books', description: '', translations: [] });
      expect(button('merchant.catalog.cancel').disabled).toBe(true); expect(button('merchant.catalog.save').disabled).toBe(true);
      await escape(); expect(dialog()).toBe(modal);
      await click(button('merchant.catalog.close')); expect(dialog()).toBe(modal);
      await click(button('merchant.catalog.cancel')); expect(dialog()).toBe(modal);
    } finally { await act(async () => { request.resolve({ data: null }); await request.promise; }); await settle(); }
    expect(document.body.querySelector('[role="dialog"]')).toBeNull(); expect(document.activeElement).toBe(trigger);
  });
  it('keeps staff invitation open while the mutation is unresolved', async () => {
    const request = deferred<undefined>(); mocks.mutate.mockReturnValueOnce(request.promise);
    await render(<StaffPage />); const trigger = button('merchant.staffView.invite'); await click(trigger);
    const modal = dialog(), inputs = modal.querySelectorAll<HTMLInputElement>('input'); await fill(inputs[0], 'new@example.com'); await fill(inputs[1], 'New staff');
    try {
      await submit(modal); expect(mocks.mutate).toHaveBeenCalledWith({ email: 'new@example.com', username: 'New staff' });
      expect(button('common.actions.cancel').disabled).toBe(true); expect(button('merchant.staffView.send').disabled).toBe(true);
      await escape(); expect(dialog()).toBe(modal);
      await click(button('common.actions.cancel')); expect(dialog()).toBe(modal);
    } finally { await act(async () => { request.resolve(undefined); await request.promise; }); await settle(); }
    expect(document.body.querySelector('[role="dialog"]')).toBeNull(); expect(document.activeElement).toBe(trigger);
  });
  it('keeps token creation open while its request is unresolved', async () => {
    const request = deferred<{ data: { token: string } }>(); mocks.post.mockReturnValueOnce(request.promise);
    await render(<ApiTokenPanel />); const trigger = button('merchant.settingsView.createToken'); await click(trigger);
    const modal = dialog(); await fill(modal.querySelector<HTMLInputElement>('input:not([type="checkbox"])')!, 'Automation');
    try {
      await submit(modal); expect(mocks.post).toHaveBeenCalledWith('/admin/api-tokens', { label: 'Automation', scopes: ['catalog:read'] });
      expect(button('merchant.settingsView.cancel').disabled).toBe(true); expect(modal.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
      await escape(); expect(dialog()).toBe(modal);
      await click(button('Close')); expect(dialog()).toBe(modal);
      await click(button('merchant.settingsView.cancel')); expect(dialog()).toBe(modal);
    } finally { await act(async () => { request.resolve({ data: { token: 'token-once' } }); await request.promise; }); await settle(); }
    expect(document.body.querySelector('[role="dialog"]')).toBeNull(); expect(document.activeElement).toBe(trigger);
  });
});
