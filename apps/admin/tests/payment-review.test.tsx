// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import OrderDetailPage from '@/app/[locale]/(themed)/orders/[id]/page';
import { AdminApiError } from '@/lib/api';

const state = vi.hoisted(() => ({ mutateAsync: vi.fn(), order: {} as any }));
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'order-1' }), useRouter: () => ({ back: vi.fn() }) }));
vi.mock('shared/src/i18n/react', () => ({ useT: () => (key: string) => key }));
vi.mock('@/lib/hooks/use-api', () => ({
  useOrder: () => ({ data: state.order, refetch: vi.fn() }),
  useRecordManualPayment: () => ({}), useDeliverOrder: () => ({}), useCancelOrder: () => ({}), useRefundOrder: () => ({}),
  useResolvePaymentReview: () => ({ mutateAsync: state.mutateAsync, isPending: false }),
}));
vi.mock('@/components/orders/ShipOrderDialog', () => ({ ShipOrderDialog: () => null }));
vi.mock('@/components/orders/RefundDialog', () => ({ RefundDialog: () => null }));
const mounted: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = [];
async function render() {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = createRoot(container); mounted.push({ root, container });
  await act(async () => root.render(<OrderDetailPage />));
}
function button(name: string, scope: ParentNode = document.body): HTMLButtonElement {
  const match = Array.from(scope.querySelectorAll('button')).find(value => value.textContent === name);
  if (!match) throw new Error('Missing accessible button: ' + name);
  return match;
}
async function enterReference(value: string) {
  const input = document.getElementById('payment-review-reference') as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
afterEach(async () => {
  for (const { root, container } of mounted.splice(0)) { await act(async () => root.unmount()); container.remove(); }
  vi.resetAllMocks();
});
function reviewOrder() {
  state.order = { id: 'order-1', status: 'PENDING', paymentStatus: 'PENDING', totalAmount: 20, currency: 'USD',
    createdAt: '2026-10-10T00:00:00Z', items: [], customer: { email: 'buyer@example.test' }, paymentAttemptState: 'REQUIRES_REVIEW',
    paymentReviews: [{ paymentId: 'review-1', status: 'REQUIRES_REVIEW', amount: 20, currency: 'USD', failureReason: 'query_budget_exhausted', reviewResolution: null }],
  };
}
it.each([
  ['PAID', 'Confirm payment received', 'Provider transaction or payment ID'],
  ['NOT_CHARGED', 'Confirm not charged and close', 'Evidence reference'],
])('requires a separate %s dialog and a trimmed reference before explicit confirmation', async (outcome, title, label) => {
  reviewOrder(); state.mutateAsync.mockResolvedValue(state.order); await render();
  expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  await act(async () => button(title).click());
  expect(state.mutateAsync).not.toHaveBeenCalled();
  const dialog = document.body.querySelector('[role="dialog"]')!;
  expect(dialog.textContent).toContain(label);
  const confirm = button(title, dialog);
  expect(confirm.disabled).toBe(true);
  await enterReference('   '); expect(confirm.disabled).toBe(true);
  await enterReference('  provider-proof  '); expect(confirm.disabled).toBe(false);
  await act(async () => confirm.click());
  expect(state.mutateAsync).toHaveBeenCalledWith({ id: 'order-1', paymentId: 'review-1', outcome, reference: 'provider-proof' });
  expect(document.body.querySelector('[role="dialog"]')).toBeNull();
});
it('keeps the dialog and entered reference open while showing the stable conflict error', async () => {
  reviewOrder(); state.mutateAsync.mockRejectedValue(new AdminApiError('PRIVATE_DETAIL', 'PAYMENT_REVIEW_ALREADY_RESOLVED', undefined, 409));
  await render(); await act(async () => button('Confirm payment received').click());
  await enterReference('provider-proof');
  await act(async () => button('Confirm payment received', document.body.querySelector('[role="dialog"]')!).click());
  expect(document.body.querySelector('[role="alert"]')?.textContent).toBe('Payment review has already been resolved. Refresh the order to see the current outcome.');
  expect(document.body.textContent).not.toContain('PRIVATE_DETAIL');
  expect((document.getElementById('payment-review-reference') as HTMLInputElement).value).toBe('provider-proof');
});
