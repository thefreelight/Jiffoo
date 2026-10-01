import { describe, expect, it, vi } from 'vitest';

const authenticateNativeAdmin = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeAdmin }));

const { tryNativeAdminSettings } = await import('./admin-settings');

const settingsUrl = 'https://api.example/api/v1/admin/settings';
const batchUrl = 'https://api.example/api/v1/admin/settings/batch';

function env(row: { settings: string; updated_at: string } | null) {
  const state = { saved: null as string | null };
  const prepare = vi.fn((sql: string) => ({
    bind: (...args: unknown[]) => ({
      first: vi.fn(async () => {
        if (sql.includes('SELECT settings')) return row;
        if (sql.includes('SELECT id FROM native_settings')) return row ? { id: 'system' } : null;
        return null;
      }),
      run: vi.fn(async () => { state.saved = String(args[0] ?? (args[0] === undefined ? '' : JSON.stringify(args))); return { success: true, meta: { changes: 1 } }; }),
      all: vi.fn(async () => ({ results: [] })),
    }),
  }));
  return { env: { DB: { prepare } } as never, state };
}

function putRequest(body: unknown): Request {
  return new Request(batchUrl, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

describe('native admin settings', () => {
  it('requires an administrator session for reads and writes', async () => {
    authenticateNativeAdmin.mockResolvedValue(null);
    const { env: e } = env(null);
    const read = await tryNativeAdminSettings(new Request(settingsUrl), e);
    expect(read?.status).toBe(401);
    const write = await tryNativeAdminSettings(putRequest({ settings: { 'general.storeName': 'X' } }), e);
    expect(write?.status).toBe(401);
  });

  it('returns a sanitized settings document on read', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    const { env: e } = env({ settings: JSON.stringify({ 'general.storeName': 'RemoteRadar', 'general.currency': 'EUR', 'checkout.countries': ['US', 'DE'] }), updated_at: '2026-09-14T00:00:00Z' });
    const response = await tryNativeAdminSettings(new Request(settingsUrl), e);
    expect(response?.status).toBe(200);
    const payload = await response?.json() as { success: boolean; data: Record<string, unknown> };
    expect(payload.data['general.storeName']).toBe('RemoteRadar');
    expect(payload.data['general.currency']).toBeUndefined();
    expect(payload.data['localization.currency']).toBe('USD');
    expect(payload.data['checkout.countries']).toEqual(['US', 'DE']);
    expect(response?.headers.get('x-jiffoo-runtime')).toBe('cloudflare-native-d1-admin-settings');
  });

  it('merges, sanitizes, and persists batch updates returning the full map', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    const { env: e, state } = env({ settings: JSON.stringify({ 'general.storeName': 'Old', 'localization.timezone': 'UTC' }), updated_at: '2026-09-14T00:00:00Z' });
    const response = await tryNativeAdminSettings(putRequest({ settings: { 'general.storeName': 'New Name', 'general.storeDescription': 'Hello' } }), e);
    expect(response?.status).toBe(200);
    const payload = await response?.json() as { success: boolean; data: Record<string, unknown>; message?: string };
    expect(payload.data).toMatchObject({ 'general.storeName': 'New Name', 'general.storeDescription': 'Hello', 'localization.timezone': 'UTC', 'localization.currency': 'USD' });
    expect(payload.message).toContain('2 settings updated');
    expect(state.saved).toContain('New Name');
  });

  it('rejects invalid keys and unsupported value shapes', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    const { env: e } = env(null);
    const badKey = await tryNativeAdminSettings(putRequest({ settings: { 'bad key!': 'x' } }), e);
    expect(badKey?.status).toBe(400);
    const badValue = await tryNativeAdminSettings(putRequest({ settings: { 'general.storeName': { nested: true } } }), e);
    expect(badValue?.status).toBe(400);
    const noSettings = await tryNativeAdminSettings(putRequest({}), e);
    expect(noSettings?.status).toBe(400);
  });

  it('ignores unrelated routes', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    const { env: e } = env(null);
    expect(await tryNativeAdminSettings(new Request('https://api.example/api/v1/admin/orders'), e)).toBeNull();
    expect(await tryNativeAdminSettings(new Request(settingsUrl, { method: 'DELETE' }), e)).toBeNull();
  });
});
