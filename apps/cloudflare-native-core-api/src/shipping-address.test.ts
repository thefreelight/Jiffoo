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
    expect(normalizeShippingAddress({ name: '张三', phone: '13800138000', line1: ' address ', city: '', state: '京', postalCode: '100000', country: 'CN' })).toBeNull();
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
