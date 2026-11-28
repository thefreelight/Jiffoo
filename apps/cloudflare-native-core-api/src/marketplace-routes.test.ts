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
      slug: 'wallet', kind: 'plugin', installable: true, sellableVersion: '0.2.0', pricingModel: 'free',
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
    const platformFetch = vi.fn(async () => Response.json({ data: { items: [{ slug: 'affiliate', kind: 'plugin', installable: true, sellableVersion: '0.1.6', pricingModel: 'member', packageAccess: 'license' }] } }));
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
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: { items: [{ slug: 'coupon', kind: 'plugin', installable: true, sellableVersion: '0.1.4', pricingModel: 'free' }] } })));
    const run = vi.fn(async () => ({ success: true, meta: { changes: 1 } }));
    const db = { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run })) })) };
    const response = await tryNativeMarketplace(new Request('https://api.example/api/v1/admin/market/extensions/coupon/install', { method: 'POST', body: JSON.stringify({ kind: 'plugin' }) }), { DB: db } as never);
    expect(response?.status).toBe(200);
    expect(run).toHaveBeenCalledOnce();
  });

  it('allows the published Shipping adapter to install natively', async () => {
    authenticateNativeAdmin.mockResolvedValue(true);
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: { items: [{ slug: 'shipping', kind: 'plugin', installable: true, sellableVersion: '1.1.0', pricingModel: 'free' }] } })));
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
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: { items: [{ slug: 'bokmoo-connect', kind: 'plugin', installable: true, sellableVersion: '0.1.2', pricingModel: 'free' }] } })));
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
        slug: 'bokmoo', kind: 'theme', installable: true, sellableVersion: '1.1.8', pricingModel: 'free', packageAccess: 'public',
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
    // A free package still comes straight from its public URL.
    const requested = fetchMock.mock.calls[1]?.[0];
    expect(typeof requested === 'string' ? requested : (requested as Request).url).toBe('https://get.jiffoo.com/official-artifacts/themes/bokmoo/1.1.8.jtheme');
  });
});

// Wallet is a member-priced official plugin: the platform must confirm an
// entitlement before this instance enables it.
const MEMBER_KEY = `JIF-${'A'.repeat(32)}`;
const PACKAGE_ROUTE = 'https://platform-api.jiffoo.com/api/marketplace/official/package';

function instanceDb(options: { settings?: unknown; connection?: unknown } = {}) {
  const run = vi.fn(async () => ({ success: true, meta: { changes: 1 } }));
  const statement = (sql: string) => {
    const first = vi.fn(async () => {
      if (sql.includes('native_settings')) return options.settings === undefined ? null : { settings: JSON.stringify(options.settings) };
      if (sql.includes('platform_connection')) return options.connection === undefined ? null : { value: JSON.stringify(options.connection) };
      return null;
    });
    return { bind: vi.fn(() => ({ first, all: vi.fn(async () => ({ results: [] })), run })), first, all: vi.fn(async () => ({ results: [] })), run };
  };
  return { db: { prepare: vi.fn((sql: string) => statement(sql)) }, run };
}

const memberConnection = {
  instance: { instanceId: 'inst-1', instanceToken: 'tok-1' },
  tenantBinding: { tenantBindingId: 'bind-1', localStoreId: 'store-1' },
};

// A theme package the native theme installer accepts: theme.json and a runtime file.
function themePackageZip(slug: string, version: string): Uint8Array {
  const encoder = new TextEncoder();
  const themeJson = encoder.encode(JSON.stringify({ slug, version, defaultConfig: {} }));
  const crcTable = (() => { const t: number[] = []; for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crcOf = (bytes: Uint8Array) => { let crc = 0xffffffff; for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; };
  const entry = (name: string, bytes: Uint8Array, offset: number) => {
    const nameBytes = encoder.encode(name);
    const crc = crcOf(bytes);
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint32(14, crc, true); lv.setUint32(18, bytes.length, true); lv.setUint32(22, bytes.length, true); lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint32(16, crc, true); cv.setUint32(20, bytes.length, true); cv.setUint32(24, bytes.length, true); cv.setUint16(28, nameBytes.length, true); cv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);
    return { local, cd, bytes };
  };
  const a = entry('theme.json', themeJson, 0);
  const runtime = encoder.encode('/* runtime */');
  const b = entry('runtime/theme-runtime.js', runtime, a.local.length + themeJson.length);
  const centralSize = a.cd.length + b.cd.length;
  const localSize = a.local.length + themeJson.length + b.local.length + runtime.length;
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, 2, true); ev.setUint16(10, 2, true); ev.setUint32(12, centralSize, true); ev.setUint32(16, localSize, true);
  const zip = new Uint8Array([...a.local, ...themeJson, ...b.local, ...runtime, ...a.cd, ...b.cd, ...eocd]);
  return zip;
}

