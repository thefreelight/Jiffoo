// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { merchant } from '../../../packages/shared/src/i18n/messages/en/merchant';
import { common } from '../../../packages/shared/src/i18n/messages/en/common';

const state = vi.hoisted(() => ({ url: '', calls: [] as any[], result: null as any, error: null as any }));

vi.mock('shared/src/i18n/react', () => {
  // The real useT is a stable useCallback: the identity must survive renders.
  const translate = (key: string, params?: Record<string, string | number>) => {
    const value = key.split('.').reduce<any>((object, part) => object?.[part], { merchant, common });
    return typeof value === 'string' ? value.replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? '{' + name + '}')) : key;
  };
  return { useLocale: () => 'en', useT: () => translate };
});
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/en/orders',
  useSearchParams: () => new URLSearchParams(state.url),
}));
vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    listPreferencesApi: {
      listViews: vi.fn(async () => ({ success: true, data: { views: [] } })),
      getPreference: vi.fn(async () => ({ success: true, data: { listKey: 'orders', columns: [] } })),
      setPreference: vi.fn(async () => ({ success: true, data: { listKey: 'orders', columns: [] } })),
    },
    ordersApi: { ...actual.ordersApi, print: vi.fn(async (body: any) => { state.calls.push(body); if (state.error) throw state.error; return state.result; }) },
    unwrapApiResponse: (response: any) => response.data,
  };
});
vi.mock('../lib/hooks/use-api', () => ({
  useOrders: () => ({ data: { data: [{ id: 'order-1', orderNumber: 'JF-20261012-0001', status: 'PENDING', paymentStatus: 'PENDING', requiresPaymentReview: true, itemQuantitySum: 5, itemsCount: 2, totalAmount: 50, currency: 'USD', createdAt: '2026-10-12T00:15:00Z', customer: { email: 'buyer@example.test' } }], pagination: { page: 1, limit: 20, total: 25, totalPages: 2 } } }),
  useOrderStats: () => ({ data: { paymentReviewCount: 0, metrics: { totalOrders: 25 }, statusCounts: { PENDING: 3, PROCESSING: 4, SHIPPED: 5, DELIVERED: 6, CANCELLED: 2, REFUNDED: 5 } } }),
}));

import OrdersPage from '../app/[locale]/(themed)/orders/page';
import OrderPrintPage from '../app/[locale]/(themed)/orders/print/page';

let root: Root | undefined;
async function mount(element: React.ReactNode) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root!.render(element));
  return container;
}
function button(text: string): HTMLButtonElement {
  const node = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(candidate => candidate.textContent?.startsWith(text) || candidate.getAttribute('aria-label') === text);
  if (!node) throw new Error('Missing button: ' + text);
  return node;
}

beforeEach(() => {
  state.url = '';
  state.calls = [];
  state.error = null;
  state.result = {
    matched: 1, truncated: false,
    orders: [{
      orderNumber: 'JF-20261012-0001', status: 'SHIPPED', paymentStatus: 'PAID', paymentMethod: 'card',
      createdAt: '2026-10-12T00:15:00Z', currency: 'USD',
      customer: { email: 'buyer@example.test', username: 'buyer', displayName: 'Buyer Example' },
      shippingAddress: { firstName: 'Ada', lastName: 'Byron', phone: '+1 555 0100', email: 'buyer@example.test', addressLine1: '1 Analytical Way', addressLine2: null, city: 'London', state: null, postalCode: 'EC1', country: 'GB' },
      items: [{ productName: 'Canvas bag', variantName: 'Standard', quantity: 2, unitPrice: 19.9, lineTotal: 39.8 }],
      amounts: { subtotalAmount: 39.8, shippingAmount: 0, taxAmount: 0, taxInclusive: false, totalAmount: 39.8 },
      shipment: { carrier: 'DHL', trackingNumber: 'TRACK-1', shippedAt: '2026-10-12T02:00:00Z' },
      paymentRequiresReview: false,
    }],
  };
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

it('puts the selected order ids into the print link', async () => {
  const container = await mount(<OrdersPage />);
  await act(async () => container.querySelector<HTMLInputElement>('input[aria-label="Select order JF-20261012-0001"]')!.click());
  const link = container.querySelector<HTMLAnchorElement>('a[href*="/orders/print"]');
  expect(link?.getAttribute('href')).toBe('/en/orders/print?ids=order-1');
});

it('puts the matching filter and the excluded ids into the print link', async () => {
  state.url = 'status=SHIPPED';
  const container = await mount(<OrdersPage />);
  await act(async () => container.querySelector<HTMLInputElement>('input[aria-label="Select all orders on this page"]')!.click());
  await act(async () => button('Select all 25 matching orders').click());
  await act(async () => container.querySelector<HTMLInputElement>('input[aria-label="Select order JF-20261012-0001"]')!.click());
  const link = container.querySelector<HTMLAnchorElement>('a[href*="/orders/print"]');
  expect(link?.getAttribute('href')).toContain('match=1');
  expect(link?.getAttribute('href')).toContain('status=SHIPPED');
  expect(link?.getAttribute('href')).toContain('exclude=order-1');
});

it('renders the printed orders of the payload and reports the truncation', async () => {
  state.url = 'ids=order-1';
  state.result = { ...state.result, truncated: true };
  const container = await mount(<OrderPrintPage />);
  await act(async () => new Promise(resolve => setTimeout(resolve, 0)));
  expect(state.calls[0]).toEqual({ selection: { mode: 'ids', ids: ['order-1'] }, sort: { sortBy: 'createdAt', sortOrder: 'desc' } });
  expect(container.textContent).toContain('JF-20261012-0001');
  expect(container.textContent).toContain('Canvas bag');
  expect(container.textContent).toContain('Standard');
  expect(container.textContent).toContain('$39.80');
  expect(container.textContent).toContain('Buyer Example');
  expect(container.textContent).toContain('1 Analytical Way');
  expect(container.textContent).toContain('DHL');
  expect(container.textContent).toContain('TRACK-1');
  expect(container.textContent).toContain('Only the first 200 orders are shown.');
  expect(container.querySelector('[data-print-document]')).toBeTruthy();
});

it('rebuilds the filter selection from the print URL', async () => {
  state.url = 'match=1&status=SHIPPED&payment=paid&search=buyer&exclude=order-1';
  await mount(<OrderPrintPage />);
  await act(async () => new Promise(resolve => setTimeout(resolve, 0)));
  expect(state.calls[0]).toEqual({
    selection: { mode: 'filter', filter: { status: 'SHIPPED', search: 'buyer', customerId: undefined, paymentStatus: 'PAID', paymentReview: undefined, createdFrom: undefined, createdTo: undefined }, excludeIds: ['order-1'] },
    sort: { sortBy: 'createdAt', sortOrder: 'desc' },
  });
});

it('reports a failed print request instead of swallowing it', async () => {
  state.url = 'ids=order-1';
  state.error = { code: 'FORBIDDEN', status: 403 };
  const container = await mount(<OrderPrintPage />);
  await act(async () => new Promise(resolve => setTimeout(resolve, 0)));
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('Access forbidden');
});
