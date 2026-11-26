import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));

const { authenticateNativeUser } = vi.hoisted(() => ({ authenticateNativeUser: vi.fn() }));
vi.mock('./auth', () => ({ authenticateNativeUser, getNativeJwtSecret: vi.fn(), createNativeSession: vi.fn(), tryNativeAuth: vi.fn() }));
vi.mock('./plugin-settings', () => ({ getNativeStripeSecret: vi.fn(), getNativePluginConfig: vi.fn(), getNativePluginSecret: vi.fn() }));

import { stripeChargeLines, tryNativeCheckout } from './checkout';

// The hosted Stripe page collects the order total. Before: it added up the item unit prices, so a promo
// (affiliate) code — an order-level discount — and a shipping fee never reached the charge, while the order
// record, the in-page payment intent and the Alipay / WeChat channels all carried the reduced total.

const card = (unitPrice: number, quantity = 1, productName = 'Bokmoo Card V1') => ({ productId: 'odoo-product-6', productName, unitPrice, quantity });

describe('stripeChargeLines', () => {
  it('lists the items as they are priced when nothing stands beside them', () => {
    expect(stripeChargeLines({ id: 'ord_1', totalAmount: 80, discountAmount: 0, shippingAmount: 0, items: [card(20, 2), card(40, 1, 'Bokmoo Bluetooth Card')] })).toEqual([
      { name: 'Bokmoo Card V1', unitAmount: 2000, quantity: 2 },
      { name: 'Bokmoo Bluetooth Card', unitAmount: 4000, quantity: 1 },
    ]);
  });

  it('takes a promo code off the charge', () => {
    const lines = stripeChargeLines({ id: 'ord_2', totalAmount: 18, discountAmount: 2, shippingAmount: 0, items: [card(20)] });
    expect(lines).toEqual([{ name: 'Bokmoo Card V1', unitAmount: 1800, quantity: 1 }]);
  });

  it('stacks the promo code on a promotion that already sits on the unit price', () => {
    const lines = stripeChargeLines({ id: 'ord_3', totalAmount: 14.4, discountAmount: 5.6, shippingAmount: 0, items: [card(16)] });
    expect(lines).toEqual([{ name: 'Bokmoo Card V1', unitAmount: 1440, quantity: 1 }]);
  });

  it('spreads the promo code over several items', () => {
    const lines = stripeChargeLines({ id: 'ord_4', totalAmount: 54, discountAmount: 6, shippingAmount: 0, items: [card(40, 1, 'Bokmoo Bluetooth Card'), card(20)] });
    expect(lines).toEqual([
      { name: 'Bokmoo Bluetooth Card', unitAmount: 3600, quantity: 1 },
      { name: 'Bokmoo Card V1', unitAmount: 1800, quantity: 1 },
    ]);
  });

  it('adds up to the total to the cent, whatever the rounding', () => {
    // 9.99 + 4.99 + 3 × 2.49 = 22.45; a 30% code takes 6.74 off, leaving 15.71
    const weights = [999, 499, 747];
    const lines = stripeChargeLines({
      id: 'ord_5', totalAmount: 15.71, discountAmount: 6.74, shippingAmount: 0,
      items: [card(9.99, 1, 'Card A'), card(4.99, 1, 'Card B'), card(2.49, 3, 'Card C')],
    })!;
    const sum = lines.reduce((running, line) => running + line.unitAmount * line.quantity, 0);
    expect(sum).toBe(1571);
    expect(lines.map((line) => line.name)).toEqual(['Card A', 'Card B', 'Card C × 3']);
    // every line stays within a cent of its exact share
    const exact = weights.map((weight) => (1571 * weight) / 2245);
    lines.forEach((line, index) => {
      expect(Math.abs(line.unitAmount - exact[index]!)).toBeLessThanOrEqual(1);
    });
  });

  it('carries several of one item as one line, so the shares stay exact', () => {
    const lines = stripeChargeLines({ id: 'ord_6', totalAmount: 36, discountAmount: 4, shippingAmount: 0, items: [card(20, 2)] });
    expect(lines).toEqual([{ name: 'Bokmoo Card V1 × 2', unitAmount: 3600, quantity: 1 }]);
  });

  it('collects a shipping fee beside the items', () => {
    const lines = stripeChargeLines({ id: 'ord_7', totalAmount: 25, discountAmount: 0, shippingAmount: 5, shippingMethod: 'DHL', items: [card(20)] });
    expect(lines).toEqual([
      { name: 'Bokmoo Card V1', unitAmount: 2000, quantity: 1 },
      { name: 'DHL', unitAmount: 500, quantity: 1 },
    ]);
  });

  it('collects a shipping fee that a promo code does not reach', () => {
    const lines = stripeChargeLines({ id: 'ord_8', totalAmount: 23, discountAmount: 2, shippingAmount: 5, shippingMethod: 'DHL', items: [card(20)] });
    expect(lines).toEqual([
      { name: 'Bokmoo Card V1', unitAmount: 1800, quantity: 1 },
      { name: 'DHL', unitAmount: 500, quantity: 1 },
    ]);
  });

  it('has nothing to collect for a free order', () => {
    expect(stripeChargeLines({ id: 'ord_9', totalAmount: 0, discountAmount: 20, shippingAmount: 0, items: [card(20)] })).toBeNull();
    expect(stripeChargeLines({ id: 'ord_10', totalAmount: 0, discountAmount: 0, shippingAmount: 0, items: [] })).toBeNull();
  });

  it('collects a total too small to give every item a unit as one line', () => {
    expect(stripeChargeLines({ id: 'ord_11', orderNumber: 'BM-1', totalAmount: 0.01, discountAmount: 1.99, shippingAmount: 0, items: [card(1), card(1)] })).toEqual([
      { name: 'Order BM-1', unitAmount: 1, quantity: 1 },
    ]);
  });

  it('keeps collecting item by item an order recorded before a total was kept', () => {
    expect(stripeChargeLines({ id: 'ord_12', items: [card(20, 3)] })).toEqual([{ name: 'Bokmoo Card V1', unitAmount: 2000, quantity: 3 }]);
  });
});

