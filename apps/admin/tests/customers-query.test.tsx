// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { useUsers, useCustomerNeighbors } from '../lib/hooks/use-api';
import CustomersPage from '../app/[locale]/(themed)/customers/page';
import { merchant } from '../../../packages/shared/src/i18n/messages/en/merchant';

const transport = vi.hoisted(() => ({ get: vi.fn() }));
const route = vi.hoisted(() => ({ query: '', replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: route.replace, push: vi.fn() }), usePathname: () => '/en/customers', useSearchParams: () => new URLSearchParams(route.query) }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('shared/src/i18n/react', () => ({ useLocale: () => 'en', useT: () => (key: string, params?: Record<string, string | number>) => {
  const value = key.split('.').slice(1).reduce<any>((value, part) => value?.[part], merchant) ?? key;
  return typeof value === 'string' ? value.replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? '{' + name + '}')) : key;
} }));
vi.mock('shared', async importOriginal => ({ ...await importOriginal<typeof import('shared')>(), createAdminClient: () => ({ get: transport.get }) }));
it('forwards every customer filter and aggregate sort through the client and returns tab counts', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  transport.get.mockImplementation((path: string) => Promise.resolve({ success: true, data: path.endsWith('/neighbors') ? { position: 2, total: 4, previousId: 'one', nextId: 'three' } : { items: [], page: 2, limit: 50, total: 1, totalPages: 1, statusCounts: { all: 4, active: 3, inactive: 1 } } }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }), root = createRoot(document.createElement('div'));
  const params = { search: 'buyer', status: 'inactive' as const, registered: 'custom' as const, start: '2026-10-01', end: '2026-10-14', sortBy: 'paidTotal' as const, sortOrder: 'asc' as const };
  function Probe() { useUsers({ ...params, page: 2, limit: 50 }); useCustomerNeighbors('two', params); return null; }
  try {
    await act(async () => root.render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>));
    expect(transport.get).toHaveBeenCalledWith('/admin/users', { params: { ...params, page: 2, limit: 50 } });
    expect(transport.get).toHaveBeenCalledWith('/admin/users/two/neighbors', { params });
    await vi.waitFor(() => expect(client.getQueryData(['users', { ...params, page: 2, limit: 50 }])).toMatchObject({ statusCounts: { all: 4, active: 3, inactive: 1 } }));
  } finally { await act(async () => root.unmount()); client.clear(); transport.get.mockReset(); vi.unstubAllGlobals(); }
});
it('keeps the table, customer row and open menu mounted while a new search query is in flight', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  route.query = '';
  const customer = { id: 'empty', username: 'Empty Customer', email: 'empty@example.com', avatar: null, locale: null, isActive: true, emailVerified: false, createdAt: '2026-10-15T00:00:00Z', updatedAt: '2026-10-15T00:00:00Z', orderCount: 0, paidTotal: 0, currency: 'USD', lastOrderAt: null };
  const initial = { success: true, data: { items: [{ ...customer, id: 'buyer', username: 'Buyer', email: 'buyer@example.com' }, customer], page: 1, limit: 20, total: 2, totalPages: 1, statusCounts: { all: 2, active: 2, inactive: 0 } } };
  const filtered = { success: true, data: { ...initial.data, items: [customer], total: 1, statusCounts: { all: 1, active: 1, inactive: 0 } } };
  let finishSearch!: (response: typeof filtered) => void;
  const pending = new Promise<typeof filtered>(resolve => { finishSearch = resolve; });
  transport.get.mockImplementation((_path: string, options: { params: { search?: string } }) => options.params.search ? pending : Promise.resolve(initial));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  const render = () => root.render(<QueryClientProvider client={client}><CustomersPage /></QueryClientProvider>);
  try {
    await act(async () => render());
    await act(async () => { await vi.waitFor(() => expect(client.getQueryCache().find({ queryKey: ['users'], exact: false })?.state.status).toBe('success')); });
    const table = container.querySelector('table')!, row = container.querySelector('tbody')!.lastElementChild;
    expect(table).not.toBeNull();
    const trigger = row!.querySelector<HTMLButtonElement>('button[aria-label="More actions: Empty Customer"]')!;
    await act(async () => trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    const menu = document.body.querySelector('[role="menu"]')!; expect(menu).not.toBeNull();
    route.query = 'search=empty@example.com';
    await act(async () => render());
    expect(transport.get).toHaveBeenCalledWith('/admin/users', { params: expect.objectContaining({ search: 'empty@example.com' }) });
    expect(client.getQueryCache().findAll({ queryKey: ['users'] }).some(query => query.state.status === 'pending')).toBe(true);
    expect(container.querySelector('table')).toBe(table);
    expect(container.querySelector('tbody')!.lastElementChild).toBe(row);
    expect(document.body.contains(menu)).toBe(true);
    expect(container.textContent).not.toContain('Loading customers');
    await act(async () => { finishSearch(filtered); await pending; });
    await vi.waitFor(async () => {
      await act(async () => {});
      expect(container.querySelector('tbody')!.children).toHaveLength(1);
    });
    expect(container.querySelector('table')).toBe(table);
    expect(document.body.contains(menu)).toBe(true);
  } finally { finishSearch(filtered); await act(async () => root.unmount()); container.remove(); client.clear(); transport.get.mockReset(); route.query = ''; vi.unstubAllGlobals(); }
});
