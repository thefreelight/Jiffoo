// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import CustomersPage from '../app/[locale]/(themed)/customers/page';
import { StoreTimeProvider } from '../lib/store-time';
import { merchant } from '../../../packages/shared/src/i18n/messages/en/merchant';

const state = vi.hoisted(() => ({ params: {} as any, url: '', replace: vi.fn(), data: {} as any, exportCsv: vi.fn() }));
vi.mock('shared/src/i18n/react', () => ({ useLocale: () => 'en', useT: () => (key: string, params?: Record<string, string | number>) => {
  const value = key.split('.').slice(1).reduce<any>((value, part) => value?.[part], merchant) ?? key;
  return typeof value === 'string' ? value.replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? '{' + name + '}')) : key;
} }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: state.replace, push: vi.fn() }), usePathname: () => '/en/customers', useSearchParams: () => new URLSearchParams(state.url) }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('../lib/hooks/use-api', () => ({ useUsers: (params: any) => { state.params = params; return state.data; }, useUpdateUser: () => ({ isPending: false }), useDeleteUser: () => ({ isPending: false }) }));
vi.mock('../lib/api', () => ({ usersApi: { export: state.exportCsv }, isAdminApiError: () => false }));
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); state.url = ''; state.replace.mockClear(); state.exportCsv.mockReset();
  state.data = { data: { data: [{ id: 'one', username: 'Buyer', email: 'buyer@example.com', isActive: true, orderCount: 3, paidTotal: 39.98, currency: 'USD', lastOrderAt: '2026-10-12T00:15:00Z', createdAt: '2026-10-01T00:00:00Z' }], pagination: { page: 1, limit: 20, total: 25 }, statusCounts: { all: 25, active: 20, inactive: 5 } } };
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
async function mount() { await act(async () => root.render(<StoreTimeProvider timezone="Asia/Shanghai" now="2026-10-14T00:00:00Z"><CustomersPage /></StoreTimeProvider>)); }
function button(name: string) { const element = Array.from(container.querySelectorAll('button')).find(button => button.textContent?.startsWith(name) || button.getAttribute('aria-label') === name); if (!element) throw new Error('Missing button: ' + name); return element; }
it('shows real aggregates, filtered tab counts, store time and mobile cards', async () => {
  await mount();
  expect(Array.from(container.querySelectorAll('[role="tab"]')).map(tab => tab.textContent)).toEqual(['All25', 'Active20', 'Inactive5']);
  expect(container.querySelector('tbody')?.textContent).toContain('$39.98'); expect(container.querySelector('tbody')?.textContent).toContain('2026-10-12 08:15');
  expect(container.querySelector('thead')?.textContent).toContain('Registered (Asia/Shanghai)');
  expect(container.querySelector('article')?.textContent).toContain('Orders 3');
  expect(container.textContent).not.toMatch(/Role|VIP|vs yesterday/);
  await act(async () => button('Orders').click()); expect(state.params).toMatchObject({ sortBy: 'orderCount', sortOrder: 'asc' });
  await act(async () => button('Inactive').click()); expect(state.params).toMatchObject({ status: 'inactive', page: 1 });
});
it('shows the loading line on the first load when there are no previous rows', async () => {
  state.data = { isLoading: true };
  await mount();
  expect(container.querySelector('[role="status"]')?.textContent).toBe('Loading customers…');
  expect(container.querySelector('table')).toBeNull();
});
it('selects the current page, offers all matching customers and clears selection on filter change', async () => {
  await mount();
  const checkbox = container.querySelector<HTMLInputElement>('input[aria-label="Select all customers on this page"]')!;
  await act(async () => checkbox.click()); expect(container.textContent).toContain('Select all 25 matching customers');
  await act(async () => button('Select all 25').click()); expect(container.textContent).toContain('All 25 customers selected');
  await act(async () => button('Inactive').click()); expect(container.querySelector('[role="region"]')).toBeNull();
});
it('restores URL filters and distinguishes filtered and new-store empty states', async () => {
  state.url = 'registered=last30&search=missing'; state.data.data.data = []; state.data.data.pagination.total = 0;
  await mount(); expect(state.params).toMatchObject({ registered: 'last30', search: 'missing' });
  expect(container.textContent).toContain('No matching customers'); expect(container.textContent).toContain('Try another keyword');
  await act(async () => button('Clear search and filters').click()); expect(container.textContent).toContain('No customers yet');
  expect(container.querySelector('nav[aria-label="Pagination"]')).not.toBeNull();
});
it('exports selected IDs or matching filters with exclusions and reports mapped failures', async () => {
  state.exportCsv.mockRejectedValue({ code: 'CUSTOMER_HAS_ORDERS' });
  await mount();
  await act(async () => container.querySelector<HTMLInputElement>('input[aria-label="Select customer Buyer"]')!.click());
  await act(async () => button('Export selected').click());
  expect(state.exportCsv).toHaveBeenLastCalledWith({ mode: 'ids', ids: ['one'] }, { sortBy: 'createdAt', sortOrder: 'desc' }, 'en');
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('This customer has orders');
  await act(async () => button('Select all 25').click());
  await act(async () => container.querySelector<HTMLInputElement>('input[aria-label="Select customer Buyer"]')!.click());
  await act(async () => button('Export selected').click());
  expect(state.exportCsv).toHaveBeenLastCalledWith({ mode: 'filter', filters: { search: undefined, status: 'all', registered: 'all', start: undefined, end: undefined }, excludedIds: ['one'] }, { sortBy: 'createdAt', sortOrder: 'desc' }, 'en');
  await act(async () => button('Export').click());
  expect(state.exportCsv).toHaveBeenLastCalledWith({ mode: 'filter', filters: { search: undefined, status: 'all', registered: 'all', start: undefined, end: undefined } }, { sortBy: 'createdAt', sortOrder: 'desc' }, 'en');
});
