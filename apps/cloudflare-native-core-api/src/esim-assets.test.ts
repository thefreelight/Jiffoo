import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authenticateNativeUser } = vi.hoisted(() => ({ authenticateNativeUser: vi.fn() }));
const { fetchBossEsimAssets, fetchBossSimInstallCode } = vi.hoisted(() => ({
  fetchBossEsimAssets: vi.fn(),
  fetchBossSimInstallCode: vi.fn(),
}));

vi.mock('./auth', () => ({ authenticateNativeUser }));
vi.mock('./boss-upstream', () => ({ fetchBossEsimAssets, fetchBossSimInstallCode }));

const { matchInstallCredentials, normalizeInstallCredentials, tryNativeEsimInstallSession } = await import('./esim-assets');

const ICCID = '76010150';
const MATCHING_ID = 'K2-2IAZJC-TQV3XF';
const LPA = `LPA:1$smdp.io$${MATCHING_ID}`;
const PACKAGE = '中国大陆流量包 1GB/7天';

type SqlCall = { sql: string; values: unknown[] };

function orderPayload(options: { paid?: boolean; pinnedIccid?: string } = {}): string {
  return JSON.stringify({
    id: 'ord_reuse',
    userId: 'user-1',
    status: 'DELIVERED',
    paymentStatus: options.paid === false ? 'PENDING' : 'PAID',
    items: [{
      id: 'item-1',
      productId: 'boss-CN-1GB-7D',
      productName: PACKAGE,
      productKind: 'digital',
      fulfillmentData: options.pinnedIccid ? { esimIccid: options.pinnedIccid } : null,
    }],
  });
}

/** This order's BOSS line. `issued` carries the fresh-profile fields. */
function linePayload(issued: boolean): string {
  return JSON.stringify({
    bossOrder: {
      orderNo: 'QW-B',
      status: 'INVOICED',
      upstreamStatus: 'DONE',
      iccid: ICCID,
      ...(issued ? { activationCode: LPA, smdpAddress: 'smdp.io', matchingId: MATCHING_ID } : {}),
    },
    lastStatusRecord: { orderNo: 'QW-B', status: 'INVOICED', upstreamStatus: 'DONE', iccid: null },
  });
}

/** Another order of the same buyer that first issued the profile. */
function issuedRow(orderId: string): { order_id: string; payload_json: string } {
  return {
    order_id: orderId,
    payload_json: JSON.stringify({
      bossOrder: { orderNo: 'QW-A', upstreamStatus: 'DONE', iccid: ICCID, activationCode: LPA, smdpAddress: 'smdp.io', matchingId: MATCHING_ID },
    }),
  };
}

function makeEnv(options: {
  order?: string;
  line?: { line_item_id: string; status: string; error: string | null; payload_json: string } | null;
  earlier?: Array<{ order_id: string; payload_json: string }>;
  inventoryLookup?: boolean;
} = {}) {
  const selects: SqlCall[] = [];
  const updates: SqlCall[] = [];
  const env = {
    JWT_SECRET: 'test-secret',
    BOSS_API_KEY: 'test-key',
    ...(options.inventoryLookup ? { BOSS_SIM_INSTALL_CODE_LOOKUP: '1' } : {}),
    DB: {
      prepare: (sql: string) => ({
        bind: (...values: unknown[]) => ({
          first: async () => {
            selects.push({ sql, values });
            if (sql.includes('FROM native_order_snapshots')) {
              return { payload: options.order ?? orderPayload({ pinnedIccid: ICCID }) };
            }
            return null;
          },
          all: async () => {
            selects.push({ sql, values });
            if (sql.includes('json_extract(payload_json')) {
              return { results: options.earlier ?? [] };
            }
            return { results: options.line === null ? [] : [options.line ?? { line_item_id: 'item-1', status: 'completed', error: null, payload_json: linePayload(false) }] };
          },
          run: async () => {
            updates.push({ sql, values });
            return { success: true, meta: { changes: 1 } };
          },
        }),
      }),
    },
  };
  return { env, selects, updates };
}

function call(env: ReturnType<typeof makeEnv>['env'], orderId = 'ord_reuse'): Promise<Response> {
  return tryNativeEsimInstallSession(new Request(`https://shop.example/api/v1/orders/${orderId}/install-session`), env);
}

