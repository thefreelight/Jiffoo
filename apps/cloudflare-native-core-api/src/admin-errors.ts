import { authenticateNativeAdmin, type NativeAuthEnv } from './auth';

/**
 * Native error tracking for Cloudflare-native instances.
 *
 * Mirrors the Node api ErrorTrackingService contract (schema/system.prisma
 * ErrorLog) on D1: errors are grouped by a SHA-256 hash over
 * message|normalized-stack|path|statusCode, repeat occurrences bump
 * occurrence_count/last_seen_at, and the Merchant Admin Errors panel reads
 * the PageResult-shaped list the frontend hook consumes. Capture happens in
 * the Worker fetch boundary (proxy 5xx fallback + unhandled exceptions).
 */

type ErrorEnv = NativeAuthEnv;

interface ErrorLogRow {
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

export interface ErrorCaptureInput {
  message: string;
  stack?: string | null;
  path: string;
  method: string;
  statusCode: number;
  requestId?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  headers?: string | null;
  body?: string | null;
  query?: string | null;
}

const RUNTIME = 'cloudflare-native-d1-admin-errors';

function json(data: unknown, status = 200): Response {
  return Response.json({ success: true, data }, { status, headers: { 'x-jiffoo-runtime': RUNTIME, 'cache-control': 'no-store' } });
}

function fail(code: string, message: string, status: number): Response {
  return Response.json({ success: false, error: { code, message } }, { status, headers: { 'x-jiffoo-runtime': RUNTIME, 'cache-control': 'no-store' } });
}

function determineSeverity(statusCode: number): string {
  if (statusCode >= 500) return 'critical';
  if (statusCode >= 400) return 'error';
  if (statusCode >= 300) return 'warning';
  return 'info';
}

// Mirrors apps/api/src/core/error-tracking/grouping.ts: keep the message line
// plus three frames, strip :line:column, collapse absolute paths to the last
// three segments, then hash message|stack|path|statusCode.
function normalizeStack(stack: string | null | undefined): string {
  if (!stack) return '';
  return stack
    .split('\n')
    .slice(0, 4)
    .map((frame) => frame
      .replace(/:\d+:\d+/g, '')
      .replace(/\(.*?\/([^/]+\/[^/]+\/[^/]+)\)/g, '($1)'))
    .join('\n');
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function generateErrorHash(input: {
  message: string;
  stack?: string | null;
  path: string;
  statusCode: number;
}): Promise<string> {
  return sha256Hex(`${input.message}|${normalizeStack(input.stack)}|${input.path}|${input.statusCode}`);
}

function rowView(row: ErrorLogRow): Record<string, unknown> {
  return {
    id: row.id,
    errorHash: row.error_hash,
    message: row.message,
    stack: row.stack,
    requestId: row.request_id,
    userId: row.user_id,
    path: row.path,
    method: row.method,
    statusCode: row.status_code,
    userAgent: row.user_agent,
    ip: row.ip,
    headers: row.headers,
    body: row.body,
    query: row.query,
    environment: row.environment,
    occurredAt: row.occurred_at,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    occurrenceCount: row.occurrence_count,
    severity: row.severity,
    resolved: row.resolved === 1,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
  };
}

/**
 * Persist one captured error with hash grouping. Never throws: capture runs
 * from the request boundary and must not mask the original failure.
 */
export async function captureNativeError(env: ErrorEnv, input: ErrorCaptureInput): Promise<void> {
  try {
    const errorHash = await generateErrorHash(input);
    const severity = determineSeverity(input.statusCode);
    const now = new Date().toISOString();
    const existing = await env.DB.prepare(
      'SELECT id FROM native_error_logs WHERE error_hash = ?1 ORDER BY first_seen_at DESC LIMIT 1',
    ).bind(errorHash).first<{ id: string }>();
    if (existing) {
      await env.DB.prepare(
        `UPDATE native_error_logs
         SET occurrence_count = occurrence_count + 1, last_seen_at = ?1,
             stack = ?2, request_id = ?3, user_id = ?4, user_agent = ?5, ip = ?6,
             headers = ?7, body = ?8, query = ?9
         WHERE id = ?10`,
      ).bind(now, input.stack ?? null, input.requestId ?? null, null, input.userAgent ?? null, input.ip ?? null,
        input.headers ?? null, input.body ?? null, input.query ?? null, existing.id).run();
      return;
    }
    await env.DB.prepare(
      `INSERT INTO native_error_logs
        (id, error_hash, message, stack, request_id, user_id, path, method, status_code, user_agent, ip,
         headers, body, query, environment, occurred_at, first_seen_at, last_seen_at, occurrence_count, severity, resolved)
       VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, 'cloudflare-workers', ?14, ?14, ?14, 1, ?15, 0)`,
    ).bind(
      crypto.randomUUID(), errorHash, input.message.slice(0, 4000), input.stack ?? null, input.requestId ?? null,
      input.path.slice(0, 2000), input.method, input.statusCode, input.userAgent ?? null, input.ip ?? null,
      input.headers ?? null, input.body ?? null, input.query ?? null, now, severity,
    ).run();
  } catch {
    // Error capture is best-effort; storage failures must not surface to callers.
  }
}

function integerParam(raw: string | null, fallback: number, max: number): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 1 ? Math.min(parsed, max) : fallback;
}

function rangeCutoff(timeRange: string | null): string {
  const hours = timeRange === '1h' ? 1 : timeRange === '7d' ? 168 : timeRange === '30d' ? 720 : 24;
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

async function listErrors(env: ErrorEnv, url: URL): Promise<Response> {
  const page = integerParam(url.searchParams.get('page'), 1, 1_000_000);
  const limit = integerParam(url.searchParams.get('limit'), 20, 100);
  const clauses = ['1 = 1'];
  const bindings: unknown[] = [];
  const severity = url.searchParams.get('severity');
  if (severity && ['info', 'warning', 'error', 'critical'].includes(severity)) {
    bindings.push(severity);
    clauses.push(`severity = ?${bindings.length}`);
  }
  const resolved = url.searchParams.get('resolved');
  if (resolved === 'true' || resolved === 'false') {
    clauses.push(`resolved = ${resolved === 'true' ? 1 : 0}`);
  }
  const errorHash = url.searchParams.get('errorHash');
  if (errorHash) { bindings.push(errorHash); clauses.push(`error_hash = ?${bindings.length}`); }
  const search = url.searchParams.get('search')?.trim();
  if (search) {
    bindings.push(`%${search.toLowerCase()}%`);
    clauses.push(`(lower(message) LIKE ?${bindings.length} OR lower(path) LIKE ?${bindings.length})`);
  }
  const start = url.searchParams.get('startDate');
  if (start) { bindings.push(start); clauses.push(`occurred_at >= ?${bindings.length}`); }
  const end = url.searchParams.get('endDate');
  if (end) { bindings.push(end); clauses.push(`occurred_at <= ?${bindings.length}`); }
  const where = clauses.join(' AND ');

  const sortByRaw = url.searchParams.get('sortBy');
  const sortColumn = sortByRaw === 'lastSeenAt' ? 'last_seen_at'
    : sortByRaw === 'occurrenceCount' ? 'occurrence_count'
      : sortByRaw === 'statusCode' ? 'status_code'
        : 'occurred_at';
  const sortDirection = url.searchParams.get('sortOrder') === 'asc' ? 'ASC' : 'DESC';

  const total = await env.DB.prepare(`SELECT count(*) AS n FROM native_error_logs WHERE ${where}`).bind(...bindings).first<{ n: number }>();
  const rows = await env.DB.prepare(
    `SELECT * FROM native_error_logs WHERE ${where} ORDER BY ${sortColumn} ${sortDirection} LIMIT ?${bindings.length + 1} OFFSET ?${bindings.length + 2}`,
  ).bind(...bindings, limit, (page - 1) * limit).all<ErrorLogRow>();
  const count = Number(total?.n ?? 0);
  // The shared admin hook consumes the PageResult shape ({items,total}) even
  // though the Node service historically returned {errors,pagination}; the
  // native adapter returns the shape the frontend actually reads.
  return json({
    items: (rows.results ?? []).map(rowView),
    page,
    limit,
    total: count,
    totalPages: Math.ceil(count / limit),
  });
}

async function stats(env: ErrorEnv, url: URL): Promise<Response> {
  const cutoff = rangeCutoff(url.searchParams.get('timeRange'));
  const total = await env.DB.prepare('SELECT count(*) AS n FROM native_error_logs WHERE occurred_at >= ?1').bind(cutoff).first<{ n: number }>();
  const resolved = await env.DB.prepare('SELECT count(*) AS n FROM native_error_logs WHERE occurred_at >= ?1 AND resolved = 1').bind(cutoff).first<{ n: number }>();
  const severityRows = await env.DB.prepare(
    'SELECT severity, count(*) AS n FROM native_error_logs WHERE occurred_at >= ?1 GROUP BY severity',
  ).bind(cutoff).all<{ severity: string; n: number }>();
  const bySeverity: Record<string, number> = { info: 0, warning: 0, error: 0, critical: 0 };
  for (const row of severityRows.results ?? []) bySeverity[row.severity] = Number(row.n);
  const totalN = Number(total?.n ?? 0);
  const resolvedN = Number(resolved?.n ?? 0);
  const topRows = await env.DB.prepare(
    'SELECT error_hash, message, occurrence_count, last_seen_at FROM native_error_logs WHERE occurred_at >= ?1 ORDER BY occurrence_count DESC LIMIT 10',
  ).bind(cutoff).all<{ error_hash: string; message: string; occurrence_count: number; last_seen_at: string }>();
  const trendRows = await env.DB.prepare(
    `SELECT substr(occurred_at, 1, 10) AS date, count(*) AS n FROM native_error_logs WHERE occurred_at >= ?1 GROUP BY date ORDER BY date ASC`,
  ).bind(cutoff).all<{ date: string; n: number }>();
  return json({
    total: totalN,
    byStatus: { resolved: resolvedN, unresolved: totalN - resolvedN },
    bySeverity,
    topErrors: (topRows.results ?? []).map((row) => ({
      errorHash: row.error_hash,
      message: row.message,
      count: Number(row.occurrence_count),
      lastSeenAt: row.last_seen_at,
    })),
    recentTrend: (trendRows.results ?? []).map((row) => ({ date: row.date, count: Number(row.n) })),
  });
}

async function trends(env: ErrorEnv, url: URL): Promise<Response> {
  const cutoff = rangeCutoff(url.searchParams.get('timeRange'));
  const rows = await env.DB.prepare(
    `SELECT substr(occurred_at, 1, 10) AS date, count(*) AS n FROM native_error_logs WHERE occurred_at >= ?1 GROUP BY date ORDER BY date ASC`,
  ).bind(cutoff).all<{ date: string; n: number }>();
  return json({
    timeRange: url.searchParams.get('timeRange') || '24h',
    points: (rows.results ?? []).map((row) => ({ date: row.date, count: Number(row.n) })),
  });
}

async function resolveError(env: ErrorEnv, id: string, adminId: string, body: Record<string, unknown>): Promise<Response> {
  const existing = await env.DB.prepare('SELECT * FROM native_error_logs WHERE id = ?1').bind(id).first<ErrorLogRow>();
  if (!existing) return fail('NOT_FOUND', 'Error log not found', 404);
  const resolved = body.resolved !== false;
  const now = new Date().toISOString();
  await env.DB.prepare(
    'UPDATE native_error_logs SET resolved = ?1, resolved_at = ?2, resolved_by = ?3 WHERE id = ?4',
  ).bind(resolved ? 1 : 0, resolved ? now : null, resolved ? adminId : null, id).run();
  const updated = await env.DB.prepare('SELECT * FROM native_error_logs WHERE id = ?1').bind(id).first<ErrorLogRow>();
  return json(rowView(updated!));
}

export async function tryNativeAdminErrors(request: Request, env: ErrorEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/v1/admin/errors')) return null;
  const admin = await authenticateNativeAdmin(request, env);
  if (!admin) return fail('UNAUTHORIZED', 'Administrator authentication is required', 401);

  const rest = url.pathname.slice('/api/v1/admin/errors'.length);
  try {
    if (request.method === 'GET' && (rest === '' || rest === '/')) return await listErrors(env, url);
    if (request.method === 'GET' && rest === '/stats') return await stats(env, url);
    if (request.method === 'GET' && rest === '/trends') return await trends(env, url);
    const detail = rest.match(/^\/([^/]+)$/);
    if (detail && request.method === 'GET') {
      const row = await env.DB.prepare('SELECT * FROM native_error_logs WHERE id = ?1').bind(decodeURIComponent(detail[1]!)).first<ErrorLogRow>();
      return row ? json(rowView(row)) : fail('NOT_FOUND', 'Error log not found', 404);
    }
    const resolve = rest.match(/^\/([^/]+)\/resolve$/);
    if (resolve && request.method === 'PATCH') {
      const body = await request.clone().json<Record<string, unknown>>().catch(() => ({}));
      return await resolveError(env, decodeURIComponent(resolve[1]!), admin.id, body);
    }
    return fail('METHOD_NOT_ALLOWED', 'Method not allowed', 405);
  } catch (error) {
    return fail('INTERNAL_SERVER_ERROR', error instanceof Error ? error.message : 'Error tracking failed', 500);
  }
}