describe('the hosted Stripe page via /payments/sessions', () => {
  function sessionsDb(order: Record<string, unknown>) {
    return {
      prepare: (sql: string) => ({
        bind: (..._values: unknown[]) => ({
          all: async () => ({ results: [] }),
          first: async () => (sql.includes('native_order_snapshots')
            ? { payload: JSON.stringify(order), total_amount: order.totalAmount, currency: 'USD', payment_status: 'PENDING' }
            : null),
          run: async () => ({ success: true }),
        }),
        first: async () => null,
        run: async () => ({ success: true }),
      }),
      batch: async (statements: unknown[]) => statements,
    };
  }

  async function createSession(order: Record<string, unknown>) {
    authenticateNativeUser.mockResolvedValue({ id: 'user-1', email: 'u@example.com', username: 'u', role: 'USER' });
    const { getNativeStripeSecret } = await import('./plugin-settings');
    (getNativeStripeSecret as ReturnType<typeof vi.fn>).mockResolvedValue({ mode: 'test', value: 'sk_test_stub' });
    const captured: { body?: string } = {};
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      captured.body = String(init?.body ?? '');
      return new Response(JSON.stringify({
        id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1',
        expires_at: Math.floor(Date.now() / 1000) + 86400, payment_intent: 'pi_test_1',
      }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const response = await tryNativeCheckout(
      new Request('https://api.example/api/v1/payments/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ paymentMethod: 'stripe', orderId: order.id }),
      }),
      { DB: sessionsDb(order), NATIVE_CHECKOUT_ENABLED: 'true' } as never,
      () => Promise.resolve(null),
    );
    vi.unstubAllGlobals();
    const payload = response ? await (response as Response).json() : {};
    const body = new URLSearchParams(captured.body ?? '');
    const count = [...body.keys()].filter((key) => key.startsWith('line_items[') && key.endsWith('[quantity]')).length;
    return { response, payload, body, fetchMock, lines: Array.from({ length: count }, (_, index) => ({
      name: body.get(`line_items[${index}][price_data][product_data][name]`),
      unitAmount: Number(body.get(`line_items[${index}][price_data][unit_amount]`)),
      quantity: Number(body.get(`line_items[${index}][quantity]`)),
    })) };
  }

  it('charges the order total after the promo code', async () => {
    const { response, lines } = await createSession({
      id: 'ord_code', currency: 'USD', status: 'PENDING', totalAmount: 18, discountAmount: 2, shippingAmount: 0, shippingAddress: null,
      items: [{ productId: 'odoo-product-6', productName: 'Bokmoo Card V1', unitPrice: 20, quantity: 1 }],
    });
    expect(response?.status).toBe(201);
    expect(lines).toEqual([{ name: 'Bokmoo Card V1', unitAmount: 1800, quantity: 1 }]);
  });

  it('charges the order total with a shipping fee and no promo code', async () => {
    const { lines } = await createSession({
      id: 'ord_ship', currency: 'USD', status: 'PENDING', totalAmount: 25, discountAmount: 0, shippingAmount: 5, shippingMethod: 'DHL', shippingAddress: null,
      items: [{ productId: 'odoo-product-6', productName: 'Bokmoo Card V1', unitPrice: 20, quantity: 1 }],
    });
    expect(lines.reduce((sum, line) => sum + line.unitAmount * line.quantity, 0)).toBe(2500);
  });

  it('does not turn to Stripe for an order with nothing to collect', async () => {
    const { response, payload, fetchMock } = await createSession({
      id: 'ord_free', currency: 'USD', status: 'PENDING', totalAmount: 0, discountAmount: 20, shippingAmount: 0, shippingAddress: null,
      items: [{ productId: 'odoo-product-6', productName: 'Bokmoo Card V1', unitPrice: 20, quantity: 1 }],
    });
    expect(response?.status).toBe(409);
    expect(payload.error.code).toBe('INVALID_ORDER_TOTAL');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
