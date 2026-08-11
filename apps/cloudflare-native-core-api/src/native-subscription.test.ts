import { beforeEach, describe, expect, it, vi } from 'vitest';

const authenticateNativeUser = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeUser }));

const { tryNativeSubscription } = await import('./native-subscription');

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
});
