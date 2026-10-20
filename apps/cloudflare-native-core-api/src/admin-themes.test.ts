import { beforeEach, describe, expect, it, vi } from 'vitest';

const authenticateNativeAdmin = vi.fn();

vi.mock('./auth', () => ({
  authenticateNativeAdmin,
}));

const { tryNativeAdminThemes } = await import('./admin-themes');

const ACTIVE_THEME_SNAPSHOT = JSON.stringify({
  success: true,
  data: {
    slug: 'bokmoo',
    version: '1.1.28',
    source: 'official-market',
    type: 'pack',
    config: { site: { apiBaseUrl: 'https://api.bokmoo.com' } },
    theme: { version: '1.1.28' },
  },
});

function fakeEnv(rows: Record<string, { payload: string; refreshed_at: string }>) {
  const prepare = (sql: string) => {
    const statement = () => ({
      first: async () => {
        if (sql.includes("request_path = '/api/v1/themes/active' LIMIT 1")) {
          return rows['/api/v1/themes/active'] ?? null;
        }
        return null;
      },
      all: async () => ({ results: [] }),
    });
    return { ...statement(), bind: (..._args: unknown[]) => statement() };
  };
  return { DB: { prepare } } as unknown as Parameters<typeof tryNativeAdminThemes>[1];
}

function request(path: string, method = 'GET'): Request {
  return new Request(`https://api.bokmoo.test${path}`, { method, headers: { authorization: 'Bearer test-token' } });
}

beforeEach(() => {
  authenticateNativeAdmin.mockReset();
  authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', role: 'SUPER_ADMIN' });
});

describe('tryNativeAdminThemes', () => {
  it('serves the shop active theme from the deployed snapshot', async () => {
    const env = fakeEnv({ '/api/v1/themes/active': { payload: ACTIVE_THEME_SNAPSHOT, refreshed_at: '2026-10-20 06:00:00' } });
    const response = await tryNativeAdminThemes(request('/api/v1/admin/themes/shop/active'), env);
    const body = await response.json() as { data: { slug: string; version: string; source: string; type: string; activatedAt: string } };
    expect(body.data).toMatchObject({ slug: 'bokmoo', version: '1.1.28', source: 'official-market', type: 'pack' });
    expect(body.data.activatedAt).toBe('2026-10-20T06:00:00Z');
  });

  it('lists the installed shop theme', async () => {
    const env = fakeEnv({ '/api/v1/themes/active': { payload: ACTIVE_THEME_SNAPSHOT, refreshed_at: '2026-10-20 06:00:00' } });
    const response = await tryNativeAdminThemes(request('/api/v1/admin/themes/shop/installed?page=1&limit=20'), env);
    const body = await response.json() as { data: { items: Array<{ slug: string; target: string; source: string }>; total: number } };
    expect(body.data.total).toBe(1);
    expect(body.data.items[0]).toMatchObject({ slug: 'bokmoo', target: 'shop' });
  });

  it('reports only the shop target on native instances', async () => {
    const env = fakeEnv({});
    const response = await tryNativeAdminThemes(request('/api/v1/admin/themes'), env);
    const body = await response.json() as { data: { targets: string[] } };
    expect(body.data.targets).toEqual(['shop']);
  });

  it('rejects activation with an explicit read-only error instead of proxying', async () => {
    const env = fakeEnv({});
    const response = await tryNativeAdminThemes(request('/api/v1/admin/themes/shop/bokmoo/activate', 'POST'), env);
    expect(response.status).toBe(501);
    const body = await response.json() as { error: { code: string } };
    expect(body.error.code).toBe('NATIVE_THEMES_READ_ONLY');
  });

  it('declines the admin-target active read so its snapshot route keeps serving it', async () => {
    const env = fakeEnv({});
    const result = await tryNativeAdminThemes(request('/api/v1/admin/themes/admin/active'), env);
    expect(result).toBeNull();
  });

  it('requires admin authentication', async () => {
    authenticateNativeAdmin.mockResolvedValue(null);
    const env = fakeEnv({});
    const response = await tryNativeAdminThemes(request('/api/v1/admin/themes/shop/active'), env);
    expect(response.status).toBe(401);
  });
});
