import { afterEach, describe, expect, it, vi } from 'vitest';

const authenticateNativeUser = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeUser }));

const isNativePluginEnabled = vi.fn();
vi.mock('./plugin-enabled', () => ({ isNativePluginEnabled }));

const { tryNativeFirepathCore } = await import('./firepath-core');

function statement(first: unknown = null, all: unknown[] = []) {
  const bound = {
    first: vi.fn(async () => first),
    all: vi.fn(async () => ({ results: all })),
    run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
  };
  return { ...bound, bind: vi.fn(() => bound) };
}

function snapshotQueries() {
  const query = vi.fn();
  // prepare() call order: profile INSERT, then the three parallel selects,
  // then the profile SELECT once the insert resolves.
  query.mockReturnValueOnce(statement(null));
  query.mockReturnValueOnce(statement(null, [
    { id: 'tx-1', amount_minor: -4500, direction: 'expense', category: 'food', account_id: 'personal-default', note: '午餐', occurred_at: '2026-11-07T00:00:00.000Z' },
  ]));
  query.mockReturnValueOnce(statement(null, []));
  query.mockReturnValueOnce(statement(null, [
    { amount_minor: -4500, direction: 'expense' },
  ]));
  query.mockReturnValueOnce(statement({
    installation_id: 'default', user_id: 'user-1', display_name: 'Explorer', level: 1, xp: 0,
    energy: 100, energy_max: 100, coins: 0, strategy: 'standard',
    opening_net_worth_minor: 0, annual_expense_target_minor: 0, withdrawal_rate_bps: 400,
  }));
  return query;
}

afterEach(() => vi.clearAllMocks());

