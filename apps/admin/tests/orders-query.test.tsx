// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { ordersApi } from '../lib/api';
import { useOrders, useResolvePaymentReview, useRecordManualPayment, useDeliverOrder } from '../lib/hooks/use-api';

const transport = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('shared', async importOriginal => ({ ...await importOriginal<typeof import('shared')>(), createAdminClient: () => ({ get: transport.get }) }));

it('forwards payment and review filters through the query hook to the API client', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const get = transport.get.mockResolvedValue({ success: true, data: { items: [], page: 1, limit: 20, total: 0, totalPages: 0 } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const container = document.createElement('div'), root = createRoot(container);
  function Probe() { useOrders({ page: 1, limit: 20, status: 'PENDING', search: 'buyer', customerId: 'customer-1', paymentStatus: 'UNPAID', paymentReview: 'required', sortBy: 'totalAmount', sortOrder: 'asc' }, () => ({ createdFrom: '2026-10-13T16:00:00.000Z', createdTo: '2026-10-14T16:00:00.000Z' })); return null; }
  try {
    await act(async () => root.render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>));
    expect(get).toHaveBeenCalledWith('/admin/orders', { params: { page: 1, limit: 20, status: 'PENDING', search: 'buyer', customerId: 'customer-1', paymentStatus: 'UNPAID', paymentReview: 'required', sortBy: 'totalAmount', sortOrder: 'asc', createdFrom: '2026-10-13T16:00:00.000Z', createdTo: '2026-10-14T16:00:00.000Z' } });
  } finally { await act(async () => root.unmount()); client.clear(); get.mockReset(); vi.unstubAllGlobals(); }
});
it.each(['review', 'manual', 'deliver'])('invalidates order counts after %s changes', async operation => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  client.setQueryData(['order-stats'], { paymentReviewCount: 1 });
  const spies = [vi.spyOn(ordersApi, 'resolvePaymentReview'), vi.spyOn(ordersApi, 'recordManualPayment'), vi.spyOn(ordersApi, 'deliverOrder')];
  for (const spy of spies) spy.mockResolvedValue({ success: true, data: {} } as any);
  const container = document.createElement('div'), root = createRoot(container);
  let mutate: () => Promise<unknown>;
  function Probe() {
    const review = useResolvePaymentReview(), manual = useRecordManualPayment(), deliver = useDeliverOrder();
    const trigger = () => operation === 'review' ? review.mutateAsync({ id: 'one', paymentId: 'payment', outcome: 'NOT_CHARGED', reference: 'proof' }) : operation === 'manual' ? manual.mutateAsync({ id: 'one', reference: 'proof' }) : deliver.mutateAsync('one');
    useEffect(() => { mutate = trigger; });
    return null;
  }
  try {
    await act(async () => root.render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>));
    await act(async () => { await mutate(); });
    expect(client.getQueryState(['order-stats'])?.isInvalidated).toBe(true);
  } finally { await act(async () => root.unmount()); client.clear(); spies.forEach(spy => spy.mockRestore()); vi.unstubAllGlobals(); }
});
