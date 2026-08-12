import { describe, expect, it, vi } from 'vitest';

const authenticateNativeUser = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeUser }));
const getNativePluginSecret = vi.fn(async () => 'sk_test_wallet');
vi.mock('./plugin-settings', () => ({ getNativePluginSecret }));

const { expireNativeWalletReservations, nativeWalletMutate, nativeWalletReserve, settleNativeWalletCheckout, tryNativeWallet } = await import('./native-wallet');

function statement(first: unknown = null, all: unknown[] = []) {
  return {
    bind: vi.fn(() => ({
      first: vi.fn(async () => first),
      all: vi.fn(async () => ({ results: all })),
      run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
    })),
  };
}

describe('native D1 wallet', () => {
  it('lists the native credit packages through the official gateway contract', async () => {
    authenticateNativeUser.mockResolvedValue({ id: 'user-1', email: 'u@example.com' });
    const db = { prepare: vi.fn(() => statement()) };
    const result = await tryNativeWallet(new Request('https://api.example/api/v1/extensions/plugin/wallet/api/api/packages'), { DB: db } as never);
    expect(result?.status).toBe(200);
    const payload = await result?.json() as { success: boolean; data: { total: number; items: Array<{ id: string; points: number }> } };
    expect(payload.success).toBe(true);
    expect(payload.data.total).toBe(3);
    expect(payload.data.items[0]).toMatchObject({ id: 'starter', points: 80 });
  });

  it('credits a paid Stripe wallet checkout only once across repeated settlement', async () => {
    const checkout = {
      id: 'wallet_checkout_1', user_id: 'user-1', package_id: 'starter', points: 80,
      amount_cents: 900, currency: 'USD', provider_session_id: 'cs_test_1', checkout_url: null, status: 'pending',
    };
    let ledger: { user_id: string; operation: string; amount: number } | null = null;
    let balance = 0;
    const db = {
      prepare: vi.fn((sql: string) => ({
        bind: vi.fn((...values: unknown[]) => ({
          first: vi.fn(async () => {
            if (sql.includes('native_wallet_checkout_sessions')) return checkout;
            if (sql.includes('native_wallet_ledger')) return ledger;
            if (sql.includes('native_wallet_accounts')) return { balance, reserved_balance: 0, user_id: 'user-1', total_credited: balance, total_debited: 0 };
            return null;
          }),
          run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
        })),
      })),
      batch: vi.fn(async () => {
        if (!ledger) {
          balance += 80;
          ledger = { user_id: 'user-1', operation: 'credit', amount: 80 };
        }
        return [];
      }),
    };
    const metadata = { walletCheckoutId: 'wallet_checkout_1', walletUserId: 'user-1' };
    await expect(settleNativeWalletCheckout({ DB: db } as never, metadata, 'cs_test_1')).resolves.toMatchObject({ balance: 80, points: 80 });
    await expect(settleNativeWalletCheckout({ DB: db } as never, metadata, 'cs_test_1')).resolves.toMatchObject({ balance: 80, points: 80 });
    expect(db.batch).toHaveBeenCalledTimes(1);
  });

  it('creates a Stripe Checkout session for a native wallet package', async () => {
    authenticateNativeUser.mockResolvedValue({ id: 'user-1', email: 'u@example.com' });
    const run = vi.fn(async () => ({ success: true, meta: { changes: 1 } }));
    const db = { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run })) })) };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id: 'cs_test_1', url: 'https://checkout.stripe.test/1' }), { status: 200 })));
    const result = await tryNativeWallet(new Request('https://api.example/api/v1/extensions/plugin/wallet/api/api/packages/starter/checkout', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ successUrl: 'https://imagic.art/en/pricing?ok=1', cancelUrl: 'https://imagic.art/en/pricing' }),
    }), { DB: db } as never);
    expect(result?.status).toBe(201);
    await expect(result?.json()).resolves.toMatchObject({ success: true, data: { sessionId: 'cs_test_1', checkoutUrl: 'https://checkout.stripe.test/1' } });
    expect(getNativePluginSecret).toHaveBeenCalledWith(expect.anything(), 'stripe', 'secretKey', undefined);
    vi.unstubAllGlobals();
  });

  it('exposes authenticated read routes but no public mutation route', async () => {
    authenticateNativeUser.mockResolvedValue({ id: 'user-1', email: 'u@example.com' });
    const db = { prepare: vi.fn(() => statement()) };
    const balance = await tryNativeWallet(new Request('https://api.example/api/v1/plugins/wallet/store/balance'), { DB: db } as never);
    expect(balance?.status).toBe(200);
    const gatewayBalance = await tryNativeWallet(new Request('https://api.example/api/v1/extensions/plugin/wallet/api/api/balance'), { DB: db } as never);
    expect(gatewayBalance?.status).toBe(200);
    const mutation = await tryNativeWallet(new Request('https://api.example/api/v1/plugins/wallet/store/reserve', { method: 'POST' }), { DB: db } as never);
    expect(mutation?.status).toBe(404);
  });

  it('rejects conflicting mutation idempotency without writing', async () => {
    const rows = [null, { user_id: 'other-user', operation: 'credit', amount: 10 }];
    const db = { prepare: vi.fn(() => statement(rows.shift() ?? null)) };
    await expect(nativeWalletMutate({ DB: db } as never, {
      userId: 'user-1', amount: 10, operation: 'credit', idempotencyKey: 'shared-key',
    })).rejects.toThrow('IDEMPOTENCY_CONFLICT');
  });

  it('returns the existing reservation for a matching idempotent retry', async () => {
    const existing = {
      id: 'wallet_res_1', user_id: 'user-1', amount: 1, status: 'reserved',
      expires_at: '2099-01-01T00:00:00.000Z', idempotency_key: 'pack-1',
      completion_idempotency_key: null, completion_action: null, reference_id: 'pack-1',
      source_plugin: 'remoteradar-applications', created_at: '2026-01-01T00:00:00.000Z',
      settled_at: null, released_at: null,
    };
    const db = { prepare: vi.fn(() => statement(existing)) };
    await expect(nativeWalletReserve({ DB: db } as never, {
      userId: 'user-1', amount: 1, idempotencyKey: 'pack-1', referenceId: 'pack-1',
    })).resolves.toMatchObject({ id: 'wallet_res_1', status: 'reserved' });
  });

  it('expires abandoned reservations in bounded scheduled batches', async () => {
    const run = vi.fn(async () => ({ success: true, meta: { changes: 4 } }));
    const bind = vi.fn(() => ({ run }));
    const db = { prepare: vi.fn(() => ({ bind })) };
    await expect(expireNativeWalletReservations({ DB: db } as never, 10)).resolves.toEqual({ expired: 4 });
    expect(bind).toHaveBeenCalledWith(expect.any(String), 10);
  });
});