async function session(env: ReturnType<typeof makeEnv>['env']): Promise<Record<string, unknown>> {
  const response = await call(env);
  expect(response.status).toBe(200);
  return (await response.json() as Promise<{ data: Record<string, unknown> }>).data;
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticateNativeUser.mockResolvedValue({ id: 'user-1', email: 'buyer@example.com' });
  fetchBossEsimAssets.mockResolvedValue([]);
  fetchBossSimInstallCode.mockResolvedValue(null);
});

describe('normalizeInstallCredentials', () => {
  it('splits a full-LPA activationCode and keeps the LPA string intact', () => {
    const credentials = normalizeInstallCredentials({ activationCode: LPA, smdpAddress: 'smdp.io', matchingId: MATCHING_ID });
    expect(credentials).toMatchObject({
      lpaString: LPA,
      smdpAddress: 'smdp.io',
      matchingId: MATCHING_ID,
      activationCode: MATCHING_ID,
    });
  });

  it('reads an inventory row that carries only the LPA string', () => {
    const credentials = normalizeInstallCredentials({ iccid: ICCID, activationCode: LPA });
    expect(credentials.lpaString).toBe(LPA);
    expect(credentials.smdpAddress).toBe('smdp.io');
    expect(credentials.matchingId).toBe(MATCHING_ID);
  });

  it('never double-prefixes a full LPA when only the SM-DP+ address is split out', () => {
    const credentials = normalizeInstallCredentials({ activationCode: LPA, smdpAddress: 'smdp.io' });
    expect(credentials.lpaString).toBe(LPA);
  });

  it('builds the LPA string from split fields', () => {
    expect(normalizeInstallCredentials({ smdpAddress: 'smdp.io', matchingId: MATCHING_ID }).lpaString).toBe(LPA);
    expect(normalizeInstallCredentials({ smdpAddress: 'smdp.io', activationCode: MATCHING_ID }).lpaString).toBe(LPA);
  });

  it('captures a confirmation code appended to the LPA string', () => {
    const credentials = normalizeInstallCredentials({ activationCode: `${LPA}$4242` });
    expect(credentials.lpaString).toBe(`${LPA}$4242`);
    expect(credentials.confirmationCode).toBe('4242');
  });

  it('keeps a QR image URL and falls back to the LPA string otherwise', () => {
    expect(normalizeInstallCredentials({ qrCodeUrl: 'https://cdn.example/qr.png', activationCode: LPA }).qrCode)
      .toBe('https://cdn.example/qr.png');
    expect(normalizeInstallCredentials({ activationCode: LPA }).qrCode).toBe(LPA);
  });

  it('yields no LPA string when there is not enough to install', () => {
    expect(normalizeInstallCredentials({ iccid: ICCID, smdpAddress: 'smdp.io' }).lpaString).toBe('');
    expect(normalizeInstallCredentials({}).lpaString).toBe('');
    expect(matchInstallCredentials({ iccid: ICCID }, 'order')).toBeNull();
  });
});

