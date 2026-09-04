import { afterEach, describe, expect, it, vi } from 'vitest';

const authenticateNativeAdmin = vi.fn();
const getNativeJwtSecret = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeAdmin, getNativeJwtSecret }));

const { tryNativePluginSettings } = await import('./plugin-settings');

function statement(first: unknown = null, all: unknown[] = []) {
  return {
    bind: vi.fn(() => ({
      first: vi.fn(async () => first),
      all: vi.fn(async () => ({ results: all })),
      run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
    })),
  };
}

afterEach(() => vi.clearAllMocks());

describe('native plugin settings admin routes', () => {
  it('lists the bokmoo-connect native adapter alongside built-in plugins', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com' });
    const response = await tryNativePluginSettings(
      new Request('https://api.example/api/v1/extensions/plugin', { headers: { authorization: 'Bearer admin-token' } }),
      { DB: { prepare: vi.fn(() => statement(null)) } } as never,
    );
    expect(response?.status).toBe(200);
    expect(response?.headers.get('x-jiffoo-runtime')).toBe('cloudflare-native-d1-plugin-settings');
    const payload = await response?.json() as any;
    const slugs = payload.data.items.map((item: any) => item.slug);
    expect(slugs).toContain('bokmoo-connect');
    const bokmoo = payload.data.items.find((item: any) => item.slug === 'bokmoo-connect');
    expect(bokmoo).toMatchObject({
      name: 'BOKMOO Connect',
      version: '0.1.2',
      runtimeType: 'cloudflare-native',
      source: 'native',
      enabled: false,
    });
    expect(JSON.parse(bokmoo.manifestJson)).toMatchObject({ slug: 'bokmoo-connect', schemaVersion: 1 });
  });

  it('answers the bokmoo-connect plugin detail route natively instead of proxying', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com' });
    const response = await tryNativePluginSettings(
      new Request('https://api.example/api/v1/extensions/plugin/bokmoo-connect', { headers: { authorization: 'Bearer admin-token' } }),
      { DB: { prepare: vi.fn() } } as never,
    );
    expect(response?.status).toBe(200);
    expect(response?.headers.get('x-jiffoo-runtime')).toBe('cloudflare-native-d1-plugin-settings');
    const payload = await response?.json() as any;
    expect(payload.data).toMatchObject({
      slug: 'bokmoo-connect',
      name: 'BOKMOO Connect',
      version: '0.1.2',
      runtimeType: 'cloudflare-native',
      source: 'native',
    });
    expect(payload.data.description).toContain('card claim');
  });

  it('keeps the bokmoo-connect detail route admin-only with a native 401', async () => {
    authenticateNativeAdmin.mockResolvedValue(null);
    const response = await tryNativePluginSettings(
      new Request('https://api.example/api/v1/extensions/plugin/bokmoo-connect'),
      { DB: { prepare: vi.fn() } } as never,
    );
    expect(response?.status).toBe(401);
    expect(response?.headers.get('x-jiffoo-runtime')).toBe('cloudflare-native-d1-plugin-settings');
    await expect(response?.json()).resolves.toMatchObject({
      success: false,
      error: { code: 'UNAUTHORIZED' },
    });
  });

  it('returns the installed bokmoo-connect instance with its enabled state', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com' });
    const instance = {
      id: 'installation-1',
      plugin_slug: 'bokmoo-connect',
      instance_key: 'default',
      enabled: 1,
      config_json: '{}',
      encrypted_secrets_json: '{}',
      created_at: '2026-09-04T04:24:57.483Z',
      updated_at: '2026-09-04T04:24:57.483Z',
    };
    const response = await tryNativePluginSettings(
      new Request('https://api.example/api/v1/extensions/plugin/bokmoo-connect/instances', { headers: { authorization: 'Bearer admin-token' } }),
      { DB: { prepare: vi.fn(() => statement(instance)) } } as never,
    );
    expect(response?.status).toBe(200);
    const payload = await response?.json() as any;
    expect(payload.data.items).toHaveLength(1);
    expect(payload.data.items[0]).toMatchObject({
      installationId: 'installation-1',
      pluginSlug: 'bokmoo-connect',
      instanceKey: 'default',
      enabled: true,
    });
  });

  it('still declines unknown plugin slugs so they are not mistaken for native plugins', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com' });
    const response = await tryNativePluginSettings(
      new Request('https://api.example/api/v1/extensions/plugin/does-not-exist', { headers: { authorization: 'Bearer admin-token' } }),
      { DB: { prepare: vi.fn() } } as never,
    );
    expect(response).toBeNull();
  });
});
