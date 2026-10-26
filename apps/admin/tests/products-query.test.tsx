// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { productsApi } from '../lib/api';
import { useProducts, useCategories, useCreateProduct, useUpdateProduct, useDeleteProduct } from '../lib/hooks/use-api';
const transport = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('shared', async original => ({ ...await original<typeof import('shared')>(), createAdminClient: () => ({ get: transport.get }) }));
vi.mock('shared/src/i18n/react', () => ({ useT: () => (key: string) => key }));
it('forwards product status, category and search through the hook to the transport', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  transport.get.mockResolvedValue({ success: true, data: { items: [], page: 1, limit: 20, total: 0, totalPages: 0 } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }), root = createRoot(document.createElement('div'));
  function Probe() { useProducts({ page: 1, limit: 20, status: 'inactive', categoryId: 'books', search: 'novel', sortBy: 'price', sortOrder: 'asc' }); return null; }
  try { await act(async () => root.render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>)); expect(transport.get).toHaveBeenCalledWith('/admin/products', { params: { page: 1, limit: 20, status: 'inactive', categoryId: 'books', search: 'novel', productType: undefined, sortBy: 'price', sortOrder: 'asc' } }); }
  finally { await act(async () => root.unmount()); client.clear(); transport.get.mockReset(); vi.unstubAllGlobals(); }
});
it('loads real categories beyond the first page', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const spy = vi.spyOn(productsApi, 'getCategories').mockResolvedValueOnce({ success: true, data: { items: [{ id: 'one', name: 'First' }], totalPages: 2 } } as any).mockResolvedValueOnce({ success: true, data: { items: [{ id: 'two', name: 'Second' }], totalPages: 2 } } as any);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }), root = createRoot(document.createElement('div'));
  function Probe() { useCategories(); return null; }
  try { await act(async () => root.render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>)); await vi.waitFor(() => expect(client.getQueryData(['categories'])).toEqual([{ id: 'one', name: 'First' }, { id: 'two', name: 'Second' }])); expect(spy).toHaveBeenNthCalledWith(2, 2, 100); }
  finally { await act(async () => root.unmount()); client.clear(); spy.mockRestore(); vi.unstubAllGlobals(); }
});
it.each(['create', 'update', 'delete'])('invalidates product lists and counts after %s', async operation => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  client.setQueryData(['products', { status: 'active' }], {}); client.setQueryData(['product-stats'], {});
  const spies = [vi.spyOn(productsApi, 'create'), vi.spyOn(productsApi, 'update'), vi.spyOn(productsApi, 'delete')]; spies.forEach(spy => spy.mockResolvedValue({ success: true, data: {} } as any));
  const root = createRoot(document.createElement('div')); let mutate: () => Promise<unknown>;
  function Probe() { const create = useCreateProduct(), update = useUpdateProduct(), remove = useDeleteProduct(); const trigger = () => operation === 'create' ? create.mutateAsync({ name: 'Book' }) : operation === 'update' ? update.mutateAsync({ id: 'one', data: { isActive: false } }) : remove.mutateAsync('one'); useEffect(() => { mutate = trigger; }); return null; }
  try { await act(async () => root.render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>)); await act(async () => { await mutate(); }); expect(client.getQueryState(['products', { status: 'active' }])?.isInvalidated).toBe(true); expect(client.getQueryState(['product-stats'])?.isInvalidated).toBe(true); }
  finally { await act(async () => root.unmount()); client.clear(); spies.forEach(spy => spy.mockRestore()); vi.unstubAllGlobals(); }
});
