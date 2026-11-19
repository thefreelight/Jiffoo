import { describe, expect, it, vi, beforeEach } from 'vitest';

// Currency behavior of the native checkout: order/items carry the catalog
// billing currency (BOSS eSIM plans are CNY), mixed-currency carts are
// rejected, and Stripe payment intents refuse non-USD orders so the
// storefront routes CNY orders to the Alipay/WeChat (epay) rails.
const { authenticateNativeUser, getNativeStripeSecret, getNativePluginConfig } = vi.hoisted(() => ({
  authenticateNativeUser: vi.fn(),
  getNativeStripeSecret: vi.fn(),
  getNativePluginConfig: vi.fn(),
}));
vi.mock('./auth', () => ({
  authenticateNativeUser,
  getNativeJwtSecret: vi.fn(),
  createNativeSession: vi.fn(),
  tryNativeAuth: vi.fn(),
}));
vi.mock('./plugin-settings', () => ({
  getNativeStripeSecret,
  getNativePluginConfig,
  getNativePluginSecret: vi.fn(),
}));
vi.mock('./bokmoo-promotions', () => ({ resolveActivePromotion: vi.fn().mockResolvedValue(null) }));
vi.mock('./native-wallet', () => ({ settleNativeWalletCheckout: vi.fn() }));

import { tryNativeCheckout } from './checkout';

const USER = { id: 'user-cur-1', email: 'cur@bokmoo.com', username: 'cur', role: 'USER' };

function bossProduct(currency: string) {
  return {
    id: 'boss-HKMO-1GB-7D',
    name: '[HKMO-1GB-7D] 港澳流量包 1GB/7天',
    productKind: 'digital',
    currency,
    stock: 999,
    variants: [{ id: 'boss-HKMO-1GB-7D-v1', salePrice: 2.5, isActive: true }],
  };
}

function usdCard() {
  return {
    id: 'odoo-product-6',
    name: 'Bokmoo Card V1',
    productKind: 'goods',
    currency: 'USD',
    stock: 94,
    variants: [{ id: 'odoo-variant-6', salePrice: 20, isActive: true }],
  };
}

function checkoutDb() {
  return {
    prepare: (_sql: string) => ({
      bind: () => ({
        first: async () => null,
        run: async () => ({ success: true }),
      }),
      first: async () => null,
      run: async () => ({ success: true }),
    }),
    batch: async (statements: unknown[]) => statements,
  };
}

function loadProductBy(product: unknown) {
  return (productId: string) => (productId === (product as { id: string }).id
    ? Promise.resolve(product)
    : Promise.resolve(null));
}

beforeEach(() => {
  authenticateNativeUser.mockReset();
  authenticateNativeUser.mockResolvedValue(USER);
  getNativeStripeSecret.mockReset();
  getNativePluginConfig.mockReset();
});

describe('native checkout currency handling', () => {
  it('carries the catalog billing currency (CNY) onto the order and items', async () => {
    const product = bossProduct('CNY');
    const captured: Array<Record<string, unknown>> = [];
    const db = {
      prepare: (sql: string) => ({
        bind: (...values: unknown[]) => {
          const insertOrder = sql.includes('INSERT INTO native_order_snapshots');
          const insertItems = sql.includes('INSERT INTO native_order_items');
          return {
            first: async () => null,
            run: async () => {
              if (insertOrder || insertItems) captured.push({ sql, values });
              return { success: true };
            },
          };
        },
        first: async () => null,
        run: async () => ({ success: true }),
      }),
      batch: async (statements: unknown[]) => statements,
    };

    const response = await tryNativeCheckout(
      new Request('https://api.example/api/v1/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          items: [{ productId: 'boss-HKMO-1GB-7D', variantId: 'boss-HKMO-1GB-7D-v1', quantity: 1 }],
          locale: 'zh-Hans',
        }),
      }),
      { DB: db as never, NATIVE_CHECKOUT_ENABLED: 'true' } as never,
      loadProductBy(product),
    );

    expect(response?.status).toBe(201);
    const payload = await (response as Response).json();
    expect(payload.data.currency).toBe('CNY');
    expect(payload.data.totalAmount).toBe(2.5);
  });

  it('rejects mixed-currency carts with MIXED_CURRENCY_CART', async () => {
    const usdDigital = { ...usdCard(), id: 'usd-plan-1', productKind: 'digital', variants: [{ id: 'usd-plan-1-v1', salePrice: 5, isActive: true }] };
    const response = await tryNativeCheckout(
      new Request('https://api.example/api/v1/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          items: [
            { productId: 'boss-HKMO-1GB-7D', variantId: 'boss-HKMO-1GB-7D-v1', quantity: 1 },
            { productId: 'usd-plan-1', variantId: 'usd-plan-1-v1', quantity: 1 },
          ],
        }),
      }),
      { DB: checkoutDb() as never, NATIVE_CHECKOUT_ENABLED: 'true' } as never,
      (productId: string) => Promise.resolve(productId === 'usd-plan-1' ? usdDigital : bossProduct('CNY')),
    );

    expect(response?.status).toBe(400);
    const payload = await (response as Response).json();
    expect(payload.error?.code).toBe('MIXED_CURRENCY_CART');
  });

  it('refuses Stripe payment intents for non-USD orders', async () => {
    const db = {
      prepare: (_sql: string) => ({
        bind: () => ({
          first: async () => ({
            payload: JSON.stringify({
              id: 'ord-cny-1', currency: 'CNY', totalAmount: 2.5,
              items: [{ productName: 'plan', unitPrice: 2.5, quantity: 1 }],
            }),
            total_amount: 2.5, currency: 'CNY', payment_status: 'PENDING', user_id: 'user-cur-1',
          }),
          run: async () => ({ success: true }),
        }),
        first: async () => null,
        run: async () => ({ success: true }),
      }),
      batch: async (statements: unknown[]) => statements,
    };

    const response = await tryNativeCheckout(
      new Request('https://api.example/api/v1/payments/intents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId: 'ord-cny-1' }),
      }),
      { DB: db as never, NATIVE_CHECKOUT_ENABLED: 'true' } as never,
      () => Promise.resolve(null),
    );

    expect(response?.status).toBe(400);
    const payload = await (response as Response).json();
    expect(payload.error?.code).toBe('CURRENCY_NOT_SUPPORTED');
  });
});
