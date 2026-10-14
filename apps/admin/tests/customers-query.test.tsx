// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { useUsers, useCustomerNeighbors } from '../lib/hooks/use-api';

const transport = vi.hoisted(() => ({ get: vi.fn() }));
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
