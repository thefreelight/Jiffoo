'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download, Users } from 'lucide-react';
import { useLocale, useT } from 'shared/src/i18n/react';
import { formatStoreTimestamp } from 'shared';
import { useStoreDate } from '@/lib/store-time';
import { useUsers } from '@/lib/hooks/use-api';
import { usersApi } from '@/lib/api';
import { customerListFields, customerListQuery, type CustomerQuery } from '@/lib/customer-list-state';
import { useListSelection, useListState, listDateRange } from '@/lib/hooks/use-list-state';
import { BulkBar, FilterChips, ListSearch, ListFilter, PaginationBar, SelectionBanner, SortHeader, StatusTabs } from '@/components/list';
import { CustomerActions, CustomerStatus, DeleteCustomerDialog } from '@/components/customers/customer-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency, cn } from '@/lib/utils';
import { resolveApiErrorMessage } from '@/lib/error-utils';
import type { Customer } from '@/lib/types';

const commonKeys = new Set(['export', 'exportSelected', 'onlyPage', 'cancelSelection', 'bulkActions', 'removeFilter', 'clearAll', 'clearFilters', 'today', 'last7', 'last30', 'custom', 'startDate', 'endDate', 'invalidDates', 'pagination', 'range', 'perPage', 'perPageBefore', 'perPageAfter', 'previous', 'next', 'pageLabel', 'retry']);
export default function CustomersPage() {
  const t = useT(), locale = useLocale(), router = useRouter(), { timezone } = useStoreDate();
  const copy = (key: string, values?: Record<string, string | number>) => t((commonKeys.has(key) ? 'merchant.orders.list.' : 'merchant.customers.workspace.') + key, values);
  const { state, update, url } = useListState(customerListFields);
  const change = (patch: Record<string, string>) => update({ page: '1', ...patch });
  useEffect(() => { sessionStorage.setItem('customers-list:' + locale, url); }, [url, locale]);
  const query = customerListQuery(url), page = Number(state.page), pageSize = Number(state.pageSize);
  const filter: CustomerQuery = { search: query.search, status: query.status, registered: query.registered, start: query.start, end: query.end };
  let invalidDates = false;
  try { listDateRange(state.registered, state.start, state.end, timezone); } catch { invalidDates = true; }
  const { data, isLoading, error, refetch } = useUsers({ ...query, page, limit: pageSize });
  const customers = invalidDates ? [] : data?.data ?? [], total = invalidDates ? 0 : data?.pagination.total ?? 0;
  const selection = useListSelection(JSON.stringify(filter), filter, customers.map(customer => customer.id), total);
  const [deleting, setDeleting] = useState<Customer | null>(null), [exporting, setExporting] = useState(false), [exportError, setExportError] = useState('');
  useEffect(() => { if (data?.pagination.page === page && page > Math.max(1, Math.ceil(total / pageSize))) update({ page: '1' }); }, [data?.pagination.page, page, pageSize, total]);
  const exportCustomers = async (selected: boolean) => {
    setExporting(true); setExportError('');
    try {
      const rows = selection.selection;
      const body = selected ? rows.mode === 'ids' ? rows : { mode: 'filter' as const, filters: rows.filter, excludedIds: rows.excludeIds } : { mode: 'filter' as const, filters: filter };
      const result = await usersApi.export(body, { sortBy: query.sortBy, sortOrder: query.sortOrder }, locale);
      const objectUrl = URL.createObjectURL(result.blob), anchor = document.createElement('a');
      anchor.href = objectUrl; anchor.download = result.filename; document.body.append(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (caught) { setExportError(resolveApiErrorMessage(caught, t)); } finally { setExporting(false); }
  };
  const clear = () => change({ search: '', status: 'all', registered: 'all', start: '', end: '' });
  const filtered = !!state.search || state.status !== 'all' || state.registered !== 'all';
  const dateLabel = state.registered === 'custom' ? [state.start, state.end].filter(Boolean).join(' – ') || copy('custom') : copy(state.registered);
  const detailUrl = (customer: Customer) => '/' + locale + '/customers/' + customer.id;
  const openRow = (event: MouseEvent, customer: Customer) => { if (!(event.target as HTMLElement).closest('a,button,input,label')) router.push(detailUrl(customer)); };
  const checkbox = (customer: Customer) => <input type="checkbox" aria-label={copy('selectCustomer', { name: customer.username })} checked={selection.checked(customer.id)} onChange={() => selection.toggle(customer.id)} className="size-[15px] shrink-0 cursor-pointer accent-foreground focus-visible:outline-2 focus-visible:outline-ring" />;
  const pageCheckbox = <input type="checkbox" aria-label={copy('selectPage')} checked={selection.pageChecked} disabled={!customers.length} onChange={selection.togglePage} className="size-[15px] accent-foreground focus-visible:outline-2 focus-visible:outline-ring" />;
  const timestamp = (value: string | null) => value ? formatStoreTimestamp(value, timezone) : copy('none');
  const customerLink = (customer: Customer) => <Link href={detailUrl(customer)} className="break-words font-medium hover:underline">{customer.username}<span className="mt-0.5 block break-all text-xs font-normal text-faint">{customer.email}</span></Link>;
  const sorts = [['orderCount', 'orders'], ['paidTotal', 'paidTotal'], ['lastOrderAt', 'lastOrder'], ['createdAt', 'registeredAt']];
  return <section className="mx-auto flex min-h-[calc(100dvh-72px)] min-w-0 max-w-[1120px] flex-col gap-4 [&:not(:first-child)]:mt-6">
    <header className="flex items-center justify-between gap-3"><h1 className="text-[26px] font-semibold tracking-[-0.025em]">{t('merchant.customers.title')}</h1><Button variant="outline" size="sm" disabled={exporting || invalidDates || isLoading || !!error} onClick={() => exportCustomers(false)}><Download aria-hidden="true" className="mr-1.5 size-3.5" />{copy('export')}</Button></header>
    <StatusTabs label={copy('status')} value={state.status} onChange={status => change({ status })} tabs={(['all', 'active', 'inactive'] as const).map(value => ({ value, label: copy(value), count: data?.statusCounts[value] }))} />
    <div className="flex flex-wrap gap-2"><ListSearch label={copy('search')} value={state.search} onChange={search => change({ search })} /><ListFilter label={copy('registered')} value={state.registered} onChange={registered => change({ registered })} options={['all', 'today', 'last7', 'last30', 'custom'].map(value => ({ value, label: copy(value) }))}>{state.registered === 'custom' && (['start', 'end'] as const).map(key => <label key={key} className="block space-y-1 text-xs text-muted-foreground">{copy(key === 'start' ? 'startDate' : 'endDate')}<Input type="date" aria-label={copy(key === 'start' ? 'startDate' : 'endDate')} value={state[key]} onChange={event => change({ [key]: event.target.value })} /></label>)}</ListFilter></div>
    <FilterChips chips={state.registered !== 'all' ? [{ key: 'registered', name: copy('registered'), value: dateLabel, remove: () => change({ registered: 'all', start: '', end: '' }) }] : []} copy={copy} clear={clear} />
    {invalidDates && <p role="alert">{copy('invalidDates')}</p>}{exportError && <p role="alert" className="text-destructive">{exportError}</p>}
    {error && !invalidDates ? <div role="alert" className="space-y-3 py-8"><p>{resolveApiErrorMessage(error, t)}</p><Button variant="outline" onClick={() => refetch()}>{copy('retry')}</Button></div> : isLoading ? <p role="status" className="py-8 text-muted-foreground">{copy('loading')}</p> : customers.length ? <div className="overflow-hidden rounded-lg border border-border">
      {(selection.pageChecked || selection.selection.mode === 'filter') && <SelectionBanner all={selection.selection.mode === 'filter'} count={selection.selection.mode === 'filter' ? selection.count : customers.length} total={total} copy={copy} selectAll={selection.allMatching} onlyPage={selection.onlyPage} />}
      <div className="hidden min-[1100px]:block"><table className="w-full text-left text-[13px]"><thead className="bg-raised text-xs text-faint"><tr><th scope="col" className="w-10 py-2.5 pl-4">{pageCheckbox}</th><th scope="col" className="px-3 py-2.5 font-medium">{copy('customer')}</th><th scope="col" className="px-3 py-2.5 font-medium">{t('merchant.customers.status')}</th>{sorts.map(([field, label]) => <SortHeader key={field} field={field} title={field === 'paidTotal' ? copy('paidTotalHint') : undefined} label={copy(label, { timezone })} sortBy={state.sortBy} sortOrder={state.sortOrder} onSort={(sortBy, sortOrder) => change({ sortBy, sortOrder })} />)}<th scope="col" className="w-11"><span className="sr-only">{copy('actions')}</span></th></tr></thead><tbody>{customers.map(customer => <tr key={customer.id} onClick={event => openRow(event, customer)} className={cn('cursor-pointer border-t border-border hover:bg-active', selection.checked(customer.id) && 'bg-active')}><td className="py-2.5 pl-4">{checkbox(customer)}</td><td className="max-w-[220px] px-3 py-2.5">{customerLink(customer)}</td><td className="px-3 py-2.5"><CustomerStatus active={customer.isActive} /></td><td className="px-3 py-2.5 text-right font-mono text-xs">{customer.orderCount}</td><td title={copy('paidTotalHint')} className={cn('whitespace-nowrap px-3 py-2.5 text-right font-mono text-xs', !customer.paidTotal && 'text-faint')}>{formatCurrency(customer.paidTotal, customer.currency)}</td><td aria-label={copy('lastOrderValue', { time: timestamp(customer.lastOrderAt) })} className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-muted-foreground">{timestamp(customer.lastOrderAt)}</td><td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-muted-foreground">{timestamp(customer.createdAt)}</td><td className="py-1.5 pr-4"><CustomerActions customer={customer} onDelete={() => setDeleting(customer)} /></td></tr>)}</tbody></table></div>
      <div aria-label={t('merchant.customers.title')} className="divide-y divide-border min-[1100px]:hidden"><p className="px-4 py-2 text-xs text-faint">{copy('registeredAt', { timezone })}</p><label className="flex items-center gap-2 px-4 py-3 text-xs">{pageCheckbox}{copy('selectPage')}</label><div className="flex flex-wrap gap-2 px-4 pb-3">{sorts.map(([field, label]) => <Button key={field} variant="outline" size="sm" onClick={() => change({ sortBy: field, sortOrder: state.sortBy === field && state.sortOrder === 'asc' ? 'desc' : 'asc' })}>{copy(field === 'createdAt' ? 'registered' : label, { timezone })}{state.sortBy === field ? state.sortOrder === 'asc' ? ' ↑' : ' ↓' : ''}</Button>)}</div>{customers.map(customer => <article key={customer.id} aria-label={customer.username} onClick={event => openRow(event, customer)} className={cn('min-w-0 cursor-pointer space-y-3 p-4', selection.checked(customer.id) && 'bg-active')}><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-2">{checkbox(customer)}<div>{customerLink(customer)}</div></div><CustomerActions customer={customer} onDelete={() => setDeleting(customer)} /></div><div className="flex flex-wrap justify-between gap-2"><CustomerStatus active={customer.isActive} /><span className="font-mono text-xs">{copy('orders')} {customer.orderCount} · {formatCurrency(customer.paidTotal, customer.currency)}</span></div><p className="flex flex-wrap justify-between gap-1 text-xs text-muted-foreground"><span>{copy('lastOrder')}</span>{timestamp(customer.lastOrderAt)}</p><p className="flex flex-wrap justify-between gap-1 text-xs text-muted-foreground"><span>{copy('registered')}</span>{timestamp(customer.createdAt)}</p></article>)}</div>
    </div> : <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-6 py-14 text-center"><Users aria-hidden="true" className="size-[22px] text-faint" /><p className="font-medium">{copy(filtered ? 'noMatches' : 'empty')}</p><p className="max-w-[420px] text-muted-foreground">{copy(filtered ? 'noMatchesDescription' : 'emptyDescription')}</p>{filtered && <Button variant="outline" size="sm" onClick={clear}>{copy('clearFilters')}</Button>}</div>}
    <PaginationBar page={page} pageSize={pageSize} total={total} copy={copy} onPage={value => update({ page: String(value) })} onPageSize={value => change({ pageSize: String(value) })} />
    <BulkBar count={selection.count} copy={copy} allMatching={selection.selection.mode === 'filter'} clear={selection.clear}><Button size="sm" disabled={exporting || invalidDates} onClick={() => exportCustomers(true)}><Download aria-hidden="true" className="mr-1.5 size-3.5" />{copy('exportSelected')}</Button></BulkBar>
    <DeleteCustomerDialog customer={deleting ? customers.find(customer => customer.id === deleting.id) ?? deleting : null} onClose={() => setDeleting(null)} onDeleted={selection.clear} />
  </section>;
}
