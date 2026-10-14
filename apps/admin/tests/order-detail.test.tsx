// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import OrderDetailPage from '../app/[locale]/(themed)/orders/[id]/page';
import { ShipOrderDialog } from '../components/orders/ShipOrderDialog';
import { StoreTimeProvider } from '../lib/store-time';
import { merchant } from '../../../packages/shared/src/i18n/messages/en/merchant';

const state = vi.hoisted(() => ({ order: {} as any, neighbors: { position: 1, total: 1, previousId: null, nextId: null } as any, neighborQuery: {} as any, cancel: vi.fn(), payment: vi.fn(), ship: vi.fn(), refund: vi.fn(), deliver: vi.fn(), pending: false, error: null as unknown, refetch: vi.fn() }));
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'order-1' }) }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('shared/src/i18n/react', () => ({ useLocale: () => 'en', useT: () => (key: string, params?: Record<string, string | number>) => {
  const value = key.split('.').slice(1).reduce<any>((value, part) => value?.[part], merchant);
  return typeof value === 'string' ? value.replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? '{' + name + '}')) : key;
} }));
vi.mock('../lib/hooks/use-api', () => ({
  useOrder: () => ({ data: state.order, error: state.error, refetch: state.refetch }),
  useOrderNeighbors: (_id: string, query: unknown) => { state.neighborQuery = query; return { data: state.neighbors, refetch: vi.fn() }; },
  useDeliverOrder: () => ({ mutate: state.deliver, isPending: state.pending }),
  useShipOrder: () => ({ mutateAsync: state.ship, isPending: state.pending }),
  useRefundOrder: () => ({ mutateAsync: state.refund, isPending: state.pending }),
  useRecordManualPayment: () => ({ mutateAsync: state.payment, isPending: state.pending }),
  useCancelOrder: () => ({ mutateAsync: state.cancel, isPending: state.pending }),
  useResolvePaymentReview: () => ({ mutateAsync: vi.fn(), isPending: state.pending }),
}));
let root: Root | undefined;
async function mount(element: React.ReactNode = <OrderDetailPage />) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<StoreTimeProvider timezone="Asia/Shanghai" now="2026-10-13T00:00:00Z">{element}</StoreTimeProvider>));
  return container;
}
function button(name: string, scope: ParentNode = document.body) {
  const result = Array.from(scope.querySelectorAll('button')).find(button => button.textContent === name);
  if (!result) throw new Error('Missing button: ' + name); return result;
}
async function fill(id: string, value: string) {
  const input = document.getElementById(id)! as HTMLInputElement | HTMLTextAreaElement;
  await act(async () => { Object.getOwnPropertyDescriptor(input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
}
async function openAction(name: string) {
  const trigger = document.querySelector<HTMLButtonElement>('button[aria-label="More order actions"]')!;
  await act(async () => trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  const item = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(item => item.textContent === name)!;
  await act(async () => item.click());
}
beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks(); state.pending = false; state.error = null;
  state.neighbors = { position: 1, total: 1, previousId: null, nextId: null };
  state.order = { id: 'order-1', status: 'PROCESSING', paymentStatus: 'PAID', totalAmount: 25, currency: 'USD', createdAt: '2026-10-12T16:00:00Z',
    amounts: { subtotal: 20, shipping: 3, tax: 2, taxInclusive: true, total: 25 },
    customerOrderNumber: 1, customerOrderCount: 2, shipments: [],
    items: [{ id: 'item-1', productId: 'product-1', productName: 'Snapshot product', variantName: 'Snapshot variant', skuCode: 'SKU-1', quantity: 2, unitPrice: 10, totalPrice: 20 }],
    customer: { id: 'customer-1', username: 'buyer', email: 'buyer@example.test' }, shippingAddress: null, paymentReviews: [], refundResolutions: [],
    timeline: [{ at: '2026-10-12T17:00:00Z', fromStatus: 'PENDING', toStatus: 'PROCESSING', fromPaymentStatus: 'PENDING', toPaymentStatus: 'PAID', actorType: 'admin' }],
    canRecordManualPayment: false, canRefundOrder: true,
  };
});
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; document.body.innerHTML = ''; vi.unstubAllGlobals(); });
it('returns to the complete last list URL', async () => {
  const url = '/en/orders?status=PROCESSING&search=buyer&sortBy=totalAmount&sortOrder=asc&page=3&pageSize=50';
  sessionStorage.setItem('orders-list:en', url);
  const container = await mount();
  expect(container.querySelector('a')?.getAttribute('href')).toBe(url);
  expect(state.neighborQuery).toMatchObject({ status: 'PROCESSING', search: 'buyer', sortBy: 'totalAmount', sortOrder: 'asc' });
});
it('rejects an external return destination', async () => {
  sessionStorage.setItem('orders-list:en', 'https://example.invalid/en/orders');
  const container = await mount();
  expect(container.querySelector('a')?.getAttribute('href')).toBe('/en/orders');
});
const cases = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'].flatMap(status => [false, true].flatMap(canRecord => [false, true].flatMap(canRefund => ['PAID', 'PENDING'].map(payment => ({ status, canRecord, canRefund, payment })))));
it.each(cases)('preserves action gates: $status / $payment / manual=$canRecord / refund=$canRefund', async ({ status, canRecord, canRefund, payment }) => {
  Object.assign(state.order, { status, paymentStatus: payment, canRecordManualPayment: canRecord, canRefundOrder: canRefund });
  const container = await mount(), actions = container.querySelector('[aria-labelledby="actions-title"]')!;
  const labels = Array.from(actions.querySelectorAll('button')).map(button => button.textContent);
  const trigger = actions.querySelector<HTMLButtonElement>('button[aria-label="More order actions"]');
  if (trigger) {
    await act(async () => trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    labels.push(...Array.from(document.querySelectorAll('[role="menuitem"]')).map(item => item.textContent));
  }
  expect(labels.includes('Ship order')).toBe(status === 'PROCESSING');
  expect(labels.includes('Mark as delivered')).toBe(status === 'SHIPPED');
  expect(labels.includes('Record payment')).toBe(['PENDING', 'CANCELLED'].includes(status) && canRecord);
  expect(labels.includes('Refund')).toBe(canRefund && payment === 'PAID' && ['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].includes(status));
  expect(labels.includes('Cancel order')).toBe(status === 'PENDING');
  if (!labels.length) expect(actions.querySelector('button')).toBeNull();
});
it('renders snapshots, real amount components and exact store times without jargon', async () => {
  const container = await mount();
  expect(container.textContent).toContain('Snapshot product'); expect(container.textContent).toContain('Snapshot variant'); expect(container.textContent).toContain('SKU-1');
  expect(container.textContent).toContain('Tax (included)'); expect(container.textContent).toContain('$3.00'); expect(container.textContent).toContain('$2.00');
  expect(container.textContent).toContain('Placed 2026-10-13 00:00'); expect(container.textContent).toContain('All times in Asia/Shanghai');
  expect(container.textContent).toContain('Status changed to Processing'); expect(container.textContent).toContain('Payment status changed to Paid');
  expect(container.querySelector('a[href="/en/orders"]')).toBeTruthy();
  const customerLink = Array.from(container.querySelectorAll('a')).find(link => link.textContent === 'View all orders from this customer');
  expect(customerLink?.getAttribute('href')).toBe('/en/orders?customerId=customer-1&customerEmail=buyer%40example.test');
  expect(container.querySelector('a[href="/en/products/product-1/edit"]')).toBeTruthy();
  expect(container.textContent).not.toMatch(/Deployment Node|Matrix Payload|Command Center|Net Settlement|Sync Heartbeat|Print Manifest/);
  expect(container.textContent).not.toContain(merchant.orders.detailView.reviewNotice); expect(container.textContent).not.toContain(merchant.orders.detailView.refundNotice); expect(container.textContent).not.toContain(merchant.orders.detailView.unknownPayment);
});
it('shows only the matching review, refund, unknown and cancelled callouts', async () => {
  Object.assign(state.order, { status: 'CANCELLED', cancelledAt: '2026-10-12T18:00:00Z', paymentAttemptState: 'UNKNOWN', refundRequired: true,
    paymentReviews: [{ paymentId: 'review', status: 'REQUIRES_REVIEW', amount: 25, currency: 'USD', failureReason: 'query_budget_exhausted' }, { paymentId: 'closed', status: 'FAILED', reviewResolution: 'NOT_CHARGED' }],
    refundResolutions: [{ paymentId: 'extra', providerPaymentId: 'capture', amount: 5, currency: 'USD', status: 'pending' }],
  });
  const container = await mount();
  for (const key of ['reviewNotice', 'refundNotice', 'unknownPayment', 'noReason'] as const) expect(container.textContent).toContain(merchant.orders.detailView[key]);
  expect(container.textContent).toContain('Technical reason: query_budget_exhausted'); expect(container.textContent).toContain('Cancelled 2026-10-13 02:00');
  expect(Array.from(container.querySelectorAll('span')).some(span => span.textContent === 'Cancelled')).toBe(true);
  expect(Array.from(container.querySelectorAll('button')).filter(button => button.textContent === 'Confirm payment received')).toHaveLength(1);
});
it('labels canonical user activity as Customer and translates failed payment changes', async () => {
  state.order.timeline = [{ at: '2026-10-12T18:00:00Z', fromStatus: 'PENDING', toStatus: 'CANCELLED', fromPaymentStatus: 'PENDING', toPaymentStatus: 'FAILED', actorType: 'user' }];
  const container = await mount();
  const row = Array.from(container.querySelectorAll('li')).find(row => row.textContent?.includes('Status changed to Cancelled'))!;
  expect(row.textContent).toContain('Customer'); expect(row.textContent).not.toContain('System'); expect(row.textContent).toContain('Payment status changed to Failed');
});
it('renders creation once with its own actor and time, newest first, without unchanged rows', async () => {
  state.order.timeline = [
    { at: '2026-10-12T16:05:00Z', fromStatus: null, toStatus: 'PENDING', fromPaymentStatus: null, toPaymentStatus: 'PENDING', actorType: 'admin' },
    state.order.timeline[0],
    { at: '2026-10-12T18:00:00Z', fromStatus: 'PROCESSING', toStatus: 'PROCESSING', fromPaymentStatus: 'PAID', toPaymentStatus: 'PAID', actorType: 'system' },
  ];
  const container = await mount(), rows = Array.from(container.querySelectorAll('[aria-labelledby="activity-title"] li'));
  expect(rows).toHaveLength(2);
  expect(rows[0].textContent).toContain('Status changed to Processing'); expect(rows[0].textContent).toContain('Payment status changed to Paid');
  expect(rows[1].textContent).toBe('Order placedAdmin · 2026-10-13 00:05');
  expect(rows.filter(row => row.querySelector('p')?.textContent === 'Order placed')).toHaveLength(1);
  expect(container.textContent).not.toContain('Status changed to Pending'); expect(container.textContent).not.toContain('Payment status changed to Pending');
});
it.each([false, true])('appends one synthetic creation row when the timeline has no creation event (empty=%s)', async empty => {
  if (empty) state.order.timeline = [];
  const container = await mount(), rows = Array.from(container.querySelectorAll('[aria-labelledby="activity-title"] li'));
  expect(rows.filter(row => row.querySelector('p')?.textContent === 'Order placed')).toHaveLength(1);
  expect(rows.at(-1)?.textContent).toBe('Order placedCustomer · 2026-10-13 00:00');
});
it('labels the recorded cancellation reason', async () => {
  Object.assign(state.order, { status: 'CANCELLED', cancelReason: 'Customer requested cancellation' });
  expect((await mount()).textContent).toContain('Cancellation reason: Customer requested cancellation');
});
it.each([['cancel', 'Cancel order', 'cancelReason'], ['payment', 'Record payment', 'reference']])('requires trimmed %s dialog input and preserves its mutation payload', async (operation, name, id) => {
  Object.assign(state.order, { status: 'PENDING', paymentStatus: 'PENDING', canRecordManualPayment: true });
  await mount(); await openAction(name);
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(button(name, dialog).disabled).toBe(true);
  await fill(id, '   '); expect(button(name, dialog).disabled).toBe(true);
  await fill(id, '  proof  '); expect(button(name, dialog).disabled).toBe(false);
  if (operation === 'payment') expect((document.getElementById(id) as HTMLInputElement).maxLength).toBe(256);
  await act(async () => button(name, dialog).click());
  expect(operation === 'cancel' ? state.cancel : state.payment).toHaveBeenCalledWith({ id: 'order-1', [id]: 'proof' });
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});
it('validates shipment fields inline and sends the unchanged item quantities', async () => {
  await mount(<ShipOrderDialog order={state.order} open onOpenChange={vi.fn()} />);
  await act(async () => button('Ship order', document.querySelector('[role="dialog"]')!).click());
  expect(document.querySelector('[role="alert"]')?.textContent).toBe('Enter both the carrier and tracking number.'); expect(state.ship).not.toHaveBeenCalled();
  await fill('carrier', 'Carrier'); await fill('trackingNumber', 'TRACK-1');
  await act(async () => button('Ship order', document.querySelector('[role="dialog"]')!).click());
  expect(state.ship).toHaveBeenCalledWith({ id: 'order-1', data: { carrier: 'Carrier', trackingNumber: 'TRACK-1', items: [{ orderItemId: 'item-1', quantity: 2 }] } });
});
it('refetches an error and links back to the order list', async () => {
  state.error = new Error('Unavailable'); const container = await mount();
  expect(container.textContent).toContain('Could not load this order.'); await act(async () => button('Try again').click()); expect(state.refetch).toHaveBeenCalledOnce();
  expect(container.querySelector('a')?.getAttribute('href')).toBe('/en/orders');
});
it('states missing records plainly without assuming a digital order or an unpaid delivery', async () => {
  state.order.status = 'DELIVERED';
  const container = await mount();
  expect(container.textContent).toContain('No shipping address was provided.');
  expect(container.textContent).toContain('No shipment recorded.');
  expect(container.textContent).not.toContain('digital order');
  expect(container.textContent).not.toContain('Payment must be confirmed before shipment.');
});
it.each([true, false])('disables the unavailable neighbour at a list boundary (first=%s)', async first => {
  state.neighbors = { position: first ? 1 : 2, total: 2, previousId: first ? null : 'previous', nextId: first ? 'next' : null };
  sessionStorage.setItem('orders-list:en', '/en/orders?status=PROCESSING&sortOrder=asc');
  const container = await mount();
  expect(container.querySelector<HTMLButtonElement>('button[aria-label="' + (first ? 'Previous order' : 'Next order') + '"]')?.disabled).toBe(true);
  expect(container.querySelector('a[aria-label="' + (first ? 'Next order' : 'Previous order') + '"]')?.getAttribute('href')).toBe('/en/orders/' + (first ? 'next' : 'previous') + '?status=PROCESSING&sortOrder=asc');
});
it('copies id, full displayed address and tracking text without moving focus and reports clipboard failures', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  state.order.shippingAddress = { recipientName: 'Buyer', phone: '+1 555', street: '1 Road', street2: 'Unit 2', city: 'City', state: 'CA', zipCode: '12345', country: 'US' };
  state.order.shipments = [{ id: 's', carrier: 'Carrier', trackingNumber: 'A & B', status: 'SHIPPED', shippedAt: state.order.createdAt }];
  const container = await mount();
  for (const [label, value] of [['Copy order ID', 'order-1'], ['Copy shipping address including recipient and phone', 'Buyer · +1 555\n1 Road\nUnit 2\nCity CA 12345 · US'], ['Copy tracking number', 'A & B']]) {
    const control = container.querySelector<HTMLButtonElement>('button[aria-label="' + label + '"]')!; control.focus();
    await act(async () => control.click()); expect(writeText).toHaveBeenLastCalledWith(value); expect(document.activeElement).toBe(control);
    expect(control.parentElement?.textContent).toContain('Copied');
  }
  const link = container.querySelector('a[aria-label="Track shipment (opens in 17TRACK)"]')!;
  expect(link.getAttribute('href')).toBe('https://t.17track.net/en#nums=A%20%26%20B'); expect(link.getAttribute('target')).toBe('_blank'); expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  writeText.mockRejectedValue(new Error('Denied'));
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Copy order ID"]')!.click());
  expect(container.querySelector('[role="alert"]')?.textContent).toBe(merchant.orders.detailView.copyError);
});
