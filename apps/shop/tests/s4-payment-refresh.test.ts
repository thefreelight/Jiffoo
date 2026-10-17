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
it('polls every five seconds without silently stopping after a refresh, then cancels on unmount', async () => {
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
    await act(async () => vi.advanceTimersByTimeAsync(5000)); expect(state.refresh).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(300000)); expect(state.refresh).toHaveBeenCalledTimes(61);
  } finally { await act(async () => root.unmount()); container.remove(); }
  const count = state.fetch.mock.calls.length;
  await vi.advanceTimersByTimeAsync(60000); expect(state.fetch).toHaveBeenCalledTimes(count);
});

it('pauses while hidden, refetches immediately on visibility and focus, and removes both listeners on unmount', async () => {
  vi.useFakeTimers();
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  const order = { id: 'manual', paymentId: 'payment', paymentInstructions: 'Pay manually.', status: 'PENDING', paymentStatus: 'PENDING', paymentAttemptState: 'PENDING' } as Order;
  state.fetch.mockImplementation(async () => new Response(JSON.stringify({ data: order })));
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(PaymentRefresh, { order, locale: 'en' })));
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    await act(async () => vi.advanceTimersByTimeAsync(300000)); expect(state.fetch).not.toHaveBeenCalled();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    expect(state.fetch).toHaveBeenCalledTimes(1);
    await act(async () => window.dispatchEvent(new Event('focus')));
    expect(state.fetch).toHaveBeenCalledTimes(2);
    expect(state.fetch.mock.calls.every(([url, init]) => url === '/bff/orders/manual' && init.cache === 'no-store')).toBe(true);
    await act(async () => vi.advanceTimersByTimeAsync(5000)); expect(state.fetch).toHaveBeenCalledTimes(3);
  } finally { await act(async () => root.unmount()); container.remove(); }
  await act(async () => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); await vi.advanceTimersByTimeAsync(60000); });
  expect(state.fetch).toHaveBeenCalledTimes(3);
});

it('still reads the real order when provider verification fails', async () => {
  vi.useFakeTimers();
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  const order = { id: 'order', paymentId: 'payment', status: 'PENDING', paymentStatus: 'PENDING', paymentAttemptState: 'PENDING' } as Order;
  state.fetch.mockImplementation(async (url: string) => url.includes('/verify/') ? new Response('{}', { status: 503 }) : new Response(JSON.stringify({ data: { ...order, paymentStatus: 'PAID' } })));
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(PaymentRefresh, { order, locale: 'en' })));
    await act(async () => vi.advanceTimersByTimeAsync(5000)); expect(state.refresh).toHaveBeenCalledOnce();
  } finally { await act(async () => root.unmount()); container.remove(); }
});
