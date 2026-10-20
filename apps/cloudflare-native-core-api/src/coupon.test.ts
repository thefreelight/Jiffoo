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
    const created = await tryNativeCoupon(new Request('https://api.example/api/v1/plugins/coupon/admin/codes', { method: 'POST', body: JSON.stringify({ code: 'welcome15', discountValue: 15 }) }), { DB: db } as never);
    expect(created?.status).toBe(200);
    const validated = await tryNativeCoupon(new Request('https://api.example/api/v1/plugins/coupon/api/validate', { method: 'POST', body: JSON.stringify({ codes: ['WELCOME15'], subtotal: 100 }) }), { DB: db } as never);
    await expect(validated?.json()).resolves.toMatchObject({ success: true, data: { discountAmount: 15, finalTotal: 85 } });
  });

  it('fails closed while the plugin is not enabled', async () => {
    const first = vi.fn(async () => ({ enabled: 0 }));
    const db = { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ first })) })) };
    const response = await tryNativeCoupon(new Request('https://api.example/api/v1/plugins/coupon/api/validate', { method: 'POST', body: JSON.stringify({ codes: ['WELCOME15'], subtotal: 100 }) }), { DB: db } as never);
    expect(response?.status).toBe(404);
  });

  it('creates and redeems a one-time subscription code idempotently', async () => {
    authenticateNativeAdmin.mockResolvedValueOnce(true);
    authenticateNativeUser.mockResolvedValue({ id: 'user-1' });
    const run = vi.fn(async () => ({ success: true, meta: { changes: 1 } }));
    const batch = vi.fn(async () => []);
    const first = vi.fn()
      .mockResolvedValueOnce({ enabled: 1 })
      .mockResolvedValueOnce({ enabled: 1 })
      .mockResolvedValueOnce({ enabled: 1 })
      .mockResolvedValueOnce({ id: 'code-1', code: 'PRO30', plan_slug: 'pro', plan_name: 'Pro', duration_days: 30 })
      .mockResolvedValueOnce({ userId: 'user-1', appliedAt: '2026-08-12T00:00:00.000Z', subscriptionPeriodEnd: '2026-09-11T00:00:00.000Z' })
      .mockResolvedValueOnce({ enabled: 1 })
      .mockResolvedValueOnce({ enabled: 1 })
      .mockResolvedValueOnce({ id: 'code-1', code: 'PRO30', plan_slug: 'pro', plan_name: 'Pro', duration_days: 30 })
      .mockResolvedValueOnce({ userId: 'user-1', appliedAt: '2026-08-12T00:00:00.000Z', subscriptionPeriodEnd: '2026-09-11T00:00:00.000Z' });
    const db = { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run, first })) })), batch };
    const created = await tryNativeCoupon(new Request('https://api.example/api/v1/plugins/coupon/admin/redemption-codes', {
      method: 'POST', body: JSON.stringify({ code: 'pro30', planSlug: 'pro', planName: 'Pro', durationDays: 30 }),
    }), { DB: db } as never);
    expect(created?.status).toBe(200);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const redeemed = await tryNativeCoupon(new Request('https://api.example/api/v1/plugins/coupon/api/redeem', {
        method: 'POST', body: JSON.stringify({ code: 'PRO30' }),
      }), { DB: db } as never);
      expect(redeemed?.status).toBe(200);
      await expect(redeemed?.json()).resolves.toMatchObject({ success: true, data: { planSlug: 'pro', currentPeriodEnd: '2026-09-11T00:00:00.000Z' } });
    }
    expect(batch).toHaveBeenCalledTimes(2);
  });

  it('rejects a redemption code claimed by another user', async () => {
    authenticateNativeUser.mockResolvedValueOnce({ id: 'user-2' });
    const first = vi.fn()
      .mockResolvedValueOnce({ enabled: 1 })
      .mockResolvedValueOnce({ enabled: 1 })
      .mockResolvedValueOnce({ id: 'code-1', code: 'PRO30', plan_slug: 'pro', plan_name: 'Pro', duration_days: 30 })
      .mockResolvedValueOnce({ userId: 'user-1', appliedAt: '2026-08-12T00:00:00.000Z', subscriptionPeriodEnd: '2026-09-11T00:00:00.000Z' });
    const db = { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ first })) })), batch: vi.fn(async () => []) };
    const response = await tryNativeCoupon(new Request('https://api.example/api/v1/plugins/coupon/api/redeem', {
      method: 'POST', body: JSON.stringify({ code: 'PRO30' }),
    }), { DB: db } as never);
    expect(response?.status).toBe(409);
    await expect(response?.json()).resolves.toMatchObject({ success: false, error: { code: 'REDEMPTION_CODE_ALREADY_CLAIMED' } });
  });
});
