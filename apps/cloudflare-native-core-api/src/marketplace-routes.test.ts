import { afterEach, describe, expect, it, vi } from 'vitest';

const authenticateNativeAdmin = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeAdmin }));

const { tryNativeMarketplace } = await import('./marketplace');

afterEach(() => vi.unstubAllGlobals());

describe('native marketplace install routes', () => {
  it('installs and enables a supported official plugin', async () => {
    authenticateNativeAdmin.mockResolvedValue(true);
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: { items: [{
      slug: 'wallet', kind: 'plugin', installable: true, sellableVersion: '0.2.0',
    }] } })));
    const run = vi.fn(async () => ({ success: true, meta: { changes: 1 } }));
    const db = { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run })) })) };
    const response = await tryNativeMarketplace(new Request('https://api.example/api/v1/admin/market/extensions/wallet/install', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'plugin', version: '0.2.0' }),
    }), { DB: db } as never);
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({ success: true, data: { slug: 'wallet', version: '0.2.0' } });
    expect(run).toHaveBeenCalledOnce();
  });

  it('fails closed for plugins without a Native runtime adapter', async () => {
    authenticateNativeAdmin.mockResolvedValue(true);
    const response = await tryNativeMarketplace(new Request('https://api.example/api/v1/admin/market/extensions/unknown/install', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'plugin' }),
    }), { DB: {} } as never);
    expect(response?.status).toBe(501);
    await expect(response?.json()).resolves.toMatchObject({ success: false, error: { code: 'NATIVE_PLUGIN_NOT_IMPLEMENTED' } });
  });
});
