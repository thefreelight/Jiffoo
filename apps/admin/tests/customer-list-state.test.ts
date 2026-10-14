import { describe, expect, it } from 'vitest';
import { customerListFields, customerListQuery, customerOrdersUrl, savedCustomerListUrl } from '../lib/customer-list-state';
import { readListState, writeListState } from '../lib/hooks/use-list-state';

describe('Customer list state', () => {
  it('round-trips filters, aggregate sort and pagination without losing other parameters', () => {
    const query = 'search=buyer&status=inactive&registered=custom&start=2026-10-01&end=2026-10-14&sortBy=paidTotal&sortOrder=asc&page=3&pageSize=50&extra=kept';
    const state = readListState(query, customerListFields);
    expect(writeListState(query, state, customerListFields)).toBe(query);
    expect(customerListQuery('/en/customers?' + query)).toEqual({ search: 'buyer', status: 'inactive', registered: 'custom', start: '2026-10-01', end: '2026-10-14', sortBy: 'paidTotal', sortOrder: 'asc' });
  });
  it('rejects invalid URL values and keeps canonical defaults', () => {
    expect(readListState('status=ADMIN&sortBy=email&page=0&pageSize=10&start=2026-02-30', customerListFields)).toMatchObject({ status: 'all', sortBy: 'createdAt', sortOrder: 'desc', page: '1', pageSize: '20', start: '' });
  });
  it('keeps back navigation within the current locale customer list', () => {
    expect(savedCustomerListUrl('zh-Hans', '/zh-Hans/customers?sortBy=orderCount')).toBe('/zh-Hans/customers?sortBy=orderCount');
    expect(savedCustomerListUrl('en', 'https://example.com')).toBe('/en/customers');
    expect(savedCustomerListUrl('en', '/en/customers/one')).toBe('/en/customers');
    expect(customerOrdersUrl('en', { id: 'one', email: 'buyer+one@example.com' })).toBe('/en/orders?customerId=one&customerEmail=buyer%2Bone%40example.com');
  });
});
