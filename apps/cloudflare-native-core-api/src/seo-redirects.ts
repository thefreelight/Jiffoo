import { authenticateNativeAdmin, type NativeAuthEnv } from './auth';

/**
 * Native SEO redirects for Cloudflare-native instances.
 *
 * Mirrors the Node api core/seo RedirectService contract (Prisma SeoRedirect)
 * on D1: list with isActive/search filters, create with path validation and
 * unique fromPath, update, delete, and a runtime lookup used by the request
 * pipeline so configured redirects actually take effect on native deployments.
 */

type SeoEnv = NativeAuthEnv;

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

const RUNTIME = 'cloudflare-native-d1-seo-redirects';
const ALLOWED_STATUS_CODES = new Set([301, 302, 307, 308]);

function json(data: unknown, status = 200, message?: string): Response {
  return Response.json(
    { success: true, data, ...(message ? { message } : {}) },
    { status, headers: { 'x-jiffoo-runtime': RUNTIME, 'cache-control': 'no-store' } },
  );
}

function fail(code: string, message: string, status: number): Response {
  return Response.json(
    { success: false, error: { code, message } },
    { status, headers: { 'x-jiffoo-runtime': RUNTIME, 'cache-control': 'no-store' } },
  );
}

function rowView(row: RedirectRow): Record<string, unknown> {
  return {
    id: row.id,
    fromPath: row.from_path,
    toPath: row.to_path,
    statusCode: row.status_code,
    isActive: row.is_active === 1,
    hitCount: row.hit_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validFromPath(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('/') && value.length <= 2000;
}

// Node parity: toPath must start with / or be an absolute URL.
function validToPath(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2000) return false;
  if (value.startsWith('/')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function integerParam(raw: string | null, fallback: number, max: number): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 1 ? Math.min(parsed, max) : fallback;
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.clone().json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function validatePaths(body: Record<string, unknown>, env: SeoEnv, excludeId?: string): Promise<string | null> {
  if (!validFromPath(body.fromPath)) return 'fromPath must start with /';
  if (!validToPath(body.toPath)) return 'toPath must start with / or be an absolute URL';
  if (body.statusCode !== undefined && !ALLOWED_STATUS_CODES.has(Number(body.statusCode))) {
    return 'statusCode must be one of 301, 302, 307, 308';
  }
  const clash = excludeId
    ? await env.DB.prepare('SELECT id FROM native_seo_redirects WHERE from_path = ?1 AND id != ?2').bind(body.fromPath, excludeId).first()
    : await env.DB.prepare('SELECT id FROM native_seo_redirects WHERE from_path = ?1').bind(body.fromPath).first();
  if (clash) return `Redirect from path "${body.fromPath}" already exists`;
  return null;
}

async function list(env: SeoEnv, url: URL): Promise<Response> {
  const page = integerParam(url.searchParams.get('page'), 1, 1_000_000);
  const limit = integerParam(url.searchParams.get('limit'), 10, 100);
  const clauses = ['1 = 1'];
  const bindings: unknown[] = [];
  const isActive = url.searchParams.get('isActive');
  if (isActive === 'true' || isActive === 'false') {
    clauses.push(`is_active = ${isActive === 'true' ? 1 : 0}`);
  }
  const search = url.searchParams.get('search')?.trim();
  if (search) {
    bindings.push(`%${search.toLowerCase()}%`);
    clauses.push(`(lower(from_path) LIKE ?${bindings.length} OR lower(to_path) LIKE ?${bindings.length})`);
  }
  const where = clauses.join(' AND ');
  const total = await env.DB.prepare(`SELECT count(*) AS n FROM native_seo_redirects WHERE ${where}`).bind(...bindings).first<{ n: number }>();
  const rows = await env.DB.prepare(
    `SELECT * FROM native_seo_redirects WHERE ${where} ORDER BY created_at DESC LIMIT ?${bindings.length + 1} OFFSET ?${bindings.length + 2}`,
  ).bind(...bindings, limit, (page - 1) * limit).all<RedirectRow>();
  const count = Number(total?.n ?? 0);
  return json({
    items: (rows.results ?? []).map(rowView),
    page,
    limit,
    total: count,
    totalPages: Math.ceil(count / limit),
  });
}

async function create(env: SeoEnv, body: Record<string, unknown>): Promise<Response> {
  const invalid = await validatePaths(body, env);
  if (invalid) {
    const status = invalid.includes('already exists') ? 409 : 400;
    return fail(status === 409 ? 'CONFLICT' : 'BAD_REQUEST', invalid, status);
  }
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO native_seo_redirects (id, from_path, to_path, status_code, is_active, hit_count, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, ?6)`,
  ).bind(
    id, body.fromPath, body.toPath,
    body.statusCode === undefined ? 301 : Number(body.statusCode),
    body.isActive === false ? 0 : 1, now,
  ).run();
  const row = await env.DB.prepare('SELECT * FROM native_seo_redirects WHERE id = ?1').bind(id).first<RedirectRow>();
  return json(rowView(row!), 201, 'Redirect created successfully');
}

async function update(env: SeoEnv, id: string, body: Record<string, unknown>): Promise<Response> {
  const existing = await env.DB.prepare('SELECT * FROM native_seo_redirects WHERE id = ?1').bind(id).first<RedirectRow>();
  if (!existing) return fail('NOT_FOUND', 'Redirect not found', 404);
  const nextFrom = validFromPath(body.fromPath) ? body.fromPath : existing.from_path;
  const nextTo = validToPath(body.toPath) ? body.toPath : existing.to_path;
  const invalid = await validatePaths({ fromPath: nextFrom, toPath: nextTo, statusCode: body.statusCode }, env, id);
  if (invalid) {
    const status = invalid.includes('already exists') ? 409 : 400;
    return fail(status === 409 ? 'CONFLICT' : 'BAD_REQUEST', invalid, status);
  }
  await env.DB.prepare(
    `UPDATE native_seo_redirects
     SET from_path = ?1, to_path = ?2, status_code = ?3, is_active = ?4, updated_at = ?5
     WHERE id = ?6`,
  ).bind(
    nextFrom, nextTo,
    body.statusCode === undefined ? existing.status_code : Number(body.statusCode),
    body.isActive === undefined ? existing.is_active : (body.isActive ? 1 : 0),
    new Date().toISOString(), id,
  ).run();
  const row = await env.DB.prepare('SELECT * FROM native_seo_redirects WHERE id = ?1').bind(id).first<RedirectRow>();
  return json(rowView(row!), 200, 'Redirect updated successfully');
}

async function remove(env: SeoEnv, id: string): Promise<Response> {
  const existing = await env.DB.prepare('SELECT id FROM native_seo_redirects WHERE id = ?1').bind(id).first();
  if (!existing) return fail('NOT_FOUND', 'Redirect not found', 404);
  await env.DB.prepare('DELETE FROM native_seo_redirects WHERE id = ?1').bind(id).run();
  return json({ message: 'Redirect deleted successfully' });
}

export async function tryNativeSeoRedirects(request: Request, env: SeoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/v1/seo/redirects')) return null;
  const admin = await authenticateNativeAdmin(request, env);
  if (!admin) return fail('UNAUTHORIZED', 'Administrator authentication is required', 401);

  const rest = url.pathname.slice('/api/v1/seo/redirects'.length);
  const detail = rest.match(/^\/([^/]+)$/);
  try {
    if (rest === '' && request.method === 'GET') return await list(env, url);
    if (rest === '' && request.method === 'POST') return await create(env, await readBody(request));
    if (detail && request.method === 'GET') {
      const row = await env.DB.prepare('SELECT * FROM native_seo_redirects WHERE id = ?1').bind(decodeURIComponent(detail[1]!)).first<RedirectRow>();
      return row ? json(rowView(row)) : fail('NOT_FOUND', 'Redirect not found', 404);
    }
    if (detail && request.method === 'PUT') return await update(env, decodeURIComponent(detail[1]!), await readBody(request));
    if (detail && request.method === 'DELETE') return await remove(env, decodeURIComponent(detail[1]!));
    return fail('METHOD_NOT_ALLOWED', 'Method not allowed', 405);
  } catch (error) {
    return fail('INTERNAL_SERVER_ERROR', error instanceof Error ? error.message : 'SEO redirect operation failed', 500);
  }
}