describe('non-free official extensions need a platform entitlement', () => {
  it('refuses to enable a member-priced plugin when the instance has no credentials', async () => {
    authenticateNativeAdmin.mockResolvedValue(true);
    const fetchMock = vi.fn(async () => Response.json({ data: { items: [{ slug: 'wallet', kind: 'plugin', installable: true, sellableVersion: '0.2.0', pricingModel: 'member', packageAccess: 'license' }] } }));
    vi.stubGlobal('fetch', fetchMock);
    const { db, run } = instanceDb();
    const response = await tryNativeMarketplace(new Request('https://api.example/api/v1/admin/market/extensions/wallet/install', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'plugin', version: '0.2.0' }),
    }), { DB: db } as never);
    expect(response?.status).toBe(402);
    await expect(response?.json()).resolves.toMatchObject({ success: false, error: { code: 'MEMBERSHIP_REQUIRED', details: { purchaseUrl: 'https://platform-api.jiffoo.com/membership' } } });
    expect(run).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('enables a member-priced plugin after the platform confirms a membership license key', async () => {
    authenticateNativeAdmin.mockResolvedValue(true);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ data: { items: [{ slug: 'wallet', kind: 'plugin', installable: true, sellableVersion: '0.2.0', pricingModel: 'member', packageAccess: 'license' }] } }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { db, run } = instanceDb({ settings: { platformLicenseKey: MEMBER_KEY, other: 1 } });
    const response = await tryNativeMarketplace(new Request('https://api.example/api/v1/admin/market/extensions/wallet/install', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'plugin', version: '0.2.0' }),
    }), { DB: db } as never);
    expect(response?.status).toBe(200);
    expect(run).toHaveBeenCalledOnce();
    const access = fetchMock.mock.calls[1]?.[0] as Request;
    expect(access.url).toBe(`${PACKAGE_ROUTE}/plugin/wallet/0.2.0`);
    expect(access.method).toBe('HEAD');
    expect(access.headers.get('x-jiffoo-license-key')).toBe(MEMBER_KEY);
    // the catalog itself is fetched without any credential
    const catalogHeaders = new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.headers);
    expect(catalogHeaders.has('x-jiffoo-license-key')).toBe(false);
  });

  it('reports the membership requirement when the platform rejects the credentials', async () => {
    authenticateNativeAdmin.mockResolvedValue(true);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ data: { items: [{ slug: 'wallet', kind: 'plugin', installable: true, sellableVersion: '0.2.0', pricingModel: 'member' }] } }))
      .mockResolvedValueOnce(Response.json({ success: false, error: { code: 'MEMBERSHIP_REQUIRED', details: { purchaseUrl: 'https://platform-api.jiffoo.com/membership' } } }, { status: 402 }));
    vi.stubGlobal('fetch', fetchMock);
    const { db, run } = instanceDb({ settings: { platformLicenseKey: MEMBER_KEY } });
    const response = await tryNativeMarketplace(new Request('https://api.example/api/v1/admin/market/extensions/wallet/install', {
      method: 'POST', body: JSON.stringify({ kind: 'plugin' }),
    }), { DB: db } as never);
    expect(response?.status).toBe(402);
    expect(run).not.toHaveBeenCalled();
  });

  it('never fetches a member-priced theme from the public URL listed in the catalog', async () => {
    authenticateNativeAdmin.mockResolvedValue(true);
    const publicUrl = 'https://get.jiffoo.com/official-artifacts/themes/navtoai/0.2.8.jtheme';
    const fetchMock = vi.fn(async () => Response.json({ data: { items: [{
      slug: 'navtoai', kind: 'theme', installable: true, sellableVersion: '0.2.8', pricingModel: 'member', packageAccess: 'license',
      versions: [{ version: '0.2.8', packageUrl: publicUrl }],
    }] } }));
    vi.stubGlobal('fetch', fetchMock);
    const { db } = instanceDb();
    const response = await tryNativeMarketplace(new Request('https://api.example/api/v1/admin/market/extensions/navtoai/install', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'theme-shop', version: '0.2.8', activate: true }),
    }), { DB: db, ASSETS: { put: vi.fn() } } as never);
    expect(response?.status).toBe(402);
    expect(fetchMock.mock.calls.map(([value]) => (value as Request).url)).not.toContain(publicUrl);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('installs a member-priced theme through the authorized route using the platform connection', async () => {
    authenticateNativeAdmin.mockResolvedValue(true);
    const zip = themePackageZip('navtoai', '0.2.8');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ data: { items: [{
        slug: 'navtoai', kind: 'theme', installable: true, sellableVersion: '0.2.8', pricingModel: 'member', packageAccess: 'license',
        versions: [{ version: '0.2.8', packageUrl: null }],
      }] } }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(zip as unknown as BodyInit, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { db } = instanceDb({ connection: memberConnection });
    const objects = new Map<string, Uint8Array>();
    const response = await tryNativeMarketplace(new Request('https://api.example/api/v1/admin/market/extensions/navtoai/install', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'theme-shop', version: '0.2.8', activate: true }),
    }), {
      DB: db,
      ASSETS: { put: vi.fn(async (key: string, value: Uint8Array) => { objects.set(key, value); }) },
    } as never);
    expect(response?.status).toBe(200);
    expect(objects.has('extensions/themes/shop/.versions/navtoai/0.2.8/runtime/theme-runtime.js')).toBe(true);
    const requests = fetchMock.mock.calls.slice(1).map(([value]) => value as Request);
    expect(requests.map((value) => value.url)).toEqual([`${PACKAGE_ROUTE}/theme/navtoai/0.2.8`, `${PACKAGE_ROUTE}/theme/navtoai/0.2.8`]);
    expect(requests.map((value) => value.method)).toEqual(['HEAD', 'GET']);
    expect(Object.fromEntries(requests[0]!.headers)).toMatchObject({ 'x-jiffoo-instance-id': 'inst-1', 'x-jiffoo-instance-token': 'tok-1', 'x-jiffoo-tenant-binding-id': 'bind-1', 'x-jiffoo-local-store-id': 'store-1' });
    expect(requests[0]!.headers.has('x-jiffoo-license-key')).toBe(false);
  });
});

