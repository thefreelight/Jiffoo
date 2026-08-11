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
});
