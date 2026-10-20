import { afterEach, describe, expect, it, vi } from 'vitest';

const authenticateNativeUser = vi.fn();
const authenticateNativeAdmin = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeUser, authenticateNativeAdmin }));

const isNativePluginEnabled = vi.fn();
vi.mock('./plugin-enabled', () => ({ isNativePluginEnabled }));

const { tryNativeBokmooConnect } = await import('./bokmoo-connect');

function statement(first: unknown = null, all: unknown[] = []) {
  const bound = {
    first: vi.fn(async () => first),
    all: vi.fn(async () => ({ results: all })),
    run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
  };
  return { ...bound, bind: vi.fn(() => bound) };
}

const ADMIN_URL = 'https://api.example/api/v1/extensions/plugin/bokmoo-connect/api/admin';

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

describe('native Bokmoo Connect admin card inventory', () => {
  it('fails closed on admin routes while the plugin is not enabled', async () => {
    isNativePluginEnabled.mockResolvedValue(false);
    const response = await tryNativeBokmooConnect(
      new Request(`${ADMIN_URL}/cards/import`, { method: 'POST' }),
      { DB: { prepare: vi.fn() } } as never,
    );
    expect(response?.status).toBe(404);
    await expect(response?.json()).resolves.toMatchObject({
      success: false,
      error: { code: 'PLUGIN_NOT_ENABLED' },
    });
  });

  it('requires administrator authentication for the import route', async () => {
    isNativePluginEnabled.mockResolvedValue(true);
    authenticateNativeAdmin.mockResolvedValue(null);
    const response = await tryNativeBokmooConnect(
      new Request(`${ADMIN_URL}/cards/import`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cards: [{ mid: '88888000000000000001' }] }),
      }),
      { DB: { prepare: vi.fn() } } as never,
    );
    expect(response?.status).toBe(401);
    await expect(response?.json()).resolves.toMatchObject({
      success: false,
      error: { code: 'UNAUTHORIZED' },
    });
  });

  it('rejects invalid import payloads', async () => {
    isNativePluginEnabled.mockResolvedValue(true);
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com' });
    const missing = await tryNativeBokmooConnect(
      new Request(`${ADMIN_URL}/cards/import`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
      { DB: { prepare: vi.fn() } } as never,
    );
    expect(missing?.status).toBe(400);
    await expect(missing?.json()).resolves.toMatchObject({
      success: false,
      error: { code: 'IMPORT_CARDS_REQUIRED' },
    });

    const tooLarge = await tryNativeBokmooConnect(
      new Request(`${ADMIN_URL}/cards/import`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cards: Array.from({ length: 1001 }, () => ({ mid: '88888000000000000001' })) }),
      }),
      { DB: { prepare: vi.fn() } } as never,
    );
    expect(tooLarge?.status).toBe(400);
    await expect(tooLarge?.json()).resolves.toMatchObject({
      success: false,
      error: { code: 'IMPORT_CARDS_TOO_LARGE' },
    });
  });

  it('imports new cards, records an audit run, and re-imports idempotently', async () => {
    isNativePluginEnabled.mockResolvedValue(true);
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com' });
    const insert = vi.fn()
      .mockReturnValueOnce(statement(null))
      .mockReturnValueOnce(statement(null))
      .mockReturnValueOnce(statement(null))
      .mockReturnValueOnce(statement(null))
      .mockReturnValueOnce(statement(null))
      .mockReturnValueOnce(statement(null));
    const first = await tryNativeBokmooConnect(
      new Request(`${ADMIN_URL}/cards/import`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer admin-token' },
        body: JSON.stringify({
          cards: [
            { mid: '88888 00000 00000 00001', sku: 'BOKMOO-BASIC-CARD', batch: 'B1' },
            { mid: '88888000000000000002', sku: 'BOKMOO-BASIC-CARD', batch: 'B1', eid: '8904903200000101', iccid: '8986006217180800001' },
          ],
        }),
      }),
      { DB: { prepare: insert } } as never,
    );
    expect(first?.status).toBe(201);
    const firstPayload = await first?.json() as any;
    expect(firstPayload.data.run).toMatchObject({ total: 2, imported: 2, updated: 0, conflicts: 0, operator: 'admin@example.com' });
    expect(firstPayload.data.items).toEqual([
      { mid: '88888000000000000001', result: 'imported' },
      { mid: '88888000000000000002', result: 'imported' },
    ]);
    expect(insert).toHaveBeenCalledTimes(6);
    expect(insert.mock.calls[0][0]).toContain('SELECT * FROM native_bokmoo_cards WHERE mid');
    expect(insert.mock.calls[1][0]).toContain('INSERT INTO native_bokmoo_cards');
    expect(insert.mock.calls[3][0]).toContain('SELECT mid FROM native_bokmoo_cards');
    expect(insert.mock.calls[4][0]).toContain('INSERT INTO native_bokmoo_cards');
    expect(insert.mock.calls[5][0]).toContain('INSERT INTO native_bokmoo_card_import_runs');

    const existing = { id: 'card-1', mid: '88888000000000000001', eid: null, iccid: null, sku: 'BOKMOO-BASIC-CARD', batch: 'B1', status: 'unbound', verification_status: 'pending', user_id: null, bound_at: null, verified_at: null, last_seen_at: null, created_at: '2026-09-04T00:00:00.000Z', updated_at: '2026-09-04T00:00:00.000Z' };
    const update = vi.fn()
      .mockReturnValueOnce(statement(existing))
      .mockReturnValueOnce(statement(null))
      .mockReturnValueOnce(statement(null));
    const second = await tryNativeBokmooConnect(
      new Request(`${ADMIN_URL}/cards/import`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer admin-token' },
        body: JSON.stringify({ cards: [{ mid: '88888000000000000001', sku: 'BOKMOO-BASIC-CARD', batch: 'B1' }] }),
      }),
      { DB: { prepare: update } } as never,
    );
    expect(second?.status).toBe(201);
    const secondPayload = await second?.json() as any;
    expect(secondPayload.data.run).toMatchObject({ total: 1, imported: 0, updated: 1, conflicts: 0 });
    expect(update.mock.calls[0][0]).toContain('SELECT * FROM native_bokmoo_cards WHERE mid');
    expect(update.mock.calls[1][0]).toContain('UPDATE native_bokmoo_cards');
    expect(update.mock.calls[2][0]).toContain('INSERT INTO native_bokmoo_card_import_runs');
  });

  it('never overwrites a bound card or an identifier registered to another card', async () => {
    isNativePluginEnabled.mockResolvedValue(true);
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com' });
    const bound = { id: 'card-bound', mid: '88888000000000000009', eid: null, iccid: null, sku: null, batch: null, status: 'bound', verification_status: 'verified', user_id: 'user-9', bound_at: '2026-09-04T00:00:00.000Z', verified_at: '2026-09-04T00:00:00.000Z', last_seen_at: null, created_at: '2026-09-04T00:00:00.000Z', updated_at: '2026-09-04T00:00:00.000Z' };
    const boundQuery = vi.fn().mockReturnValueOnce(statement(bound)).mockReturnValueOnce(statement(null));
    const boundResponse = await tryNativeBokmooConnect(
      new Request(`${ADMIN_URL}/cards/import`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer admin-token' },
        body: JSON.stringify({ cards: [{ mid: bound.mid, sku: 'BOKMOO-BASIC-CARD' }] }),
      }),
      { DB: { prepare: boundQuery } } as never,
    );
    const boundPayload = await boundResponse?.json() as any;
    expect(boundPayload.data.run).toMatchObject({ total: 1, imported: 0, updated: 0, conflicts: 1 });
    expect(boundPayload.data.items[0]).toEqual({ mid: bound.mid, result: 'conflict', reason: 'card_bound_to_user' });
    expect(boundQuery).toHaveBeenCalledTimes(2);
    expect(boundQuery.mock.calls[0][0]).toContain('SELECT * FROM native_bokmoo_cards WHERE mid');
    expect(boundQuery.mock.calls[1][0]).toContain('INSERT INTO native_bokmoo_card_import_runs');

    const conflictQuery = vi.fn()
      .mockReturnValueOnce(statement(null))
      .mockReturnValueOnce(statement({ mid: '88888000000000000002' }))
      .mockReturnValueOnce(statement(null));
    const conflictResponse = await tryNativeBokmooConnect(
      new Request(`${ADMIN_URL}/cards/import`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer admin-token' },
        body: JSON.stringify({ cards: [{ mid: '88888000000000000003', eid: '8904903200000101' }] }),
      }),
      { DB: { prepare: conflictQuery } } as never,
    );
    const conflictPayload = await conflictResponse?.json() as any;
    expect(conflictPayload.data.run).toMatchObject({ total: 1, imported: 0, updated: 0, conflicts: 1 });
    expect(conflictPayload.data.items[0]).toEqual({ mid: '88888000000000000003', result: 'conflict', reason: 'identifier_already_registered' });
    expect(conflictQuery).toHaveBeenCalledTimes(3);
    expect(conflictQuery.mock.calls[1][0]).toContain('SELECT mid FROM native_bokmoo_cards');
    expect(conflictQuery.mock.calls[2][0]).toContain('INSERT INTO native_bokmoo_card_import_runs');

    const invalidQuery = vi.fn().mockReturnValueOnce(statement(null));
    const invalidResponse = await tryNativeBokmooConnect(
      new Request(`${ADMIN_URL}/cards/import`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer admin-token' },
        body: JSON.stringify({ cards: [{ mid: 'SHORT' }] }),
      }),
      { DB: { prepare: invalidQuery } } as never,
    );
    const invalidPayload = await invalidResponse?.json() as any;
    expect(invalidPayload.data.items[0]).toEqual({ mid: 'SHORT', result: 'conflict', reason: 'invalid_mid' });
    expect(invalidQuery).toHaveBeenCalledTimes(1);
    expect(invalidQuery.mock.calls[0][0]).toContain('INSERT INTO native_bokmoo_card_import_runs');
  });

  it('lists inventory cards with hardware identifiers and status summary for admins', async () => {
    isNativePluginEnabled.mockResolvedValue(true);
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com' });
    const card = { id: 'card-1', mid: '88888000000000000001', eid: 'EID1', iccid: 'ICCID1', sku: 'BOKMOO-BASIC-CARD', batch: 'B1', status: 'unbound', verification_status: 'pending', user_id: null, bound_at: null, verified_at: null, last_seen_at: null, created_at: '2026-09-04T00:00:00.000Z', updated_at: '2026-09-04T00:00:00.000Z' };
    const query = vi.fn()
      .mockReturnValueOnce(statement(null, [card]))
      .mockReturnValueOnce(statement(null, [{ status: 'unbound', count: 1 }]));
    const response = await tryNativeBokmooConnect(
      new Request(`${ADMIN_URL}/cards?limit=50`, { headers: { authorization: 'Bearer admin-token' } }),
      { DB: { prepare: query } } as never,
    );
    expect(response?.status).toBe(200);
    const payload = await response?.json() as any;
    expect(payload.data.items[0]).toMatchObject({ mid: card.mid, sku: card.sku, batch: card.batch, eid: card.eid, iccid: card.iccid });
    expect(payload.data.summary).toEqual([{ status: 'unbound', count: 1 }]);
    expect(query.mock.calls[0][0]).toContain('SELECT * FROM native_bokmoo_cards ORDER BY created_at DESC LIMIT');
    expect(query.mock.calls[1][0]).toContain('GROUP BY status');

    authenticateNativeAdmin.mockResolvedValue(null);
    const unauthenticated = await tryNativeBokmooConnect(
      new Request(`${ADMIN_URL}/cards`),
      { DB: { prepare: vi.fn(() => statement(null)) } } as never,
    );
    expect(unauthenticated?.status).toBe(401);
  });

  it('lists recorded import runs for admins', async () => {
    isNativePluginEnabled.mockResolvedValue(true);
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com' });
    const run = { id: 'bokmoo_import_1', total: 2, imported: 2, updated: 0, conflicts: 0, operator: 'admin@example.com', created_at: '2026-09-04T00:00:00.000Z' };
    const query = vi.fn().mockReturnValueOnce(statement(null, [run]));
    const response = await tryNativeBokmooConnect(
      new Request(`${ADMIN_URL}/cards/imports`, { headers: { authorization: 'Bearer admin-token' } }),
      { DB: { prepare: query } } as never,
    );
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({
      data: { items: [{ id: run.id, total: 2, imported: 2 }], total: 1 },
    });
    expect(query.mock.calls[0][0]).toContain('SELECT * FROM native_bokmoo_card_import_runs');
  });
});
