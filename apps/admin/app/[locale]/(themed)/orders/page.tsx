'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Package, Search } from 'lucide-react';
import { useLocale, useT } from 'shared/src/i18n/react';
import { formatStoreTimestamp } from 'shared';
import { useStoreDate } from '@/lib/store-time';
import { useOrders, useOrderStats, type Order } from '@/lib/hooks/use-api';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const statuses = ['All', 'PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'] as const;
type PaymentFilter = 'All' | 'PAID' | 'UNPAID' | 'REVIEW' | 'REFUNDED';

function StatusShape({ status }: { status: string }) {
  const cancelled = status === 'CANCELLED' || status === 'REFUNDED';
  return <span aria-hidden="true" className={cn('relative inline-flex size-3 shrink-0 rounded-full border border-current',
    (status === 'PENDING' || cancelled) && 'text-faint', status === 'PENDING' && 'border-dashed')}
    style={{ background: status === 'DELIVERED' ? 'currentColor' : status === 'PROCESSING' ? 'conic-gradient(currentColor 50%, transparent 0)' : status === 'SHIPPED' ? 'conic-gradient(currentColor 75%, transparent 0)' : undefined }}>
    {cancelled && <span className="absolute inset-0 flex items-center justify-center text-[10px] leading-none">×</span>}
  </span>;
}

