import { describe, expect, it, vi } from 'vitest';

const authenticateNativeAdmin = vi.fn();
const getNativePluginConfig = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeAdmin }));
vi.mock('./plugin-settings', () => ({ getNativePluginConfig, getNativeStripeSecret: vi.fn() }));
vi.mock('./odoo', () => ({ testNativeOdooConnection: vi.fn() }));
vi.mock('./smtp', () => ({ sendSmtpEmail: vi.fn() }));
vi.mock('./site-name', () => ({ nativeSiteName: vi.fn() }));

const { tryNativeIntegrationAdmin } = await import('./integration-admin');

describe('native Shipping integration test', () => {
  it('reports configured providers without exposing credentials', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin' });
    getNativePluginConfig.mockResolvedValue({ enabled: true, config: {
      kuaidi100Enabled: true, kuaidi100Key: 'key', kuaidi100Secret: 'secret',
      fourpxEnabled: true, fourpxAppKey: 'app', fourpxAppSecret: 'secret',
    } });
    const response = await tryNativeIntegrationAdmin(new Request('https://api.example/api/v1/extensions/plugin/shipping/api/admin/test', { method: 'POST' }), {} as never);
    expect(response?.status).toBe(200);
    const body = await response?.json() as Record<string, unknown>;
    expect(body).toMatchObject({ success: true, data: { ok: true, providers: { kuaidi100: { enabled: true }, fourpx: { enabled: true } } } });
    expect(JSON.stringify(body)).not.toContain('secret');
    expect(JSON.stringify(body)).not.toContain('key');
  });

  it('fails when no provider is enabled', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin' });
    getNativePluginConfig.mockResolvedValue({ enabled: true, config: {} });
    const response = await tryNativeIntegrationAdmin(new Request('https://api.example/api/v1/extensions/plugin/shipping/api/admin/test', { method: 'POST' }), {} as never);
    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toMatchObject({ success: false, error: { code: 'CONNECTION_TEST_FAILED' } });
  });
});
