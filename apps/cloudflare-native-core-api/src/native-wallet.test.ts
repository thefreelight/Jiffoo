import { describe, expect, it, vi } from 'vitest';

const authenticateNativeUser = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeUser }));
const getNativeStripeSecret = vi.fn(async () => ({ mode: 'test', value: 'sk_test_wallet' }));
const getNativePluginConfig = vi.fn(async () => ({ enabled: true, config: {} }));
vi.mock('./plugin-settings', () => ({ getNativeStripeSecret, getNativePluginConfig }));

const {
  expireNativeWalletReservations, nativeWalletMutate, nativeWalletReserve, settleNativeWalletCheckout, tryNativeWallet,
  nativeCurrencyBalance, nativeCurrencyFinish, nativeCurrencyMutate, nativeCurrencyReserve,
} = await import('./native-wallet');

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
    expect(getNativeStripeSecret).toHaveBeenCalledWith(expect.anything(), 'secretKey', undefined);
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

describe('native D1 currency wallet', () => {
  // Route-based D1 mock: row results keyed on SQL fragments; batch applies
  // the account/ledger mutations so idempotency reads behave like the real
  // ledger.
  function currencyDb(options: {
    rows?: Record<string, unknown>;
    batch?: (statements: unknown[]) => Promise<unknown[]>;
  } = {}) {
    const state = {
      balance: 0,
      reserved: 0,
      ledger: null as null | Record<string, unknown>,
      ledgerKey: null as null | string,
    };
    const batch = options.batch ?? vi.fn(async (statements: Array<{ sql: string; _values: unknown[] }>) => {
      for (const stmt of statements) {
        if (stmt.sql.includes('UPDATE native_currency_accounts SET balance = ?1')) {
          state.balance = Number(stmt._values[0]);
        }
        if (stmt.sql.includes('balance = balance - ?1, reserved_balance = reserved_balance - ?1')) {
          state.balance -= Number(stmt._values[0]);
        }
        if (stmt.sql.includes('INSERT INTO native_currency_ledger')) {
          if (stmt.sql.includes('SELECT ?1, ?2, ?3')) {
            // Settle ledger INSERT ... SELECT binds: id,user,currency,amount,source,now,reference
            state.ledger = { user_id: stmt._values[1], operation: 'settlement', amount: Number(stmt._values[3]) };
            state.ledgerKey = null;
          } else {
            // Mutate ledger INSERT binds: id,user,currency,operation,amount,balance_after,type,description,source,key,…
            state.ledger = { user_id: stmt._values[1], operation: stmt._values[3], amount: Number(stmt._values[4]) };
            state.ledgerKey = String(stmt._values[9]);
          }
        }
      }
      return [];
    });
    const db = {
      batch,
      prepare: vi.fn((sql: string) => ({
        bind: vi.fn((...values: unknown[]) => ({
          sql,
          _values: values,
          first: vi.fn(async () => {
            for (const [fragment, row] of Object.entries(options.rows ?? {})) {
              if (sql.includes(fragment)) return row;
            }
            if (sql.includes('native_currency_ledger')) {
              return state.ledger && state.ledgerKey === String(values[0]) ? state.ledger : null;
            }
            if (sql.includes('native_currency_accounts')) return { user_id: 'user-1', currency: 'USD', balance: state.balance, reserved_balance: state.reserved, total_credited: state.balance, total_debited: 0 };
            return null;
          }),
          all: vi.fn(async () => ({ results: [] })),
          run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
        })),
      })),
    };
    return { db, batch, state };
  }

  it('lists configured currency packages from wallet plugin settings', async () => {
    authenticateNativeUser.mockResolvedValueOnce({ id: 'user-1', email: 'u@example.com' });
    getNativePluginConfig.mockResolvedValueOnce({
      enabled: true,
      config: {
        defaultCurrency: 'USD',
        currencyPackages: [{ id: 'usd-10', name: '$10 store credit', description: '', currency: 'USD', priceCents: 1000, bonusCents: 100 }],
      },
    });
    const { db } = currencyDb();
    const result = await tryNativeWallet(new Request('https://api.example/api/v1/plugins/wallet/store/currency/packages'), { DB: db } as never);
    expect(result?.status).toBe(200);
    const payload = await result?.json() as { success: boolean; data: { total: number; defaultCurrency: string; items: Array<{ id: string; priceCents: number; bonusCents: number }> } };
    expect(payload.data).toMatchObject({ total: 1, defaultCurrency: 'USD' });
    expect(payload.data.items[0]).toMatchObject({ id: 'usd-10', priceCents: 1000, bonusCents: 100 });
  });

  it('creates a currency checkout session charging the package price in minor units', async () => {
    authenticateNativeUser.mockResolvedValueOnce({ id: 'user-1', email: 'u@example.com' });
    getNativePluginConfig.mockResolvedValueOnce({
      enabled: true,
      config: { defaultCurrency: 'USD', currencyPackages: [{ id: 'usd-10', name: '$10 store credit', description: '', currency: 'USD', priceCents: 1000, bonusCents: 100 }] },
    });
    const run = vi.fn(async () => ({ success: true, meta: { changes: 1 } }));
    const db = { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run, first: vi.fn(async () => null) })) })), batch: vi.fn() };
    const fetchMock = vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.includes('api.stripe.com')) {
        return new Response(JSON.stringify({ id: 'cs_currency_1', url: 'https://checkout.stripe.test/c1' }), { status: 200 });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const result = await tryNativeWallet(new Request('https://api.example/api/v1/plugins/wallet/store/currency/packages/usd-10/checkout', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}),
      }), { DB: db } as never);
      expect(result?.status).toBe(201);
      await expect(result?.json()).resolves.toMatchObject({
        success: true,
        data: { packageId: 'usd-10', currency: 'USD', amountCents: 1000, creditedCents: 1100, status: 'pending' },
      });
      const stripeBody = decodeURIComponent(String(fetchMock.mock.calls[0]![1]!.body));
      expect(stripeBody).toContain('price_data][unit_amount]=1000');
      expect(stripeBody).toContain('metadata[walletKind]=currency');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('settles a paid currency checkout through the webhook metadata path', async () => {
    const { db, batch } = currencyDb({
      rows: {
        'native_currency_checkout_sessions': {
          id: 'wallet_checkout_c1', user_id: 'user-1', package_id: 'usd-10', currency: 'USD',
          credited_cents: 1100, amount_cents: 1000, provider_session_id: 'cs_currency_1', checkout_url: null, status: 'pending',
        },
        'native_wallet_checkout_sessions': null,
      },
    });
    const metadata = { walletCheckoutId: 'wallet_checkout_c1', walletUserId: 'user-1' };
    const settled = await settleNativeWalletCheckout({ DB: db } as never, metadata, 'cs_currency_1');
    expect(settled).toMatchObject({ kind: 'currency', currency: 'USD', creditedCents: 1100 });
    expect(batch).toHaveBeenCalled();
  });

  it('credits and debits a currency account idempotently', async () => {
    const { db, state } = currencyDb();
    await expect(nativeCurrencyMutate({ DB: db } as never, {
      userId: 'user-1', currency: 'USD', amount: 2500, operation: 'credit', idempotencyKey: 'currency-topup:1',
      type: 'purchase', description: 'Top-up',
    })).resolves.toMatchObject({ currency: 'USD', balance: 2500 });
    state.ledger = { user_id: 'user-1', operation: 'credit', amount: 2500 };
    await expect(nativeCurrencyMutate({ DB: db } as never, {
      userId: 'user-1', currency: 'USD', amount: 2500, operation: 'credit', idempotencyKey: 'currency-topup:1',
    })).resolves.toMatchObject({ balance: 2500 });
    await expect(nativeCurrencyMutate({ DB: db } as never, {
      userId: 'user-1', currency: 'USD', amount: 100000, operation: 'debit', idempotencyKey: 'currency-spend:1',
    })).rejects.toThrow('INSUFFICIENT_BALANCE');
  });

  it('reserves and settles a currency hold with availability checks', async () => {
    const { db } = currencyDb();
    await expect(nativeCurrencyReserve({ DB: db } as never, {
      userId: 'user-1', currency: 'USD', amount: 500, idempotencyKey: 'currency-res:1',
    })).rejects.toThrow('INSUFFICIENT_AVAILABLE_BALANCE');
  });
});
