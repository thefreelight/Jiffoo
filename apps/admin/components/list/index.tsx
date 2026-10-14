'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, ChevronLeft, ChevronRight, ChevronDown, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';

export type ListCopy = (key: string, values?: Record<string, string | number>) => string;

export function ListFilter({ label, value, options, onChange, children, compact = false, showValue = true, disabled = false }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void; children?: ReactNode; compact?: boolean; showValue?: boolean; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open && value === 'custom') content.current?.querySelector('input')?.focus(); }, [open, value]);
  return <DropdownMenu open={open} onOpenChange={setOpen}><DropdownMenuTrigger asChild>
    <Button type="button" variant="outline" aria-label={label} disabled={disabled} className={cn('gap-2 bg-raised px-3', compact ? 'h-7 gap-1.5 px-2 font-mono text-xs' : 'h-[34px]')}>
      {!compact && <span className={showValue ? 'text-faint' : 'text-foreground'}>{label}</span>}{showValue && <span>{options.find(option => option.value === value)?.label}</span>}<ChevronDown aria-hidden="true" className="size-3 text-faint" />
    </Button>
  </DropdownMenuTrigger><DropdownMenuContent align="end" aria-label={label} className="w-auto min-w-40 max-w-[calc(100vw-32px)] p-1">
    <DropdownMenuRadioGroup value={value} className="max-h-64 overflow-y-auto">{options.map(option => <DropdownMenuRadioItem key={option.value} value={option.value} onSelect={event => { onChange(option.value); if (option.value === 'custom') event.preventDefault(); }}>{option.label}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup>
    {children && <div ref={content} onKeyDown={event => { if (event.key !== 'Escape') event.stopPropagation(); }} className="space-y-2 border-t border-border p-3">{children}</div>}
  </DropdownMenuContent></DropdownMenu>;
}

export function StatusTabs({ label, tabs, value, onChange }: { label: string; tabs: { value: string; label: string; count: number | undefined; attention?: boolean }[]; value: string; onChange: (value: string) => void }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  return <div role="tablist" aria-label={label} className="flex flex-wrap gap-x-5 border-b border-border">
    {tabs.map((tab, index) => <button key={tab.value} ref={element => { refs.current[index] = element; }} type="button" role="tab" aria-selected={value === tab.value} tabIndex={value === tab.value ? 0 : -1}
      onKeyDown={event => {
        const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : undefined;
        if (next !== undefined) { event.preventDefault(); onChange(tabs[next].value); refs.current[next]?.focus(); }
      }} onClick={() => onChange(tab.value)} className={cn('flex h-9 items-center gap-1.5 border-b-[1.5px] text-[13px] font-medium focus-visible:outline-2 focus-visible:outline-ring', value === tab.value ? 'border-foreground text-foreground' : 'border-transparent text-faint')}>
      {tab.label}<span className={cn('font-mono text-[11px] text-faint', tab.attention && 'text-attention')}>{tab.count ?? '—'}</span>
    </button>)}
  </div>;
}

export function ListSearch({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const callback = useRef(onChange); callback.current = onChange;
  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (draft === value) return; const timer = setTimeout(() => callback.current(draft), 300); return () => clearTimeout(timer); }, [draft, value]);
  return <div className="relative min-w-0 flex-1 basis-[260px]"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-2.5 size-3.5 text-faint" /><Input aria-label={label} placeholder={label} value={draft} onChange={event => setDraft(event.target.value)} className="h-[34px] bg-raised pl-8 text-[13px]" /></div>;
}

export function FilterChips({ chips, copy, clear }: { chips: { key: string; name: string; value: string; remove: () => void }[]; copy: ListCopy; clear: () => void }) {
  if (!chips.length) return null;
  return <div className="flex flex-wrap items-center gap-1.5">{chips.map(chip => <span key={chip.key} className="inline-flex min-h-[26px] items-center gap-1 rounded-full border border-border bg-raised pl-2.5 pr-1 text-[13px]"><span className="text-muted-foreground">{chip.name}：</span>{chip.value}<button type="button" aria-label={copy('removeFilter', { name: chip.name, value: chip.value })} onClick={chip.remove} className="flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"><X aria-hidden="true" className="size-3" /></button></span>)}<Button variant="ghost" size="sm" className="h-[26px] px-2 text-muted-foreground underline underline-offset-4" onClick={clear}>{copy('clearAll')}</Button></div>;
}

