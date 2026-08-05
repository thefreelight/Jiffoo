import { describe, expect, it, vi } from 'vitest';

const authenticateNativeUser = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeUser }));

const { expireNativeWalletReservations, nativeWalletMutate, nativeWalletReserve, tryNativeWallet } = await import('./native-wallet');

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
  it('exposes authenticated read routes but no public mutation route', async () => {
    authenticateNativeUser.mockResolvedValue({ id: 'user-1', email: 'u@example.com' });
    const db = { prepare: vi.fn(() => statement()) };
    const balance = await tryNativeWallet(new Request('https://api.example/api/v1/plugins/wallet/store/balance'), { DB: db } as never);
    expect(balance?.status).toBe(200);
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
