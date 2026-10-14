import type { PaginationParams } from '@/lib/api';
import { listChoice, listDateRange, readListState, validListDate, type ListFields } from '@/lib/hooks/use-list-state';

export const orderStatuses = ['All', 'PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
export const orderListFields: ListFields = {
  status: listChoice(orderStatuses), payment: listChoice(['all', 'paid', 'unpaid', 'review', 'refunded']),
  search: { default: '', valid: () => true }, date: listChoice(['all', 'today', 'last7', 'last30', 'custom']),
  customerId: { default: '', valid: () => true }, customerEmail: { default: '', valid: () => true },
  start: { default: '', valid: validListDate }, end: { default: '', valid: validListDate },
  sortBy: listChoice(['createdAt', 'totalAmount']), sortOrder: listChoice(['desc', 'asc']),
  page: { default: '1', valid: value => /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) },
  pageSize: listChoice(['20', '50', '100']),
};
export type OrderListQuery = Pick<PaginationParams, 'status' | 'search' | 'paymentStatus' | 'paymentReview' | 'createdFrom' | 'createdTo' | 'customerId'> & {
  sortBy: 'createdAt' | 'totalAmount'; sortOrder: 'asc' | 'desc';
};
export function savedOrderListUrl(locale: string, saved: string | null): string {
  const path = '/' + locale + '/orders';
  return saved === path || saved?.startsWith(path + '?') ? saved : path;
}
export function orderListQuery(url: string, timezone: string, now?: Date): OrderListQuery {
  const state = readListState(url.split('?')[1] ?? '', orderListFields);
  return {
    status: state.status === 'All' ? undefined : state.status, search: state.search || undefined,
    customerId: state.customerId || undefined,
    paymentStatus: ['paid', 'unpaid', 'refunded'].includes(state.payment) ? state.payment.toUpperCase() as OrderListQuery['paymentStatus'] : undefined,
    paymentReview: state.payment === 'review' ? 'required' : undefined,
    ...listDateRange(state.date, state.start, state.end, timezone, now),
    sortBy: state.sortBy as OrderListQuery['sortBy'], sortOrder: state.sortOrder as OrderListQuery['sortOrder'],
  };
}
