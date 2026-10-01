import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authenticateNativeAdmin = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeAdmin }));
const isNativePluginEnabled = vi.fn();
vi.mock('./plugin-enabled', () => ({ isNativePluginEnabled }));

const { tryNativeSupportHub, mergeNativeSettings, nativePublicConfig, validateSupportHubSettings } = await import('./support-hub');
const { tryNativeMarketplace } = await import('./marketplace');

afterEach(() => vi.unstubAllGlobals());

// Stateful D1 fake over the shared native_plugin_instances row so settings
// persistence round-trips the same way as on a real Worker.
function fakeDb() {
  const state = { enabled: 1, config_json: '{}' as string };
  const firstFor = (sql: string) => async () => {
    if (sql.includes('SELECT enabled')) return { enabled: state.enabled };
    if (sql.includes('SELECT config_json')) return { config_json: state.config_json };
    return null;
  };
  return {
    state,
    prepare: (sql: string) => ({
      first: firstFor(sql),
      bind: (...args: unknown[]) => ({
        first: firstFor(sql),
        run: async () => {
          if (sql.includes('INSERT INTO native_plugin_instances')) {
            state.config_json = String(args[1]);
          }
          return {} as never;
        },
      }),
    }),
  };
}

const storeRequest = (path: string) => new Request(`https://api.example/api/v1/plugins/support-hub/store${path}`);
const mountAdminRequest = (path: string, init?: RequestInit) =>
  new Request(`https://api.example/api/v1/plugins/support-hub/admin${path}`, init);
const gatewayRequest = (path: string, init?: RequestInit) =>
  new Request(`https://api.example/api/v1/extensions/plugin/support-hub/api${path}`, init);

