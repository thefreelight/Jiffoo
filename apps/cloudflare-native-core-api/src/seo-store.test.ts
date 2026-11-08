import { describe, expect, it } from 'vitest';

const { tryNativeSeoStore } = await import('./seo-store');

interface RedirectRow {
  id: string;
  from_path: string;
  to_path: string;
  status_code: number;
  is_active: number;
  hit_count: number;
}

function makeEnv(redirectRows: RedirectRow[], catalogPayload: string | null) {
  const rows = redirectRows.map((row) => ({ ...row }));
  const env = {
    DB: {
      prepare: (sql: string) => {
        const first = async (...args: unknown[]) => {
          if (sql.includes("request_path = '/api/v1/products'")) {
            return catalogPayload === null ? null : { payload: catalogPayload };
          }
          if (sql.includes('WHERE from_path = ?1 AND is_active = 1')) {
            return rows.find((r) => r.from_path === args[0] && r.is_active === 1) ?? null;
          }
          return null;
        };
        const all = async (...args: unknown[]) => {
          if (sql.includes('WHERE is_active = 1 ORDER BY from_path LIMIT')) {
            const limit = Number(args[0]);
            const active = rows
              .filter((r) => r.is_active === 1)
              .sort((a, b) => a.from_path.localeCompare(b.from_path));
            return { results: active.slice(0, limit) };
          }
          return { results: [] };
        };
        const run = async (...args: unknown[]) => {
          if (sql.includes('SET hit_count = hit_count + 1')) {
            const row = rows.find((r) => r.id === args[0]);
            if (row) row.hit_count += 1;
          }
          return { success: true };
        };
        // D1 statements are callable with or without bindings.
        return { first, all, run, bind: (...args: unknown[]) => ({ first: () => first(...args), all: () => all(...args), run: () => run(...args) }) };
      },
    },
  };
  return { env, rows };
}

function request(path: string): Request {
  return new Request(`https://api.example.test${path}`);
}

