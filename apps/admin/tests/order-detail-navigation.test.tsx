// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { orderListQuery, savedOrderListUrl } from '../lib/order-list-state';
import { orderHeaderActions, shippingAddressText, trackingUrl } from '../lib/order-detail';

it('builds the same filter and sort from the saved URL, excluding pagination and display labels', () => {
  const url = '/zh-Hans/orders?status=PROCESSING&payment=review&search=buyer&customerId=user-1&customerEmail=buyer%40test.com&date=custom&start=2026-10-12&end=2026-10-13&sortBy=totalAmount&sortOrder=asc&page=3&pageSize=50';
  expect(orderListQuery(url, 'Asia/Shanghai')).toEqual({ status: 'PROCESSING', search: 'buyer', customerId: 'user-1', paymentReview: 'required', paymentStatus: undefined,
    createdFrom: '2026-10-11T16:00:00.000Z', createdTo: '2026-10-13T16:00:00.000Z', sortBy: 'totalAmount', sortOrder: 'asc' });
  expect(savedOrderListUrl('en', 'https://example.test/en/orders')).toBe('/en/orders');
  expect(savedOrderListUrl('zh-Hans', url)).toBe(url);
  expect(orderListQuery('/en/orders?sortBy=bad&sortOrder=bad&payment=paid', 'UTC')).toMatchObject({ sortBy: 'createdAt', sortOrder: 'desc', paymentStatus: 'PAID' });
  expect(() => orderListQuery('/en/orders?date=custom&start=2026-10-14&end=2026-10-13', 'UTC')).toThrow();
});
it('encodes tracking values and uses zh-cn only for simplified Chinese', () => {
  for (const locale of ['en', 'zh-Hans', 'zh-Hant']) expect(trackingUrl('SF 12/#?&中文', locale)).toBe('https://t.17track.net/' + (locale === 'zh-Hans' ? 'zh-cn' : 'en') + '#nums=SF%2012%2F%23%3F%26%E4%B8%AD%E6%96%87');
});
it('copies exactly the displayed address lines including recipient and phone', () => {
  expect(shippingAddressText({ recipientName: 'Mia Lin', phone: '+86 138', street: '88 Road', street2: 'Floor 12', city: 'Shanghai', state: '', zipCode: '200030', country: 'China' }))
    .toBe('Mia Lin · +86 138\n88 Road\nFloor 12\nShanghai 200030 · China');
  expect(shippingAddressText({ recipientName: 'Buyer', street: 'Street', city: 'City', country: 'US' })).toBe('Buyer\nStreet\nCity · US');
});
it('keeps primary shipping actions in the header and prevents reshipping an existing shipment', () => {
  expect(orderHeaderActions({ status: 'PROCESSING', paymentStatus: 'PAID', canRefundOrder: true })).toMatchObject({ ship: true, deliver: false, refund: true });
  expect(orderHeaderActions({ status: 'PROCESSING', paymentStatus: 'PAID', shipments: [{ id: 's', carrier: 'C', trackingNumber: 'T', status: 'SHIPPED' }] }).ship).toBe(false);
  expect(orderHeaderActions({ status: 'SHIPPED', paymentStatus: 'PAID' })).toMatchObject({ ship: false, deliver: true });
  expect(orderHeaderActions({ status: 'CANCELLED', paymentStatus: 'PENDING', canRecordManualPayment: true })).toEqual({ ship: false, deliver: false, record: true, refund: false, cancel: false });
});
