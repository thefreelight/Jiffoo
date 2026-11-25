import { beforeEach, describe, expect, it, vi } from 'vitest';

// How a promotion and an affiliate (creator) promo code combine on an order:
// the promotion lands on the covered items' unit price, the code stacks on
// top as an order-level discount, and both land on the order record.
const { authenticateNativeUser } = vi.hoisted(() => ({ authenticateNativeUser: vi.fn() }));
vi.mock('./auth', () => ({
  authenticateNativeUser,
  getNativeJwtSecret: vi.fn(),
  createNativeSession: vi.fn(),
  tryNativeAuth: vi.fn(),
}));
vi.mock('./plugin-settings', () => ({
  getNativeStripeSecret: vi.fn(),
  getNativePluginConfig: vi.fn(),
  getNativePluginSecret: vi.fn(),
}));
const { resolveActivePromotion } = vi.hoisted(() => ({ resolveActivePromotion: vi.fn() }));
vi.mock('./bokmoo-promotions', () => ({ resolveActivePromotion }));
vi.mock('./native-wallet', () => ({ settleNativeWalletCheckout: vi.fn() }));

import { tryNativeCheckout } from './checkout';

const USER = { id: 'user-bf-1', email: 'bf@bokmoo.com', username: 'bf', role: 'USER' };
const CARD = {
  id: 'odoo-product-6', name: 'Bokmoo Card V1', productKind: 'digital', currency: 'USD', stock: 94,
  variants: [{ id: 'odoo-variant-6', salePrice: 20, isActive: true }],
};
const PLAN = {
  id: 'boss-HKMO-1GB-7D', name: 'HKMO 1GB', productKind: 'digital', currency: 'USD', stock: 999,
  variants: [{ id: 'boss-HKMO-1GB-7D-v1', salePrice: 4.9, isActive: true }],
};
const PROMOTION = {
  row: {
    id: 'promo-bf', slug: 'black-friday-2026', name: 'Black Friday', status: 'active',
    starts_at: '2026-11-27T00:00:00.000Z', ends_at: '2026-12-01T00:00:00.000Z',
    discount_type: 'percent', discount_value: 20, product_ids_json: JSON.stringify(['odoo-product-6']),
    per_user_limit: 0, banner_json: null, rules_url: null, created_at: '', updated_at: '',
  },
  discountAmount: 4,
};

function checkoutDb(partner: Record<string, unknown> | null) {
  const metadataInserts: unknown[][] = [];
  const db = {
    metadataInserts,
    prepare: (sql: string) => ({
      bind: (...values: unknown[]) => {
        // the metadata row is written through batch(), so record its bindings here
        if (sql.includes('INSERT INTO native_order_metadata')) metadataInserts.push(values);
        return {
          first: async () => {
            if (sql.includes('FROM native_affiliate_partners')) return values[0] === partner?.code ? partner : null;
            if (sql.includes('native_order_number_sequences')) return { seq: 1 };
            return null;
          },
          run: async () => ({ success: true }),
        };
      },
      first: async () => null,
      run: async () => ({ success: true }),
    }),
    batch: async (statements: unknown[]) => statements,
  };
  return db;
}

async function placeOrder(items: Array<{ productId: string; variantId: string; quantity: number }>, affiliateCode?: string) {
  const partner = affiliateCode
    ? { id: 'partner-1', code: affiliateCode, discount_rate: 10, discount_type: 'percentage' }
    : null;
  const db = checkoutDb(partner);
  const response = await tryNativeCheckout(
    new Request('https://api.example/api/v1/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items, ...(affiliateCode ? { affiliateCode } : {}) }),
    }),
    { DB: db as never, NATIVE_CHECKOUT_ENABLED: 'true' } as never,
    (productId: string) => Promise.resolve(productId === CARD.id ? CARD : productId === PLAN.id ? PLAN : null),
  );
  const payload = await (response as Response).json();
  return { status: response?.status, order: payload.data, metadataInserts: db.metadataInserts };
}

const cardLine = { productId: CARD.id, variantId: 'odoo-variant-6', quantity: 1 };

beforeEach(() => {
  authenticateNativeUser.mockReset();
  authenticateNativeUser.mockResolvedValue(USER);
  resolveActivePromotion.mockReset();
});

