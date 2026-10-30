import { authenticateNativeAdmin, authenticateNativeUser, type NativeAuthEnv } from './auth';
import { failure, success } from './checkout';

export interface BokmooNotificationsEnv extends NativeAuthEnv { DB: D1Database }

interface StoredNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  metadata_json: string | null;
  read_at: string | null;
  created_at: string;
}

const ALLOWED_TYPES = new Set(['announcement', 'order', 'logistics', 'system']);

function publicNotification(row: StoredNotification) {
  let metadata: Record<string, unknown> = {};
  if (row.metadata_json) {
    try { metadata = JSON.parse(row.metadata_json) as Record<string, unknown>; } catch { metadata = {}; }
  }
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    metadata,
    read: row.read_at !== null,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

function page(request: Request): { limit: number; offset: number } {
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 20, 1), 50);
  const page = Math.max(Number(url.searchParams.get('page')) || 1, 1);
  return { limit, offset: (page - 1) * limit };
}

export async function tryNativeBokmooNotifications(request: Request, env: BokmooNotificationsEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const matches = path === '/api/v1/me/notifications' || path.startsWith('/api/v1/me/notifications/')
    || path === '/api/v1/admin/notifications'
    || path === '/api/notifications' || path.startsWith('/api/notifications/');
  if (!matches) return null;
  // The apps call the short alias; normalize before dispatch.
  const normalized = path.replace(/^\/api\/notifications/, '/api/v1/me/notifications');
  const adminPath = path === '/api/v1/admin/notifications';

  if (adminPath) {
    const admin = await authenticateNativeAdmin(request, env);
    if (!admin) return failure(401, 'UNAUTHORIZED', 'Admin login required');
    if (request.method === 'POST') {
      const body = await request.json<unknown>().catch(() => null);
      const payload = (body ?? {}) as Record<string, unknown>;
      const userId = typeof payload.userId === 'string' ? payload.userId.trim() : '';
      const title = typeof payload.title === 'string' ? payload.title.trim() : '';
      const text = typeof payload.body === 'string' ? payload.body.trim() : '';
      if (!userId || !title || !text) {
        return failure(400, 'VALIDATION_ERROR', 'userId, title and body are required');
      }
      const type = typeof payload.type === 'string' && ALLOWED_TYPES.has(payload.type)
        ? payload.type : 'announcement';
      if (typeof payload.type === 'string' && !ALLOWED_TYPES.has(payload.type)) {
        return failure(400, 'VALIDATION_ERROR', 'type must be one of announcement, order, logistics, system');
      }
      if (title.length > 120 || text.length > 2000) {
        return failure(400, 'VALIDATION_ERROR', 'title or body exceeds the length limit');
      }
      const metadata = payload.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata)
        ? JSON.stringify(payload.metadata) : null;
      const id = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO native_bokmoo_notifications (id, user_id, type, title, body, metadata_json, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
      ).bind(id, userId, type, title, text, metadata, new Date().toISOString()).run();
      const row = await env.DB.prepare(
        'SELECT * FROM native_bokmoo_notifications WHERE id = ?1',
      ).bind(id).first<StoredNotification>();
      return Response.json({ success: true, data: row ? publicNotification(row) : null });
    }
    if (request.method === 'GET') {
      const { limit, offset } = page(request);
      const result = await env.DB.prepare(
        `SELECT * FROM native_bokmoo_notifications ORDER BY created_at DESC LIMIT ?1 OFFSET ?2`,
      ).bind(limit, offset).all<StoredNotification>();
      const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM native_bokmoo_notifications').first<{ n: number }>();
      return success({ items: (result.results ?? []).map(publicNotification), total: count?.n ?? 0 });
    }
    return failure(405, 'METHOD_NOT_ALLOWED', 'Unsupported method');
  }

  const user = await authenticateNativeUser(request, env);
  if (!user) return failure(401, 'UNAUTHORIZED', 'Login required');

  if (normalized === '/api/v1/me/notifications' && request.method === 'GET') {
    const { limit, offset } = page(request);
    const result = await env.DB.prepare(
      `SELECT * FROM native_bokmoo_notifications WHERE user_id = ?1
       ORDER BY created_at DESC LIMIT ?2 OFFSET ?3`,
    ).bind(user.id, limit, offset).all<StoredNotification>();
    const total = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM native_bokmoo_notifications WHERE user_id = ?1',
    ).bind(user.id).first<{ n: number }>();
    const unread = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM native_bokmoo_notifications WHERE user_id = ?1 AND read_at IS NULL',
    ).bind(user.id).first<{ n: number }>();
    return success({
      items: (result.results ?? []).map(publicNotification),
      total: total?.n ?? 0,
      unread: unread?.n ?? 0,
    });
  }

  if (normalized === '/api/v1/me/notifications/read-all' && request.method === 'POST') {
    await env.DB.prepare(
      'UPDATE native_bokmoo_notifications SET read_at = ?1 WHERE user_id = ?2 AND read_at IS NULL',
    ).bind(new Date().toISOString(), user.id).run();
    return success({ read: 'all' });
  }

  const readMatch = normalized.match(/^\/api\/v1\/me\/notifications\/([^/]+)\/read$/);
  if (readMatch && request.method === 'POST') {
    const result = await env.DB.prepare(
      'UPDATE native_bokmoo_notifications SET read_at = ?1 WHERE id = ?2 AND user_id = ?3 AND read_at IS NULL',
    ).bind(new Date().toISOString(), readMatch[1], user.id).run();
    if (!result.meta.changes) return failure(404, 'NOT_FOUND', 'Notification not found');
    return success({ read: readMatch[1] });
  }

  return failure(404, 'NOT_FOUND', 'Unknown notifications route');
}
