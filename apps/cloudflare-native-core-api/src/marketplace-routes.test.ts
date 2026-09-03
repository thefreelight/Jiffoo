import { afterEach, describe, expect, it, vi } from 'vitest';

const authenticateNativeAdmin = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeAdmin }));

const { tryNativeMarketplace } = await import('./marketplace');
const { tryNativeAffiliate } = await import('./affiliate');

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

  it('uses the Platform service binding when available', async () => {
    authenticateNativeAdmin.mockResolvedValue(true);
    const platformFetch = vi.fn(async () => Response.json({ data: { items: [{ slug: 'affiliate', kind: 'plugin', installable: true, sellableVersion: '0.1.6' }] } }));
    const globalFetch = vi.fn(async () => Response.json({ data: { items: [] } }));
    vi.stubGlobal('fetch', globalFetch);
    const db = { prepare: vi.fn(() => ({ all: vi.fn(async () => ({ results: [] })) })) };
    const response = await tryNativeMarketplace(new Request('https://api.example/api/v1/admin/market/official-catalog'), { DB: db, PLATFORM_API: { fetch: platformFetch } } as never);
    expect(response?.status).toBe(200);
    expect(platformFetch).toHaveBeenCalledOnce();
    expect(globalFetch).not.toHaveBeenCalled();
  });

  it('installs the baseline affiliate and coupon adapters', async () => {
    authenticateNativeAdmin.mockResolvedValue(true);
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: { items: [{ slug: 'coupon', kind: 'plugin', installable: true, sellableVersion: '0.1.4' }] } })));
    const run = vi.fn(async () => ({ success: true, meta: { changes: 1 } }));
    const db = { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run })) })) };
    const response = await tryNativeMarketplace(new Request('https://api.example/api/v1/admin/market/extensions/coupon/install', { method: 'POST', body: JSON.stringify({ kind: 'plugin' }) }), { DB: db } as never);
    expect(response?.status).toBe(200);
    expect(run).toHaveBeenCalledOnce();
  });

  it('allows the published Shipping adapter to install natively', async () => {
    authenticateNativeAdmin.mockResolvedValue(true);
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: { items: [{ slug: 'shipping', kind: 'plugin', installable: true, sellableVersion: '1.1.0' }] } })));
    const run = vi.fn(async () => ({ success: true, meta: { changes: 1 } }));
    const db = { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run })) })) };
    const response = await tryNativeMarketplace(new Request('https://api.example/api/v1/admin/market/extensions/shipping/install', {
      method: 'POST', body: JSON.stringify({ kind: 'plugin', version: '1.1.0' }),
    }), { DB: db } as never);
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({ success: true, data: { slug: 'shipping', version: '1.1.0' } });
  });

  it('allows the published Bokmoo Connect adapter to install natively', async () => {
    authenticateNativeAdmin.mockResolvedValue(true);
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: { items: [{ slug: 'bokmoo-connect', kind: 'plugin', installable: true, sellableVersion: '0.1.2' }] } })));
    const run = vi.fn(async () => ({ success: true, meta: { changes: 1 } }));
    const db = { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run })) })) };
    const response = await tryNativeMarketplace(new Request('https://api.example/api/v1/admin/market/extensions/bokmoo-connect/install', {
      method: 'POST', body: JSON.stringify({ kind: 'plugin', version: '0.1.2' }),
    }), { DB: db } as never);
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({ success: true, data: { slug: 'bokmoo-connect', version: '0.1.2' } });
    expect(run).toHaveBeenCalledOnce();
  });

  it('fails closed for the published Affiliate extension route when disabled', async () => {
    const first = vi.fn(async () => ({ enabled: 0 }));
    const db = { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ first })) })) };
    const response = await tryNativeAffiliate(new Request('https://api.example/api/v1/extensions/plugin/affiliate/api/api/store/affiliate/register', {
      method: 'POST', body: JSON.stringify({}),
    }), { DB: db } as never);
    expect(response?.status).toBe(404);
    await expect(response?.json()).resolves.toMatchObject({ success: false, error: { code: 'PLUGIN_NOT_ENABLED' } });
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
