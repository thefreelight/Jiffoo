import { expect, it } from 'vitest';
import { staffListFields, staffListQuery, staffStatus, staffInviteExpired, savedStaffListUrl } from '../lib/staff-list-state';
import { readListState, writeListState } from '../lib/hooks/use-list-state';
it('derives administrator status without email verification and gives removal priority', () => {
  expect(staffStatus({ isActive: true, removedAt: null })).toBe('active');
  expect(staffStatus({ isActive: false, removedAt: null })).toBe('invited');
  expect(staffStatus({ isActive: true, removedAt: '2026-10-01' })).toBe('removed');
  expect(staffInviteExpired({ isActive: false, removedAt: null, inviteExpiresAt: '2026-10-01' }, new Date('2026-10-15'))).toBe(true);
  expect(staffInviteExpired({ isActive: false, removedAt: '2026-10-01', inviteExpiresAt: null })).toBe(false);
  expect(staffInviteExpired({ isActive: false, removedAt: null, inviteExpiresAt: null })).toBe(false);
});
it('round-trips staff search, status and pagination, rejecting invalid list values', () => {
  const query = 'status=removed&search=owner&page=2&pageSize=50';
  expect(writeListState(query, readListState(query, staffListFields), staffListFields)).toBe(query);
  expect(staffListQuery('/en/staff?' + query)).toEqual({ search: 'owner', status: 'removed' });
  expect(readListState('status=ADMIN&page=0&pageSize=10', staffListFields)).toMatchObject({ status: 'all', page: '1', pageSize: '20' });
  expect(savedStaffListUrl('en', 'https://example.com')).toBe('/en/staff');
  expect(savedStaffListUrl('en', '/en/staff?status=removed')).toBe('/en/staff?status=removed');
});
