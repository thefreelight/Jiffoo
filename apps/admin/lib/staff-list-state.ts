import { listChoice, readListState, type ListFields } from './hooks/use-list-state';
export const staffListFields: ListFields = {
  search: { default: '', valid: () => true }, status: listChoice(['all', 'active', 'invited', 'removed']),
  page: { default: '1', valid: value => /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) }, pageSize: listChoice(['20', '50', '100']),
};
export type StaffFilter = { search?: string; status?: 'all' | 'active' | 'invited' | 'removed' };
export function staffListQuery(url: string): StaffFilter {
  const state = readListState(url.split('?')[1] ?? '', staffListFields);
  return { search: state.search || undefined, status: state.status as StaffFilter['status'] };
}
export function savedStaffListUrl(locale: string, saved: string | null) {
  const path = '/' + locale + '/staff'; return saved === path || saved?.startsWith(path + '?') ? saved : path;
}
export function staffStatus(account: { removedAt: string | null; isActive: boolean }) {
  return account.removedAt ? 'removed' : account.isActive ? 'active' : 'invited';
}
export function staffInviteExpired(account: { removedAt: string | null; isActive: boolean; inviteExpiresAt: string | null }, now = new Date()) {
  return staffStatus(account) === 'invited' && !!account.inviteExpiresAt && Date.parse(account.inviteExpiresAt) <= now.getTime();
}
