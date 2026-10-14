import { listChoice, readListState, validListDate, type ListFields } from '@/lib/hooks/use-list-state';

export const customerListFields: ListFields = {
  search: { default: '', valid: () => true }, status: listChoice(['all', 'active', 'inactive']),
  registered: listChoice(['all', 'today', 'last7', 'last30', 'custom']),
  start: { default: '', valid: validListDate }, end: { default: '', valid: validListDate },
  sortBy: listChoice(['createdAt', 'orderCount', 'paidTotal', 'lastOrderAt']), sortOrder: listChoice(['desc', 'asc']),
  page: { default: '1', valid: value => /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) },
  pageSize: listChoice(['20', '50', '100']),
};
export interface CustomerQuery {
  search?: string; status?: 'all' | 'active' | 'inactive'; registered?: 'all' | 'today' | 'last7' | 'last30' | 'custom';
  start?: string; end?: string; sortBy?: 'createdAt' | 'orderCount' | 'paidTotal' | 'lastOrderAt'; sortOrder?: 'asc' | 'desc'; page?: number; limit?: number;
}
export function customerListQuery(url: string): CustomerQuery {
  const state = readListState(url.split('?')[1] ?? '', customerListFields);
  return { search: state.search || undefined, status: state.status as CustomerQuery['status'], registered: state.registered as CustomerQuery['registered'],
    start: state.start || undefined, end: state.end || undefined, sortBy: state.sortBy as CustomerQuery['sortBy'], sortOrder: state.sortOrder as CustomerQuery['sortOrder'] };
}
export function savedCustomerListUrl(locale: string, saved: string | null) {
  const path = '/' + locale + '/customers';
  return saved === path || saved?.startsWith(path + '?') ? saved : path;
}
export function customerOrdersUrl(locale: string, customer: { id: string; email: string }) {
  return '/' + locale + '/orders?' + new URLSearchParams({ customerId: customer.id, customerEmail: customer.email });
}
