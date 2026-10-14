import { listChoice, readListState, type ListFields } from '@/lib/hooks/use-list-state';
export const productListFields: ListFields = {
  status: listChoice(['all', 'active', 'inactive', 'outOfStock']), category: { default: '', valid: value => /^[\w-]*$/.test(value) }, search: { default: '', valid: () => true },
  sortBy: listChoice(['stock', 'name', 'price', 'updatedAt', 'createdAt']), sortOrder: listChoice(['asc', 'desc']),
  page: { default: '1', valid: value => /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) }, pageSize: listChoice(['20', '50', '100']),
};
export function productListQuery(url: string) {
  const state = readListState(url.split('?')[1] ?? '', productListFields);
  return { search: state.search || undefined, categoryId: state.category || undefined, status: state.status === 'all' ? undefined : state.status,
    sortBy: state.sortBy, sortOrder: state.sortOrder };
}
