import { beforeEach, describe, expect, it, vi } from 'vitest';

// A running promotion must reach the order through the real resolver. An
// earlier test mocked the resolver and so missed that checkout handed it a
// price map keyed by variant id while it looks prices up by product id: every
// promotion then discounted nothing and was skipped.
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
vi.mock('./native-wallet', () => ({ settleNativeWalletCheckout: vi.fn() }));

import { tryNativeCheckout } from './checkout';

const USER = { id: 'user-bf-2', email: 'bf2@bokmoo.com', username: 'bf2', role: 'USER' };
// A catalog product whose variant id differs from its product id, as on every real product.
const CARD = {
  id: 'odoo-product-6', name: 'Bokmoo Card V1', productKind: 'goods', currency: 'USD', stock: 94,
  variants: [{ id: 'odoo-variant-6', salePrice: 20, isActive: true }],
};
const PERCENT_20 = {
  id: 'promo-bf', slug: 'black-friday-2026', name: 'Black Friday', status: 'active',
  starts_at: '2026-11-01T00:00:00.000Z', ends_at: '2026-12-31T00:00:00.000Z',
  discount_type: 'percent', discount_value: 20, product_ids_json: JSON.stringify(['odoo-product-6']),
  per_user_limit: 0, banner_json: null, rules_url: null, created_at: '', updated_at: '',
};
const PARTNER = { id: 'partner-1', code: 'CREATOR10', discount_rate: 10, discount_type: 'percentage' };

function checkoutDb({ promotions = [], partner = null, promoOrders = 0 } = {}) {
  const metadataInserts = [];
  return {
    metadataInserts,
    prepare: (sql: string) => ({
      bind: (...values: unknown[]) => {
        if (sql.includes('INSERT INTO native_order_metadata')) metadataInserts.push(values);
        return {
          first: async () => {
            if (sql.includes('FROM native_affiliate_partners')) return values[0] === partner?.code ? partner : null;
            if (sql.includes('COUNT(*) AS n FROM native_order_metadata')) return { n: promoOrders };
            if (sql.includes('native_order_number_sequences')) return { seq: 1 };
            return null;
          },
          // the real resolver's window query; the rows given are the ones it would match
          all: async () => ({ results: sql.includes('FROM native_promotions') ? promotions : [] }),
          run: async () => ({ success: true }),
        };
      },
      first: async () => null,
      all: async () => ({ results: [] }),
      run: async () => ({ success: true }),
    }),
    batch: async (statements: unknown[]) => statements,
  };
}

async function place(db: ReturnType<typeof checkoutDb>, affiliateCode?: string) {
  const response = await tryNativeCheckout(
    new Request('https://api.example/api/v1/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: CARD.id, variantId: 'odoo-variant-6', quantity: 1 }],
        // a physical card needs a delivery address
        shippingAddress: { firstName: 'Sale', lastName: 'Test', phone: '+10000000000', addressLine1: '1 Test Way', city: 'Testville', state: 'CA', postalCode: '90000', country: 'US' },
        ...(affiliateCode ? { affiliateCode } : {}),
      }),
    }),
    { DB: db as never, NATIVE_CHECKOUT_ENABLED: 'true' } as never,
    () => Promise.resolve(CARD),
  );
  return { status: response?.status, order: (await (response as Response).json()).data };
}

beforeEach(() => {
  authenticateNativeUser.mockReset();
  authenticateNativeUser.mockResolvedValue(USER);
});

describe('native checkout: a running promotion reaches the order', () => {
  it('takes the promotion off a product whose variant id differs from its product id', async () => {
    const db = checkoutDb({ promotions: [PERCENT_20] });
    const { status, order } = await place(db);

    expect(status).toBe(201);
    expect(order.items[0].unitPrice).toBe(16);
    expect(order.appliedDiscounts).toEqual([{ kind: 'promotion', id: 'promo-bf', slug: 'black-friday-2026', amount: 4 }]);
    expect(order.discountAmount).toBe(4);
    expect(order.totalAmount).toBe(16);
    // order_id, user_id, idempotency_key, currency, total, affiliate_partner_id, promotion_id
    expect(db.metadataInserts[0]!.slice(3)).toEqual(['USD', 16, null, 'promo-bf']);
  });

  it('stacks a creator code on the promotion found by the resolver', async () => {
    const db = checkoutDb({ promotions: [PERCENT_20], partner: PARTNER });
    const { order } = await place(db, 'CREATOR10');

    expect(order.appliedDiscounts.map((entry: { kind: string; amount: number }) => [entry.kind, entry.amount])).toEqual([['promotion', 4], ['affiliate', 1.6]]);
    expect(order.totalAmount).toBe(14.4);
    expect(db.metadataInserts[0]!.slice(5)).toEqual(['partner-1', 'promo-bf']);
  });

  it('skips the promotion once the customer used up its per-order limit, and the code still applies', async () => {
    const db = checkoutDb({ promotions: [{ ...PERCENT_20, per_user_limit: 1 }], partner: PARTNER, promoOrders: 1 });
    const { order } = await place(db, 'CREATOR10');

    expect(order.items[0].unitPrice).toBe(20);
    expect(order.appliedDiscounts).toEqual([{ kind: 'affiliate', id: 'partner-1', amount: 2 }]);
    expect(order.totalAmount).toBe(18);
    expect(db.metadataInserts[0]!.slice(5)).toEqual(['partner-1', null]);
  });

  it('applies the best of two running promotions once', async () => {
    const db = checkoutDb({ promotions: [PERCENT_20, { ...PERCENT_20, id: 'promo-small', slug: 'small', discount_value: 10 }] });
    const { order } = await place(db);

    expect(order.appliedDiscounts).toEqual([{ kind: 'promotion', id: 'promo-bf', slug: 'black-friday-2026', amount: 4 }]);
    expect(order.totalAmount).toBe(16);
  });

  it('leaves a product the promotion does not cover at list price', async () => {
    const db = checkoutDb({ promotions: [{ ...PERCENT_20, product_ids_json: JSON.stringify(['odoo-product-7']) }] });
    const { order } = await place(db);

    expect(order.totalAmount).toBe(20);
    expect(order.appliedDiscounts).toEqual([]);
    expect(db.metadataInserts[0]!.slice(5)).toEqual([null, null]);
  });
});