describe('native FirePath Core adapter', () => {
  it('fails closed while the plugin is not enabled', async () => {
    isNativePluginEnabled.mockResolvedValue(false);
    const response = await tryNativeFirepathCore(
      new Request('https://api.example/api/v1/plugins/firepath-core/store/api/firepath/v1/snapshot'),
      { DB: { prepare: vi.fn() } } as never,
    );
    expect(response?.status).toBe(404);
    await expect(response?.json()).resolves.toMatchObject({
      success: false,
      error: { code: 'PLUGIN_NOT_ENABLED' },
    });
  });

  it('requires a signed-in shop user', async () => {
    isNativePluginEnabled.mockResolvedValue(true);
    authenticateNativeUser.mockResolvedValue(null);
    const response = await tryNativeFirepathCore(
      new Request('https://api.example/api/v1/plugins/firepath-core/store/api/firepath/v1/snapshot'),
      { DB: { prepare: vi.fn() } } as never,
    );
    expect(response?.status).toBe(401);
    await expect(response?.json()).resolves.toMatchObject({
      success: false,
      error: { code: 'UNAUTHORIZED' },
    });
  });

  it('returns the FIRE snapshot through the plugin store prefix', async () => {
    isNativePluginEnabled.mockResolvedValue(true);
    authenticateNativeUser.mockResolvedValue({ id: 'user-1', email: 'u@example.com' });
    const query = snapshotQueries();
    const response = await tryNativeFirepathCore(
      new Request('https://api.example/api/v1/plugins/firepath-core/store/api/firepath/v1/snapshot', {
        headers: { authorization: 'Bearer token' },
      }),
      { DB: { prepare: query } } as never,
    );
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({
      success: true,
      data: {
        profile: { displayName: 'Explorer', energy: 100 },
        fire: { strategy: 'standard', currentMinor: -4500, targetMinor: 0, progressPercent: 0 },
        missions: [
          { id: 'record-expense', status: 'pending' },
          { id: 'transfer-freedom', status: 'pending' },
          { id: 'review-subscription', status: 'pending' },
        ],
        transactions: [{ id: 'tx-1', merchant: '午餐', amountMinor: -4500 }],
      },
    });
  });

  it('creates a transaction and echoes the signed amount', async () => {
    isNativePluginEnabled.mockResolvedValue(true);
    authenticateNativeUser.mockResolvedValue({ id: 'user-1', email: 'u@example.com' });
    const query = vi.fn();
    // insert transaction, then the snapshot queries in their real order
    query.mockReturnValueOnce(statement(null));
    query.mockReturnValueOnce(statement(null)); // profile INSERT (upsert no-op)
    query.mockReturnValueOnce(statement(null, [
      { id: 'tx-new', amount_minor: -1200, direction: 'expense', category: 'coffee', account_id: 'personal-default', note: null, occurred_at: '2026-11-07T00:00:00.000Z' },
    ]));
    query.mockReturnValueOnce(statement(null, []));
    query.mockReturnValueOnce(statement(null, [{ amount_minor: -1200, direction: 'expense' }]));
    query.mockReturnValueOnce(statement({
      installation_id: 'default', user_id: 'user-1', display_name: 'Explorer', level: 1, xp: 0,
      energy: 100, energy_max: 100, coins: 0, strategy: 'standard',
      opening_net_worth_minor: 0, annual_expense_target_minor: 0, withdrawal_rate_bps: 400,
    }));

    const response = await tryNativeFirepathCore(
      new Request('https://api.example/api/v1/plugins/firepath-core/store/api/firepath/v1/transactions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
        body: JSON.stringify({ amountMinor: 1200, direction: 'expense', category: 'coffee' }),
      }),
      { DB: { prepare: query } } as never,
    );
    expect(response?.status).toBe(201);
    await expect(response?.json()).resolves.toMatchObject({
      success: true,
      data: { transaction: { amountMinor: -1200, merchant: 'coffee' } },
    });
  });

  it('rejects invalid transaction payloads', async () => {
    isNativePluginEnabled.mockResolvedValue(true);
    authenticateNativeUser.mockResolvedValue({ id: 'user-1', email: 'u@example.com' });
    const response = await tryNativeFirepathCore(
      new Request('https://api.example/api/v1/plugins/firepath-core/store/api/firepath/v1/transactions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
        body: JSON.stringify({ amountMinor: -5, direction: 'expense', category: 'coffee' }),
      }),
      { DB: { prepare: vi.fn() } } as never,
    );
    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toMatchObject({
      success: false,
      error: { code: 'INVALID_REQUEST' },
    });
  });

  it('completes a mission and grants rewards once per day', async () => {
    isNativePluginEnabled.mockResolvedValue(true);
    authenticateNativeUser.mockResolvedValue({ id: 'user-1', email: 'u@example.com' });
    const query = vi.fn();
    query.mockReturnValueOnce(statement(null)); // profile INSERT
    query.mockReturnValueOnce(statement({
      installation_id: 'default', user_id: 'user-1', display_name: 'Explorer', level: 1, xp: 0,
      energy: 100, energy_max: 100, coins: 0, strategy: 'standard',
      opening_net_worth_minor: 0, annual_expense_target_minor: 0, withdrawal_rate_bps: 400,
    }));
    query.mockReturnValueOnce(statement(null)); // mission select (none yet)
    query.mockReturnValueOnce(statement(null)); // mission insert
    query.mockReturnValueOnce(statement({ success: true, meta: { changes: 1 } })); // profile update
    // snapshot: profile INSERT, three parallel selects, profile SELECT
    query.mockReturnValueOnce(statement(null));
    query.mockReturnValueOnce(statement(null, []));
    query.mockReturnValueOnce(statement(null, [{ mission_id: 'record-expense' }]));
    query.mockReturnValueOnce(statement(null, []));
    query.mockReturnValueOnce(statement({
      installation_id: 'default', user_id: 'user-1', display_name: 'Explorer', level: 1, xp: 20,
      energy: 110, energy_max: 100, coins: 0, strategy: 'standard',
      opening_net_worth_minor: 0, annual_expense_target_minor: 0, withdrawal_rate_bps: 400,
    }));

    const response = await tryNativeFirepathCore(
      new Request('https://api.example/api/v1/plugins/firepath-core/store/api/firepath/v1/missions/record-expense/complete', {
        method: 'POST',
        headers: { authorization: 'Bearer token' },
      }),
      { DB: { prepare: query } } as never,
    );
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({
      success: true,
      data: { mission: { id: 'record-expense', status: 'completed' } },
    });
  });

  it('returns null for unrelated paths', async () => {
    isNativePluginEnabled.mockResolvedValue(true);
    const response = await tryNativeFirepathCore(
      new Request('https://api.example/api/v1/plugins/bokmoo-connect/store/cards'),
      { DB: { prepare: vi.fn() } } as never,
    );
    expect(response).toBeNull();
  });
});