describe('tryNativeSeoStore', () => {
  it('passes through non-store paths', async () => {
    const { env } = makeEnv([], null);
    expect(await tryNativeSeoStore(request('/api/v1/seo/redirects'), env as never)).toBeNull();
    expect(await tryNativeSeoStore(request('/api/v1/plugins/other/store/config'), env as never)).toBeNull();
    expect(await tryNativeSeoStore(request('/api/v1/plugins/seo/admin/redirects'), env as never)).toBeNull();
  });

  it('rejects non-GET requests', async () => {
    const { env } = makeEnv([], null);
    const response = await tryNativeSeoStore(
      new Request('https://api.example.test/api/v1/plugins/seo/store/redirects', { method: 'POST' }),
      env as never,
    );
    expect(response?.status).toBe(405);
  });

  it('lists only active redirects, capped and ordered', async () => {
    const { env } = makeEnv([
      { id: '1', from_path: '/b', to_path: '/beta', status_code: 301, is_active: 1, hit_count: 0 },
      { id: '2', from_path: '/a', to_path: '/alpha', status_code: 308, is_active: 1, hit_count: 2 },
      { id: '3', from_path: '/c', to_path: '/gamma', status_code: 301, is_active: 0, hit_count: 0 },
    ], null);
    const response = await tryNativeSeoStore(request('/api/v1/plugins/seo/store/redirects?limit=10'), env as never);
    expect(response?.status).toBe(200);
    const body = await response!.json();
    expect(body.success).toBe(true);
    expect(body.data.items).toEqual([
      { fromPath: '/a', toPath: '/alpha', statusCode: 308 },
      { fromPath: '/b', toPath: '/beta', statusCode: 301 },
    ]);
  });

  it('resolves a matching redirect and counts the hit', async () => {
    const { env, rows } = makeEnv([
      { id: 'r1', from_path: '/old', to_path: 'https://bokmoo.com/new', status_code: 301, is_active: 1, hit_count: 4 },
    ], null);
    const response = await tryNativeSeoStore(request('/api/v1/plugins/seo/store/redirects/resolve?path=%2Fold'), env as never);
    const body = await response!.json();
    expect(body.data).toEqual({ match: true, fromPath: '/old', toPath: 'https://bokmoo.com/new', statusCode: 301 });
    expect(rows[0]!.hit_count).toBe(5);
  });

  it('returns match:false and no update for unknown paths', async () => {
    const { env, rows } = makeEnv([
      { id: 'r1', from_path: '/old', to_path: '/new', status_code: 302, is_active: 1, hit_count: 0 },
    ], null);
    const response = await tryNativeSeoStore(request('/api/v1/plugins/seo/store/redirects/resolve?path=%2Fother'), env as never);
    const body = await response!.json();
    expect(body.data).toEqual({ match: false });
    expect(rows[0]!.hit_count).toBe(0);
  });

  it('rejects resolve paths without a leading slash', async () => {
    const { env } = makeEnv([], null);
    const response = await tryNativeSeoStore(request('/api/v1/plugins/seo/store/redirects/resolve?path=old'), env as never);
    expect(response?.status).toBe(400);
  });

  it('builds sitemap items from the products snapshot (items envelope)', async () => {
    const payload = JSON.stringify({
      success: true,
      data: {
        items: [
          { id: 'p1', isActive: true, sourceUpdatedAt: '2026-08-24 10:13:56' },
          { id: 'p2', isActive: false, sourceUpdatedAt: '2026-08-24 10:13:56' },
          { id: 'p3', sourceUpdatedAt: '2026-09-01T00:00:00.000Z' },
          { id: '', sourceUpdatedAt: '2026-09-01' },
        ],
      },
    });
    const { env } = makeEnv([], payload);
    const response = await tryNativeSeoStore(request('/api/v1/plugins/seo/store/sitemap'), env as never);
    const body = await response!.json();
    expect(body.data.items).toEqual([
      { id: 'p1', lastmod: '2026-08-24T10:13:56Z' },
      { id: 'p3', lastmod: '2026-09-01T00:00:00.000Z' },
    ]);
    expect(body.data.truncated).toBe(false);
  });

  it('builds sitemap items from a bare array snapshot envelope', async () => {
    const payload = JSON.stringify({
      success: true,
      data: [{ id: 'p1', isActive: true, sourceUpdatedAt: '2026-08-24 10:13:56' }],
    });
    const { env } = makeEnv([], payload);
    const response = await tryNativeSeoStore(request('/api/v1/plugins/seo/store/sitemap'), env as never);
    const body = await response!.json();
    expect(body.data.items).toEqual([{ id: 'p1', lastmod: '2026-08-24T10:13:56Z' }]);
  });

  it('returns empty sitemap items when the snapshot is missing', async () => {
    const { env } = makeEnv([], null);
    const response = await tryNativeSeoStore(request('/api/v1/plugins/seo/store/sitemap'), env as never);
    const body = await response!.json();
    expect(body.data.items).toEqual([]);
    expect(body.data.truncated).toBe(false);
  });

  it('passes through a full catalog page without the truncated flag', async () => {
    const catalog = Array.from({ length: 50 }, (_, index) => ({
      id: `p${index}`,
      isActive: true,
      sourceUpdatedAt: '2026-08-24 10:13:56',
    }));
    // The cap is a module constant (5000) and not reachable at fixture
    // scale; this case pins the pass-through contract for a large page.
    const payload = JSON.stringify({ success: true, data: { items: catalog } });
    const { env } = makeEnv([], payload);
    const response = await tryNativeSeoStore(request('/api/v1/plugins/seo/store/sitemap'), env as never);
    const body = await response!.json();
    expect(body.data.items).toHaveLength(50);
    expect(body.data.truncated).toBe(false);
  });
});
