import { afterEach, describe, expect, it, vi } from 'vitest';
import { signKuaidi100Webhook } from './shipping-providers';

const authenticateNativeAdmin = vi.fn();
const authenticateNativeUser = vi.fn();
const getNativePluginConfig = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeAdmin, authenticateNativeUser }));
vi.mock('./plugin-settings', () => ({ getNativePluginConfig }));

const { tryNativeShipping } = await import('./shipping');

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function shippingConfig(overrides: Record<string, unknown> = {}) {
  return { enabled: true, config: {
    mode: 'test', fourpxEnabled: true, fourpxAppKey: 'app', fourpxAppSecret: 'secret',
    kuaidi100Enabled: true, kuaidi100Key: 'key', kuaidi100Secret: 'secret', kuaidi100CallbackSalt: 'salt',
    ...overrides,
  } };
}

describe('Cloudflare-native shipping routes', () => {
  it('requires an admin JWT for carrier operations', async () => {
    authenticateNativeAdmin.mockResolvedValue(null);
    const response = await tryNativeShipping(new Request('https://api.example/api/v1/extensions/plugin/shipping/api/admin/providers/fourpx/orders/get', {
      method: 'POST', body: JSON.stringify({ input: { request_no: 'order-1' } }),
    }), { DB: {} } as never);
    expect(response?.status).toBe(401);
    expect(getNativePluginConfig).not.toHaveBeenCalled();
  });

  it('claims a 4PX create reference before the network request and replays its completed response', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin' });
    getNativePluginConfig.mockResolvedValue(shippingConfig());
    const carrierFetch = vi.fn(async () => Response.json({ result: '1', data: { request_no: 'FPX-1', '4px_tracking_no': 'TRACK-1' } }));
    vi.stubGlobal('fetch', carrierFetch);
    let row: { request_hash: string; state: string; response_json: string | null } | null = null;
    const db = {
      prepare: vi.fn((sql: string) => ({ bind: (...args: unknown[]) => ({
        first: async () => row,
        run: async () => {
          if (sql.includes('INSERT OR IGNORE INTO native_shipping_provider_orders')) {
            if (row) return { meta: { changes: 0 } };
            row = { request_hash: String(args[5]), state: 'PROCESSING', response_json: null };
            return { meta: { changes: 1 } };
          }
          if (sql.includes("state = 'COMPLETED'")) {
            row = { ...row!, state: 'COMPLETED', response_json: String(args[2]) };
          }
          return { meta: { changes: 1 } };
        },
      }) })),
    };
    const makeRequest = () => new Request('https://api.example/api/v1/extensions/plugin/shipping/api/admin/providers/fourpx/orders', {
      method: 'POST', body: JSON.stringify({ reference: 'order-1', input: { business_type: 'BDS' } }),
    });
    const first = await tryNativeShipping(makeRequest(), { DB: db } as never);
    const second = await tryNativeShipping(makeRequest(), { DB: db } as never);
    expect(first?.status).toBe(200);
    await expect(first?.json()).resolves.toMatchObject({ success: true, data: { replayed: false } });
    await expect(second?.json()).resolves.toMatchObject({ success: true, data: { replayed: true } });
    expect(carrierFetch).toHaveBeenCalledOnce();
  });

  it('never repeats a create whose previous outcome is unknown', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin' });
    getNativePluginConfig.mockResolvedValue(shippingConfig());
    const payload = { business_type: 'BDS', ref_no: 'order-1' };
    const { sha256Hex } = await import('./shipping-providers');
    const row = { request_hash: await sha256Hex(JSON.stringify(payload)), state: 'UNKNOWN', response_json: null };
    const db = { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ first: vi.fn(async () => row) })) })) };
    const response = await tryNativeShipping(new Request('https://api.example/api/v1/extensions/plugin/shipping/api/admin/providers/fourpx/orders', {
      method: 'POST', body: JSON.stringify({ reference: 'order-1', input: { business_type: 'BDS' } }),
    }), { DB: db } as never);
    expect(response?.status).toBe(409);
    await expect(response?.json()).resolves.toMatchObject({ error: { code: 'PROVIDER_REQUEST_PENDING' } });
  });

  it('locks a create when the carrier succeeds but the result cannot be persisted', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin' });
    getNativePluginConfig.mockResolvedValue(shippingConfig());
    const carrierFetch = vi.fn(async () => Response.json({ result: '1', data: { request_no: 'FPX-1' } }));
    vi.stubGlobal('fetch', carrierFetch);
    let state = 'PROCESSING';
    let claimed = false;
    let requestHash = '';
    const db = { prepare: vi.fn((sql: string) => ({ bind: (...args: unknown[]) => ({
      first: async () => claimed ? { request_hash: requestHash, state, response_json: null } : null,
      run: async () => {
        if (sql.includes('INSERT OR IGNORE')) { claimed = true; requestHash = String(args[5]); return { meta: { changes: 1 } }; }
        if (sql.includes("state = 'COMPLETED'")) throw new Error('D1 unavailable');
        if (sql.includes("state = 'UNKNOWN'")) state = 'UNKNOWN';
        return { meta: { changes: 1 } };
      },
    }) })) };
    const request = () => new Request('https://api.example/api/v1/extensions/plugin/shipping/api/admin/providers/fourpx/orders', {
      method: 'POST', body: JSON.stringify({ reference: 'order-1', input: { business_type: 'BDS' } }),
    });
    const first = await tryNativeShipping(request(), { DB: db } as never);
    expect(first?.status).toBe(503);
    await expect(first?.json()).resolves.toMatchObject({ error: { code: 'RESULT_PERSISTENCE_ERROR' } });
    expect(state).toBe('UNKNOWN');
    expect(carrierFetch).toHaveBeenCalledOnce();
    const retry = await tryNativeShipping(request(), { DB: db } as never);
    expect(retry?.status).toBe(409);
    expect(carrierFetch).toHaveBeenCalledOnce();
  });

  it('projects a matched Kuaidi100 callback into the shopper shipment timeline', async () => {
    getNativePluginConfig.mockResolvedValue(shippingConfig());
    const statements: string[] = [];
    const db = { prepare: vi.fn((sql: string) => ({ bind: (..._args: unknown[]) => ({
      first: async () => {
        if (sql.includes('native_shipping_provider_webhook_events')) return null;
        if (sql.includes('native_shipping_provider_orders')) return { order_id: 'ord-1' };
        if (sql.includes('native_shipments')) return null;
        if (sql.includes('native_shipment_events')) return null;
        return null;
      },
      run: async () => { statements.push(sql); return { meta: { changes: 1 } }; },
    }) })) };
    const rawParam = JSON.stringify({ status: 'shutdown', lastResult: {
      nu: 'TRACK-1', com: 'shunfeng', ischeck: '1',
      data: [{ time: '2026-08-14 10:00:00', context: 'Signed', status: 'DELIVERED' }],
    } });
    const response = await tryNativeShipping(new Request('https://api.example/api/v1/extensions/plugin/shipping/api/admin/webhooks/kuaidi100', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ param: rawParam, sign: signKuaidi100Webhook(rawParam, 'salt') }),
    }), { DB: db } as never);
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({ matched: true });
    expect(statements.some((sql) => sql.includes('INSERT INTO native_shipments'))).toBe(true);
    expect(statements.some((sql) => sql.includes('INSERT INTO native_shipment_events'))).toBe(true);
  });

  it('verifies the unmodified Kuaidi100 param and stores duplicate callbacks once', async () => {
    getNativePluginConfig.mockResolvedValue(shippingConfig());
    const run = vi.fn(async () => ({ meta: { changes: 1 } }));
    const first = vi.fn(async () => null);
    const db = { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run, first })) })) };
    const rawParam = '{"status":"polling","lastResult":{"nu":"12345678"}}';
    const callback = (param: string, signature: string) => new Request('https://api.example/api/v1/extensions/plugin/shipping/api/admin/webhooks/kuaidi100', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ param, sign: signature }),
    });
    const signature = signKuaidi100Webhook(rawParam, 'salt');
    const accepted = await tryNativeShipping(callback(rawParam, signature), { DB: db } as never);
    expect(accepted?.status).toBe(200);
    expect(run).toHaveBeenCalledOnce();
    const rejected = await tryNativeShipping(callback(`${rawParam} `, signature), { DB: db } as never);
    expect(rejected?.status).toBe(401);
    expect(run).toHaveBeenCalledOnce();
  });
});
