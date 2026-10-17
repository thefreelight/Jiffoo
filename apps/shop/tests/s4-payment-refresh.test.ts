// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { PaymentRefresh } from '../components/payment-refresh';
import type { Order } from '../lib/checkout-types';

const state = vi.hoisted(() => ({ fetch: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: state.refresh }) }));
vi.mock('../lib/client-availability', () => ({ availabilityFetch: state.fetch, useShopAvailability: () => ({ message: '', capture: vi.fn() }) }));
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });
it('waits five seconds, backs off and refreshes only after the real order changes, then cancels on unmount', async () => {
  vi.useFakeTimers();
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  const order = { id: 'order', paymentId: 'payment', status: 'PENDING', paymentStatus: 'PENDING', paymentAttemptState: 'REQUIRES_REVIEW' } as Order;
  state.fetch.mockImplementation(async (url: string) => new Response(JSON.stringify({ data: url.includes('/orders/') ? order : {} })));
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(PaymentRefresh, { order, locale: 'en' })));
    await act(async () => vi.advanceTimersByTimeAsync(4999)); expect(state.fetch).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(1)); expect(state.fetch).toHaveBeenCalledTimes(2); expect(state.refresh).not.toHaveBeenCalled();
    state.fetch.mockImplementation(async (url: string) => new Response(JSON.stringify({ data: url.includes('/orders/') ? { ...order, paymentStatus: 'PAID', paymentAttemptState: 'SUCCEEDED' } : {} })));
    await act(async () => vi.advanceTimersByTimeAsync(10000)); expect(state.refresh).toHaveBeenCalledTimes(1);
  } finally { await act(async () => root.unmount()); container.remove(); }
  const count = state.fetch.mock.calls.length;
  await vi.advanceTimersByTimeAsync(60000); expect(state.fetch).toHaveBeenCalledTimes(count);
});
