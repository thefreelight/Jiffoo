'use client';
import { useT } from 'shared/src/i18n/react';
import { formatStoreTimestamp } from 'shared';
import { useStoreDate } from '@/lib/store-time';
import type { StaffMembership } from '@/lib/api';
import { staffStatus, staffInviteExpired } from '@/lib/staff-list-state';

export function StaffTag({ account, selfId }: { account: StaffMembership; selfId?: string }) {
  const t = useT();
  const tag = [account.isInstallAdmin ? t('merchant.staffView.owner') : '', account.id === selfId ? t('merchant.staffView.you') : ''].filter(Boolean).join(' · ');
  return tag ? <span className="inline-flex items-center rounded-[5px] border border-border px-1.5 text-[11px] font-normal text-muted-foreground">{tag}</span> : null;
}
export function StaffStatus({ account, note = false }: { account: StaffMembership; note?: boolean }) {
  const t = useT(), { timezone, now } = useStoreDate(), status = staffStatus(account);
  return <span className="inline-flex flex-col gap-0.5"><span className={'inline-flex items-center gap-[7px] whitespace-nowrap ' + (status === 'removed' ? 'text-faint' : '')}><span aria-hidden="true" className={'size-[7px] rounded-full border-[1.4px] border-current ' + (status === 'active' ? 'bg-current' : status === 'invited' ? 'border-dashed' : '')} />{t('merchant.staffView.' + status)}</span>{note && status === 'invited' && <span className="pl-3.5 text-xs text-faint">{!account.inviteExpiresAt ? t('merchant.staffView.none') : staffInviteExpired(account, new Date(now)) ? t('merchant.staffView.expired') : t('merchant.staffView.validUntil', { time: formatStoreTimestamp(account.inviteExpiresAt!, timezone) })}</span>}</span>;
}
