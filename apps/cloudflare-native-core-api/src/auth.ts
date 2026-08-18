import { sendNativeVerificationCode, verifyNativeEmailCode } from './email-verification';
import { consumeVerificationRateLimit } from './auth-rate-limit';

export interface NativeSmtpEnv {
  SITE_NAME?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_SECURE?: string;
  SMTP_USER?: string;
  SMTP_USERNAME?: string;
  SMTP_PASS?: SecretsStoreSecret | string;
  SMTP_PASSWORD?: SecretsStoreSecret | string;
  SMTP_FROM?: string;
  SMTP_FROM_EMAIL?: string;
  SMTP_FROM_NAME?: string;
  SMTP_REPLY_TO?: string;
  /** Local test-only escape hatch; production uses the Secrets Store binding. */
  JWT_SECRET_VALUE?: string;
}

export type NativeAuthEnv = Pick<Cloudflare.Env, 'DB' | 'JWT_SECRET'> & NativeSmtpEnv;

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
  email_verified: number;
  verification_code_hash: string | null;
  verification_expires_at: string | null;
  verification_attempts: number;
}

export interface PublicUser {
  id: string;
  email: string;
  username: string;
  role: string;
  avatar?: string | null;
  emailVerified?: boolean;
}

export interface NativeSessionUser extends PublicUser {}

const encoder = new TextEncoder();

export async function getNativeJwtSecret(env: NativeAuthEnv): Promise<string> {
  if (env.JWT_SECRET_VALUE?.trim()) return env.JWT_SECRET_VALUE.trim();
  return env.JWT_SECRET.get();
}

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

export async function createNativeBootstrapAdmin(
  env: NativeAuthEnv,
  input: { email: string; username: string; password: string },
): Promise<boolean> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 100_000;
  const hash = await derivePassword(input.password, salt, iterations);
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `INSERT INTO native_users
      (id, email, username, role, password_salt, password_hash, password_iterations,
       is_active, migrated_at, updated_at, email_verified)
     SELECT ?1, ?2, ?3, 'SUPER_ADMIN', ?4, ?5, ?6, 1, ?7, ?7, 1
     WHERE NOT EXISTS (SELECT 1 FROM native_users WHERE role IN ('ADMIN', 'SUPER_ADMIN'))`,
  ).bind(crypto.randomUUID(), input.email, input.username, base64Url(salt), base64Url(hash), iterations, now).run();
  return (result.meta.changes ?? 0) === 1;
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

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Create (or resume) the restricted shopper identity used by guest checkout.
 * Guest orders still have a real owner in D1; the role prevents this session
 * from being treated as an admin or from bypassing order ownership checks.
 */
