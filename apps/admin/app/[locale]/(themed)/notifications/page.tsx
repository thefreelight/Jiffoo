'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale, useT } from 'shared/src/i18n/react';
import { formatStoreTimestamp } from 'shared';
import { useStoreDate } from '@/lib/store-time';
import { notificationsApi, unwrapApiResponse, type AdminNotification } from '@/lib/api';
import { listChoice, useListState, type ListFields } from '@/lib/hooks/use-list-state';
import { Choice } from '@/components/operations/Choice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Pagination } from '@/components/operations/Pagination';

const statuses = ['PENDING', 'SENDING', 'SENT', 'FAILED'] as const;
const fields: ListFields = {
  status: listChoice(['all', ...statuses]), search: { default: '', valid: value => value.length <= 320 }, type: { default: '', valid: value => value.length <= 100 },
  sort: listChoice(['newest', 'oldest']), page: { default: '1', valid: value => /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) }, pageSize: listChoice(['20', '50', '100']),
};
import { completedAttempts } from '@/lib/notification-attempts';
const knownTypes = ['order_confirmation', 'payment_received', 'staff_invite', 'email_verification', 'password_reset', 'shipped', 'cancelled', 'refunded'];
// Notifications are created asynchronously by the domain event outbox, so the
// list polls in the background to show rows that arrive after the first load.
const POLL_INTERVAL_MS = 2_000;

