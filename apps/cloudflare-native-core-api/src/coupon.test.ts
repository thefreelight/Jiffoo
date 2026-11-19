import { beforeEach, describe, expect, it, vi } from 'vitest';

const authenticateNativeAdmin = vi.fn();
const authenticateNativeUser = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeAdmin, authenticateNativeUser }));

const { tryNativeCoupon } = await import('./coupon');

describe('native coupon contract', () => {
  beforeEach(() => vi.clearAllMocks());
  it('creates and validates a percentage code', async () => {
    authenticateNativeAdmin.mockResolvedValueOnce(true);
    authenticateNativeUser.mockResolvedValueOnce({ id: 'user-1' });
    const run = vi.fn(async () => ({ success: true, meta: { changes: 1 } }));
    const first = vi.fn()
      .mockResolvedValueOnce({ enabled: 1 })
      .mockResolvedValueOnce({ enabled: 1 })
      .mockResolvedValueOnce({ code: 'WELCOME15', discount_type: 'percentage', discount_value: 15 });
    const db = { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run, first })) })) };
    const created = await tryNativeCoupon(new Request('https://api.example/api/v1/plugins/coupon/admin/codes', { method: 'POST', body: JSON.stringify({ code: 'welcome15', discountValue: 15 }) }), { DB: db } as never, vi.fn());
    expect(created?.status).toBe(200);
    const validated = await tryNativeCoupon(new Request('https://api.example/api/v1/plugins/coupon/api/validate', { method: 'POST', body: JSON.stringify({ codes: ['WELCOME15'], subtotal: 100 }) }), { DB: db } as never, vi.fn());
    await expect(validated?.json()).resolves.toMatchObject({ success: true, data: { discountAmount: 15, finalTotal: 85 } });
  });

  it('fails closed while the plugin is not enabled', async () => {
    const first = vi.fn(async () => ({ enabled: 0 }));
    const db = { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ first })) })) };
    const response = await tryNativeCoupon(new Request('https://api.example/api/v1/plugins/coupon/api/validate', { method: 'POST', body: JSON.stringify({ codes: ['WELCOME15'], subtotal: 100 }) }), { DB: db } as never, vi.fn());
    expect(response?.status).toBe(404);
  });

  it('creates and redeems a one-time subscription code idempotently', async () => {
    authenticateNativeAdmin.mockResolvedValueOnce(true);
    authenticateNativeUser.mockResolvedValue({ id: 'user-1' });
    const run = vi.fn(async () => ({ success: true, meta: { changes: 1 } }));
    const batch = vi.fn(async () => []);
    const first = vi.fn()
      // create call: plugin gate
      .mockResolvedValueOnce({ enabled: 1 })
      // redeem 1: plugin gate, subscription existence probe, subscription gate, code row, claim
      .mockResolvedValueOnce({ enabled: 1 })
      .mockResolvedValueOnce({ id: 'code-1' })
      .mockResolvedValueOnce({ enabled: 1 })
      .mockResolvedValueOnce({ id: 'code-1', code: 'PRO30', plan_slug: 'pro', plan_name: 'Pro', duration_days: 30 })
      .mockResolvedValueOnce({ userId: 'user-1', appliedAt: '2026-08-12T00:00:00.000Z', subscriptionPeriodEnd: '2026-09-11T00:00:00.000Z' })
      // redeem 2: same sequence
      .mockResolvedValueOnce({ enabled: 1 })
      .mockResolvedValueOnce({ id: 'code-1' })
      .mockResolvedValueOnce({ enabled: 1 })
      .mockResolvedValueOnce({ id: 'code-1', code: 'PRO30', plan_slug: 'pro', plan_name: 'Pro', duration_days: 30 })
      .mockResolvedValueOnce({ userId: 'user-1', appliedAt: '2026-08-12T00:00:00.000Z', subscriptionPeriodEnd: '2026-09-11T00:00:00.000Z' });
    const db = { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run, first })) })), batch };
    const created = await tryNativeCoupon(new Request('https://api.example/api/v1/plugins/coupon/admin/redemption-codes', {
      method: 'POST', body: JSON.stringify({ code: 'pro30', planSlug: 'pro', planName: 'Pro', durationDays: 30 }),
    }), { DB: db } as never, vi.fn());
    expect(created?.status).toBe(200);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const redeemed = await tryNativeCoupon(new Request('https://api.example/api/v1/plugins/coupon/api/redeem', {
        method: 'POST', body: JSON.stringify({ code: 'PRO30' }),
      }), { DB: db } as never, vi.fn());
      expect(redeemed?.status).toBe(200);
      await expect(redeemed?.json()).resolves.toMatchObject({ success: true, data: { planSlug: 'pro', currentPeriodEnd: '2026-09-11T00:00:00.000Z' } });
    }
    expect(batch).toHaveBeenCalledTimes(2);
  });

  it('rejects a redemption code claimed by another user', async () => {
    authenticateNativeUser.mockResolvedValueOnce({ id: 'user-2' });
    const first = vi.fn()
      .mockResolvedValueOnce({ enabled: 1 })
      .mockResolvedValueOnce({ id: 'code-1' })
      .mockResolvedValueOnce({ enabled: 1 })
      .mockResolvedValueOnce({ id: 'code-1', code: 'PRO30', plan_slug: 'pro', plan_name: 'Pro', duration_days: 30 })
      .mockResolvedValueOnce({ userId: 'user-1', appliedAt: '2026-08-12T00:00:00.000Z', subscriptionPeriodEnd: '2026-09-11T00:00:00.000Z' });
    const db = { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ first })) })), batch: vi.fn(async () => []) };
    const response = await tryNativeCoupon(new Request('https://api.example/api/v1/plugins/coupon/api/redeem', {
      method: 'POST', body: JSON.stringify({ code: 'PRO30' }),
    }), { DB: db } as never, vi.fn());
    expect(response?.status).toBe(409);
    await expect(response?.json()).resolves.toMatchObject({ success: false, error: { code: 'REDEMPTION_CODE_ALREADY_CLAIMED' } });
  });
});