export default function OrdersPage() {
  const t = useT(), locale = useLocale(), { timezone } = useStoreDate();
  const copy = (key: string, values?: Record<string, string | number>) => t('merchant.orders.list.' + key, values);
  const statusLabel = (status: string) => status === 'All' ? copy('all') : t('merchant.orders.' + status.toLowerCase());
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [payment, setPayment] = useState<PaymentFilter>('All');
  const [page, setPage] = useState(1);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const limit = 20;
  const { data, isLoading, error, refetch } = useOrders({ page, limit, search,
    status: status === 'All' ? undefined : status,
    paymentStatus: payment === 'PAID' || payment === 'UNPAID' || payment === 'REFUNDED' ? payment : undefined,
    paymentReview: payment === 'REVIEW' ? 'required' : undefined,
  });
  const stats = useOrderStats();
  const orders = data?.data ?? [], pagination = data?.pagination;
  const reviewCount = stats.data?.paymentReviewCount;
  const paymentLabel = (order: Order) => order.requiresPaymentReview ? copy('requiresReview') : order.paymentStatus === 'PAID' ? t('merchant.orders.paid') : order.paymentStatus === 'REFUNDED' ? t('merchant.orders.refunded') : copy('unpaid');
  const paymentPill = (order: Order) => <span className={cn('inline-flex rounded-md border px-2 py-0.5 text-xs whitespace-nowrap', order.requiresPaymentReview ? 'border-attention-line bg-attention-soft text-attention' : order.paymentStatus === 'PAID' ? 'border-border text-foreground' : 'border-border text-faint')}>{paymentLabel(order)}</span>;
  const orderLink = (order: Order) => <Link href={'/' + locale + '/orders/' + order.id} aria-label={copy('detail', { id: order.id })} title={order.id} className="font-mono text-foreground hover:underline break-all min-[769px]:block min-[769px]:max-w-[150px] min-[769px]:truncate">#{order.id}</Link>;
  const statusText = (order: Order) => <span className="inline-flex items-center gap-2 whitespace-nowrap"><StatusShape status={order.status} />{statusLabel(order.status)}</span>;
  const empty = search || status !== 'All' || payment !== 'All' ? copy('noMatches') : copy('empty');
  return <section className="min-w-0 space-y-5">
    <h1 className="text-[26px] font-semibold tracking-[-0.025em]">{t('merchant.orders.title')}</h1>
    <div role="tablist" aria-label={copy('status')} className="flex flex-wrap gap-x-5 border-b border-border">
      {statuses.map((value, index) => <button key={value} type="button" role="tab" aria-selected={status === value} tabIndex={status === value ? 0 : -1}
        ref={element => { tabRefs.current[index] = element; }}
        onKeyDown={event => {
          const next = event.key === 'ArrowRight' ? (index + 1) % statuses.length : event.key === 'ArrowLeft' ? (index + statuses.length - 1) % statuses.length : event.key === 'Home' ? 0 : event.key === 'End' ? statuses.length - 1 : undefined;
          if (next === undefined) return;
          event.preventDefault(); setStatus(statuses[next]); setPage(1); tabRefs.current[next]?.focus();
        }}
        onClick={() => { setStatus(value); setPage(1); }}
        className={cn('flex items-center gap-2 border-b-[1.5px] py-2.5 text-[13px]', status === value ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
        {statusLabel(value)}<span className="font-mono text-xs tabular-nums text-faint">{stats.data ? value === 'All' ? stats.data.metrics.totalOrders : stats.data.statusCounts[value] : '—'}</span>
      </button>)}
    </div>
    {stats.error && <p role="status" className="text-muted-foreground">{copy('statsError')}</p>}
    {reviewCount !== undefined && reviewCount > 0 && <div role="status" className="grid grid-cols-[16px_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-lg border border-attention-line bg-attention-soft px-4 py-3 text-attention min-[769px]:flex min-[769px]:items-center">
      <AlertTriangle aria-hidden="true" className="size-4 shrink-0" /><p className="min-w-0 flex-1">{copy('reviewBanner', { count: reviewCount })}</p>
      <button type="button" className="col-start-2 justify-self-start font-medium underline underline-offset-4" onClick={() => { setPayment('REVIEW'); setStatus('All'); setPage(1); }}>{copy('reviewAction')}</button>
    </div>}
    <div className="flex flex-col gap-3 min-[769px]:flex-row">
      <div className="relative min-w-0 flex-1">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-2 size-4 text-faint" />
        <Input aria-label={copy('search')} placeholder={copy('search')} value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} className="h-8 bg-raised pl-9 text-[13px]" />
      </div>
      <label className="flex h-8 items-center gap-2 rounded-md border border-border bg-raised px-3">
        <span className="text-faint">{copy('payment')}</span>
        <select aria-label={copy('payment')} value={payment} onChange={event => { setPayment(event.target.value as PaymentFilter); setPage(1); }} className="min-w-0 flex-1 bg-transparent text-foreground outline-none">
          <option value="All">{copy('all')}</option><option value="PAID">{t('merchant.orders.paid')}</option><option value="UNPAID">{copy('unpaid')}</option><option value="REVIEW">{copy('requiresReview')}</option><option value="REFUNDED">{t('merchant.orders.refunded')}</option>
        </select>
      </label>
    </div>
    {error ? <div role="alert" className="space-y-3 py-8"><p>{copy('error')}</p><Button variant="outline" onClick={() => refetch()}>{copy('retry')}</Button></div> : isLoading ? <p role="status" className="py-8 text-muted-foreground">{copy('loading')}</p> : <>
      <div className="hidden overflow-x-auto rounded-[10px] border border-border min-[769px]:block">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-raised text-xs font-normal text-faint"><tr>
            {[copy('order'), copy('customer'), copy('status'), copy('payment'), copy('amount'), copy('placedAt', { timezone })].map((label, index) => <th key={label} scope="col" className={cn('px-4 py-3 font-normal whitespace-nowrap', index >= 4 && 'text-right')}>{label}</th>)}
          </tr></thead>
          <tbody>{orders.length ? orders.map(order => <tr key={order.id} className="border-t border-border hover:bg-accent/60">
            <td className="px-4 py-3"><div className="flex items-center gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-raised"><Package aria-hidden="true" className="size-4 text-muted-foreground" /></span><div>{orderLink(order)}<p className="mt-1 text-xs text-faint">{copy('items', { count: order.itemQuantitySum })}</p></div></div></td>
            <td className="px-4 py-3 text-muted-foreground"><p title={order.customer.email || undefined} className="max-w-[260px] truncate">{order.customer.email || t('merchant.orders.noEmail')}</p></td>
            <td className="px-4 py-3">{statusText(order)}</td><td className="px-4 py-3">{paymentPill(order)}</td>
            <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">{formatCurrency(order.totalAmount, order.currency)}</td>
            <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{formatStoreTimestamp(order.createdAt, timezone)}</td>
          </tr>) : <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">{empty}</td></tr>}</tbody>
        </table>
      </div>
      <div aria-label={t('merchant.orders.title')} className="divide-y divide-border rounded-[10px] border border-border min-[769px]:hidden">
        {orders.length ? orders.map(order => <article key={order.id} aria-label={copy('detail', { id: order.id })} className="min-w-0 space-y-3 p-4">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0">{orderLink(order)}<p className="mt-1 text-xs text-faint">{copy('items', { count: order.itemQuantitySum })}</p></div><span className="shrink-0 font-mono tabular-nums">{formatCurrency(order.totalAmount, order.currency)}</span></div>
          <p className="break-all text-muted-foreground">{order.customer.email || t('merchant.orders.noEmail')}</p>
          <div className="flex flex-wrap items-center justify-between gap-2">{statusText(order)}{paymentPill(order)}</div>
          <p className="flex flex-wrap justify-between gap-1 text-xs text-faint"><span>{copy('placedAt', { timezone })}</span><time dateTime={order.createdAt} className="tabular-nums">{formatStoreTimestamp(order.createdAt, timezone)}</time></p>
        </article>) : <p className="py-12 text-center text-muted-foreground">{empty}</p>}
      </div>
      {pagination && <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <p className="tabular-nums">{copy('range', { start: pagination.total ? (page - 1) * limit + 1 : 0, end: Math.min(page * limit, pagination.total), total: pagination.total })}</p>
        <div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>{copy('previous')}</Button><Button size="sm" variant="outline" disabled={page >= pagination.totalPages} onClick={() => setPage(value => value + 1)}>{copy('next')}</Button></div>
      </div>}
    </>}
  </section>;
}
