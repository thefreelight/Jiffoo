import { describe, expect, it } from 'vitest';
import { purchaseCommands, purchaseData } from '../lib/purchase-tracking';
import { allowedBffRoute } from '../lib/auth-contract';

describe('Purchase tracking', () => {
  it('F builds exact GA4 Meta Baidu purchase payloads with numeric decimals and no PII', () => {
    const order = {
      id: 'order-1', totalAmount: '45.25', shippingAmount: '3.00', taxAmount: '2.25', currency: 'USD',
      customerEmail: 'private@example.com', phone: 'private', shippingAddress: { firstName: 'private' },
      items: [
        { productId: 'p1', productName: 'First', variantId: 'v1', unitPrice: '10.00', quantity: 2, email: 'private' },
        { productId: 'p2', productName: 'Second', unitPrice: '20.00', quantity: 1 },
      ],
    };
    const commands = purchaseCommands(order);
    expect(commands).toEqual({
      ga4: ['event', 'purchase', {
        transaction_id: 'order-1', value: 45.25, currency: 'USD', shipping: 3, tax: 2.25,
        items: [
          { item_id: 'p1', item_name: 'First', item_variant: 'v1', price: 10, quantity: 2 },
          { item_id: 'p2', item_name: 'Second', price: 20, quantity: 1 },
        ],
      }],
      meta: ['track', 'Purchase', {
        value: 45.25, currency: 'USD', content_type: 'product', content_ids: ['p1', 'p2'],
        contents: [{ id: 'p1', quantity: 2 }, { id: 'p2', quantity: 1 }], num_items: 3,
      }, { eventID: 'purchase-order-1' }],
      baidu: ['_trackOrder', { orderId: 'order-1', orderTotal: 45.25, item: [
        { skuId: 'v1', skuName: 'First', Price: 10, Quantity: 2 },
        { skuId: 'p2', skuName: 'Second', Price: 20, Quantity: 1 },
      ] }],
    });
    expect(purchaseData(order)).toEqual({
      id: 'order-1', totalAmount: 45.25, shippingAmount: 3, taxAmount: 2.25, currency: 'USD',
      items: [
        { productId: 'p1', productName: 'First', variantId: 'v1', unitPrice: 10, quantity: 2 },
        { productId: 'p2', productName: 'Second', unitPrice: 20, quantity: 1 },
      ],
    });
    expect(JSON.stringify(commands)).not.toMatch(/private|email|phone|address|firstName/i);
  });

  it('allows only POST on the constrained customer tracking claim BFF route', () => {
    const id = 'cm9abcdefghijklmnopqrstuv';
    expect(allowedBffRoute('POST', `/orders/${id}/tracking-claim`)).toBe(true);
    for (const method of ['GET', 'PUT', 'DELETE', 'PATCH']) {
      expect(allowedBffRoute(method, `/orders/${id}/tracking-claim`)).toBe(false);
    }
    for (const path of ['/orders/short/tracking-claim', `/orders/${id}/tracking-claim/extra`,
      '/orders/%2e%2e/tracking-claim', '/orders/../tracking-claim']) {
      expect(allowedBffRoute('POST', path)).toBe(false);
    }
  });
});
