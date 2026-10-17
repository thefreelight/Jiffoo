'use client';
import { useT } from 'shared/src/i18n/react';
import { Button } from '@/components/ui/button';

export function Pagination({ page, size, total, busy, onChange }: { page: number; size: number; total: number | null; busy?: boolean; onChange: (page: number, size: number) => void }) {
  const t = useT(), c = (key: string, values?: Record<string, string | number>) => t(`merchant.notificationView.${key}`, values);
  const pages = Math.max(1, Math.ceil((total ?? 0) / size));
  const numbers = [...new Set([1, page - 1, page, page + 1, pages])].filter(value => value > 0 && value <= pages).sort((a, b) => a - b);
  return <nav aria-label={c('pagination')} className="flex flex-wrap items-center justify-between gap-3 text-muted-foreground"><div className="flex flex-wrap items-center gap-2"><span>{c('total', { total: total ?? '—' })}</span><label className="flex items-center gap-2">{c('pageSize')}<select className="h-8 rounded-[7px] border border-border bg-ground px-2 text-foreground" value={size} disabled={busy} onChange={event => onChange(1, Number(event.target.value))}>{[20, 50, 100].map(value => <option key={value}>{value}</option>)}</select></label></div><div className="flex flex-wrap items-center gap-1"><Button size="sm" variant="outline" aria-label={c('previous')} disabled={busy || page <= 1} onClick={() => onChange(page - 1, size)}>‹</Button>{numbers.map((value, index) => <span className="inline-flex items-center gap-1" key={value}>{index > 0 && numbers[index - 1] < value - 1 && <span aria-hidden="true">…</span>}<Button size="sm" variant={value === page ? 'default' : 'outline'} aria-current={value === page ? 'page' : undefined} aria-label={c('page', { page: value })} disabled={busy} onClick={() => onChange(value, size)}>{value}</Button></span>)}<Button size="sm" variant="outline" aria-label={c('next')} disabled={busy || page >= pages} onClick={() => onChange(page + 1, size)}>›</Button></div></nav>;
}
