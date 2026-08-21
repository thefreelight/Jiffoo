import { snapshotKey } from './snapshot-key';

interface SnapshotImportEnv {
  DB: D1Database;
  CACHE: KVNamespace;
  SNAPSHOT_IMPORT_TOKEN?: SecretsStoreSecret | string;
}

interface SnapshotImportRecord {
  path: string;
  payload: unknown;
  statusCode?: number;
  contentType?: string;
}

interface ValidatedSnapshot {
  path: string;
  key: string;
  payload: string;
  statusCode: number;
  contentType: string;
}

const MAX_IMPORT_BYTES = 1_500_000;
const PRODUCT_PATH = /^\/api\/v1\/products(?:\/[^/?]+)?(?:\?[^#]*)?$/;
const THEME_PATH = /^\/api\/v1\/themes\/active(?:\?target=(?:shop|admin))?$/;
const STORE_PATH = /^\/api\/v1\/store(?:\/context)?$/;

function constantTimeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

async function tokenValue(binding: SnapshotImportEnv['SNAPSHOT_IMPORT_TOKEN']): Promise<string> {
  if (!binding) return '';
  return typeof binding === 'string' ? binding : binding.get();
}

export function isAllowedSnapshotPath(path: string): boolean {
  return PRODUCT_PATH.test(path) || THEME_PATH.test(path) || STORE_PATH.test(path);
}

export async function importSnapshots(request: Request, env: SnapshotImportEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== '/api/v1/internal/snapshots/import') return null;
  if (request.method !== 'POST') return Response.json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
  const expected = await tokenValue(env.SNAPSHOT_IMPORT_TOKEN);
  const supplied = request.headers.get('x-jiffoo-snapshot-import-token') ?? '';
  if (!expected || !constantTimeEqual(supplied, expected)) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (contentLength > MAX_IMPORT_BYTES) return Response.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });

  let body: { snapshots?: SnapshotImportRecord[] };
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_IMPORT_BYTES) return Response.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
    body = JSON.parse(raw) as { snapshots?: SnapshotImportRecord[] };
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
  }
  if (!Array.isArray(body.snapshots) || body.snapshots.length < 1 || body.snapshots.length > 100) {
    return Response.json({ error: 'INVALID_SNAPSHOTS' }, { status: 400 });
  }

  const validated: ValidatedSnapshot[] = [];
  for (const record of body.snapshots) {
    if (!record || typeof record.path !== 'string' || !isAllowedSnapshotPath(record.path)) {
      return Response.json({ error: 'INVALID_SNAPSHOT_PATH' }, { status: 400 });
    }
    const statusCode = record.statusCode ?? 200;
    if (!Number.isInteger(statusCode) || statusCode < 200 || statusCode >= 300) {
      return Response.json({ error: 'INVALID_SNAPSHOT_STATUS' }, { status: 400 });
    }
    const payload = typeof record.payload === 'string' ? record.payload : JSON.stringify(record.payload);
    try { JSON.parse(payload); } catch { return Response.json({ error: 'INVALID_SNAPSHOT_PAYLOAD' }, { status: 400 }); }
    const contentType = record.contentType ?? 'application/json; charset=utf-8';
    if (!contentType.toLowerCase().includes('application/json')) {
      return Response.json({ error: 'INVALID_SNAPSHOT_CONTENT_TYPE' }, { status: 400 });
    }
    validated.push({
      path: record.path,
      key: snapshotKey(new URL(record.path, 'https://native.invalid')),
      payload,
      statusCode,
      contentType,
    });
  }

  await env.DB.batch(validated.map((record) => env.DB.prepare(
      `INSERT INTO core_api_snapshots
        (cache_key, request_path, payload, status_code, content_type, source_updated_at, refreshed_at)
       VALUES (?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload,
         status_code = excluded.status_code, content_type = excluded.content_type,
         source_updated_at = excluded.source_updated_at, refreshed_at = CURRENT_TIMESTAMP`,
    ).bind(record.key, record.path, record.payload, record.statusCode, record.contentType)));
  await Promise.all(validated.map((record) => env.CACHE.put(
    record.key,
    JSON.stringify({ payload: record.payload, status_code: record.statusCode, content_type: record.contentType }),
    { expirationTtl: 120 },
  )));
  return Response.json({ success: true, imported: validated.map((record) => record.path) }, { status: 200 });
}
