'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { useLocale, useT } from 'shared/src/i18n/react';
import { formatStoreTimestamp } from 'shared';
import { useStoreDate } from '@/lib/store-time';
import { useAuthStore } from '@/lib/store';
import { useStaffMember, useStaffAuditLogs, useStaffNeighbors, useRemoveStaff, useResendStaffInvite, useReinviteStaff } from '@/lib/hooks/use-api';
import { staffApi, unwrapApiResponse } from '@/lib/api';
import { staffListQuery, savedStaffListUrl, staffStatus, staffInviteExpired } from '@/lib/staff-list-state';
import { StaffStatus, StaffTag } from '@/components/staff/staff-presentation';
import { CopyButton } from '@/components/orders/CopyButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { resolveApiErrorMessage } from '@/lib/error-utils';

export default function StaffDetailPage() {
  const id = useParams().id as string, t = useT(), locale = useLocale(), { timezone, now } = useStoreDate();
  const self = useAuthStore(state => state.user);
  const c = (key: string, values?: Record<string, string | number>) => t('merchant.staffView.' + key, values);
  const member = useStaffMember(id), audit = useStaffAuditLogs(id), remove = useRemoveStaff(), resend = useResendStaffInvite(), reinvite = useReinviteStaff();
  const [listUrl, setListUrl] = useState('/' + locale + '/staff'), [confirm, setConfirm] = useState(false), [link, setLink] = useState<{ id: string; value: string } | null>(null), [failure, setFailure] = useState(''), [generating, setGenerating] = useState(false);
  useEffect(() => { setListUrl(savedStaffListUrl(locale, sessionStorage.getItem('staff-list:' + locale))); }, [locale]);
  useEffect(() => { setLink(null); setFailure(''); setConfirm(false); }, [id]);
  const neighbors = useStaffNeighbors(id, staffListQuery(listUrl));
  const back = <Link href={listUrl} className="text-muted-foreground hover:underline">{c('back')}</Link>;
  if (member.isLoading) return <p role="status">{c('loading')}</p>;
  if (member.error || !member.data) return <div role="alert" className="space-y-3"><p>{member.error ? resolveApiErrorMessage(member.error, t) : t('common.errors.notFound')}</p><Button variant="outline" onClick={() => member.refetch()}>{t('merchant.orders.list.retry')}</Button><div>{back}</div></div>;
  const account = member.data, status = staffStatus(account), expired = staffInviteExpired(account, new Date(now));
  const protectedAccount = account.isInstallAdmin || account.id === self?.id;
  const timestamp = (value: string) => formatStoreTimestamp(value, timezone);
  const records = (audit.data?.data ?? []).filter(entry => ['ADMIN_INVITED', 'ADMIN_INVITE_ACCEPTED', 'ADMIN_REMOVED'].includes(entry.action)).map(entry => ({
    id: entry.id, text: c(entry.action === 'ADMIN_REMOVED' ? 'removedEvent' : entry.action === 'ADMIN_INVITE_ACCEPTED' ? 'acceptedEvent' : entry.metadata?.reinvite ? 'reinvitedEvent' : 'invitedEvent'),
    who: entry.actorUsername || entry.actorEmail || entry.actorUserId || c('none'), at: entry.createdAt,
  }));
  if (account.isInstallAdmin) records.push({ id: 'installation', text: c('installedEvent'), who: c('system'), at: account.createdAt });
  records.sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
  const panel = 'overflow-hidden rounded-lg border border-border', heading = 'border-b border-border px-4 py-3 font-semibold';
  const invitation = link?.id === id && status === 'invited' ? link.value : '';
  return <section className="mx-auto min-w-0 max-w-[760px] [&:not(:first-child)]:mt-6">
    <header className="sticky top-0 z-30 space-y-2.5 border-b border-border bg-ground px-4 pb-3.5 pt-4 sm:px-8"><div className="flex flex-wrap items-center justify-between gap-2">{back}<nav aria-label={c('navigation')} className="flex items-center gap-1"><span className="mr-1 font-mono text-xs text-faint">{neighbors.data ? (neighbors.data.position ?? '—') + ' / ' + neighbors.data.total : '— / —'}</span>{(['previous', 'next'] as const).map(direction => { const neighbor = direction === 'previous' ? neighbors.data?.previousId : neighbors.data?.nextId, Icon = direction === 'previous' ? ChevronLeft : ChevronRight; return neighbor ? <Button key={direction} asChild variant="outline" size="icon" className="size-7"><Link href={'/' + locale + '/staff/' + neighbor} aria-label={c(direction)}><Icon aria-hidden="true" className="size-3" /></Link></Button> : <Button key={direction} variant="outline" size="icon" disabled className="size-7" aria-label={c(direction)}><Icon aria-hidden="true" className="size-3" /></Button>; })}</nav></div>
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 flex-wrap items-center gap-2.5"><span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-raised text-xs text-muted-foreground">{account.username.slice(0, 1).toUpperCase()}</span><h1 className="min-w-0 max-w-full break-words text-[22px] font-semibold tracking-[-0.02em]">{account.username}</h1><span className="rounded-md border border-border px-2 py-0.5 text-xs"><StaffStatus account={account} /></span><StaffTag account={account} selfId={self?.id} /></div>
        <div className="flex flex-wrap gap-2">{status !== 'removed' && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="size-8" aria-label={c('more', { name: account.username })}><MoreHorizontal aria-hidden="true" className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" aria-label={c('actions')} className="w-[260px] max-w-[calc(100vw-32px)]"><DropdownMenuItem disabled={protectedAccount} onSelect={() => setConfirm(true)} className={"flex flex-col items-start gap-0.5 " + (protectedAccount ? "text-faint data-[disabled]:opacity-100" : "text-destructive focus:text-destructive")}><span>{c(status === 'invited' ? 'revoke' : 'remove')}</span><span className="text-xs leading-relaxed text-faint">{c(protectedAccount ? 'protected' : status === 'invited' ? 'revokeHint' : 'removeHint')}</span></DropdownMenuItem></DropdownMenuContent></DropdownMenu>}
          {status === 'invited' && <><Button variant="outline" size="sm" disabled={generating} onClick={async () => { setGenerating(true); setLink(null); setFailure(''); try { const value = unwrapApiResponse(await staffApi.generateInviteLink(id)).link; setLink({ id, value }); await member.refetch(); } catch (error) { setFailure(resolveApiErrorMessage(error, t)); } finally { setGenerating(false); } }}>{c(expired ? 'copyNewInvite' : 'copyInvite')}</Button><Button size="sm" disabled={resend.isPending} onClick={async () => { setLink(null); try { await resend.mutateAsync(id); } catch { /* The mutation reports mapped errors. */ } }}>{c('resend')}</Button></>}
          {status === 'removed' && <Button size="sm" disabled={reinvite.isPending} onClick={async () => { try { await reinvite.mutateAsync(id); } catch { /* The mutation reports mapped errors. */ } }}>{c('reinvite')}</Button>}
          {account.id === self?.id && <Button asChild variant="outline" size="sm"><Link href={'/' + locale + '/profile'}>{c('selfEdit')}</Link></Button>}
        </div>
      </div><div className="flex flex-wrap gap-x-3.5 gap-y-1 text-muted-foreground"><span className="break-all">{account.email}</span><span>{c('addedAt', { time: timestamp(account.createdAt) })}</span><span className="text-faint">{c('timezone', { timezone })}</span></div>
    </header>
    <div className="space-y-5 px-4 pb-16 pt-6 sm:px-8">
      {failure && <p role="alert" className="text-destructive">{failure}</p>}
      {neighbors.error && <p role="alert">{resolveApiErrorMessage(neighbors.error, t)}</p>}
      {status !== 'active' && <section aria-label={c('status')} className="rounded-lg border border-border bg-raised px-4 py-3 leading-relaxed text-muted-foreground">{status === 'removed' ? c('removedBanner', { time: timestamp(account.removedAt!) }) : c(expired ? 'expiredBanner' : 'invitedBanner')}</section>}
      {invitation && <section aria-label={c('link')} className="space-y-2.5 rounded-lg border border-border px-4 py-3.5"><h2 className="font-medium">{c('linkGenerated')}</h2><div className="flex flex-wrap items-start gap-2"><Input aria-label={c('link')} readOnly value={invitation} className="h-8 min-w-0 flex-[1_1_200px] bg-raised font-mono text-xs" /><CopyButton value={invitation} name={c('copyLink')} label={c('copyLink')} variant="default" buttonClassName="h-8 px-3 text-[13px]" /></div><p className="text-xs leading-relaxed text-muted-foreground">{c('linkNote')}</p></section>}
      <section aria-labelledby="staff-info" className={panel}><h2 id="staff-info" className={heading}>{c('info')}</h2><dl className="divide-y divide-border px-4 py-1">{[[c('name'), account.username], [c('email'), account.email], [c('permissions'), c('allPermissions')], ...(status === 'invited' ? [[c('expiry'), account.inviteExpiresAt ? c(expired ? 'expiredAt' : 'validUntil', { time: timestamp(account.inviteExpiresAt) }) : c('none')]] : [])].map(([label, value]) => <div key={label} className="flex flex-wrap gap-x-4 gap-y-1 py-2.5"><dt className="w-24 text-muted-foreground">{label}</dt><dd className="min-w-0 flex-[1_1_200px] break-words">{value}</dd></div>)}</dl><p className="border-t border-border px-4 py-2.5 text-xs text-faint">{c('infoNote')}</p></section>
      <section aria-labelledby="staff-activity" className={panel}><h2 id="staff-activity" className={heading}>{c('activity')}</h2>{audit.error ? <p role="alert" className="p-4">{resolveApiErrorMessage(audit.error, t)}</p> : records.length ? <ol className="px-4 py-3.5">{records.map((event, index) => <li key={event.id} className="flex gap-3"><span aria-hidden="true" className="flex w-2.5 shrink-0 flex-col items-center"><span className={'mt-[5px] size-2 shrink-0 rounded-full ' + (index ? 'bg-faint' : 'bg-foreground')} /><span className={'w-px flex-1 ' + (index < records.length - 1 ? 'bg-border' : '')} /></span><div className="min-w-0 space-y-0.5 pb-3.5"><p>{event.text}</p><p className="break-words text-xs text-faint">{event.who} · {timestamp(event.at)}</p></div></li>)}</ol> : <p className="p-4 text-muted-foreground">{c('noActivity')}</p>}</section>
    </div>
    <AlertDialog open={confirm} onOpenChange={value => { if (!remove.isPending) setConfirm(value); }}><AlertDialogContent overlayClassName="bg-overlay-ink/30" className="w-[calc(100%_-_32px)] max-w-[440px] rounded-xl p-5"><AlertDialogHeader><AlertDialogTitle className="text-[15px]">{c('removeTitle', { name: account.username })}</AlertDialogTitle><AlertDialogDescription>{c('removeDescription', { name: account.username })}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="gap-2"><AlertDialogCancel disabled={remove.isPending}>{t('common.actions.cancel')}</AlertDialogCancel><Button variant="destructive" disabled={remove.isPending || protectedAccount} onClick={async () => { try { await remove.mutateAsync(id); setConfirm(false); } catch { /* Keep the confirmation open after failure. */ } }}>{c('confirmRemove')}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}