describe('tryNativeEsimInstallSession first-install code', () => {
  it('takes the code from the order record when BOSS issued a fresh profile', async () => {
    const { env, selects } = makeEnv({
      order: orderPayload(),
      line: { line_item_id: 'item-1', status: 'completed', error: null, payload_json: linePayload(true) },
    });
    const data = await session(env);
    expect(data).toMatchObject({ status: 'ready', lpaString: LPA, installCodeSource: 'order', iccid: ICCID });
    expect(selects.some((query) => query.sql.includes('json_extract(payload_json'))).toBe(false);
    expect(fetchBossEsimAssets).not.toHaveBeenCalled();
  });

  it('falls back to an earlier order of the same buyer for a top-up', async () => {
    const { env, selects, updates } = makeEnv({ earlier: [issuedRow('ord_first')] });
    const data = await session(env);
    expect(data).toMatchObject({
      status: 'installed',
      lpaString: LPA,
      installCodeSource: 'earlier_order',
      installCodeOrderId: 'ord_first',
      activationCode: MATCHING_ID,
      smdpAddress: 'smdp.io',
    });
    // The lookup is scoped to the authenticated buyer and this order's ICCID.
    const lookup = selects.find((query) => query.sql.includes('json_extract(payload_json'));
    expect(lookup?.values).toEqual(['user-1', 'ord_reuse', ICCID]);
    expect(lookup?.sql).toContain('user_id = ?1');
    // Resolved codes are cached on the line via an in-place json_set.
    expect(updates).toHaveLength(1);
    expect(updates[0].sql).toContain('json_set(');
    expect(updates[0].values.slice(1)).toEqual(['ord_reuse', 'item-1']);
    expect(JSON.parse(String(updates[0].values[0]))).toMatchObject({ iccid: ICCID, lpaString: LPA, source: 'earlier_order' });
  });

  it('uses the copy cached on the line without looking further', async () => {
    const cached = { line_item_id: 'item-1', status: 'completed', error: null, payload_json: JSON.stringify({
      bossOrder: { orderNo: 'QW-B', upstreamStatus: 'DONE', iccid: ICCID },
      installCredentials: { iccid: ICCID, lpaString: LPA, source: 'inventory' },
    }) };
    const { env, selects, updates } = makeEnv({ line: cached, earlier: [issuedRow('ord_first')] });
    const data = await session(env);
    expect(data).toMatchObject({ status: 'installed', lpaString: LPA, installCodeSource: 'line' });
    expect(selects.some((query) => query.sql.includes('json_extract(payload_json'))).toBe(false);
    expect(updates).toHaveLength(0);
  });

  it('leaves the code empty when no order of this buyer issued the profile', async () => {
    const { env, updates } = makeEnv({ earlier: [] });
    const data = await session(env);
    expect(data).toMatchObject({ status: 'installed', iccid: ICCID, lpaString: null });
    expect(data).not.toHaveProperty('installCodeSource');
    expect(updates).toHaveLength(0);
  });

  it('does not ask BOSS for the code unless the inventory lookup is switched on', async () => {
    const { env } = makeEnv({ earlier: [] });
    await session(env);
    expect(fetchBossEsimAssets).not.toHaveBeenCalled();
    expect(fetchBossSimInstallCode).not.toHaveBeenCalled();
  });

  it('asks BOSS only after it confirms the buyer holds the SIM', async () => {
    fetchBossEsimAssets.mockResolvedValue([{ iccid: '8986000000000000000' }]);
    const { env } = makeEnv({ earlier: [], inventoryLookup: true });
    const data = await session(env);
    expect(data.lpaString).toBeNull();
    expect(fetchBossSimInstallCode).not.toHaveBeenCalled();

    vi.clearAllMocks();
    authenticateNativeUser.mockResolvedValue({ id: 'user-1', email: 'buyer@example.com' });
    fetchBossEsimAssets.mockResolvedValue([{ iccid: ICCID }]);
    fetchBossSimInstallCode.mockResolvedValue({ iccid: ICCID, activationCode: LPA });
    const owned = makeEnv({ earlier: [], inventoryLookup: true });
    const resolved = await session(owned.env);
    expect(fetchBossSimInstallCode).toHaveBeenCalledWith(owned.env, ICCID, 'user-1');
    expect(resolved).toMatchObject({ lpaString: LPA, installCodeSource: 'inventory' });
    expect(owned.updates).toHaveLength(1);
  });

  it('resolves nothing before the order is provisioned', async () => {
    const unpaid = makeEnv({ order: orderPayload({ paid: false, pinnedIccid: ICCID }), earlier: [issuedRow('ord_first')] });
    const data = await session(unpaid.env);
    expect(data).toMatchObject({ status: 'pending_payment', lpaString: null });
    expect(unpaid.selects.some((query) => query.sql.includes('json_extract(payload_json'))).toBe(false);

    const failed = makeEnv({
      line: { line_item_id: 'item-1', status: 'failed', error: 'BOSS upstream FAILED', payload_json: linePayload(false) },
      earlier: [issuedRow('ord_first')],
    });
    const failedData = await session(failed.env);
    expect(failedData).toMatchObject({ status: 'failed', lpaString: null, error: 'BOSS upstream FAILED' });
  });

  it('stays owner-only and hides non-eSIM orders', async () => {
    authenticateNativeUser.mockResolvedValue(null);
    const anonymous = makeEnv();
    expect((await call(anonymous.env)).status).toBe(401);

    vi.clearAllMocks();
    authenticateNativeUser.mockResolvedValue({ id: 'user-1', email: 'buyer@example.com' });
    const physical = makeEnv({ order: JSON.stringify({ id: 'ord_card', items: [{ id: 'i', productId: 'odoo-product-6', productKind: 'goods' }] }) });
    expect((await call(physical.env, 'ord_card')).status).toBe(404);
  });
});
