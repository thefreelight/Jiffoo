import { authenticateNativeAdmin, type NativeAuthEnv } from './auth';

type TokenEnv = NativeAuthEnv & { DB: D1Database };
const encoder = new TextEncoder();

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function rawToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `jft_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export async function tryNativeAdminApiTokens(request: Request, env: TokenEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!/^\/api\/v1\/admin\/api-tokens(?:\/[^/]+)?\/?$/.test(url.pathname)) return null;
  const admin = await authenticateNativeAdmin(request, env);
  if (!admin) return Response.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Administrator authentication is required' } }, { status: 401 });
  const id = url.pathname.match(/\/api-tokens\/([^/]+)\/?$/)?.[1];
  if (request.method === 'GET' && !id) {
    const rows = await env.DB.prepare(
      'SELECT id,label,scopes_json,created_at,last_used_at FROM native_admin_api_tokens WHERE admin_user_id=?1 AND revoked_at IS NULL ORDER BY created_at DESC',
    ).bind(admin.id).all<{ id: string; label: string; scopes_json: string; created_at: string; last_used_at: string | null }>();
    return Response.json({ success: true, data: rows.results.map((row) => ({ id: row.id, label: row.label, scopes: JSON.parse(row.scopes_json), createdAt: row.created_at, lastUsedAt: row.last_used_at })) }, { headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-api-tokens' } });
  }
  if (request.method === 'POST' && !id) {
    const body = await request.json<{ label?: string; scopes?: string[] }>();
    const label = body.label?.trim();
    const scopes = Array.isArray(body.scopes) ? body.scopes.filter((scope) => typeof scope === 'string') : [];
    if (!label || scopes.length === 0) return Response.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Label and at least one scope are required' } }, { status: 400 });
    const token = rawToken(); const tokenId = crypto.randomUUID(); const now = new Date().toISOString();
    await env.DB.prepare('INSERT INTO native_admin_api_tokens (id,admin_user_id,label,token_hash,scopes_json,created_at) VALUES (?1,?2,?3,?4,?5,?6)')
      .bind(tokenId, admin.id, label, await hashToken(token), JSON.stringify(scopes), now).run();
    return Response.json({ success: true, data: { token, id: tokenId, label, scopes } }, { status: 201, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-api-tokens' } });
  }
  if (request.method === 'DELETE' && id) {
    await env.DB.prepare('UPDATE native_admin_api_tokens SET revoked_at=?1 WHERE id=?2 AND admin_user_id=?3').bind(new Date().toISOString(), decodeURIComponent(id), admin.id).run();
    return Response.json({ success: true, data: { revoked: true } }, { headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-api-tokens' } });
  }
  return Response.json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } }, { status: 405 });
}
