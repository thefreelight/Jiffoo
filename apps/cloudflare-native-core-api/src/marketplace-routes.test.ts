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

  it('handles theme-shop installs through the native theme adapter', async () => {
    authenticateNativeAdmin.mockResolvedValue(true);
    const encoder = new TextEncoder();
    const crcTable = (() => { const t: number[] = []; for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
    const stored = (name: string, text: string) => {
      const bytes = encoder.encode(text);
      const nameBytes = encoder.encode(name);
      let crc = 0xffffffff;
      for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
      const crcValue = (crc ^ 0xffffffff) >>> 0;
      const local = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(8, 0, true);
      lv.setUint32(14, crcValue, true); lv.setUint32(18, bytes.length, true); lv.setUint32(22, bytes.length, true);
      lv.setUint16(26, nameBytes.length, true);
      local.set(nameBytes, 30);
      const cd = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(cd.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(8, 0, true);
      cv.setUint32(16, crcValue, true); cv.setUint32(20, bytes.length, true); cv.setUint32(24, bytes.length, true);
      cv.setUint16(28, nameBytes.length, true); cv.setUint32(42, 0, true);
      cd.set(nameBytes, 46);
      return { local, cd, bytes };
    };
    const entryA = stored('theme.json', JSON.stringify({ slug: 'bokmoo', version: '1.1.8', defaultConfig: {} }));
    const entryB = stored('runtime/theme-runtime.js', '/* runtime */');
    const entries = [entryA, entryB];
    let headerOffset = 0;
    for (const entry of entries) { entry.cd && (entry.cd as Uint8Array); void entry; }
    // compute local offsets
    let cursor = 0;
    for (const entry of entries) { (entry as unknown as { localOffset: number }).localOffset = cursor; cursor += entry.local.length + entry.bytes.length; }
    for (const entry of entries) { const cv2 = new DataView(entry.cd.buffer); cv2.setUint32(42, (entry as unknown as { localOffset: number }).localOffset, true); }
    const centralSize = entries.reduce((sum, entry) => sum + entry.cd.length, 0);
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true);
    eocdView.setUint16(8, entries.length, true);
    eocdView.setUint16(10, entries.length, true);
    eocdView.setUint32(12, centralSize, true);
    eocdView.setUint32(16, cursor, true);
    const zip = new Uint8Array(cursor + centralSize + 22);
    let writeAt = 0;
    for (const entry of entries) { zip.set(entry.local, writeAt); writeAt += entry.local.length; zip.set(entry.bytes, writeAt); writeAt += entry.bytes.length; }
    for (const entry of entries) { zip.set(entry.cd, writeAt); writeAt += entry.cd.length; }
    zip.set(eocd, writeAt);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ data: { items: [{
        slug: 'bokmoo', kind: 'theme', installable: true, sellableVersion: '1.1.8',
        versions: [{ version: '1.1.8', packageUrl: 'https://get.jiffoo.com/official-artifacts/themes/bokmoo/1.1.8.jtheme' }],
      }] } }))
      .mockResolvedValueOnce(new Response(zip as unknown as BodyInit, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mock.calls.length;
    const objects = new Map<string, Uint8Array>();
    const response = await tryNativeMarketplace(new Request('https://api.example/api/v1/admin/market/extensions/bokmoo/install', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'theme-shop', version: '1.1.8', activate: true }),
    }), {
      DB: { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ first: vi.fn(async () => null), run: vi.fn(async () => ({ success: true })) })) })) },
      ASSETS: { put: vi.fn(async (key: string, value: Uint8Array) => { objects.set(key, value); }) },
    } as never);
    expect(response?.status).toBe(200);
    expect(objects.has('extensions/themes/shop/.versions/bokmoo/1.1.8/runtime/theme-runtime.js')).toBe(true);
  });
});
