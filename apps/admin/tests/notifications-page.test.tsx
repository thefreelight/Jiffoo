// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import NotificationsPage from '@/app/[locale]/(themed)/notifications/page';
import { completedAttempts } from '@/lib/notification-attempts';
const mock = vi.hoisted(() => ({ getAll: vi.fn(), getById: vi.fn(), resend: vi.fn(), replace: vi.fn(), push: vi.fn(), query: '' }));
it.each([['SENT', 0, 1], ['SENT', 2, 3], ['PENDING', 0, 0], ['PENDING', 2, 2], ['SENDING', 2, 2], ['FAILED', 5, 5]] as const)('counts completed outcomes for %s with %s recorded failures', (status, attempts, expected) => {
  expect(completedAttempts({ status, attempts })).toBe(expected);
});
vi.mock('shared/src/i18n/react', async () => { const { translate } = await import('./helpers/operations'); return { useLocale: () => 'en', useT: () => translate }; });
vi.mock('next/navigation', () => ({ usePathname: () => '/en/notifications', useSearchParams: () => new URLSearchParams(mock.query), useRouter: () => ({ replace: mock.replace, push: mock.push }) }));
vi.mock('@/lib/api', () => ({ notificationsApi: mock, unwrapApiResponse: <T,>(response: { data: T }) => response.data }));
const item = { id: 'one', type: 'order_confirmation', toAddress: 'buyer@example.com', subject: 'Your order', text: 'Hello {{secret.link}}', status: 'SENT', attempts: 1, createdAt: '2026-10-13T00:00:00Z', sentAt: '2026-10-13T00:01:00Z', nextAttemptAt: '2026-10-13T00:02:00Z', providerSlug: 'console-email', recipientUserId: 'buyer' };
let container: HTMLDivElement, root: Root;
beforeEach(() => { vi.clearAllMocks(); mock.query = ''; vi.spyOn(window.history, 'replaceState').mockImplementation((data, unused, url) => { mock.replace(data, unused, url); mock.query = String(url).split('?')[1] ?? ''; }); (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; mock.getAll.mockResolvedValue({ data: { items: [item], total: 1, totalPages: 1, counts: { all: 1, SENT: 1, FAILED: 0 }, types: ['order_confirmation'] } }); mock.getById.mockResolvedValue({ data: item }); mock.resend.mockResolvedValue({ data: { ...item, id: 'two', status: 'PENDING' } }); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); });
async function render() { await act(async () => root.render(<NotificationsPage />)); }
async function click(name: string) { const button = [...document.querySelectorAll('button')].find(element => element.textContent === name || element.getAttribute('aria-label') === name); expect(button).toBeDefined(); await act(async () => button!.click()); }
async function open() { await act(async () => container.querySelector('tbody tr')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))); }
it('opens and closes a detail identity in history while preserving list filters', async () => {
  mock.query = 'status=SENT&page=2';
  await render(); await open();
  expect(mock.push).toHaveBeenLastCalledWith('/en/notifications?status=SENT&page=2&notificationId=one', { scroll: false });
  await click('Close');
  expect(mock.push).toHaveBeenLastCalledWith('/en/notifications?status=SENT&page=2', { scroll: false });
});
it('restores an initial detail link and retries a failed detail without clearing its identity', async () => {
  mock.query = 'notificationId=one&search=buyer';
  mock.getById.mockRejectedValueOnce(new Error());
  await render();
  expect(document.body.textContent).toContain('Unable to load notification details');
  await click('Retry');
  expect(mock.getById).toHaveBeenLastCalledWith('one');
  expect(document.body.textContent).toContain('[One-time link hidden]');
  expect(mock.push).not.toHaveBeenCalled();
});
it('follows browser history changes and closes when the detail identity disappears', async () => {
  mock.query = 'notificationId=one'; await render();
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  mock.query = ''; vi.spyOn(window.history, 'replaceState').mockImplementation((data, unused, url) => { mock.replace(data, unused, url); mock.query = String(url).split('?')[1] ?? ''; }); await render();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  mock.query = 'notificationId=one'; await render();
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
});
it('loads real counts, desktop rows and phone cards and resends from the detail drawer', async () => { await render(); expect(container.textContent).toContain('buyer@example.com'); expect(container.querySelector('.md\\:hidden')).not.toBeNull(); await open(); expect(document.body.textContent).toContain('[One-time link hidden]'); await click('Resend'); expect(mock.resend).toHaveBeenCalledWith('one', expect.any(String)); expect(document.body.textContent).toContain('Email queued'); expect(mock.getAll).toHaveBeenCalledTimes(2); });
it.each(['PENDING', 'SENDING', 'SENT', 'FAILED'])('restores the %s tab, filters, sort and pagination from the URL', async status => { mock.query = `status=${status}&search=buyer&type=order_confirmation&sort=oldest&page=2&pageSize=50`; await render(); expect(mock.getAll).toHaveBeenCalledWith(2, 50, status, { search: 'buyer', type: 'order_confirmation', sort: 'oldest' }); await click('Remove filter: buyer'); expect(mock.replace).toHaveBeenLastCalledWith(null, '', expect.stringContaining('pageSize=50')); expect(mock.replace.mock.calls.at(-1)![2]).not.toContain('search='); });
it('shows empty and failed load states without fake counts', async () => { mock.getAll.mockRejectedValueOnce(new Error()); await render(); expect(container.textContent).toContain('Unable to load notifications'); await click('Retry'); expect(container.textContent).toContain('buyer@example.com'); mock.getAll.mockResolvedValueOnce({ data: { items: [], total: 0, counts: { all: 0 }, types: [] } }); await click('Pending—'); expect(container.textContent).toContain('No notifications yet'); });
it('retains detail after resend failure and reuses its idempotency key', async () => { mock.resend.mockRejectedValueOnce(new Error()); await render(); await open(); await click('Resend'); expect(document.body.textContent).toContain('Unable to queue email'); await click('Resend'); expect(mock.resend.mock.calls[0][1]).toBe(mock.resend.mock.calls[1][1]); });
it.each([['password_reset', 'SENT'], ['order_confirmation', 'PENDING'], ['order_confirmation', 'SENDING']])('disables resend for %s in %s', async (type, status) => { mock.getById.mockResolvedValue({ data: { ...item, type, status } }); await render(); await open(); const button = [...document.querySelectorAll('button')].find(value => value.textContent === 'Resend')!; expect(button.disabled).toBe(true); expect(mock.resend).not.toHaveBeenCalled(); });
it('shows failed delivery evidence and handles detail request failure', async () => { mock.getById.mockRejectedValueOnce(new Error()); await render(); await open(); expect(document.body.textContent).toContain('Unable to load notification details'); await click('Close'); mock.getById.mockResolvedValue({ data: { ...item, status: 'FAILED', attempts: 5, lastError: '550 mailbox rejected' } }); await open(); expect(document.body.textContent).toContain('550 mailbox rejected'); expect(document.body.textContent).toContain('Automatic retries have stopped.'); });
const refunded = { ...item, id: 'refund', type: 'refunded', toAddress: 'refund-buyer@e2e.example', subject: 'Order refunded' };
it.each(['success', 'failure'])('does not let a late resend %s overwrite another history detail', async outcome => {
  let resolveResend!: (value: unknown) => void, rejectResend!: (error: Error) => void;
  mock.resend.mockReturnValueOnce(new Promise((resolve, reject) => { resolveResend = resolve; rejectResend = reject; }));
  await render(); await open(); await click('Resend');
  mock.query = 'notificationId=refund';
  mock.getById.mockResolvedValueOnce({ data: refunded });
  await render();
  await act(async () => { if (outcome === 'success') resolveResend({ data: { ...item, status: 'PENDING' } }); else rejectResend(new Error()); });
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(dialog.textContent).toContain('refund-buyer@e2e.example');
  expect(dialog.textContent).not.toContain('Email queued');
  expect(dialog.textContent).not.toContain('Unable to queue email');
  expect(mock.push).toHaveBeenCalledTimes(1);
});
it('does not reopen a history-closed detail when a resend finishes', async () => {
  let resolveResend!: (value: unknown) => void;
  mock.resend.mockReturnValueOnce(new Promise(resolve => { resolveResend = resolve; }));
  mock.query = 'notificationId=one'; await render(); await click('Resend');
  mock.query = ''; await render();
  await act(async () => { resolveResend({ data: { ...item, id: 'two', status: 'PENDING' } }); });
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(mock.push).not.toHaveBeenCalled();
});
it('preserves the latest history filters when a pending resend finishes on the same detail', async () => {
  let resolveResend!: (value: unknown) => void;
  mock.resend.mockReturnValueOnce(new Promise(resolve => { resolveResend = resolve; }));
  mock.query = 'notificationId=one&status=SENT&page=2';
  await render(); await click('Resend');
  mock.query = 'notificationId=one&status=FAILED&search=latest&type=order_confirmation&sort=oldest&page=3&pageSize=50';
  await render();
  await act(async () => { resolveResend({ data: { ...item, id: 'two', status: 'PENDING' } }); });
  expect(mock.push).toHaveBeenLastCalledWith('/en/notifications?notificationId=two&status=FAILED&search=latest&type=order_confirmation&sort=oldest&page=3&pageSize=50', { scroll: false });
  expect(mock.getById).toHaveBeenCalledTimes(1);
});
it('tracks the resent identity in history and polls it to a final status without reloading detail', async () => {
  vi.useFakeTimers();
  try {
    const filters = 'status=SENT&search=buyer&type=order_confirmation&sort=oldest&page=2&pageSize=50';
    mock.query = filters + '&notificationId=one';
    await render(); await click('Resend');
    expect(mock.push).toHaveBeenLastCalledWith('/en/notifications?' + filters + '&notificationId=two', { scroll: false });
    expect(mock.getById).toHaveBeenCalledTimes(1);
    mock.query = filters + '&notificationId=two'; await render();
    expect(mock.getById).toHaveBeenCalledTimes(1);
    const resend = () => [...document.querySelectorAll('button')].find(value => value.textContent === 'Resend')!;
    expect(resend().disabled).toBe(true);
    mock.getById.mockResolvedValue({ data: { ...item, id: 'two', status: 'SENT' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(mock.getById).toHaveBeenLastCalledWith('two');
    expect(resend().disabled).toBe(false);
    const calls = mock.getById.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(4_000); });
    expect(mock.getById).toHaveBeenCalledTimes(calls);
    mock.query = filters + '&notificationId=one'; await render();
    expect(mock.getById).toHaveBeenLastCalledWith('one');
  } finally { vi.useRealTimers(); }
});
const snapshot = (items: Array<typeof item>) => ({ data: { items, total: items.length, counts: { all: items.length, SENT: items.length, FAILED: 0 }, types: ['order_confirmation'] } });
it('shows a notification that arrives after the first snapshot without a manual reload', async () => {
  vi.useFakeTimers();
  try {
    mock.getAll.mockResolvedValueOnce(snapshot([item]));
    await render();
    expect(container.textContent).not.toContain('refund-buyer@e2e.example');
    mock.getAll.mockResolvedValueOnce(snapshot([refunded, item]));
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    await act(async () => {});
    expect(container.textContent).toContain('refund-buyer@e2e.example');
  } finally { vi.useRealTimers(); }
});
it('stops polling once the page unmounts', async () => {
  vi.useFakeTimers();
  const ownContainer = document.createElement('div'); document.body.append(ownContainer);
  const ownRoot = createRoot(ownContainer);
  try {
    await act(async () => ownRoot.render(<NotificationsPage />));
    const calls = mock.getAll.mock.calls.length;
    await act(async () => ownRoot.unmount());
    await act(async () => { await vi.advanceTimersByTimeAsync(6_000); });
    expect(mock.getAll).toHaveBeenCalledTimes(calls);
  } finally { ownContainer.remove(); vi.useRealTimers(); }
});
it('keeps a newer result when a poll response arrives late', async () => {
  vi.useFakeTimers();
  try {
    await render();
    let resolvePoll!: (value: unknown) => void;
    mock.getAll.mockReturnValueOnce(new Promise(resolve => { resolvePoll = resolve; }));
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    mock.getAll.mockResolvedValueOnce(snapshot([{ ...item, toAddress: 'fresh-buyer@example.com' }]));
    await open();
    await click('Resend');
    await act(async () => {});
    expect(container.textContent).toContain('fresh-buyer@example.com');
    await act(async () => { resolvePoll(snapshot([{ ...item, toAddress: 'stale-buyer@example.com' }])); });
    expect(container.textContent).toContain('fresh-buyer@example.com');
    expect(container.textContent).not.toContain('stale-buyer@example.com');
  } finally { vi.useRealTimers(); }
});
it('follows the status of an open notification that is still being sent', async () => {
  vi.useFakeTimers();
  try {
    mock.getById.mockResolvedValueOnce({ data: { ...item, status: 'SENDING' } });
    await render();
    await open();
    const resend = () => [...document.querySelectorAll('button')].find(value => value.textContent === 'Resend')!;
    // While the notification is still being sent the resend stays disabled.
    expect(resend().disabled).toBe(true);
    mock.getById.mockResolvedValue({ data: { ...item, status: 'SENT' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    await act(async () => {});
    // The open detail follows the status, so the resend becomes available.
    expect(resend().disabled).toBe(false);
    // A final status is not read again.
    const calls = mock.getById.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(6_000); });
    expect(mock.getById).toHaveBeenCalledTimes(calls);
  } finally { vi.useRealTimers(); }
});
it('stops reading the open detail once the sheet is closed', async () => {
  vi.useFakeTimers();
  try {
    mock.getById.mockResolvedValueOnce({ data: { ...item, status: 'SENDING' } });
    await render();
    await open();
    await click('Close');
    const calls = mock.getById.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(6_000); });
    expect(mock.getById).toHaveBeenCalledTimes(calls);
  } finally { vi.useRealTimers(); }
});
