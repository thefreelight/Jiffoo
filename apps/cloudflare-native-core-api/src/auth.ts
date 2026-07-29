export type NativeAuthEnv = Pick<Cloudflare.Env, 'DB' | 'JWT_SECRET'>;

export interface NativeUser {
  id: string;
  email: string;
  username: string;
  role: string;
  avatar: string | null;
  password_salt: string;
  password_hash: string;
  password_iterations: number;
  is_active: number;
  migrated_at: string;
  updated_at: string;
}

export interface PublicUser {
  id: string;
  email: string;
  username: string;
  role: string;
  avatar?: string | null;
}

export interface NativeSessionUser extends PublicUser {}

const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index]! ^ right[index]!;
  return difference === 0;
}

async function derivePassword(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt.buffer as ArrayBuffer, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function upsertNativeUser(env: NativeAuthEnv, user: PublicUser, password: string): Promise<void> {
  const iterations = 100000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePassword(password, salt, iterations);
  await env.DB.prepare(
    `INSERT INTO native_users
      (id, email, username, role, avatar, password_salt, password_hash, password_iterations, is_active, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1, CURRENT_TIMESTAMP)
     ON CONFLICT(email) DO UPDATE SET id = excluded.id, username = excluded.username,
       role = excluded.role, avatar = excluded.avatar, password_salt = excluded.password_salt,
       password_hash = excluded.password_hash, password_iterations = excluded.password_iterations,
       is_active = 1, updated_at = CURRENT_TIMESTAMP`,
  ).bind(
    user.id,
    user.email.toLowerCase(),
    user.username,
    user.role,
    user.avatar ?? null,
    base64Url(salt),
    base64Url(hash),
    iterations,
  ).run();
}

export async function createNativeUser(env: NativeAuthEnv, user: PublicUser, password: string): Promise<void> {
  const iterations = 100000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePassword(password, salt, iterations);
  await env.DB.prepare(
    `INSERT INTO native_users
      (id, email, username, role, avatar, password_salt, password_hash, password_iterations, is_active, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1, CURRENT_TIMESTAMP)`,
  ).bind(
    user.id,
    user.email.toLowerCase(),
    user.username,
    user.role,
    user.avatar ?? null,
    base64Url(salt),
    base64Url(hash),
    iterations,
  ).run();
}

export async function findNativeUserByEmail(env: NativeAuthEnv, email: string): Promise<NativeUser | null> {
  return env.DB.prepare('SELECT * FROM native_users WHERE email = ?1')
    .bind(email.toLowerCase())
    .first<NativeUser>();
}

export async function findNativeUserById(env: NativeAuthEnv, id: string): Promise<NativeUser | null> {
  return env.DB.prepare('SELECT * FROM native_users WHERE id = ?1').bind(id).first<NativeUser>();
}

export async function verifyNativePassword(user: NativeUser, password: string): Promise<boolean> {
  const hash = await derivePassword(password, decodeBase64Url(user.password_salt), user.password_iterations);
  return constantTimeEqual(hash, decodeBase64Url(user.password_hash));
}

export async function updateNativePassword(env: NativeAuthEnv, userId: string, password: string): Promise<void> {
  const iterations = 100000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePassword(password, salt, iterations);
  await env.DB.prepare(
    `UPDATE native_users
     SET password_salt = ?1, password_hash = ?2, password_iterations = ?3, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?4`,
  ).bind(base64Url(salt), base64Url(hash), iterations, userId).run();
}

async function signJwt(secret: string, payload: Record<string, unknown>): Promise<string> {
  const header = base64Url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = base64Url(encoder.encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${header}.${body}`));
  return `${header}.${body}.${base64Url(new Uint8Array(signature))}`;
}

async function verifyJwt(secret: string, token: string): Promise<Record<string, unknown> | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts as [string, string, string];
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`${header}.${body}`)));
  if (!constantTimeEqual(expected, decodeBase64Url(signature))) return null;
  const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(body))) as Record<string, unknown>;
  if (typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export async function authenticateNativeUser(request: Request, env: NativeAuthEnv): Promise<NativeSessionUser | null> {
  const authorization = request.headers.get('authorization');
  const token = cookie(request, 'auth_token') ?? (authorization?.startsWith('Bearer ') ? authorization.slice(7) : null);
  if (!token) return null;
  const secret = await env.JWT_SECRET.get();
  const payload = await verifyJwt(secret, token);
  if (!payload || payload.type === 'refresh' || payload.iss !== 'jiffoo-shop' || payload.aud !== 'shop') return null;
  if (typeof payload.userId !== 'string') return null;
  const user = await env.DB.prepare('SELECT * FROM native_users WHERE id = ?1').bind(payload.userId).first<NativeUser>();
  return user?.is_active ? nativePublicUser(user) : null;
}

export async function authenticateNativeAdmin(request: Request, env: NativeAuthEnv): Promise<NativeSessionUser | null> {
  const authorization = request.headers.get('authorization');
  const token = cookie(request, 'admin_auth_token') ?? (authorization?.startsWith('Bearer ') ? authorization.slice(7) : null);
  if (!token) return null;
  const secret = await env.JWT_SECRET.get();
  const payload = await verifyJwt(secret, token);
  if (!payload || payload.type === 'refresh' || payload.iss !== 'jiffoo-admin' || payload.aud !== 'admin') return null;
  if (typeof payload.userId !== 'string') return null;
  const user = await env.DB.prepare('SELECT * FROM native_users WHERE id = ?1').bind(payload.userId).first<NativeUser>();
  return user?.is_active && ['ADMIN', 'SUPER_ADMIN'].includes(user.role) ? nativePublicUser(user) : null;
}

export async function createNativeSession(
  env: NativeAuthEnv,
  user: PublicUser,
  audience: 'shop' | 'admin' = 'shop',
): Promise<{ body: Record<string, unknown>; headers: Headers }> {
  const secret = await env.JWT_SECRET.get();
  const now = Math.floor(Date.now() / 1000);
  const issuer = audience === 'admin' ? 'jiffoo-admin' : 'jiffoo-shop';
  const accessCookie = audience === 'admin' ? 'admin_auth_token' : 'auth_token';
  const refreshCookie = audience === 'admin' ? 'admin_refresh_token' : 'refresh_token';
  const accessToken = await signJwt(secret, {
    userId: user.id, email: user.email, role: user.role, iss: issuer, aud: audience, iat: now, exp: now + 604800,
  });
  const refreshToken = await signJwt(secret, {
    userId: user.id, type: 'refresh', iss: issuer, aud: audience, iat: now, exp: now + 7776000,
  });
  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8', 'x-jiffoo-runtime': 'cloudflare-native-d1-auth' });
  headers.append('set-cookie', `${accessCookie}=${accessToken}; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax`);
  headers.append('set-cookie', `${refreshCookie}=${refreshToken}; Path=/; Max-Age=7776000; HttpOnly; Secure; SameSite=Lax`);
  return {
    headers,
    body: {
      success: true,
      data: {
        user,
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 604800,
        refresh_token: refreshToken,
        token: accessToken,
      },
    },
  };
}

function cookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('cookie') ?? '';
  for (const item of cookieHeader.split(';')) {
    const [key, ...value] = item.trim().split('=');
    if (key === name) return value.join('=');
  }
  return null;
}

export function nativePublicUser(user: NativeUser): PublicUser {
  return { id: user.id, email: user.email, username: user.username, role: user.role, avatar: user.avatar };
}

export async function tryNativeAuth(
  request: Request,
  env: NativeAuthEnv,
  proxyRequest: () => Promise<Response>,
): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (path === '/api/v1/admin/auth/login' && request.method === 'POST') {
    const body = await request.clone().json<{ email?: string; password?: string }>();
    if (!body.email || !body.password) return null;
    let user = await findNativeUserByEmail(env, body.email);
    if (!user) {
      const upstream = await proxyRequest();
      if (upstream.ok) {
        const payload = await upstream.clone().json<{ data?: { user?: PublicUser } }>();
        if (payload.data?.user && ['ADMIN', 'SUPER_ADMIN'].includes(payload.data.user.role)) {
          await upsertNativeUser(env, payload.data.user, body.password);
          user = await findNativeUserByEmail(env, body.email);
        }
      }
      if (!user) return upstream;
    }
    const hash = await derivePassword(body.password, decodeBase64Url(user.password_salt), user.password_iterations);
    if (!user.is_active || !['ADMIN', 'SUPER_ADMIN'].includes(user.role) || !constantTimeEqual(hash, decodeBase64Url(user.password_hash))) {
      return Response.json(
        { success: false, error: { code: 'LOGIN_FAILED', message: 'Invalid credentials' } },
        { status: 401, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-auth' } },
      );
    }
    const session = await createNativeSession(env, nativePublicUser(user), 'admin');
    return new Response(JSON.stringify(session.body), { status: 200, headers: session.headers });
  }

  if (path === '/api/v1/admin/auth/refresh' && request.method === 'POST') {
    const body: { refresh_token?: string } = await request.clone().json<{ refresh_token?: string }>().catch(() => ({}));
    const token = cookie(request, 'admin_refresh_token') ?? body.refresh_token;
    if (!token) return null;
    const secret = await env.JWT_SECRET.get();
    const payload = await verifyJwt(secret, token);
    if (!payload || payload.type !== 'refresh' || payload.iss !== 'jiffoo-admin' || payload.aud !== 'admin') return null;
    const user = await env.DB.prepare('SELECT * FROM native_users WHERE id = ?1').bind(payload.userId).first<NativeUser>();
    if (!user?.is_active || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) return null;
    const session = await createNativeSession(env, nativePublicUser(user), 'admin');
    return new Response(JSON.stringify(session.body), { status: 200, headers: session.headers });
  }

  if (path === '/api/v1/admin/auth/me' && request.method === 'GET') {
    const token = cookie(request, 'admin_auth_token') ?? (request.headers.get('authorization')?.startsWith('Bearer ')
      ? request.headers.get('authorization')!.slice(7)
      : null);
    if (!token) return null;
    const secret = await env.JWT_SECRET.get();
    const payload = await verifyJwt(secret, token);
    if (!payload || payload.iss !== 'jiffoo-admin' || payload.aud !== 'admin' || typeof payload.userId !== 'string') return null;
    const user = await env.DB.prepare('SELECT * FROM native_users WHERE id = ?1').bind(payload.userId).first<NativeUser>();
    if (!user?.is_active || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) return null;
    return Response.json({ success: true, data: { ...nativePublicUser(user), isActive: true } }, {
      headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-auth' },
    });
  }

  if (path === '/api/v1/admin/auth/logout' && request.method === 'POST') {
    const headers = new Headers({ 'content-type': 'application/json', 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-auth' });
    headers.append('set-cookie', 'admin_auth_token=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
    headers.append('set-cookie', 'admin_refresh_token=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
    return new Response(JSON.stringify({ success: true, data: { loggedOut: true, timestamp: new Date().toISOString() } }), { headers });
  }

  if (path === '/api/v1/shop/auth/login' && request.method === 'POST') {
    const body = await request.clone().json<{ email?: string; password?: string }>();
    if (!body.email || !body.password) return null;
    const user = await findNativeUserByEmail(env, body.email);
    if (!user) {
      return Response.json(
        { success: false, error: { code: 'LOGIN_FAILED', message: 'Invalid credentials' } },
        { status: 401, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-auth' } },
      );
    }
    const hash = await derivePassword(body.password, decodeBase64Url(user.password_salt), user.password_iterations);
    if (!user.is_active || !constantTimeEqual(hash, decodeBase64Url(user.password_hash))) {
      return Response.json(
        { success: false, error: { code: 'LOGIN_FAILED', message: 'Invalid credentials' } },
        { status: 401, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-auth' } },
      );
    }
    const session = await createNativeSession(env, nativePublicUser(user));
    return new Response(JSON.stringify(session.body), { status: 200, headers: session.headers });
  }

  if (path === '/api/v1/shop/auth/refresh' && request.method === 'POST') {
    const body: { refresh_token?: string } = await request.clone().json<{ refresh_token?: string }>().catch(() => ({}));
    const token = cookie(request, 'refresh_token') ?? body.refresh_token;
    if (!token) return null;
    const secret = await env.JWT_SECRET.get();
    const payload = await verifyJwt(secret, token);
    if (!payload || payload.type !== 'refresh' || payload.iss !== 'jiffoo-shop' || payload.aud !== 'shop') return null;
    const user = await env.DB.prepare('SELECT * FROM native_users WHERE id = ?1').bind(payload.userId).first<NativeUser>();
    if (!user?.is_active) return null;
    const session = await createNativeSession(env, nativePublicUser(user));
    return new Response(JSON.stringify(session.body), { status: 200, headers: session.headers });
  }

  if (path === '/api/v1/shop/auth/me' && request.method === 'GET') {
    const user = await authenticateNativeUser(request, env);
    if (!user) return null;
    return Response.json(
      { success: true, data: { ...user, isActive: true } },
      { headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-auth' } },
    );
  }

  if (path === '/api/v1/shop/auth/logout' && request.method === 'POST') {
    const headers = new Headers({ 'content-type': 'application/json', 'x-jiffoo-runtime': 'cloudflare-native-d1-auth' });
    headers.append('set-cookie', 'auth_token=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
    headers.append('set-cookie', 'refresh_token=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
    return new Response(JSON.stringify({ success: true, data: { loggedOut: true, timestamp: new Date().toISOString() } }), { headers });
  }

  return null;
}
