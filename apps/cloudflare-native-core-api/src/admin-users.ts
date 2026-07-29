import { authenticateNativeAdmin, type NativeAuthEnv, type NativeSessionUser } from './auth';

type AdminUserEnv = NativeAuthEnv;

interface NativeUserRow {
  id: string;
  email: string;
  username: string;
  role: string;
  avatar: string | null;
  is_active: number;
  migrated_at: string;
  updated_at: string;
}

const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function hashPassword(password: string): Promise<{ salt: string; hash: string; iterations: number }> {
  const iterations = 100000;
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes.buffer as ArrayBuffer, iterations },
    key,
    256,
  );
  return { salt: base64Url(saltBytes), hash: base64Url(new Uint8Array(bits)), iterations };
}

function userView(row: NativeUserRow, orders = 0): Record<string, unknown> {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    avatar: row.avatar,
    role: row.role,
    isActive: row.is_active === 1,
    createdAt: row.migrated_at,
    updatedAt: row.updated_at,
    totalOrders: orders,
    totalSpent: 0,
    lastLoginAt: null,
  };
}

function json(data: unknown, status = 200, runtime = 'cloudflare-native-d1-admin-users'): Response {
  return Response.json({ success: true, data }, { status, headers: { 'x-jiffoo-runtime': runtime } });
}

function error(status: number, code: string, message: string): Response {
  return Response.json({ success: false, error: { code, message } }, {
    status,
    headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-users' },
  });
}

async function requireAdmin(request: Request, env: AdminUserEnv): Promise<NativeSessionUser | null> {
  return authenticateNativeAdmin(request, env);
}

function parseId(pathname: string): string | null {
  const match = pathname.match(/^\/api\/v1\/admin\/users\/([^/]+)(?:\/password)?\/?$/);
  return match ? decodeURIComponent(match[1]!) : null;
}

function parseBody(request: Request): Promise<Record<string, unknown>> {
  return request.json() as Promise<Record<string, unknown>>;
}

