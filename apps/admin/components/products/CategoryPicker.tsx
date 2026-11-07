'use client';
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useT } from 'shared/src/i18n/react';
import { useCategories } from '@/lib/hooks/use-api';
import { apiClient, unwrapApiResponse } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ListSearch, PaginationBar } from '@/components/list';

export function useCategoryLabel(value: string) {
  return useQuery({ queryKey: ['categories', 'detail', value], enabled: !!value && value !== 'none', queryFn: async () => unwrapApiResponse(await apiClient.get<{ id: string; name: string }>('/admin/products/categories/' + encodeURIComponent(value))) });
}
export function CategoryPicker({ label, value, onChange, options = [], disabled = false, showValue = true, id }: { label: string; value: string; onChange: (value: string) => void; options?: { value: string; label: string }[]; disabled?: boolean; showValue?: boolean; id?: string }) {
  const t = useT(), c = (key: string, values?: Record<string, string | number>) => t('merchant.catalog.' + key, values), l = (key: string, values?: Record<string, string | number>) => t('merchant.orders.list.' + key, values);
  const [open, setOpen] = useState(false), [search, setSearch] = useState(''), [page, setPage] = useState(1), [size, setSize] = useState(20);
  const trigger = useRef<HTMLButtonElement>(null);
  const selected = useCategoryLabel(value), list = useCategories(page, size, search);
  const choose = (next: string) => { onChange(next); setOpen(false); };
  return <><Button ref={trigger} id={id} type="button" variant="outline" aria-label={label} disabled={disabled} onClick={() => setOpen(true)} className="min-w-0 whitespace-normal break-words">{label}{showValue && <span className="ml-2 text-muted-foreground">{options.find(option => option.value === value)?.label ?? selected.data?.name ?? value}</span>}</Button>{selected.error && <span role="alert" className="text-xs text-destructive">{c('categoryError')}<Button type="button" size="sm" variant="ghost" onClick={() => void selected.refetch()}>{c('retry')}</Button></span>}<Dialog open={open} onOpenChange={setOpen}><DialogContent onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }} className="flex max-h-[85dvh] flex-col overflow-hidden"><DialogHeader className="shrink-0"><DialogTitle>{label}</DialogTitle><DialogDescription>{c('categoryDescription')}</DialogDescription></DialogHeader><div className="shrink-0"><ListSearch label={c('name')} value={search} onChange={value => { setSearch(value.slice(0, 200)); setPage(1); }} /></div><div className="min-h-0 flex-1 space-y-1 overflow-y-auto">{options.map(option => <Button key={option.value} type="button" variant="ghost" className="h-auto w-full justify-start whitespace-normal break-words" onClick={() => choose(option.value)}>{option.label}</Button>)}{list.isLoading ? <p role="status">{c('loadingCategories')}</p> : list.error ? <div role="alert"><p>{c('categoryError')}</p><Button onClick={() => void list.refetch()}>{c('retry')}</Button></div> : list.data?.items.length ? list.data.items.map(category => <Button key={category.id} type="button" variant={value === category.id ? 'outline' : 'ghost'} className="h-auto w-full justify-start whitespace-normal break-words" onClick={() => choose(category.id)}>{category.name}</Button>) : <p>{c('emptyCategories')}</p>}</div><div className="shrink-0 [&>div]:static"><PaginationBar page={page} pageSize={size} total={list.data?.total ?? 0} copy={l} onPage={setPage} onPageSize={value => { setSize(value); setPage(1); }} /></div></DialogContent></Dialog></>;
}