describe('native checkout: promotion and affiliate code', () => {
  it('stacks a percentage code on top of the promotion', async () => {
    resolveActivePromotion.mockResolvedValue(PROMOTION);
    const { status, order, metadataInserts } = await placeOrder([cardLine], 'CREATOR10');

    expect(status).toBe(201);
    expect(order.items[0].unitPrice).toBe(16);
    expect(order.appliedDiscounts).toEqual([
      { kind: 'promotion', id: 'promo-bf', slug: 'black-friday-2026', amount: 4 },
      { kind: 'affiliate', id: 'partner-1', amount: 1.6 },
    ]);
    expect(order.discountAmount).toBe(5.6);
    expect(order.totalAmount).toBe(14.4);
    // order_id, user_id, idempotency_key, currency, total, affiliate_partner_id, promotion_id
    expect(metadataInserts[0]!.slice(3)).toEqual(['USD', 14.4, 'partner-1', 'promo-bf']);
  });

  it('stacks a fixed-amount code on top of the promotion', async () => {
    resolveActivePromotion.mockResolvedValue(PROMOTION);
    const db = checkoutDb({ id: 'partner-1', code: 'CREATOR5', discount_rate: 5, discount_type: 'fixed_amount' });
    const response = await tryNativeCheckout(
      new Request('https://api.example/api/v1/orders', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: [cardLine], affiliateCode: 'creator5' }),
      }),
      { DB: db as never, NATIVE_CHECKOUT_ENABLED: 'true' } as never,
      (productId: string) => Promise.resolve(productId === CARD.id ? CARD : null),
    );
    const { status, order } = { status: response?.status, order: (await (response as Response).json()).data };

    expect(status).toBe(201);
    expect(order.items[0].unitPrice).toBe(16);
    expect(order.appliedDiscounts.map((entry: { kind: string; amount: number }) => [entry.kind, entry.amount])).toEqual([['promotion', 4], ['affiliate', 5]]);
    expect(order.totalAmount).toBe(11);
  });

  it('keeps the code off the items the promotion leaves out', async () => {
    resolveActivePromotion.mockResolvedValue(PROMOTION);
    const db = checkoutDb({ id: 'partner-1', code: 'CREATOR5', discount_rate: 5, discount_type: 'fixed_amount' });
    const response = await tryNativeCheckout(
      new Request('https://api.example/api/v1/orders', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: [cardLine, { productId: PLAN.id, variantId: 'boss-HKMO-1GB-7D-v1', quantity: 1 }], affiliateCode: 'CREATOR5' }),
      }),
      { DB: db as never, NATIVE_CHECKOUT_ENABLED: 'true' } as never,
      (productId: string) => Promise.resolve(productId === CARD.id ? CARD : productId === PLAN.id ? PLAN : null),
    );
    const order = (await (response as Response).json()).data;

    expect(order.items.map((item: { unitPrice: number }) => item.unitPrice)).toEqual([16, 4.9]);
    expect(order.discountAmount).toBe(9);
    expect(order.totalAmount).toBe(15.9);
  });

  it('applies the code to the whole order when no promotion applies', async () => {
    resolveActivePromotion.mockResolvedValue(null);
    const { status, order, metadataInserts } = await placeOrder([cardLine], 'CREATOR10');

    expect(status).toBe(201);
    expect(order.items[0].unitPrice).toBe(20);
    expect(order.appliedDiscounts).toEqual([{ kind: 'affiliate', id: 'partner-1', amount: 2 }]);
    expect(order.totalAmount).toBe(18);
    expect(metadataInserts[0]!.slice(3)).toEqual(['USD', 18, 'partner-1', null]);
  });

  it('applies the promotion alone when no code is entered', async () => {
    resolveActivePromotion.mockResolvedValue(PROMOTION);
    const { order, metadataInserts } = await placeOrder([cardLine]);

    expect(order.items[0].unitPrice).toBe(16);
    expect(order.appliedDiscounts).toEqual([{ kind: 'promotion', id: 'promo-bf', slug: 'black-friday-2026', amount: 4 }]);
    expect(order.totalAmount).toBe(16);
    expect(metadataInserts[0]!.slice(3)).toEqual(['USD', 16, null, 'promo-bf']);
  });

  it('ignores a code the store does not know', async () => {
    resolveActivePromotion.mockResolvedValue(PROMOTION);
    const db = checkoutDb({ id: 'partner-1', code: 'CREATOR10', discount_rate: 10, discount_type: 'percentage' });
    const response = await tryNativeCheckout(
      new Request('https://api.example/api/v1/orders', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: [cardLine], affiliateCode: 'NOPE' }),
      }),
      { DB: db as never, NATIVE_CHECKOUT_ENABLED: 'true' } as never,
      (productId: string) => Promise.resolve(productId === CARD.id ? CARD : null),
    );
    const order = (await (response as Response).json()).data;

    expect(order.appliedDiscounts).toEqual([{ kind: 'promotion', id: 'promo-bf', slug: 'black-friday-2026', amount: 4 }]);
    expect(order.totalAmount).toBe(16);
  });
});