export async function tryNativeAdminUsers(request: Request, env: AdminUserEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!/^\/api\/v1\/admin\/users(?:\/[^/]+(?:\/password)?)?\/?$/.test(url.pathname)) return null;

  const admin = await requireAdmin(request, env);
  if (!admin) return error(401, 'UNAUTHORIZED', 'Admin authentication required');

  if (request.method === 'GET' && (url.pathname.endsWith('/stats') || url.pathname.endsWith('/stats/'))) {
    const row = await env.DB.prepare(
      `SELECT COUNT(*) AS total_users,
              SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_users,
              SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) AS inactive_users,
              SUM(CASE WHEN migrated_at >= datetime('now', 'start of month') THEN 1 ELSE 0 END) AS new_this_month
         FROM native_users WHERE role = 'USER'`,
    ).first<{ total_users: number | null; active_users: number | null; inactive_users: number | null; new_this_month: number | null }>();
    const total = Number(row?.total_users ?? 0);
    const active = Number(row?.active_users ?? 0);
    const inactive = Number(row?.inactive_users ?? 0);
    return json({ metrics: {
      totalUsers: total,
      activeUsers: active,
      inactiveUsers: inactive,
      newThisMonth: Number(row?.new_this_month ?? 0),
      totalUsersTrend: 0,
      activeUsersTrend: 0,
      inactiveUsersTrend: 0,
      newUsersTrend: 0,
    } });
  }

  const userId = parseId(url.pathname);
  const isPasswordPath = /\/password\/?$/.test(url.pathname);
  if (request.method === 'GET' && userId && !isPasswordPath) {
    const row = await env.DB.prepare("SELECT id,email,username,role,avatar,is_active,migrated_at,updated_at FROM native_users WHERE id = ?1")
      .bind(userId).first<NativeUserRow>();
    if (!row) return error(404, 'NOT_FOUND', 'User not found');
    return json(userView(row));
  }

  if (request.method === 'GET' && !userId) {
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 10) || 10));
    const search = url.searchParams.get('search')?.trim() ?? '';
    const status = url.searchParams.get('status');
    const where: string[] = ["role = 'USER'"];
    const bindings: unknown[] = [];
    if (search) { where.push('(email LIKE ? OR username LIKE ?)'); bindings.push(`%${search}%`, `%${search}%`); }
    if (status === 'ACTIVE') where.push('is_active = 1');
    if (status === 'INACTIVE') where.push('is_active = 0');
    const clause = where.join(' AND ');
    const totalRow = await env.DB.prepare(`SELECT COUNT(*) AS total FROM native_users WHERE ${clause}`).bind(...bindings).first<{ total: number }>();
    const rows = await env.DB.prepare(
      `SELECT id,email,username,role,avatar,is_active,migrated_at,updated_at
         FROM native_users WHERE ${clause} ORDER BY migrated_at DESC LIMIT ? OFFSET ?`,
    ).bind(...bindings, limit, (page - 1) * limit).all<NativeUserRow>();
    const total = Number(totalRow?.total ?? 0);
    return json({ items: (rows.results ?? []).map((row) => userView(row)), page, limit, total, totalPages: Math.ceil(total / limit) });
  }

  if (request.method === 'POST' && !userId) {
    const body = await parseBody(request);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email || !email.includes('@') || password.length < 6) return error(400, 'BAD_REQUEST', 'Valid email and password (min 6 characters) are required');
    const existing = await env.DB.prepare('SELECT id FROM native_users WHERE email = ?1').bind(email).first<{ id: string }>();
    if (existing) return error(409, 'EMAIL_EXISTS', 'Email already exists');
    const credentials = await hashPassword(password);
    const id = crypto.randomUUID();
    const username = typeof body.username === 'string' && body.username.trim() ? body.username.trim() : email.split('@')[0]!;
    const role = typeof body.role === 'string' && body.role.trim() ? body.role.trim().toUpperCase() : 'USER';
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO native_users (id,email,username,role,avatar,password_salt,password_hash,password_iterations,is_active,migrated_at,updated_at)
       VALUES (?1,?2,?3,?4,NULL,?5,?6,?7,1,?8,?8)`,
    ).bind(id, email, username, role, credentials.salt, credentials.hash, credentials.iterations, now).run();
    const row = await env.DB.prepare('SELECT id,email,username,role,avatar,is_active,migrated_at,updated_at FROM native_users WHERE id = ?1').bind(id).first<NativeUserRow>();
    return json(userView(row!), 201);
  }

  if (request.method === 'PUT' && userId && !isPasswordPath) {
    const body = await parseBody(request);
    const current = await env.DB.prepare('SELECT * FROM native_users WHERE id = ?1').bind(userId).first<NativeUserRow>();
    if (!current) return error(404, 'NOT_FOUND', 'User not found');
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : current.email;
    const username = typeof body.username === 'string' ? body.username.trim() || current.username : current.username;
    const role = typeof body.role === 'string' ? body.role.trim().toUpperCase() || current.role : current.role;
    const active = typeof body.isActive === 'boolean' ? (body.isActive ? 1 : 0) : current.is_active;
    const conflict = await env.DB.prepare('SELECT id FROM native_users WHERE email = ?1 AND id <> ?2').bind(email, userId).first<{ id: string }>();
    if (conflict) return error(409, 'EMAIL_EXISTS', 'Email already exists');
    const now = new Date().toISOString();
    await env.DB.prepare('UPDATE native_users SET email=?1, username=?2, role=?3, is_active=?4, updated_at=?5 WHERE id=?6')
      .bind(email, username, role, active, now, userId).run();
    const row = await env.DB.prepare('SELECT id,email,username,role,avatar,is_active,migrated_at,updated_at FROM native_users WHERE id = ?1').bind(userId).first<NativeUserRow>();
    return json(userView(row!));
  }

  if (request.method === 'PATCH' && userId && url.pathname.endsWith('/password')) {
    const body = await parseBody(request);
    const password = typeof body.newPassword === 'string' ? body.newPassword : '';
    if (password.length < 6) return error(400, 'BAD_REQUEST', 'Password must contain at least 6 characters');
    const current = await env.DB.prepare('SELECT id FROM native_users WHERE id = ?1').bind(userId).first<{ id: string }>();
    if (!current) return error(404, 'NOT_FOUND', 'User not found');
    const credentials = await hashPassword(password);
    const now = new Date().toISOString();
    await env.DB.prepare('UPDATE native_users SET password_salt=?1,password_hash=?2,password_iterations=?3,updated_at=?4 WHERE id=?5')
      .bind(credentials.salt, credentials.hash, credentials.iterations, now, userId).run();
    return json({ userId, passwordReset: true, resetAt: now });
  }

  if (request.method === 'DELETE' && userId && !isPasswordPath) {
    const current = await env.DB.prepare('SELECT id FROM native_users WHERE id = ?1').bind(userId).first<{ id: string }>();
    if (!current) return error(404, 'NOT_FOUND', 'User not found');
    await env.DB.prepare('DELETE FROM native_users WHERE id = ?1').bind(userId).run();
    return json({ userId, deleted: true });
  }

  return error(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
}