export function SortHeader({ label, field, sortBy, sortOrder, onSort, align = 'right', title }: { title?: string; label: string; field: string; sortBy: string; sortOrder: string; onSort: (field: string, order: string) => void; align?: 'left' | 'right' }) {
  const active = field === sortBy, Icon = active ? sortOrder === 'asc' ? ArrowUp : ArrowDown : ChevronsUpDown;
  return <th scope="col" aria-sort={active ? sortOrder === 'asc' ? 'ascending' : 'descending' : 'none'} className={cn('whitespace-nowrap px-3 py-2.5 font-medium last:pr-4', align === 'left' ? 'text-left' : 'text-right')}><button type="button" title={title} onClick={() => onSort(field, active && sortOrder === 'asc' ? 'desc' : 'asc')} className={cn('inline-flex items-center gap-1 focus-visible:outline-2 focus-visible:outline-ring', active && 'text-foreground')}>{label}<Icon aria-hidden="true" className={cn('size-3', !active && 'opacity-50')} /></button></th>;
}

export function SelectionBanner({ all, count, total, copy, selectAll, onlyPage }: { all: boolean; count: number; total: number; copy: ListCopy; selectAll: () => void; onlyPage: () => void }) {
  return <div className="flex flex-wrap items-center justify-center gap-2 border-b border-border bg-active px-4 py-[9px] text-[13px]"><span>{copy(all ? 'allSelected' : 'pageSelected', { count })}</span><button type="button" className="font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring" onClick={all ? onlyPage : selectAll}>{copy(all ? 'onlyPage' : 'selectAll', { count: total })}</button></div>;
}

export function BulkBar({ count, copy, children, clear, allMatching = false }: { count: number; copy: ListCopy; children: ReactNode; clear: () => void; allMatching?: boolean }) {
  if (!count) return null;
  return <div role="region" aria-label={copy('bulkActions')} className="sticky bottom-4 z-20 mt-auto flex justify-center px-4 pb-4"><div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-ground p-2 pl-4 shadow-xl"><span className="mr-2 font-medium">{copy(allMatching ? 'selectedAll' : 'selected', { count })}</span>{children}<Button size="sm" variant="ghost" onClick={clear}>{copy('cancelSelection')}</Button></div></div>;
}

export function paginationPages(page: number, pages: number): Array<number | string> {
  const edge = page <= 2 ? [2, 3] : page >= pages - 1 ? [pages - 2, pages - 1] : [];
  const values = [...new Set([1, pages, page - 1, page, page + 1, ...edge, ...(pages <= 7 ? Array.from({ length: pages }, (_, i) => i + 1) : [])])].filter(value => value > 0 && value <= pages).sort((a, b) => a - b);
  return values.flatMap((value, index) => index && value - values[index - 1] > 1 ? ['gap-' + value, value] : [value]);
}
export function PaginationBar({ page, pageSize, total, copy, onPage, onPageSize }: { page: number; pageSize: number; total: number; copy: ListCopy; onPage: (page: number) => void; onPageSize: (size: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <nav aria-label={copy('pagination')} className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
    <div className="flex flex-wrap items-center gap-3">
      <span className="tabular-nums">{copy('range', { start: total ? (page - 1) * pageSize + 1 : 0, end: Math.min(page * pageSize, total), total })}</span>
      <label className="flex items-center gap-2">{copy('perPageBefore')}
        <ListFilter compact label={copy('perPage')} value={String(pageSize)} onChange={value => onPageSize(Number(value))} options={[20, 50, 100].map(size => ({ value: String(size), label: String(size) }))} />
        {copy('perPageAfter')}
      </label>
    </div>
    <div className="flex items-center gap-1">
      <Button size="icon" variant="outline" className="size-[30px] bg-ground" aria-label={copy('previous')} disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft aria-hidden="true" className="size-3" /></Button>
      {paginationPages(page, pages).map(value => typeof value === 'string' ? <span key={value} className="px-2">…</span> : <Button key={value} size="sm" variant={page === value ? 'default' : 'outline'} aria-label={copy('pageLabel', { page: value })} aria-current={page === value ? 'page' : undefined} className={cn('h-[30px] min-w-[30px] px-2 font-mono', page !== value && 'bg-ground')} onClick={() => onPage(value)}>{value}</Button>)}
      <Button size="icon" variant="outline" className="size-[30px] bg-ground" aria-label={copy('next')} disabled={page >= pages} onClick={() => onPage(page + 1)}><ChevronRight aria-hidden="true" className="size-3" /></Button>
    </div>
  </nav>;
}

export function ListEmpty({ filtered, copy, clear }: { filtered: boolean; copy: ListCopy; clear: () => void }) {
  return <div className="space-y-2 py-12 text-center text-muted-foreground"><p>{copy(filtered ? 'noMatches' : 'empty')}</p>{filtered ? <Button variant="outline" size="sm" onClick={clear}>{copy('clearFilters')}</Button> : <p className="text-xs">{copy('emptyDescription')}</p>}</div>;
}
