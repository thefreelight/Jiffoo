import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authenticateNativeAdmin = vi.fn();
const authenticateNativeUser = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeAdmin, authenticateNativeUser }));

const getNativePluginConfig = vi.fn();
const createPickup = vi.fn();
vi.mock('./plugin-settings', () => ({ getNativePluginConfig }));
vi.mock('./shipping-providers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./shipping-providers')>();
  return {
    ...actual,
    Kuaidi100NativeProvider: class {
      createPickup = createPickup;
    },
  };
});

const { tryNativeCrosspilotBridge } = await import('./crosspilot-bridge');

function statement(first: unknown = null, all: unknown[] = []) {
  const bound = {
    first: vi.fn(async () => first),
    all: vi.fn(async () => ({ results: all })),
    run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
  };
  return { ...bound, bind: vi.fn(() => bound) };
}

interface DbStub { DB: { prepare: ReturnType<typeof vi.fn> } }

function db(): DbStub {
  return { DB: { prepare: vi.fn(() => statement()) } } as unknown as DbStub;
}

const ADMIN = { id: 'admin-1', role: 'SUPER_ADMIN', email: 'admin@jiffoo.com' };
const USER = { id: 'user-1', email: 'owner@jiffoo.com' };

function adminRequest(method: string, path: string, body?: unknown): Request {
  return new Request(`https://api.example${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  authenticateNativeAdmin.mockResolvedValue(ADMIN);
  authenticateNativeUser.mockResolvedValue(USER);
  getNativePluginConfig.mockResolvedValue({
    enabled: true,
    config: { kuaidi100Enabled: true, kuaidi100Key: 'k-test', kuaidi100Secret: 's-test', kuaidi100Customer: 'c-test', mode: 'test' },
  });
});
afterEach(() => vi.clearAllMocks());

describe('native CrossPilot bridge', () => {
  it('ignores unrelated paths (returns null for the chain)', async () => {
    const result = await tryNativeCrosspilotBridge(new Request('https://api.example/api/v1/auth/me'), db());
    expect(result).toBeNull();
  });

  it('requires admin auth for ingest', async () => {
    authenticateNativeAdmin.mockResolvedValue(null);
    const response = await tryNativeCrosspilotBridge(
      adminRequest('POST', '/api/v1/plugins/crosspilot/admin/orders', { storeId: 'tb-1', orders: [] }),
      db(),
    );
    expect(response?.status).toBe(401);
  });

  it('upserts an ingest batch and reports inserted count', async () => {
    const store = db();
    const response = await tryNativeCrosspilotBridge(
      adminRequest('POST', '/api/v1/plugins/crosspilot/admin/orders', {
        storeId: 'tb-1',
        orders: [{ platformOrderId: 'TB100', status: 'paid', amount: 59.9, importedAt: '2026-11-16T08:00:00Z' }],
      }),
      store,
    );
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({ success: true, data: { storeId: 'tb-1', received: 1, inserted: 1 } });
    expect(store.DB.prepare.mock.calls[0][0]).toContain('INSERT INTO crosspilot_orders');
  });

  it('rejects an empty ingest batch', async () => {
    const response = await tryNativeCrosspilotBridge(
      adminRequest('POST', '/api/v1/plugins/crosspilot/admin/orders', { storeId: 'tb-1', orders: [] }),
      db(),
    );
    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR' } });
  });

  it('records a shipment only for a synced order', async () => {
    const store = db();
    // First call resolves the order row, second inserts the shipment.
    store.DB.prepare.mockReturnValueOnce(statement({ id: 'cpo_tb-1_TB100' }));
    store.DB.prepare.mockReturnValueOnce(statement());
    const response = await tryNativeCrosspilotBridge(
      adminRequest('POST', '/api/v1/plugins/crosspilot/admin/shipments', {
        storeId: 'tb-1',
        platformOrderId: 'TB100',
        kind: 'pickup',
        state: 'SUBMITTED',
        kuaidiCom: 'yuantong',
        receiverName: '张三',
        receiverPhone: '13800000000',
        receiverAddress: '广东省深圳市南山区xx路1号',
      }),
      store,
    );
    expect(response?.status).toBe(201);
    await expect(response?.json()).resolves.toMatchObject({ success: true, data: { state: 'SUBMITTED' } });
  });

  it('404s a shipment for an unknown order', async () => {
    const store = db();
    store.DB.prepare.mockReturnValueOnce(statement(null));
    const response = await tryNativeCrosspilotBridge(
      adminRequest('POST', '/api/v1/plugins/crosspilot/admin/shipments', { storeId: 'tb-1', platformOrderId: 'MISSING', kind: 'pickup', state: 'SUBMITTED' }),
      store,
    );
    expect(response?.status).toBe(404);
  });

  it('rejects unknown shipment states', async () => {
    const store = db();
    store.DB.prepare.mockReturnValueOnce(statement({ id: 'cpo_tb-1_TB100' }));
    const response = await tryNativeCrosspilotBridge(
      adminRequest('POST', '/api/v1/plugins/crosspilot/admin/shipments', { orderId: 'cpo_tb-1_TB100', kind: 'pickup', state: 'WAT' }),
      store,
    );
    expect(response?.status).toBe(400);
  });

  it('requires a signed-in shop user for store routes', async () => {
    authenticateNativeUser.mockResolvedValue(null);
    const response = await tryNativeCrosspilotBridge(adminRequest('GET', '/api/v1/plugins/crosspilot/store/summary'), db());
    expect(response?.status).toBe(401);
  });

  it('returns the console summary', async () => {
    const store = db();
    store.DB.prepare.mockReturnValueOnce(statement({ orders: 3, awaiting_shipment: 2, shipments: 1, waybills_issued: 1, last_import_at: '2026-11-16T08:00:00Z' }));
    const response = await tryNativeCrosspilotBridge(adminRequest('GET', '/api/v1/plugins/crosspilot/store/summary'), store);
    await expect(response?.json()).resolves.toMatchObject({
      success: true,
      data: { orders: 3, awaitingShipment: 2, shipments: 1, waybillsIssued: 1, backendConnected: true },
    });
  });

  it('lists console orders with their shipments', async () => {
    const store = db();
    const order = { id: 'cpo_tb-1_TB100', store_id: 'tb-1', platform: 'taobao', platform_order_id: 'TB100', status: 'paid', amount: 59.9, receiver_name: null, receiver_phone: null, receiver_address: null, cargo: null, imported_at: '2026-11-16T08:00:00Z', updated_at: '2026-11-16T08:00:00Z' };
    const shipment = { id: 'cps_1', order_row_id: 'cpo_tb-1_TB100', kind: 'pickup', kuaidi_com: 'yuantong', tracking_no: 'YT123', task_id: null, state: 'SUBMITTED', result_json: null, created_at: '2026-11-16T09:00:00Z', updated_at: '2026-11-16T09:00:00Z' };
    store.DB.prepare.mockReturnValueOnce(statement(null, [order]));
    store.DB.prepare.mockReturnValueOnce(statement(null, [shipment]));
    store.DB.prepare.mockReturnValueOnce(statement({ total: 1 }));
    const response = await tryNativeCrosspilotBridge(adminRequest('GET', '/api/v1/plugins/crosspilot/store/orders'), store);
    const payload = await response?.json();
    expect(payload?.data?.items?.[0]?.shipments?.[0]?.trackingNo).toBe('YT123');
    expect(payload?.data?.total).toBe(1);
  });

  it('validates sender settings on PUT', async () => {
    const response = await tryNativeCrosspilotBridge(
      adminRequest('PUT', '/api/v1/plugins/crosspilot/store/settings', { name: '老板', mobile: '', printAddr: '深圳' }),
      db(),
    );
    expect(response?.status).toBe(400);
  });

  describe('pickup orders', () => {
    const pickupBody = {
      storeId: 'tb-1',
      platformOrderId: 'TB100',
      kuaidiCom: 'yuantong',
      receiver: { name: '张三', mobile: '13800000000', printAddr: '广东省深圳市南山区xx路1号' },
      cargo: '蓝牙耳机',
    };

    it('404s when the order was never synced', async () => {
      const store = db();
      store.DB.prepare.mockReturnValueOnce(statement(null));
      const response = await tryNativeCrosspilotBridge(adminRequest('POST', '/api/v1/plugins/crosspilot/admin/shipments/pickup', pickupBody), store);
      expect(response?.status).toBe(404);
    });

    it('rejects a request without receiver contact', async () => {
      const store = db();
      store.DB.prepare.mockReturnValueOnce(statement({ id: 'cpo_tb-1_TB100' }));
      const response = await tryNativeCrosspilotBridge(
        adminRequest('POST', '/api/v1/plugins/crosspilot/admin/shipments/pickup', { ...pickupBody, receiver: { name: '张三' } }),
        store,
      );
      expect(response?.status).toBe(400);
    });

    it('records WAYBILL_ISSUED with the extracted waybill code', async () => {
      const store = db();
      store.DB.prepare.mockReturnValueOnce(statement({ id: 'cpo_tb-1_TB100' })); // order row
      store.DB.prepare.mockReturnValueOnce(statement({ name: '老板', mobile: '13900000000', print_addr: '深圳', updated_at: '2026-11-16T07:00:00Z' })); // sender defaults
      createPickup.mockResolvedValue({ result: true, data: { waybillCode: 'YT999', taskId: 'task-1' } });
      const response = await tryNativeCrosspilotBridge(adminRequest('POST', '/api/v1/plugins/crosspilot/admin/shipments/pickup', pickupBody), store);
      expect(response?.status).toBe(201);
      const payload = await response?.json();
      expect(payload?.data?.state).toBe('WAYBILL_ISSUED');
      expect(payload?.data?.waybill).toBe('YT999');
      expect(createPickup).toHaveBeenCalledWith(expect.objectContaining({
        kuaidicom: 'yuantong',
        recManName: '张三',
        sendManName: '老板',
        thirdOrderId: 'cp-cpo_tb-1_TB100',
      }));
    });

    it('maps provider failures to a 502 and records a FAILED shipment', async () => {
      const { ShippingProviderError } = await import('./shipping-providers');
      const store = db();
      store.DB.prepare.mockReturnValueOnce(statement({ id: 'cpo_tb-1_TB100' }));
      store.DB.prepare.mockReturnValueOnce(statement({ name: '老板', mobile: '13900000000', print_addr: '深圳', updated_at: null }));
      createPickup.mockRejectedValue(new ShippingProviderError('Kuaidi100 rejected the order', 'PROVIDER_REJECTED', false, true));
      const response = await tryNativeCrosspilotBridge(adminRequest('POST', '/api/v1/plugins/crosspilot/admin/shipments/pickup', pickupBody), store);
      expect(response?.status).toBe(502);
      // FAILED shipment was recorded (second prepare is the insert after defaults read).
      const insertCall = store.DB.prepare.mock.calls[2]?.[0] as string;
      expect(insertCall).toContain("state, result_json");
      expect(insertCall).toContain("'FAILED'");
    });

    it('fails fast when the shipping plugin has no Kuaidi100 secret', async () => {
      getNativePluginConfig.mockResolvedValue({ enabled: true, config: { kuaidi100Enabled: false } });
      const store = db();
      store.DB.prepare.mockReturnValueOnce(statement({ id: 'cpo_tb-1_TB100' }));
      store.DB.prepare.mockReturnValueOnce(statement({ name: null, mobile: null, print_addr: null, updated_at: null }));
      const response = await tryNativeCrosspilotBridge(adminRequest('POST', '/api/v1/plugins/crosspilot/admin/shipments/pickup', pickupBody), store);
      expect(response?.status).toBe(502);
      await expect(response?.json()).resolves.toMatchObject({ success: false, error: { code: 'PROVIDER_NOT_CONFIGURED' } });
    });
  });
});
