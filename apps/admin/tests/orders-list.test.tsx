// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import OrdersPage from '../app/[locale]/(themed)/orders/page';
import { StoreTimeProvider, useStoreDate } from '../lib/store-time';
import { ordersApi } from '../lib/api';
import { merchant as en } from '../../../packages/shared/src/i18n/messages/en/merchant';
import { merchant as hans } from '../../../packages/shared/src/i18n/messages/zh-Hans/merchant';
import { merchant as hant } from '../../../packages/shared/src/i18n/messages/zh-Hant/merchant';

const state = vi.hoisted(() => ({ params: {} as any, locale: 'en', data: {} as any, stats: {} as any, url: '', replace: vi.fn() }));
const messages = { en, 'zh-Hans': hans, 'zh-Hant': hant };
vi.mock('shared/src/i18n/react', () => ({ useLocale: () => state.locale, useT: () => (key: string, params?: Record<string, string | number>) => {
  const value = key.split('.').slice(1).reduce<any>((value, part) => value?.[part], messages[state.locale as keyof typeof messages]) ?? key;
  return typeof value === 'string' ? value.replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? '{' + name + '}')) : key;
} }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: state.replace }), usePathname: () => '/en/orders', useSearchParams: () => new URLSearchParams(state.url) }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('../lib/hooks/use-api', () => ({ useOrders: (params: any) => {
  state.params = params;
  if (!state.data.data) return state.data;
  const data = state.data.data;
  const secondPage = data.data.map((order: any) => ({ ...order, id: order.id + '-page-2', orderNumber: order.orderNumber + '-P2' }));
  return { ...state.data, data: { ...data, data: params.limit >= 50 ? [...data.data, ...secondPage] : params.page === 2 ? secondPage : data.data, pagination: { ...data.pagination, page: params.page, limit: params.limit } } };
}, useOrderStats: () => state.stats }));
let root: Root | undefined;
let setStoreTimezone: (timezone: string) => void;
function StoreTimezoneControl() { setStoreTimezone = useStoreDate().setTimezone; return null; }
function Page() { return <StoreTimeProvider timezone="Asia/Shanghai" now="2026-10-12T00:00:00Z"><StoreTimezoneControl /><OrdersPage /></StoreTimeProvider>; }
async function mount() {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<Page />));
  return container;
}
function button(text: string): HTMLButtonElement {
  const button = Array.from(document.querySelectorAll('button')).find(button => button.textContent?.startsWith(text) || button.getAttribute('aria-label') === text);
  if (!button) throw new Error('Missing button: ' + text); return button;
}
async function chooseFilter(label: string, text: string) {
  const trigger = document.querySelector<HTMLButtonElement>('button[aria-label="' + label + '"]')!;
  await act(async () => trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  const options = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitemradio"]'));
  const names = options.map(option => option.textContent);
  const option = options.find(option => option.textContent === text); if (!option) throw new Error('Missing option ' + text);
  await act(async () => option.click()); return names;
}
beforeEach(() => {
  state.locale = 'en'; state.url = ''; state.replace.mockClear();
  state.data = { data: { data: [{ id: 'order-1', orderNumber: 'JF-20261012-0001', status: 'PENDING', paymentStatus: 'PENDING', requiresPaymentReview: true, itemQuantitySum: 5, itemsCount: 2, totalAmount: 50, currency: 'USD', createdAt: '2026-10-12T00:15:00Z', customer: { email: 'buyer@example.test' } }], pagination: { page: 1, limit: 20, total: 25, totalPages: 2 } } };
  state.stats = { data: { paymentReviewCount: 1, metrics: { totalOrders: 25 }, statusCounts: { PENDING: 3, PROCESSING: 4, SHIPPED: 5, DELIVERED: 6, CANCELLED: 2, REFUNDED: 5 } } };
});
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; document.body.innerHTML = ''; vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks(); });
it('shows global status counts, the quantity sum, an absolute store-time header and named mobile details', async () => {
  const container = await mount();
  expect(Array.from(container.querySelectorAll('[role="tab"]')).map(tab => tab.textContent)).toEqual(['All25', 'Pending3', 'Processing4', 'Shipped5', 'Delivered6', 'Cancelled2', 'Refunded5']);
  expect(container.querySelector('thead')?.textContent).toContain('Placed at (Asia/Shanghai)');
  expect(container.querySelector('tbody')?.textContent).toContain('5 items');
  expect(container.querySelector('tbody')?.textContent).toContain('2026-10-12 08:15');
  const card = container.querySelector('article')!;
  expect(card.parentElement?.className).toContain('min-[769px]:hidden');
  expect(card.textContent).toContain('5 items'); expect(card.textContent).toContain('buyer@example.test'); expect(card.textContent).toContain('Requires review');
  expect(card.querySelector('a')?.getAttribute('aria-label')).toBe('View order JF-20261012-0001');
  expect(card.querySelector('a')?.getAttribute('href')).toBe('/en/orders/order-1');
  expect(container.textContent).toContain('1–20 of 25');
  expect(container.textContent).not.toMatch(/Transaction|Ledger|vs yesterday|Stable/);
});
it('wires tabs, review banner, supported payment options, search and pagination to the list query', async () => {
  await mount();
  await act(async () => button('Next').click()); expect(state.params.page).toBe(2);
  await act(async () => button('Shipped').click()); expect(state.params).toMatchObject({ status: 'SHIPPED', page: 1, limit: 20 });
  await act(async () => button('Review payments').click()); expect(state.params).toMatchObject({ status: undefined, paymentReview: 'required', paymentStatus: undefined, page: 1 });
  for (const value of ['PAID', 'UNPAID', 'REFUNDED', 'All']) {
    const names = await chooseFilter('Payment', value === 'PAID' ? 'Paid' : value === 'UNPAID' ? 'Unpaid' : value === 'REFUNDED' ? 'Refunded' : 'All');
    expect(names).toEqual(['All', 'Paid', 'Unpaid', 'Requires review', 'Refunded']);
    expect(state.params.paymentStatus).toBe(value === 'All' ? undefined : value); expect(state.params.paymentReview).toBeUndefined();
  }
  const input = document.querySelector<HTMLInputElement>('input[placeholder]')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'buyer@example.test'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(state.params.search).toBe('');
  await act(async () => new Promise(resolve => setTimeout(resolve, 320)));
  expect(state.params).toMatchObject({ search: 'buyer@example.test', page: 1 });
});
it.each([0, undefined])('does not invent a review banner when the count is %s', async count => {
  state.stats = { data: count === undefined ? undefined : { ...state.stats.data, paymentReviewCount: count } };
  await mount(); expect(document.body.textContent).not.toContain('Review payments');
  expect(document.body.textContent).not.toContain('will not ship');
});
it('moves focus and status selection with keyboard arrows and End', async () => {
  const container = await mount(), tabs = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  tabs[0].focus();
  await act(async () => tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
  expect(document.activeElement).toBe(tabs[1]); expect(state.params.status).toBe('PENDING'); expect(tabs[1].getAttribute('aria-selected')).toBe('true');
  await act(async () => tabs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })));
  expect(document.activeElement).toBe(tabs[6]); expect(state.params.status).toBe('REFUNDED');
});
it.each(['en', 'zh-Hans', 'zh-Hant'])('renders approved review copy and an honest empty state in %s', async locale => {
  state.locale = locale; state.data.data.data = [];
  const container = await mount(), copy = messages[locale as keyof typeof messages].orders.list;
  expect(container.textContent).toContain(copy.reviewBanner.replace('{count}', '1'));
  expect(container.textContent).toContain(copy.empty);
});

