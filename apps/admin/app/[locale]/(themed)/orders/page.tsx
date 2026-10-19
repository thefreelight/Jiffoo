'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Download } from 'lucide-react';
import { useLocale, useT } from 'shared/src/i18n/react';
import { formatStoreTimestamp } from 'shared';
import { useStoreDate } from '@/lib/store-time';
import { useOrders, useOrderStats, type Order } from '@/lib/hooks/use-api';
import { ordersApi, type PaginationParams } from '@/lib/api';
import { useListState, useListSelection, listDateRange } from '@/lib/hooks/use-list-state';
import { BulkBar, FilterChips, ListEmpty, ListSearch, ListFilter, PaginationBar, SelectionBanner, SortHeader, StatusTabs } from '@/components/list';
import { PaymentPill, StatusShape } from '@/components/orders/order-badges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency, cn } from '@/lib/utils';
import { orderListFields as fields, orderStatuses as statuses } from '@/lib/order-list-state';


export default function OrdersPage() {
  const t = useT(), locale = useLocale(), { timezone } = useStoreDate(), router = useRouter();
  const copy = (key: string, values?: Record<string, string | number>) => t('merchant.orders.list.' + key, values);
  const statusLabel = (value: string) => value === 'All' ? copy('all') : t('merchant.orders.' + value.toLowerCase());
  const { state, update, url } = useListState(fields);
  const change = (patch: Record<string, string>) => update({ page: '1', ...patch });
  useEffect(() => { sessionStorage.setItem('orders-list:' + locale, url); }, [url, locale]);
  const { status, payment, search, date, start, end, customerId, customerEmail } = state;
  const page = Number(state.page), pageSize = Number(state.pageSize);
  const sort = { sortBy: state.sortBy as 'createdAt' | 'totalAmount', sortOrder: state.sortOrder as 'asc' | 'desc' };
  let dates: Pick<PaginationParams, 'createdFrom' | 'createdTo'> = {}, invalidDates = false;
  try { dates = listDateRange(date, start, end, timezone); } catch { invalidDates = true; }
  const filter: PaginationParams = { status: status === 'All' ? undefined : status, search, customerId: customerId || undefined,
    paymentStatus: ['paid', 'unpaid', 'refunded'].includes(payment) ? payment.toUpperCase() as PaginationParams['paymentStatus'] : undefined,
    paymentReview: payment === 'review' ? 'required' : undefined, ...dates };
  const { data, isLoading, error, refetch } = useOrders({ ...filter, ...sort, page, limit: pageSize }, () => invalidDates ? {} : listDateRange(date, start, end, timezone));
  const stats = useOrderStats(), orders = invalidDates ? [] : data?.data ?? [], total = invalidDates ? 0 : data?.pagination?.total ?? 0;
  useEffect(() => {
    if (data?.pagination?.page === page && page > Math.max(1, Math.ceil(total / pageSize))) update({ page: '1' });
  }, [data?.pagination?.page, page, pageSize, total]);
  const selection = useListSelection(JSON.stringify(state), filter, orders.map(order => order.id), total);
  const [exporting, setExporting] = useState(false), [exportError, setExportError] = useState(false);
  const [retrySelected, setRetrySelected] = useState(false);
  const exportOrders = async (selected: boolean) => {
    setExporting(true); setExportError(false); setRetrySelected(selected);
    try {
      const result = await ordersApi.export(selected ? selection.selection : { mode: 'filter', filter: { ...filter, ...listDateRange(date, start, end, timezone) } }, sort, locale);
      const objectUrl = URL.createObjectURL(result.blob), anchor = document.createElement('a');
      anchor.href = objectUrl; anchor.download = result.filename; document.body.append(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch { setExportError(true); } finally { setExporting(false); }
  };
  const clear = () => change({ search: '', payment: 'all', date: 'all', start: '', end: '', customerId: '', customerEmail: '' });
  const filtered = !!search || !!customerId || status !== 'All' || payment !== 'all' || date !== 'all';
  const paymentLabel = payment === 'all' ? copy('all') : payment === 'review' ? copy('requiresReview') : payment === 'unpaid' ? copy('unpaid') : t('merchant.orders.' + payment);
  const dateLabel = date === 'custom' ? [start, end].filter(Boolean).join(' – ') || copy('custom') : copy(date);
  const chips = [
    ...(customerId ? [{ key: 'customer', name: copy('customer'), value: customerEmail || orders[0]?.customer.email || customerId, remove: () => change({ customerId: '', customerEmail: '' }) }] : []),
    ...(payment !== 'all' ? [{ key: 'payment', name: copy('payment'), value: paymentLabel, remove: () => change({ payment: 'all' }) }] : []),
    ...(date !== 'all' ? [{ key: 'date', name: copy('placed'), value: dateLabel, remove: () => change({ date: 'all', start: '', end: '' }) }] : []),
  ];
  const detailUrl = (order: Order) => '/' + locale + '/orders/' + order.id;
  const openRow = (event: MouseEvent, order: Order) => {
    if ((event.target as HTMLElement).closest('a,button,input,label')) return;
    router.push(detailUrl(order));
  };
  const orderLink = (order: Order) => <Link href={detailUrl(order)} aria-label={copy('detail', { id: order.orderNumber })} title={order.orderNumber} className="break-all font-mono text-xs font-medium text-foreground hover:underline min-[769px]:block min-[769px]:max-w-[150px] min-[769px]:truncate">{order.orderNumber}</Link>;
  const checkbox = (order: Order) => <input type="checkbox" aria-label={copy('selectOrder', { id: order.orderNumber })} checked={selection.checked(order.id)} onChange={() => selection.toggle(order.id)} className="size-[15px] shrink-0 cursor-pointer accent-foreground focus-visible:outline-2 focus-visible:outline-ring" />;
  const statusText = (order: Order) => <span className="inline-flex items-center gap-[7px] whitespace-nowrap"><StatusShape status={order.status} />{statusLabel(order.status)}</span>;
  const pageCheckbox = <input type="checkbox" aria-label={copy('selectPage')} checked={selection.pageChecked} onChange={selection.togglePage} disabled={!orders.length} className="size-[15px] cursor-pointer accent-foreground focus-visible:outline-2 focus-visible:outline-ring" />;
  return <section className="mx-auto flex min-h-[calc(100dvh-72px)] min-w-0 max-w-[1120px] flex-col gap-4 [&:not(:first-child)]:mt-6">
    <header className="flex items-center justify-between gap-3"><h1 className="text-[26px] font-semibold tracking-[-0.025em]">{t('merchant.orders.title')}</h1><Button variant="outline" size="sm" className="bg-ground" disabled={exporting || invalidDates} onClick={() => exportOrders(false)}><Download aria-hidden="true" className="mr-1.5 size-3.5" />{copy('export')}</Button></header>
    <StatusTabs label={copy('status')} value={status} onChange={value => change({ status: value })} tabs={statuses.map(value => ({ value, label: statusLabel(value), count: stats.data ? value === 'All' ? Object.values(stats.data.statusCounts).reduce((sum, count) => sum + count, 0) : stats.data.statusCounts[value] : undefined }))} />
    {stats.error && <p role="status" className="text-muted-foreground">{copy('statsError')}</p>}
    {!!stats.data?.paymentReviewCount && <div role="status" className="flex flex-wrap items-center gap-2.5 rounded-lg border border-attention-line bg-attention-soft px-3.5 py-3 text-attention"><AlertTriangle aria-hidden="true" className="size-4 shrink-0" /><p className="min-w-0 flex-1 basis-[320px]">{copy('reviewBanner', { count: stats.data.paymentReviewCount })}</p><Button variant="outline" size="sm" className="h-[30px] border-attention-line bg-transparent text-attention" onClick={() => change({ status: 'All', payment: 'review' })}>{copy('reviewAction')}</Button></div>}
    <div className="flex flex-wrap gap-2">
      <ListSearch label={copy('search')} value={search} onChange={value => change({ search: value })} />
      <ListFilter label={copy('payment')} value={payment} onChange={value => change({ payment: value })} options={['all', 'paid', 'unpaid', 'review', 'refunded'].map(value => ({ value, label: value === 'all' ? copy('all') : value === 'review' ? copy('requiresReview') : value === 'unpaid' ? copy('unpaid') : t('merchant.orders.' + value) }))} />
      <ListFilter label={copy('placed')} value={date} onChange={value => change({ date: value })} options={['all', 'today', 'last7', 'last30', 'custom'].map(value => ({ value, label: copy(value) }))}>
        {date === 'custom' && (['start', 'end'] as const).map(key => <label key={key} className="block space-y-1 text-xs text-muted-foreground">{copy(key === 'start' ? 'startDate' : 'endDate')}<Input type="date" aria-label={copy(key === 'start' ? 'startDate' : 'endDate')} value={state[key]} onChange={event => change({ [key]: event.target.value })} /></label>)}
      </ListFilter>
    </div>
    <FilterChips chips={chips} copy={copy} clear={clear} />
    {invalidDates && <p role="alert">{copy('invalidDates')}</p>}
    {exportError && <div role="alert" className="flex items-center gap-3"><p>{copy('exportError')}</p><Button variant="outline" size="sm" disabled={exporting} onClick={() => exportOrders(retrySelected)}>{copy('retry')}</Button></div>}
    {error ? <div role="alert" className="space-y-3 py-8"><p>{copy('error')}</p><Button variant="outline" onClick={() => refetch()}>{copy('retry')}</Button></div> : isLoading ? <p role="status" className="py-8 text-muted-foreground">{copy('loading')}</p> : <>
      <div className="overflow-hidden rounded-lg border border-border">
        {(selection.pageChecked || selection.selection.mode === 'filter') && <SelectionBanner all={selection.selection.mode === 'filter'} count={selection.selection.mode === 'filter' ? selection.count : orders.length} total={total} copy={copy} selectAll={selection.allMatching} onlyPage={selection.onlyPage} />}
        <div className="hidden overflow-x-auto min-[769px]:block"><table className="w-full text-left text-[13px]"><thead className="bg-raised text-xs text-faint"><tr><th scope="col" className="w-10 py-2.5 pl-4">{pageCheckbox}</th>{['order', 'customer', 'status', 'payment'].map(key => <th key={key} scope="col" className="whitespace-nowrap px-3 py-2.5 font-medium">{copy(key)}</th>)}{['totalAmount', 'createdAt'].map(field => <SortHeader key={field} label={copy(field === 'totalAmount' ? 'amount' : 'placedAt', { timezone })} field={field} {...sort} onSort={(sortBy, sortOrder) => change({ sortBy, sortOrder })} />)}</tr></thead><tbody>{orders.map(order => <tr key={order.id} onClick={event => openRow(event, order)} className={cn('cursor-pointer border-t border-border hover:bg-active', selection.checked(order.id) && 'bg-active')}><td className="py-2.5 pl-4">{checkbox(order)}</td><td className="px-3 py-2.5">{orderLink(order)}<p className="mt-0.5 text-xs text-faint">{copy('items', { count: order.itemQuantitySum })}</p></td><td className="px-3 py-2.5 text-muted-foreground"><p title={order.customer.email || undefined} className="max-w-[260px] truncate">{order.customer.email || t('merchant.orders.noEmail')}</p></td><td className="px-3 py-2.5">{statusText(order)}</td><td className="px-3 py-2.5"><PaymentPill {...order} /></td><td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-xs">{formatCurrency(order.totalAmount, order.currency)}</td><td className="whitespace-nowrap px-3 py-2.5 pr-4 text-right tabular-nums text-muted-foreground">{formatStoreTimestamp(order.createdAt, timezone)}</td></tr>)}</tbody></table></div>
        <div aria-label={t('merchant.orders.title')} className="divide-y divide-border min-[769px]:hidden"><p className="px-4 py-2 text-xs text-faint">{copy('placedAt', { timezone })}</p>{!!orders.length && <label className="flex items-center gap-2 px-4 py-3 text-xs">{pageCheckbox}{copy('selectPage')}</label>}{orders.map(order => <article key={order.id} aria-label={copy('detail', { id: order.orderNumber })} onClick={event => openRow(event, order)} className={cn('min-w-0 cursor-pointer space-y-3 p-4', selection.checked(order.id) && 'bg-active')}><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-2">{checkbox(order)}<div>{orderLink(order)}<p className="mt-1 text-xs text-faint">{copy('items', { count: order.itemQuantitySum })}</p></div></div><span className="shrink-0 font-mono">{formatCurrency(order.totalAmount, order.currency)}</span></div><p className="break-all text-muted-foreground">{order.customer.email || t('merchant.orders.noEmail')}</p><div className="flex flex-wrap items-center justify-between gap-2">{statusText(order)}<PaymentPill {...order} /></div><p className="flex flex-wrap justify-between gap-1 text-xs text-faint"><span>{copy('placed')}</span><time dateTime={order.createdAt}>{formatStoreTimestamp(order.createdAt, timezone)}</time></p></article>)}</div>
        {!orders.length && <ListEmpty filtered={filtered} copy={copy} clear={() => change({ status: 'All', search: '', payment: 'all', date: 'all', start: '', end: '', customerId: '', customerEmail: '' })} />}
      </div>
    </>}
    <PaginationBar page={page} pageSize={pageSize} total={total} copy={copy} onPage={value => update({ page: String(value) })} onPageSize={value => change({ pageSize: String(value) })} />
    <BulkBar count={selection.count} copy={copy} allMatching={selection.selection.mode === 'filter'} clear={selection.clear}><Button size="sm" disabled={exporting || invalidDates} onClick={() => exportOrders(true)}><Download aria-hidden="true" className="mr-1.5 size-3.5" />{copy('exportSelected')}</Button></BulkBar>
  </section>;
}
