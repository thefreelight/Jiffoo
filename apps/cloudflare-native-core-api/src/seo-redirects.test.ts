import { beforeEach, describe, expect, it, vi } from 'vitest';

const authenticateNativeAdmin = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeAdmin }));

const { tryNativeSeoRedirects } = await import('./seo-redirects');

interface RedirectRow {
  id: string;
  from_path: string;
  to_path: string;
  status_code: number;
  is_active: number;
  hit_count: number;
  created_at: string;
  updated_at: string;
}

function store() {
  const rows: RedirectRow[] = [];
  const env = {
    DB: {
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => ({
          first: async () => {
            if (sql.includes('WHERE from_path = ?1 AND id != ?2')) {
              return rows.find((r) => r.from_path === args[0] && r.id !== args[1]) ?? null;
            }
            if (sql.includes('WHERE from_path = ?1 AND is_active = 1')) {
              return rows.find((r) => r.from_path === args[0] && r.is_active === 1) ?? null;
            }
            if (sql.includes('WHERE from_path = ?1')) {
              return rows.find((r) => r.from_path === args[0]) ?? null;
            }
            if (sql.includes('WHERE id = ?1') && sql.includes('SELECT id FROM')) {
              return rows.find((r) => r.id === args[0]) ?? null;
            }
            if (sql.includes('WHERE id = ?1')) {
              return rows.find((r) => r.id === args[0]) ?? null;
            }
            if (sql.includes('count(*) AS n')) {
              return { n: rows.length };
            }
            return null;
          },
          all: async () => {
            if (sql.includes('ORDER BY created_at DESC LIMIT')) {
              const limit = Number(args[args.length - 2]);
              const offset = Number(args[args.length - 1]);
              return { results: [...rows].reverse().slice(offset, offset + limit) };
            }
            return { results: [] };
          },
          run: async () => {
            if (sql.includes('INSERT INTO native_seo_redirects')) {
              rows.push({
                id: String(args[0]), from_path: String(args[1]), to_path: String(args[2]),
                status_code: Number(args[3]), is_active: Number(args[4]), hit_count: 0,
                created_at: String(args[5]), updated_at: String(args[5]),
              });
            }
            if (sql.includes('UPDATE native_seo_redirects') && sql.includes('from_path = ?1')) {
              const row = rows.find((r) => r.id === args[5]);
              if (row) {
                row.from_path = String(args[0]); row.to_path = String(args[1]);
                row.status_code = Number(args[2]); row.is_active = Number(args[3]); row.updated_at = String(args[4]);
              }
            }
            if (sql.includes('hit_count + 1')) {
              const row = rows.find((r) => r.id === args[0]);
              if (row) row.hit_count += 1;
            }
            if (sql.includes('DELETE FROM native_seo_redirects')) {
              const index = rows.findIndex((r) => r.id === args[0]);
              if (index >= 0) rows.splice(index, 1);
            }
            return { success: true, meta: { changes: 1 } };
          },
        }),
      }),
    },
  };
  return { env: env as never, rows };
}

function request(path: string, init?: RequestInit): Request {
  return new Request(`https://api.example${path}`, init);
}

function jsonBody(value: unknown): RequestInit {
  return { headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) };
}

async function create(env: never, body: Record<string, unknown>): Promise<Response> {
  return (await tryNativeSeoRedirects(request('/api/v1/seo/redirects', { method: 'POST', ...jsonBody(body) }), env))!;
}

describe('native seo redirects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
  });

  it('requires an administrator session', async () => {
    authenticateNativeAdmin.mockResolvedValue(null);
    const { env } = store();
    const response = await tryNativeSeoRedirects(request('/api/v1/seo/redirects'), env);
    expect(response?.status).toBe(401);
  });

  it('ignores unrelated paths', async () => {
    const { env } = store();
    expect(await tryNativeSeoRedirects(request('/api/v1/admin/orders'), env)).toBeNull();
  });

  it('creates, lists, and returns the PageResult shape', async () => {
    const { env, rows } = store();
    const created = await create(env as never, { fromPath: '/old-page', toPath: '/new-page', statusCode: 302 });
    expect(created.status).toBe(201);
    await expect(created.json()).resolves.toMatchObject({ data: { fromPath: '/old-page', toPath: '/new-page', statusCode: 302, isActive: true, hitCount: 0 } });
    const list = await tryNativeSeoRedirects(request('/api/v1/seo/redirects?page=1&limit=10'), env as never);
    const payload = await list!.json() as { data: { items: unknown[]; total: number; totalPages: number } };
    expect(payload.data.total).toBe(1);
    expect(payload.data.items.length).toBe(1);
    expect(rows.length).toBe(1);
  });

  it('validates paths and status codes', async () => {
    const { env } = store();
    const badFrom = await create(env as never, { fromPath: 'old', toPath: '/new' });
    expect(badFrom.status).toBe(400);
    await expect(badFrom.json()).resolves.toMatchObject({ error: { message: 'fromPath must start with /' } });
    const badTo = await create(env as never, { fromPath: '/a', toPath: 'javascript:alert(1)' });
    expect(badTo.status).toBe(400);
    const badStatus = await create(env as never, { fromPath: '/a', toPath: '/b', statusCode: 305 });
    expect(badStatus.status).toBe(400);
  });

  it('accepts absolute http(s) toPath', async () => {
    const { env } = store();
    const created = await create(env as never, { fromPath: '/external', toPath: 'https://example.com/target' });
    expect(created.status).toBe(201);
  });

  it('rejects duplicate fromPath with 409', async () => {
    const { env } = store();
    await create(env as never, { fromPath: '/dup', toPath: '/one' });
    const second = await create(env as never, { fromPath: '/dup', toPath: '/two' });
    expect(second.status).toBe(409);
    await expect(second.json()).resolves.toMatchObject({ error: { code: 'CONFLICT' } });
  });

  it('updates a redirect and re-checks conflicts', async () => {
    const { env, rows } = store();
    await create(env as never, { fromPath: '/a', toPath: '/b' });
    await create(env as never, { fromPath: '/c', toPath: '/d' });
    const id = rows[0]!.id;
    const updated = await tryNativeSeoRedirects(request(`/api/v1/seo/redirects/${id}`, { method: 'PUT', ...jsonBody({ isActive: false }) }), env as never);
    expect(updated?.status).toBe(200);
    await expect(updated!.json()).resolves.toMatchObject({ data: { isActive: false } });
    const clash = await tryNativeSeoRedirects(request(`/api/v1/seo/redirects/${id}`, { method: 'PUT', ...jsonBody({ fromPath: '/c' }) }), env as never);
    expect(clash?.status).toBe(409);
  });

  it('deletes and 404s missing rows', async () => {
    const { env, rows } = store();
    await create(env as never, { fromPath: '/x', toPath: '/y' });
    const id = rows[0]!.id;
    const removed = await tryNativeSeoRedirects(request(`/api/v1/seo/redirects/${id}`, { method: 'DELETE' }), env as never);
    expect(removed?.status).toBe(200);
    expect(rows.length).toBe(0);
    const missing = await tryNativeSeoRedirects(request(`/api/v1/seo/redirects/${id}`, { method: 'DELETE' }), env as never);
    expect(missing?.status).toBe(404);
  });
});
