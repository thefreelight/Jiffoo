'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { formatStoreTimestamp, storeLocalToUtc } from 'shared';

export type ListState = Record<string, string>;
export interface ListField { default: string; valid: (value: string) => boolean }
export type ListFields = Record<string, ListField>;
export function readListState(query: string, fields: ListFields): ListState {
  const params = new URLSearchParams(query);
  return Object.fromEntries(Object.entries(fields).map(([key, field]) => {
    const value = params.get(key);
    return [key, value !== null && field.valid(value) ? value : field.default];
  }));
}
export function writeListState(query: string, state: ListState, fields: ListFields): string {
  const params = new URLSearchParams(query);
  for (const [key, field] of Object.entries(fields)) {
    if (state[key] === field.default) params.delete(key); else params.set(key, state[key]);
  }
  return params.toString();
}
export const listChoice = (values: string[], fallback = values[0]): ListField => ({ default: fallback, valid: value => values.includes(value) });
export const validListDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

export function useListState(fields: ListFields) {
  const router = useRouter(), pathname = usePathname(), params = useSearchParams();
  const raw = params.toString();
  const [state, setState] = useState(() => readListState(raw, fields));
  const current = useRef(state), query = useRef(raw);
  useEffect(() => { query.current = raw; const next = readListState(raw, fields); current.current = next; setState(next); }, [raw, fields]);
  const update = (patch: ListState) => {
    const next = { ...current.current, ...patch };
    const serialized = writeListState(query.current, next, fields);
    current.current = next; query.current = serialized; setState(next);
    router.replace(pathname + (serialized ? '?' + serialized : ''), { scroll: false });
  };
  const serialized = writeListState(raw, state, fields);
  return { state, update, url: pathname + (serialized ? '?' + serialized : '') };
}

export type ListSelection<F> = { mode: 'ids'; ids: string[] } | { mode: 'filter'; filter: F; excludeIds: string[] };
export function toggleListRow<F>(selection: ListSelection<F>, id: string): ListSelection<F> {
  if (selection.mode === 'ids') return { mode: 'ids', ids: selection.ids.includes(id) ? selection.ids.filter(value => value !== id) : [...selection.ids, id] };
  return { ...selection, excludeIds: selection.excludeIds.includes(id) ? selection.excludeIds.filter(value => value !== id) : [...selection.excludeIds, id] };
}
export function useListSelection<F>(key: string, filter: F, pageIds: string[], total: number) {
  const [stored, setStored] = useState<{ key: string; selection: ListSelection<F> }>({ key, selection: { mode: 'ids', ids: [] } });
  if (stored.key !== key) setStored({ key, selection: { mode: 'ids', ids: [] } });
  const selection: ListSelection<F> = stored.key === key ? stored.selection : { mode: 'ids', ids: [] };
  const set = (next: ListSelection<F>) => setStored({ key, selection: next });
  const checked = (id: string) => selection.mode === 'ids' ? selection.ids.includes(id) : !selection.excludeIds.includes(id);
  const count = selection.mode === 'ids' ? selection.ids.length : Math.max(0, total - selection.excludeIds.length);
  const pageChecked = pageIds.length > 0 && pageIds.every(checked);
  return { selection, count, checked, pageChecked, clear: () => set({ mode: 'ids', ids: [] }),
    toggle: (id: string) => set(toggleListRow(selection, id)),
    togglePage: () => set(selection.mode === 'filter'
      ? { ...selection, excludeIds: pageChecked ? [...new Set([...selection.excludeIds, ...pageIds])] : selection.excludeIds.filter(id => !pageIds.includes(id)) }
      : { mode: 'ids', ids: pageChecked ? selection.ids.filter(id => !pageIds.includes(id)) : [...new Set([...selection.ids, ...pageIds])] }),
    onlyPage: () => set({ mode: 'ids', ids: pageIds }),
    allMatching: () => set({ mode: 'filter', filter, excludeIds: [] }),
  };
}

export function listDateRange(preset: string, start: string, end: string, timezone: string, now = new Date()) {
  if (preset === 'all') return {};
  const shiftDate = (day: string, offset: number) => { const date = new Date(day + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0, 10); };
  const today = formatStoreTimestamp(now, timezone).slice(0, 10);
  if (preset !== 'custom') {
    start = shiftDate(today, preset === 'today' ? 0 : preset === 'last7' ? -6 : -29); end = today;
  }
  if (!validListDate(start) || !validListDate(end) || start > end) throw new RangeError('Invalid list date range');
  return { createdFrom: storeLocalToUtc(start + 'T00:00', timezone), createdTo: storeLocalToUtc(shiftDate(end, 1) + 'T00:00', timezone) };
}
