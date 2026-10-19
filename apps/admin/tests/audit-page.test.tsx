// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AuditEventsPage from '@/app/[locale]/(themed)/audit-events/page';
const mock = vi.hoisted(() => ({ list: vi.fn(), filters: vi.fn(), replace: vi.fn(), query: '' }));
vi.mock('shared/src/i18n/react', async () => { const { translate } = await import('./helpers/operations'); return { useLocale: () => 'en', useT: () => translate }; });
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mock.replace }), usePathname: () => '/en/audit-events', useSearchParams: () => new URLSearchParams(mock.query) }));
vi.mock('@/lib/audit-events', async original => ({ ...await original<typeof import('@/lib/audit-events')>(), auditEventsApi: mock }));
const item = { id: 'event-one', createdAt: '2026-10-13T00:00:00Z', action: 'STORE_TIMEZONE_CHANGED', actorId: 'owner', actor: { username: 'Owner', email: 'owner@example.com' }, targetType: 'settings', targetId: 'localization.timezone', summary: { from: 'UTC', to: 'Asia/Shanghai' } };
let root: Root, container: HTMLDivElement;
beforeEach(() => { vi.clearAllMocks(); mock.query = ''; (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; mock.filters.mockResolvedValue({ actions: [], targetTypes: [], actors: [{ id: 'owner', username: 'Owner', email: 'owner@example.com' }] }); mock.list.mockResolvedValue({ items: [item], total: 1, totalPages: 1 }); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function render() { await act(async () => root.render(<AuditEventsPage />)); }
async function click(name: string) { const button = [...document.querySelectorAll('button')].find(element => element.textContent === name || element.getAttribute('aria-label') === name); expect(button).toBeDefined(); await act(async () => button!.click()); }
it.each([
  ['ADMIN_INVITED', 'Administrator invited'], ['ADMIN_REINVITED', 'Administrator re-invited'],
  ['ADMIN_REMOVED', 'Administrator removed'], ['ADMIN_INVITE_ACCEPTED', 'Administrator accepted invitation'],
  ['THEME_UNSIGNED_INSTALL_CONFIRMED', 'Unsigned theme installation confirmed'], ['BUILTIN_PLUGIN_INSTALLED', 'Built-in plugin installed'],
])('shows historical staff action %s with its target snapshot', async (action, label) => {
  mock.list.mockResolvedValue({ items: [{ ...item, action, targetType: 'staff', targetLabel: 'Past Staff · past@example.com', actor: null, actorId: 'system' }], total: 1, totalPages: 1 });
  await render(); expect(container.textContent).toContain(label);
  expect(container.textContent).toContain('Past Staff · past@example.com');
  expect(container.textContent).toContain('System');
});
it('does not invent target links and renders verified context with payment facts', async () => {
  mock.list.mockResolvedValue({ items: [{ ...item, context: { path: '/orders/real-order', label: 'JF-20261013-0001' }, paymentContext: { amount: '459.00', currency: 'CNY', attemptNumber: 2 }, summary: { orderId: 'real-order', version: '2.3.1', revision: 6 } }], total: 1, totalPages: 1 });
  await render(); await click('Expand: Store timezone changed');
  expect(container.querySelector('a[href="/en/orders/real-order"]')).not.toBeNull();
  expect(container.textContent).toContain('CNY 459.00');
  expect(container.textContent).toContain('Payment attempt 2');
  expect(container.textContent).toContain('2.3.1');
  expect(container.textContent).toContain('JF-20261013-0001');
  expect(container.textContent).not.toContain('real-order');
});
it.each([
  ['customer.deactivated', 'Customer deactivated'], ['customer.reactivated', 'Customer reactivated'],
  ['customer.renamed', 'Customer renamed'], ['customer.deleted', 'Customer deleted'],
])('shows customer action %s in the accounts category with recorded facts', async (action, label) => {
  mock.query = 'category=accounts';
  mock.list.mockResolvedValue({ items: [{ ...item, action, targetType: 'customer', targetId: 'past-customer', targetLabel: 'New Name · customer@example.com', summary: { email: 'customer@example.com', username: 'New Name', from: 'Old Name', to: 'New Name' } }], total: 1, totalPages: 1 });
  await render();
  expect(mock.list).toHaveBeenCalledWith(1, expect.objectContaining({ category: 'accounts' }), 20);
  expect(container.textContent).toContain(label);
  expect(container.textContent).toContain('Administrators and accounts');
  expect(container.textContent).toContain('New Name · customer@example.com');
  await click(`Expand: ${label}`);
  expect(container.textContent).toContain('Old Name');
  expect(container.textContent).toContain('New Name');
  expect(container.textContent).toContain('customer@example.com');
});
it('opens human facts and then literal technical details on desktop and phone', async () => { await render(); await click('Expand: Store timezone changed'); expect(container.textContent).toContain('Before'); expect(container.textContent).toContain('Asia/Shanghai'); await click('Technical details (raw record) ›'); expect(container.querySelector('pre')!.textContent).toContain('"from": "UTC"'); expect(container.textContent).toContain('Owner'); });
it.each([['NOTIFICATION_RESENT', 'Notification resent'], ['CUSTOMER_PASSWORD_RESET_LINK_GENERATED', 'Customer password reset link generated'], ['PAYMENT_REVIEW_CONFIRMED_PAID', 'Confirmed payment received']])('uses a merchant-readable label for %s', async (action, label) => { mock.list.mockResolvedValue({ items: [{ ...item, action }], total: 1, totalPages: 1 }); await render(); expect(container.textContent).toContain(label); expect(container.textContent).not.toContain(action); });
it('restores filters, page size and sort from the URL and removes chips', async () => { mock.query = 'category=settings&actorId=owner&page=2&pageSize=50&sort=oldest'; await render(); expect(mock.list).toHaveBeenCalledWith(2, expect.objectContaining({ category: 'settings', actorId: 'owner', sort: 'oldest' }), 50); await click('Remove filter: Shop settings'); expect(mock.replace.mock.calls.at(-1)![0]).not.toContain('category='); });
it('shows load failure and retries, then shows a genuine empty state', async () => { mock.list.mockRejectedValueOnce(new Error()); await render(); expect(container.textContent).toContain('Unable to load audit log'); mock.list.mockResolvedValueOnce({ items: [], total: 0, totalPages: 0 }); await click('Retry'); expect(container.textContent).toContain('No audit records yet'); expect(container.querySelector('nav')).not.toBeNull(); });
it('rejects reversed time ranges without calling the API', async () => { mock.query = 'from=2026-10-14T00:00&to=2026-10-13T00:00'; await render(); expect(container.textContent).toContain('Enter a valid time range.'); expect(mock.list).not.toHaveBeenCalled(); });
it('exports all matching pages and reports export failure', async () => { const create = vi.fn(() => 'blob:audit'); URL.createObjectURL = create; URL.revokeObjectURL = vi.fn(); const clickLink = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {}); await render(); mock.list.mockResolvedValueOnce({ items: [item], total: 101, totalPages: 2 }).mockResolvedValueOnce({ items: [{ ...item, id: 'two' }], total: 101, totalPages: 2 }); await click('Export'); expect(mock.list).toHaveBeenLastCalledWith(2, expect.any(Object), 100); expect(create).toHaveBeenCalled(); expect(clickLink).toHaveBeenCalled(); mock.list.mockRejectedValueOnce(new Error()); await click('Export'); expect(container.textContent).toContain('Unable to export audit log'); clickLink.mockRestore(); });
