// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  views: [] as any[],
  preference: { listKey: 'orders', columns: ['orderNumber', 'status'] } as { listKey: string; columns: string[] },
  pushed: [] as string[],
  created: [] as any[],
  deleted: [] as string[],
  saved: [] as string[][],
}));

vi.mock('../lib/api', () => ({
  listPreferencesApi: {
    listViews: vi.fn(async (list: string) => ({ success: true, data: { views: state.views } })),
    createView: vi.fn(async (payload: any) => { state.created.push(payload); return { success: true, data: { id: 'view-1', listKey: payload.list, name: payload.name, query: payload.query, createdAt: '', updatedAt: '' } }; }),
    updateView: vi.fn(async () => ({ success: true, data: { id: 'view-1', listKey: 'orders', name: 'Updated', query: {}, createdAt: '', updatedAt: '' } })),
    deleteView: vi.fn(async (id: string) => { state.deleted.push(id); return { success: true, data: null }; }),
    getPreference: vi.fn(async (list: string) => ({ success: true, data: state.preference })),
    setPreference: vi.fn(async (list: string, columns: string[]) => { state.saved.push(columns); return { success: true, data: { listKey: list, columns } }; }),
  },
  unwrapApiResponse: <T,>(response: { data: T }) => response.data,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: (url: string) => { state.pushed.push(url); } }),
  usePathname: () => '/en/orders',
}));

import { ColumnPicker, SavedViews, useListColumns } from '../components/list';

const labels: Record<string, string> = {
  savedViews: 'Views', noSavedViews: 'No saved views yet', saveCurrentView: 'Save current view',
  viewName: 'View name', viewNamePlaceholder: 'Name this view', save: 'Save', cancel: 'Cancel',
};
const copy = (key: string, values?: Record<string, string | number>) => key === 'deleteView'
  ? 'Delete saved view: ' + String(values?.name ?? '')
  : labels[key] ?? key;

let root: Root | undefined;
async function mount(node: React.ReactNode) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root!.render(node));
  return container;
}
/**
 * Opens the dropdown of the given trigger. The trigger toggles the menu, so an
 * already open menu would be closed by another press; the menu content stays
 * mounted after saving a view because the save keeps the selection default
 * prevented. Opening is therefore idempotent here.
 */
function openMenu(label: string) {
  if (document.querySelector('[role="menu"]')) return;
  const trigger = document.querySelector<HTMLButtonElement>('button[aria-label="' + label + '"]');
  if (!trigger) throw new Error('Missing trigger: ' + label);
  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
}
function menuItem(text: string): HTMLElement {
  const item = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"],[role="menuitemcheckbox"]')).find(node => node.textContent === text);
  if (!item) throw new Error('Missing menu item: ' + text);
  return item;
}
function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Types like a browser does: the key goes to the element that holds the
 * focus, the character is inserted by the default action of that key, and a
 * menu that steals the focus afterwards loses the rest of the word.
 */
async function typeInto(input: HTMLInputElement, text: string) {
  for (const character of text) {
    if (document.activeElement !== input) break;
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: character, bubbles: true }));
      setInputValue(input, input.value + character);
    });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    if (document.activeElement !== input) break;
  }
}

beforeEach(() => {
  state.views = [];
  state.pushed = [];
  state.created = [];
  state.deleted = [];
  state.saved = [];
  state.preference = { listKey: 'orders', columns: ['orderNumber', 'status'] };
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

it('lists the saved views of the list and navigates to the applied view query', async () => {
  state.views = [{ id: 'view-1', listKey: 'orders', name: 'Paid orders', query: { status: 'PAID', page: '2' }, createdAt: '', updatedAt: '' }];
  await mount(<SavedViews listKey="orders" query={{ status: 'PENDING' }} label="Views" copy={copy} />);
  await act(async () => openMenu('Views'));
  expect(Array.from(document.querySelectorAll('[role="menuitem"]')).some(node => node.textContent === 'Paid orders')).toBe(true);
  await act(async () => menuItem('Paid orders').click());
  expect(state.pushed).toEqual(['/en/orders?status=PAID&page=2']);
});

it('saves the current query under a name and deletes a saved view', async () => {
  state.views = [{ id: 'view-1', listKey: 'orders', name: 'Paid orders', query: { status: 'PAID' }, createdAt: '', updatedAt: '' }];
  await mount(<SavedViews listKey="orders" query={{ status: 'PENDING', page: '3' }} label="Views" copy={copy} />);
  await act(async () => openMenu('Views'));
  await act(async () => menuItem('Save current view').click());
  const input = document.querySelector<HTMLInputElement>('input[aria-label="View name"]');
  if (!input) throw new Error('Missing name input');
  await act(async () => setInputValue(input, 'My view'));
  const save = Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Save');
  if (!save) throw new Error('Missing save button');
  await act(async () => save.click());
  expect(state.created).toEqual([{ list: 'orders', name: 'My view', query: { status: 'PENDING', page: '3' } }]);
  await act(async () => openMenu('Views'));
  const remove = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(button => button.getAttribute('aria-label')?.startsWith('Delete saved view'));
  if (!remove) throw new Error('Missing delete button');
  await act(async () => remove.click());
  expect(state.deleted).toEqual(['view-1']);
});

it('focuses the naming input as soon as it appears', async () => {
  await mount(<SavedViews listKey="orders" query={{ status: 'PENDING' }} label="Views" copy={copy} />);
  await act(async () => openMenu('Views'));
  await act(async () => menuItem('Save current view').click());
  const input = document.querySelector<HTMLInputElement>('input[aria-label="View name"]');
  if (!input) throw new Error('Missing name input');
  expect(document.activeElement).toBe(input);
});

it('keeps the typed name in the input while the surrounding menu cannot steal the keystroke', async () => {
  state.views = [{ id: 'view-1', listKey: 'orders', name: 'Paid orders', query: { status: 'PAID' }, createdAt: '', updatedAt: '' }];
  await mount(<SavedViews listKey="orders" query={{ status: 'PENDING' }} label="Views" copy={copy} />);
  await act(async () => openMenu('Views'));
  await act(async () => menuItem('Save current view').click());
  const input = document.querySelector<HTMLInputElement>('input[aria-label="View name"]');
  if (!input) throw new Error('Missing name input');
  await typeInto(input, 'sales');
  expect(input.value).toBe('sales');
  expect(document.activeElement).toBe(input);
  const save = Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Save');
  if (!save) throw new Error('Missing save button');
  await act(async () => save.click());
  expect(state.created).toEqual([{ list: 'orders', name: 'sales', query: { status: 'PENDING' } }]);
});

it('keeps the always visible column and persists the column preference', async () => {
  function Probe() {
    const { visible, toggle } = useListColumns('orders', ['orderNumber', 'status', 'totalAmount']);
    return <ColumnPicker label="Columns" columns={[{ key: 'orderNumber', label: 'Order', alwaysVisible: true }, { key: 'status', label: 'Status' }, { key: 'totalAmount', label: 'Amount' }]} visible={visible} onToggle={toggle} />;
  }
  await mount(<Probe />);
  await act(async () => openMenu('Columns'));
  const items = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]'));
  expect(items.map(item => item.getAttribute('aria-checked'))).toEqual(['true', 'true', 'false']);
  expect(items[0].getAttribute('aria-disabled')).toBe('true');
  await act(async () => menuItem('Amount').click());
  expect(state.saved).toEqual([['orderNumber', 'status', 'totalAmount']]);
});
