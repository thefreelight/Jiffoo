import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));

const { authenticateNativeUser } = vi.hoisted(() => ({ authenticateNativeUser: vi.fn() }));
vi.mock('./auth', () => ({ authenticateNativeUser, getNativeJwtSecret: vi.fn(), createNativeSession: vi.fn(), tryNativeAuth: vi.fn() }));
vi.mock('./plugin-settings', () => ({ getNativeStripeSecret: vi.fn(), getNativePluginConfig: vi.fn(), getNativePluginSecret: vi.fn() }));

import { normalizeShippingAddress, tryNativeCheckout } from './checkout';

const goodsProduct = {
  id: 'prod_goods_1',
  name: 'Bokmoo Card V1',
  productKind: 'goods' as const,
  variants: [{ id: 'var_goods_1', name: '实体卡', salePrice: 20, baseStock: 10, isActive: true, attributes: {} }],
};

function goodsDb() {
  return {
    prepare: (sql: string) => ({
      bind: (..._values: unknown[]) => ({
        first: async () => null,
        run: async () => ({ success: true }),
      }),
      first: async () => null,
      run: async () => ({ success: true }),
    }),
    batch: async (statements: unknown[]) => statements,
  };
}

function orderRequest(body: Record<string, unknown>) {
  return new Request('https://api.example/api/v1/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const envStub = { NATIVE_CHECKOUT_ENABLED: 'true' } as never;
const loadGoods = (productId: string) =>
  Promise.resolve(productId === 'prod_goods_1' ? goodsProduct : null);

async function createOrder(body: Record<string, unknown>) {
  authenticateNativeUser.mockResolvedValue({ id: 'user-1', email: 'u@example.com', username: 'u', role: 'USER' });
  const response = await tryNativeCheckout(
    orderRequest(body),
    { DB: goodsDb(), ...envStub } as never,
    loadGoods,
  );
  const payload = response ? await (response as Response).json() : {};
  return { response, payload };
}

describe('normalizeShippingAddress', () => {
  it('returns null when any required field is blank or missing', () => {
    expect(normalizeShippingAddress(null)).toBeNull();
    expect(normalizeShippingAddress({})).toBeNull();
    expect(normalizeShippingAddress({ name: '张三', phone: '13800138000', line1: ' address ', city: '', state: '', postalCode: '', country: 'CN' })).toBeNull();
    // state/postalCode are optional now
    expect(normalizeShippingAddress({ name: '张三', phone: '13800138000', line1: ' address ', city: '北京', state: '', postalCode: '', country: 'CN' })).not.toBeNull();
  });

  it('trims fields, uppercases country, and keeps optional line2', () => {
    const address = normalizeShippingAddress({
      name: ' 张三 ', phone: ' 13800138000 ', line1: ' 朝阳区 ', line2: '某大厦 8 层',
      city: ' 北京 ', state: ' 北京 ', postalCode: ' 100000 ', country: ' cn ',
    });
    expect(address).toEqual({
      name: '张三', phone: '13800138000', line1: '朝阳区', line2: '某大厦 8 层',
      city: '北京', state: '北京', postalCode: '100000', country: 'CN',
    });
  });
});

describe('physical order requires a shipping address', () => {
  it('rejects a goods order without a shipping address', async () => {
    const { response, payload } = await createOrder({
      items: [{ productId: 'prod_goods_1', variantId: 'var_goods_1', quantity: 1 }],
    });
    expect(response?.status).toBe(400);
    expect(payload.error.code).toBe('SHIPPING_ADDRESS_REQUIRED');
  });

  it('rejects a goods order with an incomplete address', async () => {
    const { response, payload } = await createOrder({
      items: [{ productId: 'prod_goods_1', variantId: 'var_goods_1', quantity: 1 }],
      shippingAddress: { name: '张三', phone: '', line1: '朝阳区', city: '北京', state: '北京', postalCode: '100000', country: 'CN' },
    });
    expect(response?.status).toBe(400);
    expect(payload.error.code).toBe('SHIPPING_ADDRESS_REQUIRED');
  });

  it('stores the normalized address on a valid goods order', async () => {
    const { response, payload } = await createOrder({
      items: [{ productId: 'prod_goods_1', variantId: 'var_goods_1', quantity: 1 }],
      shippingAddress: {
        name: ' 张三 ', phone: ' 13800138000 ', line1: ' 朝阳区望京街道 1 号 ',
        city: ' 北京 ', state: ' 北京 ', postalCode: ' 100000 ', country: ' cn ',
      },
    });
    expect(response?.status).toBe(201);
    expect(payload.data.shippingAddress).toEqual({
      name: '张三', phone: '13800138000', line1: '朝阳区望京街道 1 号',
      city: '北京', state: '北京', postalCode: '100000', country: 'CN',
    });
  });

  it('does not require an address for digital-only orders', async () => {
    authenticateNativeUser.mockResolvedValue({ id: 'user-1', email: 'u@example.com', username: 'u', role: 'USER' });
    const digitalProduct = {
      id: 'prod_digital_1', name: 'eSIM', productKind: 'service' as const,
      variants: [{ id: 'var_d_1', name: 'eSIM', salePrice: 5, baseStock: 1000, isActive: true, attributes: {} }],
    };
    const response = await tryNativeCheckout(
      orderRequest({ items: [{ productId: 'prod_digital_1', variantId: 'var_d_1', quantity: 1 }] }),
      { DB: goodsDb(), ...envStub } as never,
      (id: string) => Promise.resolve(id === 'prod_digital_1' ? digitalProduct : null),
    );
    expect(response?.status).toBe(201);
    const payload = await (response as Response).json();
    expect(payload.data.shippingAddress).toBeNull();
  });
});

describe('encodeStripeForm via /payments/sessions', () => {
  const orderWithAddress = {
    id: 'ord_test_1', currency: 'USD', status: 'PENDING',
    shippingAddress: {
      name: '张三', phone: '+8613800001111', line1: '9F, Block A, 88 Century Avenue',
      line2: '', city: 'Shanghai', state: '', postalCode: '200000', country: 'CN',
    },
    items: [{ productId: 'prod_goods_1', productName: 'Bokmoo Card V1', unitPrice: 20, quantity: 1 }],
  };
  const digitalOrder = {
    id: 'ord_test_2', currency: 'USD', status: 'PENDING', shippingAddress: null,
    items: [{ productId: 'prod_digital_1', productName: 'eSIM', unitPrice: 5, quantity: 1 }],
  };

  function sessionsDb(order: Record<string, unknown>) {
    return {
      prepare: (sql: string) => ({
        bind: (..._values: unknown[]) => ({
          first: async () => (sql.includes('native_order_snapshots')
            ? { payload: JSON.stringify(order), total_amount: 20, currency: 'USD', payment_status: 'PENDING' }
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
      loadGoods,
    );
    vi.unstubAllGlobals();
    const payload = response ? await (response as Response).json() : {};
    return { response, payload, body: new URLSearchParams(captured.body ?? '') };
  }

  it('binds the stored address to the payment intent instead of re-collecting it on Stripe', async () => {
    const { response, body } = await createSession(orderWithAddress);
    expect(response?.status).toBe(201);
    expect([...body.keys()].filter((key) => key.startsWith('shipping_address_collection'))).toEqual([]);
    expect(body.get('payment_intent_data[shipping][name]')).toBe('张三');
    expect(body.get('payment_intent_data[shipping][phone]')).toBe('+8613800001111');
    expect(body.get('payment_intent_data[shipping][address][line1]')).toBe('9F, Block A, 88 Century Avenue');
    expect(body.get('payment_intent_data[shipping][address][city]')).toBe('Shanghai');
    expect(body.get('payment_intent_data[shipping][address][postal_code]')).toBe('200000');
    expect(body.get('payment_intent_data[shipping][address][country]')).toBe('CN');
    expect(body.has('payment_intent_data[shipping][address][state]')).toBe(false);
    expect(body.has('payment_intent_data[shipping][address][line2]')).toBe(false);
  });

  it('sets no address constraint for digital orders', async () => {
    const { response, body } = await createSession(digitalOrder);
    expect(response?.status).toBe(201);
    expect([...body.keys()].filter((key) => key.startsWith('shipping_address_collection'))).toEqual([]);
    expect([...body.keys()].filter((key) => key.startsWith('payment_intent_data[shipping]'))).toEqual([]);
  });
});
