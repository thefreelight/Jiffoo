import { beforeEach, describe, expect, it, vi } from 'vitest';

const authenticateNativeUser = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeUser }));

const { applyNativeSubscriptionRedemption, tryNativeSubscription } = await import('./native-subscription');

describe('native subscription contract', () => {
  beforeEach(() => vi.clearAllMocks());
  it('returns a stable Free fallback for an authenticated user without a subscription', async () => {
    authenticateNativeUser.mockResolvedValue({ id: 'user-1', email: 'u@example.com' });
    const first = vi.fn()
      .mockResolvedValueOnce({ enabled: 1 })
      .mockResolvedValueOnce(null);
    const db = { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ first })) })) };
    const response = await tryNativeSubscription(new Request('https://api.example/api/v1/extensions/plugin/subscription/api/api/store/subscriptions/active'), { DB: db } as never);
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({ success: true, data: { active: false, planName: 'Free' } });
  });

  it('rejects unauthenticated reads', async () => {
    authenticateNativeUser.mockResolvedValue(null);
    const first = vi.fn(async () => ({ enabled: 1 }));
    const db = { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ first })) })) };
    const response = await tryNativeSubscription(new Request('https://api.example/api/v1/extensions/plugin/subscription/api/api/store/subscriptions/active'), { DB: db } as never);
    expect(response?.status).toBe(401);
  });

  it('fails closed while the plugin is not enabled', async () => {
    const first = vi.fn(async () => null);
    const db = { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ first })) })) };
    const response = await tryNativeSubscription(new Request('https://api.example/api/v1/extensions/plugin/subscription/api/api/store/subscriptions/active'), { DB: db } as never);
    expect(response?.status).toBe(404);
  });

  it('owns the atomic subscription redemption write contract', async () => {
    const claim = { userId: 'user-1', appliedAt: '2026-08-12T00:00:00.000Z', subscriptionPeriodEnd: '2026-09-11T00:00:00.000Z' };
    const first = vi.fn(async () => claim);
    const bind = vi.fn(() => ({ first }));
    const prepare = vi.fn(() => ({ bind }));
    const batch = vi.fn(async () => []);
    const db = { prepare, batch };

    await expect(applyNativeSubscriptionRedemption({ DB: db } as never, 'user-1', {
      id: 'code-1', code: 'PRO30', planSlug: 'pro', planName: 'Pro', durationDays: 30,
    })).resolves.toEqual(claim);

    expect(batch).toHaveBeenCalledOnce();
    expect(batch.mock.calls[0]?.[0]).toHaveLength(3);
    expect(prepare.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO native_subscription_records'))).toBe(true);
  });
});
