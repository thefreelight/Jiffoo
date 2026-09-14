import { beforeEach, describe, expect, it, vi } from 'vitest';

const authenticateNativeAdmin = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeAdmin }));

const { captureNativeError, generateErrorHash, tryNativeAdminErrors } = await import('./admin-errors');

interface Row extends Record<string, unknown> {
  id: string;
  error_hash: string;
  message: string;
  stack: string | null;
  request_id: string | null;
  user_id: string | null;
  path: string;
  method: string;
  status_code: number;
  user_agent: string | null;
  ip: string | null;
  headers: string | null;
  body: string | null;
  query: string | null;
  environment: string;
  occurred_at: string;
  first_seen_at: string;
  last_seen_at: string;
  occurrence_count: number;
  severity: string;
  resolved: number;
  resolved_at: string | null;
  resolved_by: string | null;
}

function store() {
  const rows: Row[] = [];
  const env = {
    DB: {
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => ({
          first: async () => {
            if (sql.includes('count(*) AS n FROM native_error_logs WHERE error_hash')) {
              const match = rows.find((r) => r.error_hash === args[0]);
              return match ? { id: match.id } : null;
            }
            if (sql.includes('SELECT id FROM native_error_logs WHERE error_hash')) {
              const match = rows.find((r) => r.error_hash === args[0]);
              return match ? { id: match.id } : null;
            }
            if (sql.includes('SELECT * FROM native_error_logs WHERE id = ?1')) {
              return rows.find((r) => r.id === args[0]) ?? null;
            }
            if (sql.includes('resolved = 1')) {
              return { n: rows.filter((r) => r.resolved === 1).length };
            }
            if (sql.includes('count(*) AS n FROM native_error_logs')) {
              return { n: rows.length };
            }
            return null;
          },
          all: async () => {
            if (sql.includes('GROUP BY severity')) {
              const by: Record<string, number> = {};
              for (const r of rows) by[r.severity] = (by[r.severity] ?? 0) + 1;
              return { results: Object.entries(by).map(([severity, n]) => ({ severity, n })) };
            }
            if (sql.includes('GROUP BY date')) {
              return { results: [] };
            }
            if (sql.includes('ORDER BY occurrence_count DESC LIMIT 10')) {
              return { results: [...rows].sort((a, b) => b.occurrence_count - a.occurrence_count).slice(0, 10).map((r) => ({ error_hash: r.error_hash, message: r.message, occurrence_count: r.occurrence_count, last_seen_at: r.last_seen_at })) };
            }
            if (sql.includes('SELECT * FROM native_error_logs WHERE 1 = 1') || sql.includes('ORDER BY')) {
              const limit = Number(args[args.length - 2]);
              const offset = Number(args[args.length - 1]);
              return { results: rows.slice(offset, offset + limit) };
            }
            return { results: [] };
          },
          run: async () => {
            if (sql.includes('INSERT INTO native_error_logs')) {
              rows.push({
                id: String(args[0]), error_hash: String(args[1]), message: String(args[2]), stack: args[3] as string | null,
                request_id: args[4] as string | null, user_id: null, path: String(args[5]), method: String(args[6]),
                status_code: Number(args[7]), user_agent: args[8] as string | null, ip: args[9] as string | null,
                headers: args[10] as string | null, body: args[11] as string | null, query: args[12] as string | null,
                environment: 'cloudflare-workers', occurred_at: String(args[13]), first_seen_at: String(args[13]),
                last_seen_at: String(args[13]), occurrence_count: 1, severity: String(args[14]), resolved: 0,
                resolved_at: null, resolved_by: null,
              });
            }
            if (sql.includes('occurrence_count + 1')) {
              const row = rows.find((r) => r.id === args[9]);
              if (row) { row.occurrence_count += 1; row.last_seen_at = String(args[0]); }
            }
            if (sql.includes('UPDATE native_error_logs SET resolved')) {
              const row = rows.find((r) => r.id === args[3]);
              if (row) { row.resolved = Number(args[0]); row.resolved_at = args[1] as string | null; row.resolved_by = args[2] as string | null; }
            }
            return { success: true, meta: { changes: 1 } };
          },
        }),
      }),
    },
  };
  return { env: env as never, rows };
}

async function seed(env: never, count: number, statusCode = 500) {
  for (let i = 0; i < count; i += 1) {
    await captureNativeError(env, {
      message: `boom ${i}`,
      path: `/api/v1/jobs`,
      method: 'GET',
      statusCode,
    });
  }
}