it.each([
  ['status=PROCESSING&payment=review', 'PROCESSING', undefined, 'required'],
  ['status=SHIPPED&payment=paid', 'SHIPPED', 'PAID', undefined],
  ['status=CANCELLED&payment=unpaid', 'CANCELLED', 'UNPAID', undefined],
  ['status=REFUNDED&payment=refunded', 'REFUNDED', 'REFUNDED', undefined],
  ['status=invalid&payment=invalid', undefined, undefined, undefined],
])('reads supported URL filters and ignores invalid values: %s', async (url, status, paymentStatus, paymentReview) => {
  state.url = url; await mount();
  expect(state.params).toMatchObject({ status, paymentStatus, paymentReview, page: 1 });
});
it('replaces the URL while preserving other query parameters', async () => {
  state.url = 'source=overview'; await mount();
  await act(async () => button('Processing').click());
  expect(state.replace).toHaveBeenLastCalledWith('/en/orders?source=overview&status=PROCESSING', { scroll: false });
  await act(async () => button('Review payments').click());
  expect(state.replace).toHaveBeenLastCalledWith('/en/orders?source=overview&payment=review', { scroll: false });
});
it('shows the exact customer filter as a removable email chip', async () => {
  state.url = 'customerId=customer-1&customerEmail=buyer%40example.test';
  await mount(); expect(state.params.customerId).toBe('customer-1');
  const remove = document.querySelector<HTMLButtonElement>('button[aria-label="Remove filter: Customer buyer@example.test"]')!;
  expect(remove).toBeTruthy(); await act(async () => remove.click());
  expect(state.params.customerId).toBeUndefined();
  expect(state.replace).toHaveBeenLastCalledWith('/en/orders', { scroll: false });
});
it('preserves matching-order exclusions through pagination, sorting and page size in the export request', async () => {
  const exportOrders = vi.spyOn(ordersApi, 'export').mockRejectedValue(new Error('Unavailable'));
  const node = await mount();
  await act(async () => node.querySelector<HTMLInputElement>('input[aria-label="Select all orders on this page"]')!.click());
  await act(async () => button('Select all 25 matching orders').click());
  await act(async () => node.querySelector<HTMLInputElement>('input[aria-label="Select order JF-20261012-0001"]')!.click());
  await act(async () => button('Next').click());
  expect(state.params.page).toBe(2); expect(node.textContent).toContain('All 24 orders selected');
  const secondOrder = node.querySelector<HTMLInputElement>('input[aria-label="Select order JF-20261012-0001-P2"]')!;
  expect(secondOrder.checked).toBe(true);
  await act(async () => secondOrder.click());
  expect(node.textContent).toContain('All 23 orders selected');
  await act(async () => node.querySelector<HTMLButtonElement>('thead th[aria-sort="none"] button')!.click());
  expect(state.params).toMatchObject({ sortBy: 'totalAmount', sortOrder: 'asc', page: 1 });
  expect(node.querySelector<HTMLInputElement>('input[aria-label="Select order JF-20261012-0001"]')!.checked).toBe(false);
  await chooseFilter(en.orders.list.perPage, '50');
  expect(state.params.limit).toBe(50); expect(node.textContent).toContain('All 23 orders selected');
  expect(node.querySelector<HTMLInputElement>('input[aria-label="Select order JF-20261012-0001-P2"]')!.checked).toBe(false);
  await act(async () => button(en.orders.list.exportSelected).click());
  expect(exportOrders).toHaveBeenLastCalledWith({ mode: 'filter', filter: { status: undefined, search: '', customerId: undefined, paymentStatus: undefined, paymentReview: undefined }, excludeIds: ['order-1', 'order-1-page-2'] }, { sortBy: 'totalAmount', sortOrder: 'asc' }, 'en');
});
it('preserves explicit order IDs through pagination, sorting, page size and a display-only customer email change', async () => {
  const exportOrders = vi.spyOn(ordersApi, 'export').mockRejectedValue(new Error('Unavailable'));
  state.url = 'customerId=customer-1&customerEmail=first%40example.test';
  const node = await mount();
  await act(async () => node.querySelector<HTMLInputElement>('input[aria-label="Select order JF-20261012-0001"]')!.click());
  await act(async () => button('Next').click());
  expect(state.params).toMatchObject({ page: 2, customerId: 'customer-1' });
  const secondOrder = node.querySelector<HTMLInputElement>('input[aria-label="Select order JF-20261012-0001-P2"]')!;
  expect(secondOrder.checked).toBe(false);
  expect(node.textContent).toContain('1 orders selected');
  await act(async () => secondOrder.click());
  expect(node.textContent).toContain('2 orders selected');
  await act(async () => button(en.orders.list.previous).click());
  expect(node.querySelector<HTMLInputElement>('input[aria-label="Select order JF-20261012-0001"]')!.checked).toBe(true);
  await act(async () => node.querySelector<HTMLButtonElement>('thead th[aria-sort="none"] button')!.click());
  expect(state.params).toMatchObject({ sortBy: 'totalAmount', sortOrder: 'asc', page: 1, customerId: 'customer-1' });
  await chooseFilter(en.orders.list.perPage, '50');
  expect(state.params).toMatchObject({ page: 1, limit: 50, customerId: 'customer-1' });
  state.url = 'customerId=customer-1&customerEmail=second%40example.test&sortBy=totalAmount&sortOrder=asc&pageSize=50';
  await act(async () => root!.render(<Page />));
  expect(node.textContent).toContain('2 orders selected');
  expect(node.querySelector<HTMLInputElement>('input[aria-label="Select order JF-20261012-0001"]')!.checked).toBe(true);
  expect(node.querySelector<HTMLInputElement>('input[aria-label="Select order JF-20261012-0001-P2"]')!.checked).toBe(true);
  await act(async () => button(en.orders.list.exportSelected).click());
  expect(exportOrders).toHaveBeenLastCalledWith({ mode: 'ids', ids: ['order-1', 'order-1-page-2'] }, { sortBy: 'totalAmount', sortOrder: 'asc' }, 'en');
});
it.each(['status=SHIPPED', 'payment=paid', 'search=buyer', 'customerId=customer-1', 'date=custom&start=2026-10-12&end=2026-10-12', 'date=custom'])('clears order selection when effective filters or date validity change: %s', async url => {
  const node = await mount();
  await act(async () => node.querySelector<HTMLInputElement>('input[aria-label="Select order JF-20261012-0001"]')!.click());
  state.url = url; await act(async () => root!.render(<Page />));
  expect(node.querySelector('[role="region"][aria-label="Bulk actions"]')).toBeNull();
});
it('clears selected orders when the store timezone changes the effective UTC date range', async () => {
  state.url = 'date=custom&start=2026-10-12&end=2026-10-12';
  const node = await mount();
  expect(state.params.createdFrom).toBe('2026-10-11T16:00:00.000Z');
  await act(async () => node.querySelector<HTMLInputElement>('input[aria-label="Select order JF-20261012-0001"]')!.click());
  await act(async () => setStoreTimezone('America/New_York'));
  expect(state.params.createdFrom).toBe('2026-10-12T04:00:00.000Z');
  expect(node.querySelector('[role="region"][aria-label="Bulk actions"]')).toBeNull();
});
it('clears selected orders when a relative date preset crosses the store calendar day', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-12T00:00:00Z'));
  state.url = 'date=today'; const node = await mount();
  await act(async () => node.querySelector<HTMLInputElement>('input[aria-label="Select order JF-20261012-0001"]')!.click());
  vi.setSystemTime(new Date('2026-10-13T00:00:00Z'));
  await act(async () => root!.render(<Page />));
  expect(state.params.createdFrom).toBe('2026-10-12T16:00:00.000Z');
  expect(node.querySelector('[role="region"][aria-label="Bulk actions"]')).toBeNull();
});
it('keeps typing immediate and resets pagination only when the 300ms debounce completes', async () => {
  vi.useFakeTimers(); await mount();
  await act(async () => button('Next').click());
  const input = document.querySelector<HTMLInputElement>('input[placeholder]')!;
  const type = async (text: string) => act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await type('bu');
  await act(async () => vi.advanceTimersByTime(200));
  await type('buyer');
  expect(input.value).toBe('buyer'); expect(state.params.search).toBe(''); expect(state.params.page).toBe(2);
  await act(async () => vi.advanceTimersByTime(299));
  expect(state.params.search).toBe('');
  await act(async () => vi.advanceTimersByTime(1));
  expect(state.params).toMatchObject({ search: 'buyer', page: 1 });
});
