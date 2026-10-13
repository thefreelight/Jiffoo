// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import DashboardPage from '../app/[locale]/(themed)/dashboard/page';
import { StoreTimeProvider } from '../lib/store-time';
import { merchant as en } from '../../../packages/shared/src/i18n/messages/en/merchant';
import { merchant as hans } from '../../../packages/shared/src/i18n/messages/zh-Hans/merchant';
import { merchant as hant } from '../../../packages/shared/src/i18n/messages/zh-Hant/merchant';

const state = vi.hoisted(() => ({ result: {} as any, locale: 'en', refetch: vi.fn() }));
const messages = { en, 'zh-Hans': hans, 'zh-Hant': hant };
vi.mock('shared/src/i18n/react', () => ({ useLocale: () => state.locale, useT: () => (key: string, params?: Record<string, string | number>) => {
  const value = key.split('.').slice(1).reduce<any>((value, part) => value?.[part], messages[state.locale as keyof typeof messages]) ?? key;
  return typeof value === 'string' ? value.replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? '{' + name + '}')) : key;
} }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('../lib/hooks/use-api', () => ({ useAdminDashboard: () => ({ ...state.result, refetch: state.refetch }) }));
// The accessible sales table is tested independently of SVG layout in jsdom.
vi.mock('recharts', () => ({ ResponsiveContainer: ({ children }: any) => <div>{children}</div>, BarChart: () => <div aria-label="Sales chart" />, Bar: () => null, Cell: () => null, Tooltip: () => null, XAxis: () => null }));
let root: Root | undefined;
async function mount() {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<StoreTimeProvider timezone="Asia/Shanghai" now="2026-10-12T16:15:00Z"><DashboardPage /></StoreTimeProvider>));
  return container;
}
beforeEach(() => {
  state.locale = 'en'; state.refetch.mockClear();
  state.result = { data: {
    metrics: { currency: 'USD' }, today: { paidSales: 123.45, orders: 7, newCustomers: 2 }, yesterday: { paidSales: 20, orders: 3, newCustomers: 1 },
    attention: { paymentReviewCount: 4, toShipCount: 5 },
    dailySales: Array.from({ length: 14 }, (_, index) => ({ date: '2026-10-' + String(index + 1).padStart(2, '0'), paidSales: index === 13 ? 123.45 : 0, orders: index === 13 ? 7 : 0 })),
    recentOrders: [{ id: 'order-1', status: 'PROCESSING', paymentStatus: 'PAID', requiresPaymentReview: true, totalAmount: 123.45, currency: 'USD', createdAt: '2026-10-12T16:15:00Z', customer: { email: 'buyer@example.test' } }],
  } };
});
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; document.body.innerHTML = ''; vi.unstubAllGlobals(); });
it('shows real figures, attention links, store-local dates, review pills and an accessible 14-day summary', async () => {
  const container = await mount();
  expect(container.textContent).toContain('Tuesday, October 13, 2026 · Asia/Shanghai');
  expect(container.textContent).toContain('$123.45'); expect(container.textContent).toContain('Yesterday: $20.00');
  expect(container.textContent).toContain('Yesterday: 3'); expect(container.textContent).toContain('Yesterday: 1');
  expect(container.textContent).toContain('4 orders have payments that need manual review');
  expect(container.textContent).toContain('5 paid orders are waiting to ship');
  expect(container.querySelector('a[href="/en/orders?payment=review"]')?.textContent).toBe('Review payments');
  expect(container.querySelector('a[href="/en/orders?status=PROCESSING"]')?.textContent).toBe('View orders');
  expect(container.querySelector('table[aria-label="Sales, last 14 days"] tbody')?.children).toHaveLength(14);
  expect(container.textContent).toContain('Requires review'); expect(container.textContent).toContain('2026-10-13 00:15');
  expect(container.querySelector('article a')?.getAttribute('href')).toBe('/en/orders/order-1');
  expect(container.textContent).not.toMatch(/%|vs yesterday|Analytics|Ledger|No Signal/);
});
it.each(['en', 'zh-Hans', 'zh-Hant'])('renders quiet zero states and translated copy in %s', async locale => {
  state.locale = locale; state.result.data.attention = { paymentReviewCount: 0, toShipCount: 0 }; state.result.data.recentOrders = [];
  state.result.data.dailySales.forEach((day: any) => { day.paidSales = 0; day.orders = 0; });
  const container = await mount(), copy = messages[locale as keyof typeof messages].dashboard;
  expect(container.textContent).toContain(copy.title); expect(container.textContent).toContain(copy.nothingNeedsAttention);
  expect(container.textContent).toContain(copy.noSales); expect(container.textContent).toContain(copy.noOrders);
  expect(container.querySelector('a[href*="?payment="]')).toBeNull(); expect(container.querySelector('a[href*="?status="]')).toBeNull();
  expect(container.querySelector('[aria-label="Sales chart"]')).toBeNull(); expect(container.textContent).not.toContain('%');
});
it.each(['paymentReviewCount', 'toShipCount'])('hides only the zero attention row: %s', async key => {
  state.result.data.attention[key] = 0; const container = await mount();
  expect(container.textContent).not.toContain('Nothing needs your attention');
  expect(container.querySelector('a[href*="?payment="]') !== null).toBe(key !== 'paymentReviewCount');
  expect(container.querySelector('a[href*="?status="]') !== null).toBe(key !== 'toShipCount');
});
it('renders a quiet loading line', async () => {
  state.result = { isLoading: true }; const container = await mount(); expect(container.textContent).toBe('Loading overview…');
});
it('refetches after an error without reloading the page', async () => {
  state.result = { error: new Error('Unavailable') }; const container = await mount();
  expect(container.textContent).toContain('Could not load the overview.');
  await act(async () => container.querySelector('button')!.click()); expect(state.refetch).toHaveBeenCalledOnce();
});
