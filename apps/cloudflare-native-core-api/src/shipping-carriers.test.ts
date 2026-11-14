import { describe, expect, it, vi } from 'vitest';

const authenticateNativeAdmin = vi.fn();
const authenticateNativeUser = vi.fn();
const getNativePluginConfig = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeAdmin, authenticateNativeUser }));
vi.mock('./plugin-settings', () => ({ getNativePluginConfig, getNativeStripeSecret: vi.fn() }));

const { tryNativeShipping } = await import('./shipping');
const { detectCarriers, matchCarrierByName, trackingUrlFor, SHIPPING_CARRIERS } = await import('./shipping-carriers');

function shipFormRequest(): Request {
  return new Request('https://api.example/api/v1/extensions/plugin/shipping/api/admin/ship-form', { method: 'GET' });
}

function detectRequest(trackingNumber: string): Request {
  return new Request('https://api.example/api/v1/extensions/plugin/shipping/api/admin/carriers/detect', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ trackingNumber }),
  });
}

describe('native shipping carrier catalog', () => {
  it('detects carriers from tracking numbers', () => {
    expect(detectCarriers('1Z12345E6205276888')[0]).toMatchObject({ code: 'ups', confidence: 'high' });
    expect(detectCarriers('SF1382947302948')[0]).toMatchObject({ code: 'sf', confidence: 'high' });
    expect(detectCarriers('EE382947503CN')[0]).toMatchObject({ code: 'ems', confidence: 'high' });
    expect(detectCarriers('9400111899223344556677')[0]).toMatchObject({ code: 'usps', confidence: 'high' });
    expect(detectCarriers('ZZZZ99999999')).toEqual([]);
  });

  it('resolves typed carrier text to structured codes', () => {
    expect(matchCarrierByName('顺丰')?.code).toBe('sf');
    expect(matchCarrierByName('fedex')?.code).toBe('fedex');
    expect(matchCarrierByName('FedEx')?.code).toBe('fedex');
    expect(matchCarrierByName('Custom Van Line')).toBeNull();
  });

  it('keeps the catalog self-consistent', () => {
    for (const carrier of SHIPPING_CARRIERS) {
      expect(carrier.patterns?.every((pattern) => pattern.source.startsWith('^') && pattern.source.endsWith('$')) ?? true).toBe(true);
    }
    expect(trackingUrlFor('dhl', '8259483016')).toBe('https://www.dhl.com/track?tracking-id=8259483016');
    expect(trackingUrlFor('zto', '75123456789012')).toBeNull();
  });
});

describe('native shipping ship-form routes', () => {
  it('serves the enabled carrier catalog to the admin ship dialog', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin' });
    getNativePluginConfig.mockResolvedValue({ enabled: true, config: {} });
    const response = await tryNativeShipping(shipFormRequest(), { DB: {} } as never);
    expect(response?.status).toBe(200);
    const body = await response?.json() as { success: boolean; data: { available: boolean; carriers: Array<{ code: string }>; defaultCarrierCode: string | null } };
    expect(body.success).toBe(true);
    expect(body.data.available).toBe(true);
    expect(body.data.carriers.length).toBeGreaterThan(5);
    expect(body.data.carriers.some((carrier) => carrier.code === 'sf')).toBe(true);
    expect(body.data.defaultCarrierCode).toBe('sf');
  });

  it('auto-detects the carrier for a tracking number', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin' });
    getNativePluginConfig.mockResolvedValue({ enabled: true, config: {} });
    const response = await tryNativeShipping(detectRequest('1Z12345E6205276888'), { DB: {} } as never);
    expect(response?.status).toBe(200);
    const body = await response?.json() as { success: boolean; data: { candidates: Array<{ code: string; confidence: string }> } };
    expect(body.data.candidates[0]).toMatchObject({ code: 'ups', confidence: 'high' });
  });

  it('requires administrator authentication', async () => {
    authenticateNativeAdmin.mockResolvedValue(null);
    const response = await tryNativeShipping(shipFormRequest(), { DB: {} } as never);
    expect(response?.status).toBe(401);
  });

  it('reports the plugin-disabled state so the admin falls back to free text', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin' });
    getNativePluginConfig.mockResolvedValue({ enabled: false, config: {} });
    const response = await tryNativeShipping(shipFormRequest(), { DB: {} } as never);
    expect(response?.status).toBe(404);
    const body = await response?.json() as { success: boolean; error: { code: string } };
    expect(body.error.code).toBe('PLUGIN_DISABLED');
  });

  it('rejects detection without a tracking number', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin' });
    getNativePluginConfig.mockResolvedValue({ enabled: true, config: {} });
    const response = await tryNativeShipping(detectRequest(''), { DB: {} } as never);
    expect(response?.status).toBe(400);
  });
});