describe('native error tracking', () => {
  beforeEach(() => vi.clearAllMocks());

  it('groups repeat occurrences by hash instead of inserting duplicates', async () => {
    const { env, rows } = store();
    await captureNativeError(env, { message: 'db down', path: '/api/v1/orders', method: 'POST', statusCode: 500 });
    await captureNativeError(env, { message: 'db down', path: '/api/v1/orders', method: 'POST', statusCode: 500 });
    expect(rows.length).toBe(1);
    expect(rows[0]!.occurrence_count).toBe(2);
    expect(rows[0]!.severity).toBe('critical');
  });

  it('derives severity from the status code', async () => {
    const { env, rows } = store();
    await captureNativeError(env, { message: 'not found', path: '/x', method: 'GET', statusCode: 404 });
    await captureNativeError(env, { message: 'redirect', path: '/y', method: 'GET', statusCode: 302 });
    expect(rows.find((r) => r.message === 'not found')!.severity).toBe('error');
    expect(rows.find((r) => r.message === 'redirect')!.severity).toBe('warning');
  });

  it('hash ignores line/column numbers and absolute path prefixes', async () => {
    // Node's grouping keeps the last three path segments, so two stacks that
    // differ only in line numbers and deeper prefixes must collide.
    const a = await generateErrorHash({ message: 'x', stack: 'Error: x\n  at f (/abs/deep/a/b/c/file.js:12:3)', path: '/p', statusCode: 500 });
    const b = await generateErrorHash({ message: 'x', stack: 'Error: x\n  at f (/other/a/b/c/file.js:99:1)', path: '/p', statusCode: 500 });
    expect(a).toBe(b);
  });

  it('requires an administrator session', async () => {
    authenticateNativeAdmin.mockResolvedValue(null);
    const { env } = store();
    const response = await tryNativeAdminErrors(new Request('https://api.example/api/v1/admin/errors'), env);
    expect(response?.status).toBe(401);
  });

  it('lists errors in the PageResult shape the admin hook consumes', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    const { env } = store();
    await seed(env as never, 3);
    const response = await tryNativeAdminErrors(new Request('https://api.example/api/v1/admin/errors?page=1&limit=10'), env);
    expect(response?.status).toBe(200);
    const payload = await response!.json() as { data: { items: unknown[]; total: number; totalPages: number } };
    expect(payload.data.items.length).toBe(3);
    expect(payload.data.total).toBe(3);
    expect(payload.data.totalPages).toBe(1);
  });

  it('reports stats with bySeverity, byStatus, and topErrors', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    const { env } = store();
    await seed(env as never, 2, 500);
    await seed(env as never, 1, 404);
    const response = await tryNativeAdminErrors(new Request('https://api.example/api/v1/admin/errors/stats'), env);
    const payload = await response!.json() as { data: { total: number; byStatus: { resolved: number; unresolved: number }; bySeverity: Record<string, number>; topErrors: unknown[] } };
    expect(payload.data.total).toBe(3);
    expect(payload.data.bySeverity.critical).toBe(2);
    expect(payload.data.bySeverity.error).toBe(1);
    expect(payload.data.byStatus.unresolved).toBe(3);
    expect(payload.data.topErrors.length).toBeGreaterThan(0);
  });

  it('resolves and unresolves an error with admin attribution', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    const { env, rows } = store();
    await captureNativeError(env, { message: 'boom', path: '/p', method: 'GET', statusCode: 500 });
    const id = rows[0]!.id;
    const resolved = await tryNativeAdminErrors(new Request(`https://api.example/api/v1/admin/errors/${id}/resolve`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ resolved: true }) }), env);
    expect(resolved?.status).toBe(200);
    await expect(resolved!.json()).resolves.toMatchObject({ data: { resolved: true, resolvedBy: 'admin-1' } });
    const unresolved = await tryNativeAdminErrors(new Request(`https://api.example/api/v1/admin/errors/${id}/resolve`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ resolved: false }) }), env);
    await expect(unresolved!.json()).resolves.toMatchObject({ data: { resolved: false, resolvedBy: null } });
  });

  it('returns 404 for unknown detail and ignores unrelated paths', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    const { env } = store();
    const missing = await tryNativeAdminErrors(new Request('https://api.example/api/v1/admin/errors/nope'), env);
    expect(missing?.status).toBe(404);
    expect(await tryNativeAdminErrors(new Request('https://api.example/api/v1/admin/orders'), env)).toBeNull();
  });
});
