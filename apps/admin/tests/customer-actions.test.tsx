// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { CustomerActions } from '../components/customers/customer-actions';
import { merchant } from '../../../packages/shared/src/i18n/messages/en/merchant';
import type { Customer } from '../lib/types';

vi.mock('shared/src/i18n/react', () => ({ useLocale: () => 'en', useT: () => (key: string, values?: Record<string, string | number>) => {
  const name = key.split('.').at(-1) as keyof typeof merchant.customers.workspace;
  return merchant.customers.workspace[name].replace(/\{(\w+)\}/g, (_, value) => String(values?.[value] ?? ''));
} }));
vi.mock('../lib/hooks/use-api', () => ({ useUpdateUser: () => ({ isPending: false, mutateAsync: vi.fn() }), useDeleteUser: () => ({ isPending: false }) }));
it.each([0, 3])('keeps menu actions separate from row navigation and explains deletion with %s orders', async orderCount => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container), onRow = vi.fn(), onDelete = vi.fn();
  const customer = { id: 'one', username: 'Buyer', email: 'buyer@example.com', isActive: true, orderCount } as Customer;
  try {
    await act(async () => root.render(<table><tbody><tr onClick={onRow}><td><CustomerActions customer={customer} onDelete={onDelete} /></td></tr></tbody></table>));
    const trigger = container.querySelector<HTMLButtonElement>('button[aria-label="More actions: Buyer"]')!;
    await act(async () => trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    const item = Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(item => item.textContent?.startsWith('Delete customer'))!;
    expect(item).toBeDefined();
    onRow.mockClear();
    if (orderCount) {
      expect(item.getAttribute('aria-disabled')).toBe('true');
      expect(item.textContent).toContain('Has 3 orders and cannot be deleted. Deactivate instead; orders will be kept.');
    } else {
      await act(async () => item.click());
      expect(onDelete).toHaveBeenCalledTimes(1); expect(onRow).not.toHaveBeenCalled();
    }
  } finally { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); }
});
