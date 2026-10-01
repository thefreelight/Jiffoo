import { authenticateNativeUser, type NativeAuthEnv } from './auth';

export interface RemoteRadarAuditEnv extends NativeAuthEnv { DB: D1Database }

export const REMOTERADAR_AUDIT_EVENT_TYPES = [
  'resume.uploaded',
  'resume.parsed',
  'resume.parse_failed',
  'resume.deleted',
  'application_pack.generated',
  'application_pack.approved',
  'application.sent',
  'application.send_failed',
] as const;

export type RemoteRadarAuditEventType = typeof REMOTERADAR_AUDIT_EVENT_TYPES[number];
export type RemoteRadarAuditResourceType = 'resume' | 'resume_document' | 'application_pack' | 'application';

const SAFE_METADATA_KEYS = new Set(['resumeId', 'versionId', 'version', 'submissionId', 'transport', 'format']);

function safeMetadata(input: Record<string, unknown> = {}): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!SAFE_METADATA_KEYS.has(key)) continue;
    if (typeof value === 'string' && value.length <= 160) result[key] = value;
    else if (typeof value === 'number' && Number.isSafeInteger(value)) result[key] = value;
    else if (typeof value === 'boolean') result[key] = value;
  }
  return result;
}

export async function recordRemoteRadarAuditEvent(
  env: RemoteRadarAuditEnv,
  event: {
    userId: string;
    eventType: RemoteRadarAuditEventType;
    resourceType: RemoteRadarAuditResourceType;
    resourceId: string;
    metadata?: Record<string, unknown>;
    createdAt?: string;
  },
): Promise<void> {
  await env.DB.prepare(`INSERT INTO remoteradar_audit_events
    (id, user_id, event_type, resource_type, resource_id, metadata, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`)
    .bind(crypto.randomUUID(), event.userId, event.eventType, event.resourceType, event.resourceId,
      JSON.stringify(safeMetadata(event.metadata)), event.createdAt ?? new Date().toISOString()).run();
}

function response(data: unknown, status = 200): Response {
  return Response.json({ success: status < 400, ...(status < 400 ? { data } : { error: data }) }, {
    status,
    headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-d1-remoteradar-audit' },
  });
}

function parseMetadata(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? safeMetadata(parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function tryNativeRemoteRadarAudit(request: Request, env: RemoteRadarAuditEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const path = '/api/v1/plugins/remoteradar-applications/store/audit-events';
  if (url.pathname !== path) return null;
  if (request.method !== 'GET') return response({ code: 'METHOD_NOT_ALLOWED', message: 'Only GET is supported' }, 405);
  const current = await authenticateNativeUser(request, env);
  if (!current) return response({ code: 'UNAUTHORIZED', message: 'Login required' }, 401);

  const requestedLimit = Number(url.searchParams.get('limit') ?? '50');
  const limit = Number.isSafeInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;
  const cursor = url.searchParams.get('cursor');
  const rows = cursor
    ? await env.DB.prepare(`SELECT id, event_type, resource_type, resource_id, metadata, created_at
        FROM remoteradar_audit_events WHERE user_id = ?1 AND (created_at < ?2 OR (created_at = ?2 AND id < ?3))
        ORDER BY created_at DESC, id DESC LIMIT ?4`).bind(current.id, cursor.split('|', 2)[0] ?? '', cursor.split('|', 2)[1] ?? '', limit + 1).all<Record<string, unknown>>()
    : await env.DB.prepare(`SELECT id, event_type, resource_type, resource_id, metadata, created_at
        FROM remoteradar_audit_events WHERE user_id = ?1 ORDER BY created_at DESC, id DESC LIMIT ?2`)
      .bind(current.id, limit + 1).all<Record<string, unknown>>();
  const hasMore = rows.results.length > limit;
  const items = rows.results.slice(0, limit).map((row) => ({
    id: row.id,
    eventType: row.event_type,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    metadata: parseMetadata(row.metadata),
    createdAt: row.created_at,
  }));
  const last = items.at(-1);
  return response({ items, nextCursor: hasMore && last ? `${last.createdAt}|${last.id}` : null });
}