export default function NotificationsPage() {
  const t = useT(), locale = useLocale(), { timezone } = useStoreDate();
  const c = (key: string, values?: Record<string, string | number>) => t(`merchant.notificationView.${key}`, values);
  const typeLabel = (value: string) => knownTypes.includes(value) ? c(value) : value;
  const { state, update } = useListState(fields), page = Number(state.page), size = Number(state.pageSize);
  const [items, setItems] = useState<AdminNotification[]>([]), [selected, setSelected] = useState<AdminNotification | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({}), [types, setTypes] = useState<string[]>([]), [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true), [detailLoading, setDetailLoading] = useState(false), [open, setOpen] = useState(false);
  const [error, setError] = useState(''), [detailError, setDetailError] = useState(''), [notice, setNotice] = useState(''), [resending, setResending] = useState(false), [revision, setRevision] = useState(0);
  const requestId = useRef(0), detailId = useRef(0), resendKeys = useRef(new Map<string, string>()), inFlight = useRef(0);
  const refresh = useCallback(async (background = false) => {
    // A background poll never overlaps a request that is still running.
    if (background && inFlight.current > 0) return;
    const id = ++requestId.current; inFlight.current += 1;
    if (!background) { setLoading(true); setError(''); }
    try {
      const result = unwrapApiResponse(await notificationsApi.getAll(page, size, state.status === 'all' ? undefined : state.status as AdminNotification['status'], { search: state.search || undefined, type: state.type || undefined, sort: state.sort }));
      if (requestId.current === id) { setItems(result.items); setTotal(result.total); setCounts(result.counts ?? {}); setTypes(result.types ?? []); }
    } catch { if (requestId.current === id && !background) { setItems([]); setTotal(0); setCounts({}); setError('failed'); } }
    finally { inFlight.current -= 1; if (requestId.current === id) setLoading(false); }
  }, [page, size, state.status, state.search, state.type, state.sort]);
  useEffect(() => { void refresh(); return () => { requestId.current++; }; }, [refresh, revision]);
  useEffect(() => {
    const timer = setInterval(() => { void refresh(true); }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);
  const filter = (patch: Record<string, string>) => update({ ...patch, page: '1' });
  async function openDetail(id: string) {
    const request = ++detailId.current; setOpen(true); setSelected(null); setDetailLoading(true); setDetailError(''); setNotice('');
    try { const item = unwrapApiResponse(await notificationsApi.getById(id)); if (request === detailId.current) setSelected(item); }
    catch { if (request === detailId.current) setDetailError('detailFailed'); }
    finally { if (request === detailId.current) setDetailLoading(false); }
  }
  async function resend() {
    if (!selected || resending) return;
    setResending(true); setDetailError(''); setNotice('');
    const id = selected.id, key = resendKeys.current.get(id) ?? crypto.randomUUID(); resendKeys.current.set(id, key);
    try { const item = unwrapApiResponse(await notificationsApi.resend(id, key)); setSelected(item); resendKeys.current.delete(id); setNotice('queued'); setRevision(value => value + 1); }
    catch { setDetailError('resendFailed'); } finally { setResending(false); }
  }
  const status = (item: AdminNotification) => <span className={`inline-flex items-center gap-2 ${item.status === 'FAILED' ? 'text-attention' : ''}`}><span aria-hidden="true" className={`size-[7px] rounded-full border border-current ${item.status === 'SENT' ? 'bg-current' : item.status === 'PENDING' ? 'border-dashed' : ''}`} />{c(item.status)}</span>;
  const date = (value: string) => formatStoreTimestamp(value, timezone);
  const blocked = selected?.type === 'password_reset' ? 'passwordHint' : selected && ['PENDING', 'SENDING'].includes(selected.status) ? 'pendingHint' : selected && ['staff_invite', 'email_verification'].includes(selected.type) && !selected.recipientUserId ? 'recipientMissing' : null;
  const hint = blocked ?? (selected?.type === 'staff_invite' ? 'inviteHint' : selected?.type === 'email_verification' ? 'verificationHint' : 'resendHint');
  return <section className="mx-auto w-full max-w-[1120px] space-y-4 px-4 pb-10 text-[13px] text-foreground sm:px-8">
    <header className="space-y-1.5"><h1 className="text-[26px] font-semibold tracking-tight">{c('title')}</h1><p className="text-muted-foreground">{c('description')}</p></header>
    {(counts.FAILED ?? 0) > 0 && <div role="status" className="flex flex-wrap items-center gap-2.5 rounded-[10px] border border-attention-line bg-attention-soft px-3.5 py-3 text-attention"><p className="flex-1 basis-72">{c('failedBanner', { count: counts.FAILED })}</p><Button size="sm" variant="outline" onClick={() => filter({ status: 'FAILED' })}>{c('onlyFailed')}</Button></div>}
    <div role="tablist" aria-label={c('status')} className="flex flex-wrap gap-x-5 border-b border-border">{['all', ...statuses].map(value => <button key={value} role="tab" aria-selected={state.status === value} onClick={() => filter({ status: value })} className={`-mb-px flex h-9 items-center gap-1.5 border-b-[1.5px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 ${state.status === value ? 'border-foreground' : 'border-transparent text-faint'}`}>{c(value)}<span className={`font-mono text-[11px] ${value === 'FAILED' ? 'text-attention' : 'text-faint'}`}>{counts[value] ?? '—'}</span></button>)}</div>
    <div className="flex flex-wrap gap-2"><Input className="h-[34px] min-w-0 flex-1 basis-64 bg-raised" type="search" aria-label={c('search')} placeholder={c('searchPlaceholder')} value={state.search} onChange={event => filter({ search: event.target.value })} /><Choice label={c('type')} prefix value={state.type} onChange={type => filter({ type })} options={[{ value: '', label: c('all') }, ...types.map(value => ({ value, label: typeLabel(value) }))]} /></div>
    {(state.search || state.type) && <div className="flex flex-wrap items-center gap-2">{['search', 'type'].filter(key => state[key]).map(key => <Button size="sm" variant="outline" key={key} aria-label={c('removeFilter', { value: state[key] })} onClick={() => filter({ [key]: '' })}>{key === 'type' ? typeLabel(state[key]) : state[key]} ×</Button>)}<Button size="sm" variant="ghost" onClick={() => filter({ search: '', type: '', status: 'all' })}>{c('clear')}</Button></div>}
    {error && <div role="alert" className="flex items-center gap-3 text-destructive">{c(error)}<Button size="sm" variant="outline" onClick={() => setRevision(value => value + 1)}>{c('retry')}</Button></div>}
    {loading ? <p role="status" className="py-10 text-center text-muted-foreground">{c('loading')}</p> : error ? null : !items.length ? <p className="rounded-[10px] border border-border py-10 text-center text-muted-foreground">{c('empty')}</p> : <>
      <div className="hidden overflow-hidden rounded-[10px] border border-border md:block"><table className="w-full border-collapse text-left"><thead className="bg-raised text-xs text-faint"><tr>{['mail', 'recipient', 'status', 'attempts'].map(key => <th key={key} className="px-3 py-2.5 font-medium">{c(key)}</th>)}<th className="px-4 py-2.5 text-right font-medium" aria-sort={state.sort === 'newest' ? 'descending' : 'ascending'}><button aria-label={c('sort')} onClick={() => filter({ sort: state.sort === 'newest' ? 'oldest' : 'newest' })}>{c('created', { timezone })} {state.sort === 'newest' ? '↓' : '↑'}</button></th></tr></thead><tbody>{items.map(item => <tr key={item.id} className="cursor-pointer border-t border-border hover:bg-raised" onClick={() => void openDetail(item.id)}><td className="max-w-64 px-4 py-2.5"><button className="max-w-full text-left" onClick={event => { event.stopPropagation(); void openDetail(item.id); }}><span className="block font-medium">{typeLabel(item.type)}</span><span className="block truncate text-xs text-faint">{item.subject}</span></button></td><td className="max-w-56 break-all px-3 py-2.5 text-muted-foreground">{item.toAddress}</td><td className="px-3 py-2.5">{status(item)}{item.status === 'FAILED' && item.lastError && <p className="max-w-48 truncate text-xs text-faint" title={item.lastError}>{item.lastError}</p>}{item.status === 'PENDING' && item.attempts > 0 && <p className="text-xs text-faint">{c('nextAttempt', { time: date(item.nextAttemptAt) })}</p>}</td><td className="px-3 py-2.5 text-right font-mono text-xs">{completedAttempts(item)}</td><td className="whitespace-nowrap px-4 py-2.5 text-right text-muted-foreground">{date(item.createdAt)}</td></tr>)}</tbody></table></div>
      <div className="space-y-2 md:hidden"><button className="min-h-[34px] text-xs text-faint" aria-label={c('sort')} onClick={() => filter({ sort: state.sort === 'newest' ? 'oldest' : 'newest' })}>{c('created', { timezone })} {state.sort === 'newest' ? '↓' : '↑'}</button>{items.map(item => <button key={item.id} onClick={() => void openDetail(item.id)} className="block w-full space-y-2 rounded-[10px] border border-border p-4 text-left hover:bg-raised"><span className="flex flex-wrap justify-between gap-2"><span className="font-medium">{typeLabel(item.type)}</span>{status(item)}</span><span className="block break-words text-xs text-faint">{item.subject}</span><span className="block break-all text-muted-foreground">{item.toAddress}</span><span className="flex flex-wrap justify-between gap-2 text-xs text-faint"><span>{date(item.createdAt)}</span><span>{c('attempts')} {completedAttempts(item)}</span></span></button>)}</div>
    </>}
    <Pagination page={page} size={size} total={loading || error ? null : total} busy={loading} onChange={(next, pageSize) => update({ page: String(next), pageSize: String(pageSize) })} />
    <Sheet open={open} onOpenChange={value => { if (!resending) { setOpen(value); if (!value) detailId.current++; } }}><SheetContent closeLabel={c('close')} aria-describedby={undefined} className="left-auto right-0 flex w-full max-w-[520px] flex-col gap-[18px] overflow-y-auto border-l border-border bg-ground p-6 text-[13px] text-foreground">
      <SheetTitle className="pr-8 text-base font-semibold">{selected ? typeLabel(selected.type) : c(detailLoading ? 'loading' : 'detailFailed')}</SheetTitle>
      {detailError && <p role="alert" className="text-destructive">{c(detailError)}</p>}{notice && <p role="status">{c(notice)}</p>}
      {selected && <><p className="break-all text-muted-foreground">{selected.toAddress}</p>{selected.status === 'FAILED' && <div role="alert" className="space-y-1.5 rounded-[10px] border border-attention-line bg-attention-soft px-3.5 py-3 text-attention"><p className="font-medium">{c('failure', { count: selected.attempts })}</p><p className="break-all font-mono text-xs">{selected.lastError}</p><p className="text-xs text-faint">{c('lastAttemptUnknown')}</p></div>}
      <dl className="rounded-[10px] border border-border px-3.5 py-1">{[[c('status'), c(selected.status)], [c('attempts'), String(completedAttempts(selected))], [c('created', { timezone }), date(selected.createdAt)], ...(selected.sentAt ? [[c('sent'), date(selected.sentAt)]] : []), [c('provider'), selected.providerSlug || c('noProvider')]].map(([key, value]) => <div key={key} className="flex flex-wrap gap-x-3 gap-y-1 border-b border-border py-2 last:border-0"><dt className="w-28 text-muted-foreground">{key}</dt><dd className="min-w-0 flex-1 basis-48 break-words">{value}</dd></div>)}{selected.relatedType === 'order' && selected.relatedId && <div className="py-2"><Link className="underline underline-offset-4" href={`/${locale}/orders/${encodeURIComponent(selected.relatedId)}`}>{c('relatedOrder')} →</Link></div>}</dl>
      <section className="space-y-2"><h2 className="font-semibold">{c('content')}</h2><div className="space-y-2 rounded-[10px] border border-border bg-raised p-3.5"><h3 className="break-words font-medium">{selected.subject}</h3><p className="whitespace-pre-line break-words leading-relaxed text-muted-foreground">{selected.text.replace(/\{\{secret\.link\}\}/g, c('hiddenLink')).replace(/\{\{secret\.code\}\}/g, c('hiddenCode'))}</p></div></section>
      <div className="mt-auto space-y-1.5"><Button className="w-full" disabled={resending || !!blocked} onClick={() => void resend()}>{c('resend')}</Button><p className="text-xs leading-relaxed text-faint">{c(hint)}</p></div></>}
    </SheetContent></Sheet>
  </section>;
}