describe('native support hub adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isNativePluginEnabled.mockResolvedValue(true);
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
  });

  it('ignores unrelated paths', async () => {
    const db = fakeDb();
    const response = await tryNativeSupportHub(new Request('https://api.example/api/v1/plugins/wallet/store/balance'), { DB: db } as never);
    expect(response).toBeNull();
    const unknownNamespaceRoute = await tryNativeSupportHub(gatewayRequest('/webhooks/anything'), { DB: db } as never);
    expect(unknownNamespaceRoute?.status).toBe(404);
    await expect(unknownNamespaceRoute?.json()).resolves.toMatchObject({ error: { code: 'NOT_FOUND' } });
  });

  it('404s when the plugin is not enabled', async () => {
    isNativePluginEnabled.mockResolvedValue(false);
    const response = await tryNativeSupportHub(storeRequest('/health'), { DB: fakeDb() } as never);
    expect(response?.status).toBe(404);
    await expect(response?.json()).resolves.toMatchObject({ error: { code: 'PLUGIN_NOT_ENABLED' } });
  });

  it('serves store health and defaults through the storefront mount', async () => {
    const db = fakeDb();
    const health = await tryNativeSupportHub(storeRequest('/health'), { DB: db } as never);
    expect(health?.status).toBe(200);
    await expect(health?.json()).resolves.toMatchObject({ status: 'healthy', plugin: 'support-hub', version: '0.0.3' });

    const config = await tryNativeSupportHub(storeRequest('/config'), { DB: db } as never);
    await expect(config?.json()).resolves.toMatchObject({ success: true, data: { enabled: true, channels: [] } });
    expect(config?.headers.get('x-jiffoo-runtime')).toBe('cloudflare-native-support-hub');
  });

  it('serves the same contract through the gateway alias', async () => {
    const db = fakeDb();
    const health = await tryNativeSupportHub(gatewayRequest('/store/health'), { DB: db } as never);
    await expect(health?.json()).resolves.toMatchObject({ status: 'healthy', version: '0.0.3' });
    const config = await tryNativeSupportHub(gatewayRequest('/store/config'), { DB: db } as never);
    await expect(config?.json()).resolves.toMatchObject({ success: true, data: { enabled: true, channels: [] } });
  });

  it('serves admin settings through the bare plugin mount shape (0.0.3 client fetch path)', async () => {
    const db = fakeDb();
    const saved = await tryNativeSupportHub(mountAdminRequest('/settings', {
      method: 'PUT',
      body: JSON.stringify({ whatsappEnabled: true, whatsappLink: 'https://wa.me/15551234567' }),
    }), { DB: db } as never);
    expect(saved?.status).toBe(200);
    const fetched = await tryNativeSupportHub(mountAdminRequest('/settings'), { DB: db } as never);
    await expect(fetched?.json()).resolves.toMatchObject({ data: { whatsappEnabled: true } });
    const config = await tryNativeSupportHub(storeRequest('/config'), { DB: db } as never);
    const configBody = await config?.json();
    expect(configBody.data.channels).toEqual([
      { kind: 'whatsapp', label: 'WhatsApp', href: 'https://wa.me/15551234567' },
    ]);
  });

  it('persists settings via admin PUT and reflects them in store config', async () => {
    const db = fakeDb();
    const saved = await tryNativeSupportHub(gatewayRequest('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ telegramEnabled: true, telegramLink: 'https://t.me/jiffoo_support', whatsappEnabled: false }),
    }), { DB: db } as never);
    expect(saved?.status).toBe(200);
    const savedBody = await saved?.json();
    expect(savedBody.data.retentionDays).toBe(90);
    expect(db.state.config_json).toContain('https://t.me/jiffoo_support');

    const fetched = await tryNativeSupportHub(gatewayRequest('/admin/settings'), { DB: db } as never);
    await expect(fetched?.json()).resolves.toMatchObject({ data: { telegramEnabled: true } });

    const config = await tryNativeSupportHub(storeRequest('/config'), { DB: db } as never);
    const configBody = await config?.json();
    expect(configBody.data.channels).toEqual([
      { kind: 'telegram', label: 'Telegram', href: 'https://t.me/jiffoo_support' },
    ]);
  });

  it('rejects enabling a channel without a link', async () => {
    const response = await tryNativeSupportHub(gatewayRequest('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ whatsappEnabled: true, whatsappLink: '' }),
    }), { DB: fakeDb() } as never);
    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toMatchObject({ error: { code: 'SUPPORT_HUB_SETTINGS_INVALID' } });
  });

  it('requires admin authentication for /admin routes', async () => {
    authenticateNativeAdmin.mockResolvedValue(null);
    const response = await tryNativeSupportHub(gatewayRequest('/admin/settings'), { DB: fakeDb() } as never);
    expect(response?.status).toBe(401);
  });

  it('exposes pure helpers used by the generic admin panel path', () => {
    expect(mergeNativeSettings({}).defaultQueue).toBe('general');
    expect(validateSupportHubSettings({ telegramEnabled: true, telegramLink: 't.me/x' })).toMatch(/http\(s\)/);
    expect(validateSupportHubSettings({ telegramEnabled: true, telegramLink: 'https://t.me/x', retentionDays: 4000 })).toMatch(/retentionDays/);
    expect(validateSupportHubSettings({})).toBeNull();
    expect(nativePublicConfig(mergeNativeSettings({ enabled: false, feishuEnabled: true, feishuLink: 'https://x.com' })).channels).toEqual([]);
  });
});

describe('native marketplace install of support-hub', () => {
  it('allows support-hub to install natively now that the adapter exists', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: { items: [
      { slug: 'support-hub', kind: 'plugin', installable: true, sellableVersion: '0.0.3' },
    ] } })));
    const run = vi.fn(async () => ({ success: true, meta: { changes: 1 } }));
    const db = { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run })) })) };
    const response = await tryNativeMarketplace(new Request('https://api.example/api/v1/admin/market/extensions/support-hub/install', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'plugin' }),
    }), { DB: db } as never);
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({ success: true, data: { slug: 'support-hub', version: '0.0.3' } });
    expect(run).toHaveBeenCalledOnce();
  });
});
