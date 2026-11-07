// @vitest-environment jsdom
import { act, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { listChoice, listDateRange, readListState, writeListState, useListSelection, useListState } from '../lib/hooks/use-list-state';
import { BulkBar, ListFilter, PaginationBar, paginationPages } from '../components/list';

const fields = { tab: listChoice(['all', 'paid']), search: { default: '', valid: () => true }, page: { default: '1', valid: (value: string) => /^[1-9]\d*$/.test(value) }, pageSize: listChoice(['20', '50', '100']), sort: listChoice(['desc', 'asc']) };

const navigation = vi.hoisted(() => ({ raw: '' }));
vi.mock('next/navigation', () => ({ usePathname: () => '/en/orders', useSearchParams: () => new URLSearchParams(navigation.raw) }));

it('replaces native history, preserves consecutive updates and follows external URL state', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  navigation.raw = 'source=overview&page=3';
  const replace = vi.spyOn(window.history, 'replaceState').mockImplementation((_data, _unused, url) => {
    navigation.raw = String(url).split('?')[1] ?? '';
  });
  const root = createRoot(document.createElement('div'));
  let model: ReturnType<typeof useListState>;
  function Probe() { model = useListState(fields); return null; }
  try {
    await act(async () => root.render(<Probe />));
    await act(async () => { model.update({ search: 'buyer' }); model.update({ pageSize: '100', page: '1' }); });
    expect(replace).toHaveBeenLastCalledWith(null, '', '/en/orders?source=overview&search=buyer&pageSize=100');
    expect(model!.state).toMatchObject({ search: 'buyer', pageSize: '100', page: '1' });
    expect(model!.url).toContain('source=overview');
    navigation.raw = 'source=history&tab=paid&page=2&pageSize=invalid';
    await act(async () => root.render(<Probe />));
    expect(model!.state).toMatchObject({ tab: 'paid', page: '2', pageSize: '20', search: '' });
    await act(async () => model.update({ sort: 'asc' }));
    expect(replace).toHaveBeenLastCalledWith(null, '', '/en/orders?source=history&tab=paid&page=2&sort=asc');
  } finally { await act(async () => root.unmount()); replace.mockRestore(); vi.unstubAllGlobals(); }
});

it('keeps pagination usable after clearing the composed bulk-action footer', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div'), root = createRoot(container);
  const onPage = vi.fn(), onPageSize = vi.fn();
  const copy = (key: string) => key;
  function Probe() {
    const [count, setCount] = useState(2);
    const [size, setSize] = useState(20);
    return <PaginationBar page={1} pageSize={size} total={200} copy={copy} onPage={onPage} onPageSize={value => { onPageSize(value); setSize(value); }}>
      <BulkBar count={count} copy={copy} clear={() => setCount(0)}><button>Export selected</button></BulkBar>
    </PaginationBar>;
  }
  try {
    await act(async () => root.render(<Probe />));
    const nav = container.querySelector('nav[aria-label="pagination"]')!;
    const bulk = container.querySelector('[role="region"][aria-label="bulkActions"]')!;
    expect(bulk).toBeTruthy(); expect(nav.contains(bulk)).toBe(false);
    const cancel = Array.from(bulk.querySelectorAll('button')).find(button => button.textContent === 'cancelSelection')!;
    await act(async () => cancel.click());
    expect(container.querySelector('[role="region"][aria-label="bulkActions"]')).toBeNull();
    expect(container.querySelector('nav[aria-label="pagination"]')).toBe(nav);
    const size = container.querySelector<HTMLSelectElement>('select[aria-label="perPage"]')!;
    await act(async () => { size.value = '100'; size.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(onPageSize).toHaveBeenLastCalledWith(100); expect(size.value).toBe('100');
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="next"]')!.click());
    expect(onPage).toHaveBeenLastCalledWith(2);
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});
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
it('selects a page, stores a filter with exclusions, and clears when its selection key changes', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const root = createRoot(document.createElement('div')); let model: ReturnType<typeof useListSelection<{ search: string }>>;
  const filter = { search: 'buyer' };
  function Probe({ stateKey }: { stateKey: string }) { const selection = useListSelection(stateKey, filter, ['a', 'b'], 503); useEffect(() => { model = selection; }); return null; }
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
    for (const stateKey of ['filter-changed', 'tab-changed', 'search-changed']) {
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
    const size = container.querySelector<HTMLSelectElement>('select[aria-label="perPage"]')!;
    expect(size.value).toBe('20'); expect(Array.from(size.options).map(option => option.value)).toEqual(['20', '50', '100']);
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

it('changes the native page-size control using its accessible name', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  const change = vi.fn();
  function Probe() { const [size, setSize] = useState(20); return <PaginationBar page={1} pageSize={size} total={200} copy={key => key === 'perPage' ? 'Rows per page' : key} onPage={vi.fn()} onPageSize={value => { change(value); setSize(value); }} />; }
  try {
    await act(async () => root.render(<Probe />));
    const select = container.querySelector<HTMLSelectElement>('select[aria-label="Rows per page"]')!;
    expect(select).toBeTruthy();
    expect(Array.from(select.options).map(option => option.value)).toEqual(['20', '50', '100']);
    await act(async () => { select.value = '100'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(change).toHaveBeenLastCalledWith(100); expect(select.value).toBe('100');
  } finally { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); }
});
