import { authenticateNativeAdmin, type NativeAuthEnv } from './auth';

interface AdminWebhookEnv extends NativeAuthEnv { DB: D1Database }

interface SubscriptionRow {
  id: string;
  installation_id: string;
  event_type: string;
  endpoint_url: string;
  secret: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

function response(data: unknown, status = 200): Response {
  return Response.json({ success: true, data }, {
    status,
    headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-webhooks' },
  });
}

function error(status: number, code: string, message: string): Response {
  return Response.json({ success: false, error: { code, message } }, {
    status,
    headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-webhooks' },
  });
}

function mapSubscription(row: SubscriptionRow) {
  return {
    id: row.id,
    installationId: row.installation_id,
    eventType: row.event_type,
    deliveryMode: 'external',
    endpointUrl: row.endpoint_url,
    secret: row.secret,
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

async function body(request: Request): Promise<Record<string, unknown> | null> {
  return request.json<Record<string, unknown>>().catch(() => null);
}

export async function tryNativeAdminWebhooks(request: Request, env: AdminWebhookEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/v1/admin/webhooks/')) return null;
  const admin = await authenticateNativeAdmin(request, env);
  if (!admin) return error(401, 'UNAUTHORIZED', 'Admin authentication required');

  const subscriptionMatch = url.pathname.match(/^\/api\/v1\/admin\/webhooks\/subscriptions(?:\/([^/]+))?$/);
  if (subscriptionMatch) {
    const id = subscriptionMatch[1];
    if (request.method === 'GET') {
      if (id) {
        const row = await env.DB.prepare('SELECT * FROM native_webhook_subscriptions WHERE id = ?1').bind(id).first<SubscriptionRow>();
        return row ? response(mapSubscription(row)) : error(404, 'NOT_FOUND', 'Webhook subscription not found');
      }
      const installationId = url.searchParams.get('installationId');
      const query = installationId
        ? env.DB.prepare('SELECT * FROM native_webhook_subscriptions WHERE installation_id = ?1 ORDER BY created_at DESC').bind(installationId)
        : env.DB.prepare('SELECT * FROM native_webhook_subscriptions ORDER BY created_at DESC');
      const rows = await query.all<SubscriptionRow>();
      return response(rows.results.map(mapSubscription));
    }
    if (request.method === 'POST' && !id) {
      const input = await body(request);
      if (!input || typeof input.installationId !== 'string' || !input.installationId || typeof input.eventType !== 'string' || !input.eventType) {
        return error(400, 'BAD_REQUEST', 'installationId and eventType are required');
      }
      if (input.deliveryMode !== 'external') return error(400, 'BAD_REQUEST', 'Cloudflare native webhooks require deliveryMode=external');
      if (!validEndpoint(input.endpointUrl)) return error(400, 'BAD_REQUEST', 'endpointUrl must be an HTTPS URL');
      if (input.secret !== undefined && input.secret !== null && typeof input.secret !== 'string') return error(400, 'BAD_REQUEST', 'secret must be a string');
      const now = new Date().toISOString();
      const row: SubscriptionRow = {
        id: crypto.randomUUID(), installation_id: input.installationId, event_type: input.eventType,
        endpoint_url: input.endpointUrl, secret: typeof input.secret === 'string' ? input.secret : null,
        active: 1, created_at: now, updated_at: now,
      };
      await env.DB.prepare(
        `INSERT INTO native_webhook_subscriptions
          (id, installation_id, event_type, endpoint_url, secret, active, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      ).bind(row.id, row.installation_id, row.event_type, row.endpoint_url, row.secret, row.active, now, now).run();
      return response(mapSubscription(row), 201);
    }
    if (request.method === 'PATCH' && id) {
      const input = await body(request);
      if (!input || (input.active !== undefined && typeof input.active !== 'boolean') || (input.endpointUrl !== undefined && !validEndpoint(input.endpointUrl)) || (input.secret !== undefined && input.secret !== null && typeof input.secret !== 'string')) {
        return error(400, 'BAD_REQUEST', 'Invalid subscription update');
      }
      const current = await env.DB.prepare('SELECT * FROM native_webhook_subscriptions WHERE id = ?1').bind(id).first<SubscriptionRow>();
      if (!current) return error(404, 'NOT_FOUND', 'Webhook subscription not found');
      const updatedAt = new Date().toISOString();
      const next = {
        active: input.active === undefined ? current.active : input.active ? 1 : 0,
        endpointUrl: input.endpointUrl === undefined ? current.endpoint_url : input.endpointUrl,
        secret: input.secret === undefined ? current.secret : input.secret,
      };
      await env.DB.prepare(
        'UPDATE native_webhook_subscriptions SET endpoint_url = ?1, secret = ?2, active = ?3, updated_at = ?4 WHERE id = ?5',
      ).bind(next.endpointUrl, next.secret, next.active, updatedAt, id).run();
      return response(mapSubscription({ ...current, endpoint_url: next.endpointUrl, secret: next.secret, active: next.active, updated_at: updatedAt }));
    }
    if (request.method === 'DELETE' && id) {
      const result = await env.DB.prepare('DELETE FROM native_webhook_subscriptions WHERE id = ?1').bind(id).run();
      return result.meta.changes ? response({ deleted: true }) : error(404, 'NOT_FOUND', 'Webhook subscription not found');
    }
    return error(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/admin/webhooks/delivery-logs') {
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? '50') || 50, 1), 200);
    const rows = await env.DB.prepare(
      `SELECT id, subscription_id, event_id, attempt, status, response_code, NULL AS response_body,
              error_message, latency_ms, delivered_at
       FROM native_webhook_delivery_logs
       WHERE (?1 IS NULL OR subscription_id = ?1) AND (?2 IS NULL OR event_id = ?2) AND (?3 IS NULL OR status = ?3)
       ORDER BY delivered_at DESC LIMIT ?4`,
    ).bind(url.searchParams.get('subscriptionId'), url.searchParams.get('eventId'), url.searchParams.get('status'), limit).all();
    const items = rows.results.map((row) => ({
      id: row.id, subscriptionId: row.subscription_id, eventId: row.event_id, attempt: row.attempt,
      status: row.status, responseCode: row.response_code, responseBody: row.response_body,
      errorMessage: row.error_message, latencyMs: row.latency_ms, deliveredAt: row.delivered_at,
    }));
    return response({ items, page: 1, limit, total: items.length, totalPages: 1 });
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/admin/webhooks/dead-letters') {
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? '50') || 50, 1), 200);
    const rows = await env.DB.prepare(
      `SELECT d.*, s.installation_id, s.endpoint_url, s.active
       FROM native_webhook_dead_letters d JOIN native_webhook_subscriptions s ON s.id = d.subscription_id
       WHERE (?1 IS NULL OR d.subscription_id = ?1) ORDER BY d.created_at DESC LIMIT ?2`,
    ).bind(url.searchParams.get('subscriptionId'), limit).all();
    const items = rows.results.map((row) => ({
      id: row.id, eventId: row.event_id, subscriptionId: row.subscription_id, eventType: row.event_type,
      payload: JSON.parse(String(row.payload)), lastError: row.last_error, retryCount: row.retry_count,
      replayedAt: row.replayed_at, createdAt: row.created_at,
      subscription: { id: row.subscription_id, eventType: row.event_type, installationId: row.installation_id, deliveryMode: 'external' },
    }));
    return response({ items, page: 1, limit, total: items.length, totalPages: 1 });
  }

  return error(404, 'NOT_FOUND', 'Native webhook route not found');
}