export async function createNativeGuest(
  env: NativeAuthEnv,
  input: { guestId?: string; installId?: string; deviceId?: string },
): Promise<{ user: PublicUser; guestId: string }> {
  const hint = input.guestId?.trim() || input.installId?.trim() || input.deviceId?.trim() || crypto.randomUUID();
  const digest = await sha256Hex(hint);
  const guestId = `guest_${digest.slice(0, 32)}`;
  const email = `${digest}@guest.bokmoo.invalid`;
  let user = await findNativeUserByEmail(env, email);
  if (!user) {
    const password = base64Url(crypto.getRandomValues(new Uint8Array(32)));
    const iterations = 100000;
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await derivePassword(password, salt, iterations);
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO native_users
       (id, email, username, role, password_salt, password_hash, password_iterations,
        is_active, migrated_at, updated_at, email_verified)
       VALUES (?1, ?2, ?3, 'GUEST', ?4, ?5, ?6, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)`,
    ).bind(id, email, guestId, base64Url(salt), base64Url(hash), iterations).run();
    user = await findNativeUserByEmail(env, email);
  }
  if (!user || user.role !== 'GUEST' || !user.is_active || !user.email_verified) {
    throw new Error('Guest session could not be created');
  }
  return { user: nativePublicUser(user), guestId };
}

export async function findNativeUserByEmail(env: NativeAuthEnv, email: string): Promise<NativeUser | null> {
  return env.DB.prepare('SELECT * FROM native_users WHERE email = ?1')
    .bind(email.toLowerCase())
    .first<NativeUser>();
}

export async function findNativeUserByIdentifier(env: NativeAuthEnv, identifier: string): Promise<NativeUser | null> {
  const normalized = identifier.trim();
  if (normalized.includes('@')) return findNativeUserByEmail(env, normalized);
  const result = await env.DB.prepare('SELECT * FROM native_users WHERE username = ?1 LIMIT 2')
    .bind(normalized)
    .all<NativeUser>();
  return result.results.length === 1 ? result.results[0]! : null;
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
  try {
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
  } catch {
    // Malformed bearer/refresh tokens are authentication failures, never Worker errors.
    return null;
  }
}

export async function authenticateNativeUser(request: Request, env: NativeAuthEnv): Promise<NativeSessionUser | null> {
  const authorization = request.headers.get('authorization');
  const token = cookie(request, 'auth_token') ?? (authorization?.startsWith('Bearer ') ? authorization.slice(7) : null);
  if (!token) return null;
  const secret = await getNativeJwtSecret(env);
  const payload = await verifyJwt(secret, token);
  if (!payload || payload.type === 'refresh' || payload.iss !== 'jiffoo-shop' || payload.aud !== 'shop') return null;
  if (typeof payload.userId !== 'string') return null;
  const user = await env.DB.prepare('SELECT * FROM native_users WHERE id = ?1').bind(payload.userId).first<NativeUser>();
  return user?.is_active && user.email_verified ? nativePublicUser(user) : null;
}

export async function authenticateNativeAdmin(request: Request, env: NativeAuthEnv): Promise<NativeSessionUser | null> {
  const authorization = request.headers.get('authorization');
  const token = cookie(request, 'admin_auth_token') ?? (authorization?.startsWith('Bearer ') ? authorization.slice(7) : null);
  if (!token) return null;
  const secret = await getNativeJwtSecret(env);
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
  const secret = await getNativeJwtSecret(env);
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
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    avatar: user.avatar,
    emailVerified: user.email_verified === 1,
  };
}

export async function tryNativeAuth(
  request: Request,
  env: NativeAuthEnv,
  proxyRequest: () => Promise<Response>,
): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (
    (path === '/api/v1/auth/guest' || path === '/api/v1/shop/auth/guest') &&
    request.method === 'POST'
  ) {
    const body = await request.clone().json<{ guestId?: string; installId?: string; deviceId?: string }>().catch(() => ({}));
    const guest = await createNativeGuest(env, body);
    const session = await createNativeSession(env, guest.user);
    const data = session.body.data as Record<string, unknown>;
    data.accountType = 'guest';
    data.guestId = guest.guestId;
    const responseBody = { ...session.body, data };
    return new Response(JSON.stringify(responseBody), { status: 201, headers: session.headers });
  }
  if (path === '/api/v1/admin/auth/login' && request.method === 'POST') {
    const body = await request.clone().json<{ identifier?: string; email?: string; password?: string }>();
    const identifier = body.identifier?.trim() || body.email?.trim();
    if (!identifier || !body.password) return null;
    let user = await findNativeUserByIdentifier(env, identifier);
    if (!user) {
      const upstream = await proxyRequest();
      if (upstream.ok) {
        const payload = await upstream.clone().json<{ data?: { user?: PublicUser } }>();
        if (payload.data?.user && ['ADMIN', 'SUPER_ADMIN'].includes(payload.data.user.role)) {
          await upsertNativeUser(env, payload.data.user, body.password);
          user = await findNativeUserByIdentifier(env, identifier);
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

  if (path === '/api/v1/admin/auth/change-password' && request.method === 'POST') {
    const user = await authenticateNativeAdmin(request, env);
    if (!user) return Response.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-auth' } });
    const body: { currentPassword?: string; newPassword?: string } = await request.clone()
      .json<{ currentPassword?: string; newPassword?: string }>()
      .catch(() => ({}));
    if (!body.currentPassword || !body.newPassword || body.newPassword.length < 8 || body.newPassword.length > 128) {
      return Response.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Current password and a new password between 8 and 128 characters are required' } }, { status: 400, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-auth' } });
    }
    const nativeUser = await findNativeUserById(env, user.id);
    if (!nativeUser || !(await verifyNativePassword(nativeUser, body.currentPassword))) {
      return Response.json({ success: false, error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' } }, { status: 401, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-auth' } });
    }
    await updateNativePassword(env, user.id, body.newPassword);
    return Response.json({ success: true, data: { passwordChanged: true, changedAt: new Date().toISOString() } }, { headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-auth' } });
  }

  if (path === '/api/v1/admin/auth/refresh' && request.method === 'POST') {
    const body: { refresh_token?: string } = await request.clone().json<{ refresh_token?: string }>().catch(() => ({}));
    const token = cookie(request, 'admin_refresh_token') ?? body.refresh_token;
    if (!token) return null;
    const secret = await getNativeJwtSecret(env);
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
    const secret = await getNativeJwtSecret(env);
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

  if (
    (path === '/api/v1/auth/register' || path === '/api/v1/shop/auth/register') &&
    request.method === 'POST'
  ) {
    const body = await request.clone().json<{
      email?: string;
      password?: string;
      username?: string;
      firstName?: string;
      lastName?: string;
    }>();
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? '';
    if (!email || !email.includes('@') || password.length < 8) {
      return Response.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'A valid email and password are required' } },
        { status: 400, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-auth' } },
      );
    }
    const rate = await consumeVerificationRateLimit(request, env, 'register', email);
    if (!rate.allowed) return Response.json(
      { success: false, error: { code: 'RATE_LIMITED', message: 'Too many registration attempts. Try again later' } },
      { status: 429, headers: { 'retry-after': String(rate.retryAfter), 'x-jiffoo-runtime': 'cloudflare-native-d1-auth' } },
    );
    if (await findNativeUserByEmail(env, email)) {
      return Response.json(
        { success: false, error: { code: 'CONFLICT', message: 'An account already exists for this email' } },
        { status: 409, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-auth' } },
      );
    }
    const emailPrefix = email.split('@')[0] || 'member';
    const requestedUsername = body.username?.trim();
    const displayName = [body.firstName?.trim(), body.lastName?.trim()].filter(Boolean).join(' ');
    const user: PublicUser = {
      id: crypto.randomUUID(),
      email,
      username: requestedUsername || displayName || emailPrefix,
      role: 'USER',
      avatar: null,
    };
    await createNativeUser(env, user, password);
    try {
      await sendNativeVerificationCode(env, user);
    } catch (error) {
      await env.DB.prepare('DELETE FROM native_users WHERE id = ?1 AND email_verified = 0').bind(user.id).run();
      return Response.json(
        { success: false, error: { code: 'EMAIL_UNAVAILABLE', message: error instanceof Error ? error.message : 'Verification email could not be sent' } },
        { status: 503, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-auth' } },
      );
    }
    return Response.json(
      { success: true, data: { user: { ...user, emailVerified: false }, emailVerificationRequired: true }, message: 'Verification code sent' },
      { status: 201, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-auth' } },
    );
  }

  if (
    (path === '/api/v1/auth/verify-email/code' || path === '/api/v1/shop/auth/verify-email/code') &&
    request.method === 'POST'
  ) {
    const body = await request.clone().json().catch(() => ({})) as { email?: string; code?: string };
    const rate = await consumeVerificationRateLimit(request, env, 'verify', body.email || '');
    if (!rate.allowed) return Response.json(
      { success: false, error: { code: 'RATE_LIMITED', message: 'Too many verification attempts. Try again later' } },
      { status: 429, headers: { 'retry-after': String(rate.retryAfter), 'x-jiffoo-runtime': 'cloudflare-native-d1-auth' } },
    );
    const result = await verifyNativeEmailCode(env, body.email || '', body.code || '');
    return Response.json(
      result.success
        ? { success: true, data: null, message: 'Email verified successfully' }
        : { success: false, error: { code: 'VERIFICATION_FAILED', message: result.error } },
      { status: result.success ? 200 : 400, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-auth' } },
    );
  }

  if (
    (path === '/api/v1/auth/resend-verification' || path === '/api/v1/shop/auth/resend-verification') &&
    request.method === 'POST'
  ) {
    const body = await request.clone().json().catch(() => ({})) as { email?: string };
    const rate = await consumeVerificationRateLimit(request, env, 'resend', body.email || '');
    if (!rate.allowed) return Response.json(
      { success: false, error: { code: 'RATE_LIMITED', message: 'Too many resend attempts. Try again later' } },
      { status: 429, headers: { 'retry-after': String(rate.retryAfter), 'x-jiffoo-runtime': 'cloudflare-native-d1-auth' } },
    );
    const user = body.email ? await findNativeUserByEmail(env, body.email) : null;
    if (!user || user.email_verified) {
      return Response.json(
        { success: false, error: { code: 'RESEND_FAILED', message: user ? 'Email is already verified' : 'User not found' } },
        { status: 400, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-auth' } },
      );
    }
    try {
      await sendNativeVerificationCode(env, nativePublicUser(user));
      return Response.json(
        { success: true, data: null, message: 'Verification email sent successfully' },
        { headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-auth' } },
      );
    } catch (error) {
      return Response.json(
        { success: false, error: { code: 'EMAIL_UNAVAILABLE', message: error instanceof Error ? error.message : 'Verification email could not be sent' } },
        { status: 503, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-auth' } },
      );
    }
  }

  if (
    (path === '/api/v1/auth/login' || path === '/api/v1/shop/auth/login') &&
    request.method === 'POST'
  ) {
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
    if (!user.is_active || !user.email_verified || !constantTimeEqual(hash, decodeBase64Url(user.password_hash))) {
      return Response.json(
        { success: false, error: { code: user.email_verified ? 'LOGIN_FAILED' : 'EMAIL_NOT_VERIFIED', message: user.email_verified ? 'Invalid credentials' : 'Email not verified' } },
        { status: 401, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-auth' } },
      );
    }
    const session = await createNativeSession(env, nativePublicUser(user));
    return new Response(JSON.stringify(session.body), { status: 200, headers: session.headers });
  }

  if (
    (path === '/api/v1/auth/refresh' || path === '/api/v1/shop/auth/refresh') &&
    request.method === 'POST'
  ) {
    const body: { refresh_token?: string } = await request.clone().json<{ refresh_token?: string }>().catch(() => ({}));
    const token = cookie(request, 'refresh_token') ?? body.refresh_token;
    if (!token) return null;
    const secret = await getNativeJwtSecret(env);
    const payload = await verifyJwt(secret, token);
    if (!payload || payload.type !== 'refresh' || payload.iss !== 'jiffoo-shop' || payload.aud !== 'shop') return null;
    const user = await env.DB.prepare('SELECT * FROM native_users WHERE id = ?1').bind(payload.userId).first<NativeUser>();
    if (!user?.is_active || !user.email_verified) {
      return Response.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-auth', 'cache-control': 'no-store' } },
      );
    }
    const session = await createNativeSession(env, nativePublicUser(user));
    return new Response(JSON.stringify(session.body), { status: 200, headers: session.headers });
  }

  if (
    (path === '/api/v1/auth/me' || path === '/api/v1/shop/auth/me') &&
    request.method === 'GET'
  ) {
    const user = await authenticateNativeUser(request, env);
    if (!user) {
      return Response.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-auth', 'cache-control': 'no-store' } },
      );
    }
    return Response.json(
      { success: true, data: { ...user, isActive: true } },
      { headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-auth' } },
    );
  }

  if (
    (path === '/api/v1/auth/logout' || path === '/api/v1/shop/auth/logout') &&
    request.method === 'POST'
  ) {
    const headers = new Headers({ 'content-type': 'application/json', 'x-jiffoo-runtime': 'cloudflare-native-d1-auth' });
    headers.append('set-cookie', 'auth_token=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
    headers.append('set-cookie', 'refresh_token=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
    return new Response(JSON.stringify({ success: true, data: { loggedOut: true, timestamp: new Date().toISOString() } }), { headers });
  }

  return null;
}
