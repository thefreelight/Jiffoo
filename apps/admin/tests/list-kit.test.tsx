// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { listChoice, listDateRange, readListState, writeListState, useListSelection } from '../lib/hooks/use-list-state';
import { ListFilter, PaginationBar, paginationPages } from '../components/list';

const fields = { tab: listChoice(['all', 'paid']), search: { default: '', valid: () => true }, page: { default: '1', valid: (value: string) => /^[1-9]\d*$/.test(value) }, pageSize: listChoice(['20', '50', '100']), sort: listChoice(['desc', 'asc']) };
it('round trips URL state, preserves unrelated params and falls back on invalid values', () => {
  const state = { tab: 'paid', search: 'a+b@example.test', page: '3', pageSize: '100', sort: 'asc' };
  const serialized = writeListState('source=overview', state, fields);
  expect(readListState(serialized, fields)).toEqual(state); expect(serialized).toContain('source=overview');
  expect(readListState('tab=unknown&page=-1&pageSize=3&sort=random', fields)).toEqual({ tab: 'all', search: '', page: '1', pageSize: '20', sort: 'desc' });
});
it('evaluates inclusive calendar dates in a non-UTC zone across DST', () => {
  const now = new Date('2026-03-08T18:00:00Z');
  expect(listDateRange('today', '', '', 'America/New_York', now)).toEqual({ createdFrom: '2026-03-08T05:00:00.000Z', createdTo: '2026-03-09T04:00:00.000Z' });
  expect(listDateRange('last7', '', '', 'Asia/Shanghai', new Date('2026-10-13T20:00:00Z'))).toEqual({ createdFrom: '2026-10-07T16:00:00.000Z', createdTo: '2026-10-14T16:00:00.000Z' });
  expect(listDateRange('last30', '', '', 'Asia/Shanghai', new Date('2026-10-13T20:00:00Z')).createdFrom).toBe('2026-09-14T16:00:00.000Z');
  expect(listDateRange('custom', '2026-03-08', '2026-03-08', 'America/New_York')).toEqual(listDateRange('today', '', '', 'America/New_York', now));
  expect(() => listDateRange('custom', '2026-02-30', '2026-03-02', 'UTC')).toThrow();
  expect(() => listDateRange('custom', '2026-10-14', '2026-10-13', 'UTC')).toThrow();
});
it('selects a page, stores a filter with exclusions, and clears on every list-state change', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const root = createRoot(document.createElement('div')); let model: ReturnType<typeof useListSelection<{ search: string }>>;
  const filter = { search: 'buyer' };
  function Probe({ stateKey }: { stateKey: string }) { model = useListSelection(stateKey, filter, ['a', 'b'], 503); return null; }
  try {
    await act(async () => root.render(<Probe stateKey="initial" />));
    await act(async () => model.togglePage()); expect(model!.selection).toEqual({ mode: 'ids', ids: ['a', 'b'] });
    await act(async () => model.allMatching()); expect(model!.count).toBe(503);
    expect(model!.selection).toEqual({ mode: 'filter', filter, excludeIds: [] });
    await act(async () => model.toggle('a')); expect(model!.count).toBe(502); expect(model!.checked('a')).toBe(false);
    expect(model!.selection).toEqual({ mode: 'filter', filter, excludeIds: ['a'] });
    await act(async () => model.togglePage()); expect(model!.count).toBe(503);
    await act(async () => model.togglePage()); expect(model!.count).toBe(501);
    expect(model!.selection).toEqual({ mode: 'filter', filter, excludeIds: ['a', 'b'] });
    await act(async () => model.onlyPage()); expect(model!.count).toBe(2);
    for (const stateKey of ['filter-changed', 'sort-changed', 'page-changed', 'page-size-changed', 'tab-changed', 'search-changed']) {
      await act(async () => root.render(<Probe stateKey={stateKey} />)); expect(model!.count).toBe(0);
      await act(async () => model.toggle('a')); expect(model!.count).toBe(1);
    }
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});
it('always renders single-page pagination, page size and disabled navigation', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div'), root = createRoot(container);
  const copy = (key: string, values?: Record<string, string | number>) => key + (values ? JSON.stringify(values) : '');
  try {
    await act(async () => root.render(<PaginationBar page={1} pageSize={20} total={1} copy={copy} onPage={vi.fn()} onPageSize={vi.fn()} />));
    expect(container.querySelector('nav')).toBeTruthy(); expect(container.querySelector('[aria-current="page"]')?.textContent).toBe('1');
    expect(container.querySelectorAll('button:disabled')).toHaveLength(2);
    expect(container.querySelector('button[aria-label="perPage"]')?.textContent).toBe('20');
    expect(paginationPages(5, 20)).toEqual([1, 'gap-4', 4, 5, 6, 'gap-20', 20]);
    expect(paginationPages(1, 20)).toEqual([1, 2, 3, 'gap-20', 20]);
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});
it('opens a named filter with the keyboard and selects a menu option without a native select', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  function Probe() { const [value, setValue] = useState('all'); return <ListFilter label="Category" value={value} options={[{ value: 'all', label: 'All' }, { value: 'a', label: 'Apparel' }]} onChange={setValue} />; }
  try {
    await act(async () => root.render(<Probe />));
    const trigger = container.querySelector<HTMLButtonElement>('button[aria-label="Category"]')!;
    await act(async () => trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    const option = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')).find(node => node.textContent === 'Apparel')!;
    expect(option).toBeTruthy(); await act(async () => option.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(trigger.textContent).toBe('CategoryApparel'); expect(container.querySelector('select')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  } finally { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); }
});
it('keeps custom-date fields keyboard accessible inside the filter menu', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  function Probe() { const [value, setValue] = useState('all'); return <ListFilter label="Placed at" value={value} options={[{ value: 'all', label: 'All' }, { value: 'custom', label: 'Custom' }]} onChange={setValue}>{value === 'custom' && <><input type="date" aria-label="Start date" /><input type="date" aria-label="End date" /></>}</ListFilter>; }
  try {
    await act(async () => root.render(<Probe />));
    await act(async () => container.querySelector('button')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    const custom = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')).find(node => node.textContent === 'Custom')!;
    await act(async () => custom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Start date');
  } finally { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); }
});