describe('native product redemption codes', () => {
  beforeEach(() => vi.clearAllMocks());

  // Route-based D1 mock: first/all/run behavior keyed on SQL fragments.
  function couponDb(overrides: {
    rows?: Record<string, unknown>;
    run?: (sql: string) => Promise<unknown>;
    batch?: (statements: unknown[]) => Promise<unknown[]>;
  } = {}) {
    const rows = { 'native_plugin_instances': { enabled: 1 }, ...(overrides.rows ?? {}) };
    const batch = overrides.batch ?? vi.fn(async () => []);
    const routeFirst = vi.fn(async (sql: string) => {
      for (const [fragment, row] of Object.entries(rows)) {
        if (sql.includes(fragment)) return row;
      }
      return null;
    });
    const routeAll = vi.fn(async () => ({ results: [] }));
    const db = {
      batch,
      prepare: vi.fn((sql: string) => {
        const bound = {
          sql,
          first: vi.fn(() => routeFirst(sql)),
          all: routeAll,
          run: vi.fn(async () => overrides.run?.(sql) ?? { success: true, meta: { changes: 1 } }),
        };
        return { ...bound, bind: vi.fn(() => bound) };
      }),
    };
    return { db, batch };
  }

  const esimProduct = {
    id: 'esim-jp-7d-1gb',
    name: 'Japan eSIM 7-day 1GB',
    productKind: 'consumable',
    variants: [{ id: 'variant-jp-7d', name: 'Standard', isActive: true, salePrice: 4.9, baseStock: 0, attributes: null }],
  };

  it('creates and lists a product redemption code as admin', async () => {
    authenticateNativeAdmin.mockResolvedValue(true);
    const { db } = couponDb();
    const created = await tryNativeCoupon(new Request('https://api.example/api/v1/plugins/coupon/admin/product-redemption-codes', {
      method: 'POST', body: JSON.stringify({ code: 'esimjp7d', productId: 'esim-jp-7d-1gb', quantity: 2 }),
    }), { DB: db } as never, vi.fn());
    expect(created?.status).toBe(201);
    await expect(created?.json()).resolves.toMatchObject({ success: true, data: { code: 'ESIMJP7D', productId: 'esim-jp-7d-1gb', quantity: 2 } });
    const list = await tryNativeCoupon(new Request('https://api.example/api/v1/plugins/coupon/admin/product-redemption-codes'), { DB: db } as never, vi.fn());
    expect(list?.status).toBe(200);
    await expect(list?.json()).resolves.toMatchObject({ success: true, data: { items: [], total: 0 } });
  });

  it('rejects unauthenticated admin creation', async () => {
    authenticateNativeAdmin.mockResolvedValue(false);
    const db = couponDb().db;
    const response = await tryNativeCoupon(new Request('https://api.example/api/v1/plugins/coupon/admin/product-redemption-codes', {
      method: 'POST', body: JSON.stringify({ code: 'ESIMJP7D', productId: 'esim-jp-7d-1gb' }),
    }), { DB: db } as never, vi.fn());
    expect(response?.status).toBe(401);
  });

  it('redeems a product code into a zero-total paid order and fires the fulfillment outbox event', async () => {
    authenticateNativeUser.mockResolvedValueOnce({ id: 'user-1', email: 'u@example.com' });
    const { db, batch } = couponDb({
      rows: {
        'native_subscription_redemption_codes': null,
        'native_product_redemption_codes': { id: 'pcode-1', code: 'ESIMJP7D', product_id: 'esim-jp-7d-1gb', variant_id: null, quantity: 1 },
        'native_product_redemption_claims': null,
      },
    });
    const loadProduct = vi.fn(async () => esimProduct);
    const response = await tryNativeCoupon(new Request('https://api.example/api/v1/plugins/coupon/api/redeem', {
      method: 'POST', body: JSON.stringify({ code: 'esimjp7d' }),
    }), { DB: db } as never, loadProduct);
    expect(response?.status).toBe(201);
    const payload = await response?.json() as { success: boolean; data: { grantKind: string; orderId: string; status: string; productId: string; quantity: number } };
    expect(payload.success).toBe(true);
    expect(payload.data).toMatchObject({ grantKind: 'product', status: 'PAID', productId: 'esim-jp-7d-1gb', quantity: 1 });
    expect(batch).toHaveBeenCalledTimes(1);
    const statements = batch.mock.calls[0]![0] as Array<{ sql: string }>;
    const sqls = statements.map((statement) => statement.sql);
    expect(sqls.some((sql) => sql.includes('INSERT INTO native_order_snapshots'))).toBe(true);
    expect(sqls.some((sql) => sql.includes("'PAID', 'USD', 0"))).toBe(true);
    expect(sqls.some((sql) => sql.includes('native_inventory_reservations'))).toBe(true);
    expect(sqls.some((sql) => sql.includes('native_order_items'))).toBe(true);
    const outbox = statements.find((statement) => statement.sql.includes('native_checkout_outbox'));
    expect(outbox).toBeDefined();
    expect(sqls.some((sql) => sql.includes("'payment.succeeded'"))).toBe(true);
  });

  it('rejects a product code claimed by another user', async () => {
    authenticateNativeUser.mockResolvedValueOnce({ id: 'user-2', email: 'u2@example.com' });
    const { db } = couponDb({
      rows: {
        'native_product_redemption_codes': { id: 'pcode-1', code: 'ESIMJP7D', product_id: 'esim-jp-7d-1gb', variant_id: null, quantity: 1 },
        'native_product_redemption_claims': { code_id: 'pcode-1', user_id: 'user-1', order_id: 'ord_x', applied_at: '2026-11-19T00:00:00.000Z' },
      },
    });
    const response = await tryNativeCoupon(new Request('https://api.example/api/v1/plugins/coupon/api/redeem', {
      method: 'POST', body: JSON.stringify({ code: 'ESIMJP7D' }),
    }), { DB: db } as never, vi.fn(async () => esimProduct));
    expect(response?.status).toBe(409);
    await expect(response?.json()).resolves.toMatchObject({ success: false, error: { code: 'REDEMPTION_CODE_ALREADY_CLAIMED' } });
  });

  it('returns the existing order when the same user re-redeems their claimed code', async () => {
    authenticateNativeUser.mockResolvedValueOnce({ id: 'user-1', email: 'u@example.com' });
    const { db, batch } = couponDb({
      rows: {
        'native_product_redemption_codes': { id: 'pcode-1', code: 'ESIMJP7D', product_id: 'esim-jp-7d-1gb', variant_id: null, quantity: 1 },
        'native_product_redemption_claims': { code_id: 'pcode-1', user_id: 'user-1', order_id: 'ord_existing', applied_at: '2026-11-19T00:00:00.000Z' },
      },
    });
    const loadProduct = vi.fn(async () => esimProduct);
    const response = await tryNativeCoupon(new Request('https://api.example/api/v1/plugins/coupon/api/redeem', {
      method: 'POST', body: JSON.stringify({ code: 'ESIMJP7D' }),
    }), { DB: db } as never, loadProduct);
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({ success: true, data: { grantKind: 'product', orderId: 'ord_existing', duplicate: true } });
    expect(batch).not.toHaveBeenCalled();
    expect(loadProduct).not.toHaveBeenCalled();
  });

  it('rejects an unknown or expired product code', async () => {
    authenticateNativeUser.mockResolvedValueOnce({ id: 'user-1', email: 'u@example.com' });
    const { db } = couponDb();
    const response = await tryNativeCoupon(new Request('https://api.example/api/v1/plugins/coupon/api/redeem', {
      method: 'POST', body: JSON.stringify({ code: 'NOCODE' }),
    }), { DB: db } as never, vi.fn(async () => esimProduct));
    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toMatchObject({ success: false, error: { code: 'REDEMPTION_CODE_INVALID' } });
  });

  it('rejects a product code whose product is no longer purchasable', async () => {
    authenticateNativeUser.mockResolvedValueOnce({ id: 'user-1', email: 'u@example.com' });
    const { db } = couponDb({
      rows: {
        'native_product_redemption_codes': { id: 'pcode-1', code: 'ESIMJP7D', product_id: 'esim-jp-7d-1gb', variant_id: null, quantity: 1 },
        'native_product_redemption_claims': null,
      },
    });
    const response = await tryNativeCoupon(new Request('https://api.example/api/v1/plugins/coupon/api/redeem', {
      method: 'POST', body: JSON.stringify({ code: 'ESIMJP7D' }),
    }), { DB: db } as never, vi.fn(async () => null));
    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toMatchObject({ success: false, error: { code: 'REDEMPTION_PRODUCT_NOT_FOUND' } });
  });

  it('prefers the subscription code when both tables carry the same identifier', async () => {
    authenticateNativeUser.mockResolvedValueOnce({ id: 'user-1' });
    const first = vi.fn()
      .mockResolvedValueOnce({ enabled: 1 })
      .mockResolvedValueOnce({ id: 'code-1' })
      .mockResolvedValueOnce({ enabled: 1 })
      .mockResolvedValueOnce({ id: 'code-1', code: 'PRO30', plan_slug: 'pro', plan_name: 'Pro', duration_days: 30 })
      .mockResolvedValueOnce({ userId: 'user-1', appliedAt: '2026-08-12T00:00:00.000Z', subscriptionPeriodEnd: '2026-09-11T00:00:00.000Z' });
    const db = { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run: vi.fn(), first })) })), batch: vi.fn() };
    const loadProduct = vi.fn();
    const response = await tryNativeCoupon(new Request('https://api.example/api/v1/plugins/coupon/api/redeem', {
      method: 'POST', body: JSON.stringify({ code: 'PRO30' }),
    }), { DB: db } as never, loadProduct);
    expect(response?.status).toBe(200);
    expect(loadProduct).not.toHaveBeenCalled();
  });
});