describe('official items with a free base', () => {
  const freeBasePlugin = { slug: 'traffic-analytics', kind: 'plugin', installable: true, sellableVersion: '0.0.1', pricingModel: 'member', packageAccess: 'license', freeBase: true };

  it('installs a membership plugin the platform marks as free-base without any credential', async () => {
    authenticateNativeAdmin.mockResolvedValue(true);
    const fetchMock = vi.fn(async () => Response.json({ data: { items: [freeBasePlugin] } }));
    vi.stubGlobal('fetch', fetchMock);
    const { db, run } = instanceDb();
    const response = await tryNativeMarketplace(new Request('https://api.example/api/v1/admin/market/extensions/traffic-analytics/install', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'plugin', version: '0.0.1' }),
    }), { DB: db } as never);
    expect(response?.status).toBe(200);
    expect(run).toHaveBeenCalledOnce();
    // Only the catalog was asked: no entitlement check and, for a plugin, no package download.
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('fetches a free-base theme through an install grant, never through a public URL', async () => {
    authenticateNativeAdmin.mockResolvedValue(true);
    const grantUrl = 'https://get.jiffoo.com/api/marketplace/official/package/theme/navtoai/0.2.8?grant=' + 'a'.repeat(64);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ data: { items: [{
        slug: 'navtoai', kind: 'theme', installable: true, sellableVersion: '0.2.8', pricingModel: 'member', packageAccess: 'license', freeBase: true,
        versions: [{ version: '0.2.8', packageUrl: null }],
      }] } }))
      .mockResolvedValueOnce(Response.json({ success: true, data: { allowed: true, packageUrl: grantUrl, entitlement: { required: false, status: 'free_base' } } }))
      .mockResolvedValueOnce(new Response(themePackageZip('navtoai', '0.2.8') as unknown as BodyInit, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { db } = instanceDb();
    const objects = new Map<string, Uint8Array>();
    const response = await tryNativeMarketplace(new Request('https://api.example/api/v1/admin/market/extensions/navtoai/install', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'theme-shop', version: '0.2.8', activate: true }),
    }), {
      DB: db,
      ASSETS: { put: vi.fn(async (key: string, value: Uint8Array) => { objects.set(key, value); }) },
    } as never);
    expect(response?.status).toBe(200);
    expect(objects.has('extensions/themes/shop/.versions/navtoai/0.2.8/runtime/theme-runtime.js')).toBe(true);
    const authorization = fetchMock.mock.calls[1]?.[0] as Request;
    expect(authorization.url).toBe('https://platform-api.jiffoo.com/api/marketplace/official/catalog/navtoai/authorize-install');
    expect(authorization.method).toBe('POST');
    expect(JSON.parse(await authorization.text())).toEqual({ userId: 'native-install', version: '0.2.8' });
    // Without a Platform service binding the granted address is fetched by URL: no credential rides along.
    const download = fetchMock.mock.calls[2]?.[0];
    expect(typeof download === 'string' ? download : (download as Request).url).toBe(grantUrl);
    expect(fetchMock.mock.calls[2]?.[1]).toBeUndefined();
  });

  it('installs nothing when the platform does not confirm the free base', async () => {
    authenticateNativeAdmin.mockResolvedValue(true);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ data: { items: [{
        slug: 'navtoai', kind: 'theme', installable: true, sellableVersion: '0.2.8', pricingModel: 'member', packageAccess: 'license', freeBase: true,
        versions: [{ version: '0.2.8', packageUrl: null }],
      }] } }))
      .mockResolvedValueOnce(Response.json({ success: true, data: { allowed: false, packageUrl: null, entitlement: { required: true, status: 'denied' } } }));
    vi.stubGlobal('fetch', fetchMock);
    const { db } = instanceDb();
    const put = vi.fn();
    const response = await tryNativeMarketplace(new Request('https://api.example/api/v1/admin/market/extensions/navtoai/install', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'theme-shop', version: '0.2.8', activate: true }),
    }), { DB: db, ASSETS: { put } } as never);
    expect(response?.status).toBe(503);
    expect(put).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
