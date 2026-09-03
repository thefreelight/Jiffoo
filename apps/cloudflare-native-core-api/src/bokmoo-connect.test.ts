import { afterEach, describe, expect, it, vi } from 'vitest';

const authenticateNativeUser = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeUser }));

const isNativePluginEnabled = vi.fn();
vi.mock('./plugin-enabled', () => ({ isNativePluginEnabled }));

const { tryNativeBokmooConnect } = await import('./bokmoo-connect');

function statement(first: unknown = null, all: unknown[] = []) {
  return {
    bind: vi.fn(() => ({
      first: vi.fn(async () => first),
      all: vi.fn(async () => ({ results: all })),
      run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
    })),
  };
}

afterEach(() => vi.clearAllMocks());

describe('native Bokmoo Connect adapter', () => {
  it('fails closed while the plugin is not enabled', async () => {
    isNativePluginEnabled.mockResolvedValue(false);
    const response = await tryNativeBokmooConnect(
      new Request('https://api.example/api/v1/plugins/bokmoo-connect/store/cards'),
      { DB: { prepare: vi.fn() } } as never,
    );
    expect(response?.status).toBe(404);
    await expect(response?.json()).resolves.toMatchObject({
      success: false,
      error: { code: 'PLUGIN_NOT_ENABLED' },
    });
  });

  it('creates a pending MID session without binding a card', async () => {
    isNativePluginEnabled.mockResolvedValue(true);
    authenticateNativeUser.mockResolvedValue({ id: 'user-1', email: 'u@example.com' });
    const card = { id: 'card-1', mid: '88888000000000000001', status: 'unbound', verification_status: 'pending', user_id: null };
    const session = { id: 'claim-1', user_id: 'user-1', card_id: 'card-1', mid: card.mid, status: 'pending', verification_method: 'ios_qr', expires_at: '2099-01-01T00:00:00.000Z', verified_at: null, created_at: '2026-09-03T00:00:00.000Z', updated_at: '2026-09-03T00:00:00.000Z' };
    const query = vi.fn()
      .mockReturnValueOnce(statement(card))
      .mockReturnValueOnce(statement(session))
      .mockReturnValueOnce(statement(session));
    const response = await tryNativeBokmooConnect(
      new Request('https://api.example/api/v1/cards/claim-sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
        body: JSON.stringify({ mid: '88888 00000 00000 00001' }),
      }),
      { DB: { prepare: query } } as never,
    );
    expect(response?.status).toBe(201);
    await expect(response?.json()).resolves.toMatchObject({
      data: { result: 'pending_verification', session: { id: 'claim-1', mid: card.mid, status: 'pending' } },
    });
    expect(query).toHaveBeenCalledTimes(3);
  });

  it('returns only MID in the card list and exposes hardware identifiers in detail', async () => {
    isNativePluginEnabled.mockResolvedValue(true);
    authenticateNativeUser.mockResolvedValue({ id: 'user-1', email: 'u@example.com' });
    const card = { id: 'card-1', mid: '88888000000000000001', eid: 'EID-1', iccid: 'ICCID-1', status: 'bound', verification_status: 'verified', user_id: 'user-1', bound_at: null, verified_at: null, last_seen_at: null, created_at: '2026-09-03T00:00:00.000Z', updated_at: '2026-09-03T00:00:00.000Z' };
    const listResponse = await tryNativeBokmooConnect(
      new Request('https://api.example/api/v1/cards'),
      { DB: { prepare: vi.fn(() => statement(null, [card])) } } as never,
    );
    const listPayload = await listResponse?.json() as any;
    expect(listPayload.data.items[0]).toMatchObject({ mid: card.mid, displayCardId: '8888 8000 0000 0000 0001' });
    expect(listPayload.data.items[0].iccid).toBeUndefined();

    const detailResponse = await tryNativeBokmooConnect(
      new Request('https://api.example/api/v1/cards/card-1'),
      { DB: { prepare: vi.fn(() => statement(card)) } } as never,
    );
    await expect(detailResponse?.json()).resolves.toMatchObject({ data: { mid: card.mid, eid: card.eid, iccid: card.iccid } });
  });

  it('atomically verifies identifiers through the session route and returns the bound MID', async () => {
    isNativePluginEnabled.mockResolvedValue(true);
    authenticateNativeUser.mockResolvedValue({ id: 'user-1', email: 'u@example.com' });
    const updated = { id: 'card-1', mid: '88888000000000000001', eid: 'EID-1', iccid: 'ICCID-1', status: 'bound', verification_status: 'verified', user_id: 'user-1', bound_at: null, verified_at: '2026-09-03T00:00:00.000Z', last_seen_at: '2026-09-03T00:00:00.000Z', created_at: '2026-09-03T00:00:00.000Z', updated_at: '2026-09-03T00:00:00.000Z' };
    const session = { id: 'claim-1', user_id: 'user-1', card_id: 'card-1', mid: updated.mid, status: 'pending', expires_at: '2099-01-01T00:00:00.000Z', verified_at: null, created_at: '2026-09-03T00:00:00.000Z', updated_at: '2026-09-03T00:00:00.000Z' };
    const query = vi.fn()
      .mockReturnValueOnce(statement(session))
      .mockReturnValueOnce(statement(updated))
      .mockReturnValueOnce(statement(null))
      .mockReturnValueOnce(statement(null))
      .mockReturnValueOnce(statement(null))
      .mockReturnValueOnce(statement(updated))
      .mockReturnValueOnce(statement({ ...session, status: 'completed', verified_at: updated.verified_at }));
    const batch = vi.fn(async () => []);
    const response = await tryNativeBokmooConnect(
      new Request('https://api.example/api/v1/cards/claim-sessions/claim-1/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
        body: JSON.stringify({ eid: 'EID-1', iccid: 'ICCID-1', verificationMethod: 'android' }),
      }),
      { DB: { prepare: query, batch } } as never,
    );
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({ data: { result: 'verified', card: { mid: updated.mid, iccid: updated.iccid }, session: { status: 'completed' } } });
    expect(batch).toHaveBeenCalledOnce();
  });
});
