// @vitest-environment jsdom
import { merchant } from '../../../packages/shared/src/i18n/messages/en/merchant';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import OrderDetailPage from '@/app/[locale]/(themed)/orders/[id]/page';
import { RefundDialog } from '@/components/orders/RefundDialog';
import type { AdminOrderDetailDTO } from 'shared';

const state = vi.hoisted(() => ({ mutateAsync: vi.fn(), order: {} as any }));
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'order-1' }), useRouter: () => ({ back: vi.fn() }) }));
vi.mock('shared/src/i18n/react', () => ({ useLocale: () => 'en', useT: () => (key: string, params?: Record<string, string | number>) => { const value = key.split('.').slice(1).reduce<any>((value, part) => value?.[part], merchant); return typeof value === 'string' ? value.replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? '{' + name + '}')) : key; } }));
vi.mock('@/lib/hooks/use-api', () => ({
  useOrder: () => ({ data: state.order, refetch: vi.fn() }),
  useOrderNeighbors: () => ({ data: { position: 1, total: 1, previousId: null, nextId: null }, refetch: vi.fn() }),
  useRecordManualPayment: () => ({}), useDeliverOrder: () => ({}), useCancelOrder: () => ({}),
  useRefundOrder: () => ({ mutateAsync: state.mutateAsync, isPending: false }),
}));
vi.mock('@/components/orders/ShipOrderDialog', () => ({ ShipOrderDialog: () => null }));
const mounted: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = [];
async function render(element: React.ReactNode) {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = createRoot(container); mounted.push({ root, container });
  await act(async () => root.render(element)); return container;
}
afterEach(async () => {
  for (const { root, container } of mounted.splice(0)) { await act(async () => root.unmount()); container.remove(); }
  vi.clearAllMocks();
});
const order = { id: 'order-1', orderNumber: 'JF-20261010-0001', userId: 'user-1', status: 'PROCESSING', paymentStatus: 'PAID', totalAmount: 20, amounts: { subtotal: 20, shipping: 0, tax: 0, taxInclusive: false, total: 20 }, timeline: [],
  currency: 'USD', customerOrderNumber: 1, customerOrderCount: 1, shippingAddress: null, createdAt: '2026-10-10T00:00:00Z', updatedAt: '2026-10-10T00:00:00Z', items: [],
  customer: { id: 'user-1', email: 'buyer@example.test', username: 'buyer' },
} satisfies AdminOrderDetailDTO;
it.each([
  ['UNKNOWN', "We're still confirming this payment with the provider."],
  ['REQUIRES_REVIEW', merchant.orders.detailView.reviewNotice],
])('shows the approved %s payment warning', async (paymentAttemptState, expected) => {
  state.order = { ...order, paymentAttemptState, paymentReviews: paymentAttemptState === 'REQUIRES_REVIEW' ? [{ paymentId: 'review', status: 'REQUIRES_REVIEW', amount: 20, currency: 'USD' }] : [] }; const container = await render(<OrderDetailPage />);
  expect(container.textContent).toContain(expected);
});
it('shows pending and resolved extra refunds and offers an action only for the pending payment', async () => {
  state.order = { ...order, refundRequired: true, refundResolutions: [
    { paymentId: 'pending-payment', providerPaymentId: 'capture-1', amount: 30, currency: 'USD', status: 'pending', reference: null },
    { paymentId: 'resolved-payment', providerPaymentId: 'capture-2', amount: 20, currency: 'USD', status: 'resolved', reference: 'offline-proof' },
  ] };
  const container = await render(<OrderDetailPage />);
  expect(container.textContent).toContain(merchant.orders.detailView.refundNotice); expect(container.textContent).toContain('Refund recorded');
  expect(container.textContent).toContain('offline-proof');
  const actions = Array.from(container.querySelectorAll('button')).filter(button => button.textContent === 'Record offline refund');
  expect(actions).toHaveLength(1);
  await act(async () => actions[0].click());
  expect((document.getElementById('refund-amount') as HTMLInputElement).value).toContain('30');
});
it('requires a trimmed reference and sends the selected payment rather than an order refund', async () => {
  state.mutateAsync.mockResolvedValue(order);
  await render(<RefundDialog order={order} payment={{ paymentId: 'extra-payment', providerPaymentId: 'capture-3', amount: 30, currency: 'USD' }} open onOpenChange={vi.fn()} />);
  const confirm = Array.from(document.body.querySelectorAll('button')).find(button => button.textContent?.includes('Record refund'))!;
  expect(confirm.disabled).toBe(true);
  const reference = document.getElementById('refund-reference') as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(reference, '  offline-proof  ');
    reference.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(confirm.disabled).toBe(false);
  await act(async () => confirm.click());
  expect(state.mutateAsync).toHaveBeenCalledWith({ id: order.id, paymentId: 'extra-payment', providerPaymentId: 'capture-3', data: {
    reason: '', reference: 'offline-proof', idempotencyKey: expect.any(String),
  } });
});
