'use client';
import { useEffect, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useLocale, useT } from 'shared/src/i18n/react';
import { formatStoreTimestamp } from 'shared';
import { useStoreDate } from '@/lib/store-time';
import { useAuthStore } from '@/lib/store';
import { useStaff, useCreateStaff } from '@/lib/hooks/use-api';
import { useListState } from '@/lib/hooks/use-list-state';
import { staffListFields, staffListQuery } from '@/lib/staff-list-state';
import { StaffStatus, StaffTag } from '@/components/staff/staff-presentation';
import { StatusTabs, ListSearch, PaginationBar } from '@/components/list';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { resolveApiErrorMessage } from '@/lib/error-utils';
import type { StaffMembership } from '@/lib/api';

export default function StaffPage() {
  const t = useT(), locale = useLocale(), router = useRouter(), { timezone } = useStoreDate(), user = useAuthStore(state => state.user);
  const c = (key: string, values?: Record<string, string | number>) => t('merchant.staffView.' + key, values);
  const common = (key: string, values?: Record<string, string | number>) => t('merchant.orders.list.' + key, values);
  const { state, update, url } = useListState(staffListFields);
  const change = (patch: Record<string, string>) => update({ page: '1', ...patch });
  useEffect(() => { sessionStorage.setItem('staff-list:' + locale, url); }, [url, locale]);
  const page = Number(state.page), limit = Number(state.pageSize);
  const staff = useStaff({ ...staffListQuery(url), page, limit }), create = useCreateStaff();
  const [open, setOpen] = useState(false), [email, setEmail] = useState(''), [name, setName] = useState(''), [failure, setFailure] = useState('');
  const items = staff.data?.data ?? [], total = staff.data?.pagination.total ?? 0;
  useEffect(() => { if (staff.data?.pagination.page === page && page > Math.max(1, Math.ceil(total / limit))) update({ page: '1' }); }, [staff.data?.pagination.page, page, limit, total]);
  const detail = (id: string) => '/' + locale + '/staff/' + id;
  const navigate = (event: MouseEvent, account: StaffMembership) => { if (!(event.target as HTMLElement).closest('a,button,input,label')) router.push(detail(account.id)); };
  const identity = (account: StaffMembership) => <Link href={detail(account.id)} className="flex min-w-0 items-center gap-2.5"><span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-raised text-[11px] text-muted-foreground">{account.username.slice(0, 1).toUpperCase()}</span><span className="min-w-0"><span className="flex flex-wrap items-center gap-1.5 font-medium">{account.username}<StaffTag account={account} selfId={user?.id} /></span><span className="mt-0.5 block break-all text-xs text-faint">{account.email}</span></span></Link>;
  return <section className="mx-auto min-w-0 max-w-[1120px] space-y-4 [&:not(:first-child)]:mt-6">
    <header className="flex flex-wrap items-start justify-between gap-3"><div className="space-y-1.5"><h1 className="text-[26px] font-semibold tracking-[-0.025em]">{c('title')}</h1><p className="text-muted-foreground">{c('description')}</p></div><Button size="sm" onClick={() => { setFailure(''); setOpen(true); }}><Plus aria-hidden="true" className="mr-1.5 size-3.5" />{c('invite')}</Button></header>
    <StatusTabs label={c('status')} value={state.status} onChange={status => change({ status })} tabs={(['all', 'active', 'invited', 'removed'] as const).map(value => ({ value, label: c(value), count: staff.data?.statusCounts[value] }))} />
    <ListSearch label={c('search')} value={state.search} onChange={search => change({ search })} />
    {staff.error ? <div role="alert" className="space-y-3"><p>{resolveApiErrorMessage(staff.error, t)}</p><Button variant="outline" onClick={() => staff.refetch()}>{common('retry')}</Button></div> : staff.isLoading && !staff.data ? <p role="status">{c('loading')}</p> : items.length ? <div className="overflow-hidden rounded-lg border border-border">
      <div className="hidden min-[769px]:block"><table className="w-full text-left text-[13px]"><thead className="bg-raised text-xs text-faint"><tr><th scope="col" className="px-4 py-2.5 font-medium">{c('title')}</th><th scope="col" className="px-3 py-2.5 font-medium">{t('merchant.customers.status')}</th><th scope="col" className="px-4 py-2.5 text-right font-medium">{c('added', { timezone })}</th></tr></thead><tbody>{items.map(account => <tr key={account.id} className="cursor-pointer border-t border-border hover:bg-active" onClick={event => navigate(event, account)}><td className="px-4 py-2.5">{identity(account)}</td><td className="px-3 py-2.5"><StaffStatus account={account} note /></td><td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-muted-foreground">{formatStoreTimestamp(account.createdAt, timezone)}</td></tr>)}</tbody></table></div>
      <div className="divide-y divide-border min-[769px]:hidden"><p className="px-4 py-2 text-xs text-faint">{c('added', { timezone })}</p>{items.map(account => <article key={account.id} aria-label={account.username} className="min-w-0 cursor-pointer space-y-3 p-4" onClick={event => navigate(event, account)}>{identity(account)}<div className="flex flex-wrap items-center justify-between gap-2"><StaffStatus account={account} note /><time className="text-xs tabular-nums text-muted-foreground">{formatStoreTimestamp(account.createdAt, timezone)}</time></div></article>)}</div>
    </div> : <p className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">{c('empty')}</p>}
    <PaginationBar page={page} pageSize={limit} total={total} copy={common} onPage={value => update({ page: String(value) })} onPageSize={value => change({ pageSize: String(value) })} />
    <Dialog open={open} onOpenChange={value => { if (!create.isPending) setOpen(value); }}><DialogContent showCloseButton={false} overlayClassName="bg-overlay-ink/30" className="w-[calc(100%_-_32px)] max-w-[440px] rounded-xl p-5"><DialogHeader><DialogTitle className="text-[15px]">{c('invite')}</DialogTitle><DialogDescription>{c('inviteDescription')}</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={async event => { event.preventDefault(); setFailure(''); try { await create.mutateAsync({ email: email.trim(), username: name.trim() }); setOpen(false); setEmail(''); setName(''); } catch (error) { const code = (error as { code?: string }).code; setFailure(code === 'EMAIL_TAKEN' ? c('emailTaken') : resolveApiErrorMessage(error, t)); } }}><label className="block space-y-1.5">{c('email')}<Input type="email" required value={email} onChange={event => { setEmail(event.target.value); setFailure(''); }} placeholder={c('emailPlaceholder')} aria-invalid={!!failure} aria-describedby={failure ? 'staff-email-error' : undefined} /></label>{failure && <p id="staff-email-error" role="alert" className="text-xs text-destructive">{failure}</p>}<label className="block space-y-1.5">{c('name')}<Input required maxLength={50} value={name} placeholder={c('namePlaceholder')} onChange={event => setName(event.target.value)} /></label><DialogFooter className="gap-2"><Button type="button" variant="outline" disabled={create.isPending} onClick={() => setOpen(false)}>{t('common.actions.cancel')}</Button><Button type="submit" disabled={create.isPending || !email.trim() || !name.trim()}>{c('send')}</Button></DialogFooter></form></DialogContent></Dialog>
  </section>;
}
