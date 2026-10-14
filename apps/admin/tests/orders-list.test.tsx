// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import OrdersPage from '../app/[locale]/(themed)/orders/page';
import { StoreTimeProvider } from '../lib/store-time';
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
vi.mock('../lib/hooks/use-api', () => ({ useOrders: (params: any) => { state.params = params; return state.data; }, useOrderStats: () => state.stats }));
let root: Root | undefined;
async function mount() {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<StoreTimeProvider timezone="Asia/Shanghai" now="2026-10-12T00:00:00Z"><OrdersPage /></StoreTimeProvider>));
  return container;
}
function button(text: string): HTMLButtonElement {
  const button = Array.from(document.querySelectorAll('button')).find(button => button.textContent?.startsWith(text) || button.getAttribute('aria-label') === text);
  if (!button) throw new Error('Missing button: ' + text); return button;
}
beforeEach(() => {
  state.locale = 'en'; state.url = ''; state.replace.mockClear();
  state.data = { data: { data: [{ id: 'order-1', status: 'PENDING', paymentStatus: 'PENDING', requiresPaymentReview: true, itemQuantitySum: 5, itemsCount: 2, totalAmount: 50, currency: 'USD', createdAt: '2026-10-12T00:15:00Z', customer: { email: 'buyer@example.test' } }], pagination: { page: 1, limit: 20, total: 25, totalPages: 2 } } };
  state.stats = { data: { paymentReviewCount: 1, metrics: { totalOrders: 25 }, statusCounts: { PENDING: 3, PROCESSING: 4, SHIPPED: 5, DELIVERED: 6, CANCELLED: 2, REFUNDED: 5 } } };
});
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; document.body.innerHTML = ''; vi.unstubAllGlobals(); vi.useRealTimers(); });
it('shows global status counts, the quantity sum, an absolute store-time header and named mobile details', async () => {
  const container = await mount();
  expect(Array.from(container.querySelectorAll('[role="tab"]')).map(tab => tab.textContent)).toEqual(['All25', 'Pending3', 'Processing4', 'Shipped5', 'Delivered6', 'Cancelled2', 'Refunded5']);
  expect(container.querySelector('thead')?.textContent).toContain('Placed at (Asia/Shanghai)');
  expect(container.querySelector('tbody')?.textContent).toContain('5 items');
  expect(container.querySelector('tbody')?.textContent).toContain('2026-10-12 08:15');
  const card = container.querySelector('article')!;
  expect(card.parentElement?.className).toContain('min-[769px]:hidden');
  expect(card.textContent).toContain('5 items'); expect(card.textContent).toContain('buyer@example.test'); expect(card.textContent).toContain('Requires review');
  expect(card.querySelector('a')?.getAttribute('aria-label')).toBe('View order order-1');
  expect(card.querySelector('a')?.getAttribute('href')).toBe('/en/orders/order-1');
  expect(container.textContent).toContain('1–20 of 25');
  expect(container.textContent).not.toMatch(/Transaction|Ledger|vs yesterday|Stable/);
});
it('wires tabs, review banner, supported payment options, search and pagination to the list query', async () => {
  await mount();
  await act(async () => button('Next').click()); expect(state.params.page).toBe(2);
  await act(async () => button('Shipped').click()); expect(state.params).toMatchObject({ status: 'SHIPPED', page: 1, limit: 20 });
  await act(async () => button('Review payments').click()); expect(state.params).toMatchObject({ status: undefined, paymentReview: 'required', paymentStatus: undefined, page: 1 });
  const select = document.querySelector('select')!;
  expect(Array.from(select.options).map(option => option.text)).toEqual(['All', 'Paid', 'Unpaid', 'Requires review', 'Refunded']);
  for (const value of ['PAID', 'UNPAID', 'REFUNDED', 'All']) {
    await act(async () => { select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); });
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
