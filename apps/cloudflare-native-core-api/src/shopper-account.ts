import {
  authenticateNativeUser,
  createNativeUser,
  findNativeUserByEmail,
  findNativeUserById,
  nativePublicUser,
  updateNativePassword,
  verifyNativePassword,
  type NativeAuthEnv,
  type NativeUser,
} from './auth';
import { sendNativeVerificationCode, verifyNativeEmailCode } from './email-verification';
import { consumeVerificationRateLimit } from './auth-rate-limit';

const RUNTIME = 'cloudflare-native-d1-shopper-account';

function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('content-type', 'application/json; charset=utf-8');
  responseHeaders.set('cache-control', 'no-store');
  responseHeaders.set('x-jiffoo-runtime', RUNTIME);
  return new Response(JSON.stringify(data), { status, headers: responseHeaders });
}

function success(data: unknown, status = 200, message?: string): Response {
  return json({ success: true, data, ...(message ? { message } : {}) }, status);
}

function error(status: number, code: string, message: string, details?: unknown): Response {
  return json({ success: false, error: { code, message, ...(details === undefined ? {} : { details }) } }, status);
}

async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return await request.clone().json<T>();
  } catch {
    return null;
  }
}

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validPassword(password: string): boolean {
  return password.length >= 8 && password.length <= 128;
}

async function authenticatedUser(request: Request, env: NativeAuthEnv): Promise<NativeUser | null> {
  const session = await authenticateNativeUser(request, env);
  if (!session) return null;
  return findNativeUserById(env, session.id);
}

async function profile(env: NativeAuthEnv, user: NativeUser): Promise<Record<string, unknown>> {
  const orderStats = await env.DB.prepare(
    `SELECT COUNT(*) AS total_orders, COALESCE(SUM(total_amount), 0) AS total_spent
     FROM native_order_metadata WHERE user_id = ?1`,
  ).bind(user.id).first<{ total_orders: number; total_spent: number }>();
  const totalOrders = Number(orderStats?.total_orders ?? 0);
  return {
    ...nativePublicUser(user),
    isActive: user.is_active === 1,
    emailVerified: user.email_verified === 1,
    orderCount: totalOrders,
    totalOrders,
    totalSpent: Number(orderStats?.total_spent ?? 0),
    createdAt: user.migrated_at,
    updatedAt: user.updated_at,
  };
}

function clearShopCookies(headers: Headers): void {
  headers.append('set-cookie', 'auth_token=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
  headers.append('set-cookie', 'refresh_token=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
}

async function register(request: Request, env: NativeAuthEnv): Promise<Response> {
  const body = await readJson<{ email?: string; password?: string; username?: string }>(request);
  const email = body?.email?.trim().toLowerCase() ?? '';
  const username = body?.username?.trim() ?? '';
  const password = body?.password ?? '';
  if (!validEmail(email)) return error(400, 'VALIDATION_ERROR', 'A valid email is required');
  if (username.length < 3 || username.length > 50) {
    return error(400, 'VALIDATION_ERROR', 'Username must contain between 3 and 50 characters');
  }
  if (!validPassword(password)) {
    return error(400, 'VALIDATION_ERROR', 'Password must contain between 8 and 128 characters');
  }
  const rate = await consumeVerificationRateLimit(request, env, 'register', email);
  if (!rate.allowed) {
    const response = error(429, 'RATE_LIMITED', 'Too many registration attempts. Try again later');
    response.headers.set('retry-after', String(rate.retryAfter));
    return response;
  }
  if (await findNativeUserByEmail(env, email)) return error(409, 'CONFLICT', 'Email is already registered');

  const user = { id: crypto.randomUUID(), email, username, role: 'USER', avatar: null };
  try {
    await createNativeUser(env, user, password);
  } catch (cause) {
    if (cause instanceof Error && cause.message.toLowerCase().includes('unique')) {
      return error(409, 'CONFLICT', 'Email is already registered');
    }
    throw cause;
  }
  try {
    await sendNativeVerificationCode(env, user);
  } catch (cause) {
    await env.DB.prepare('DELETE FROM native_users WHERE id = ?1 AND email_verified = 0').bind(user.id).run();
    return error(503, 'EMAIL_UNAVAILABLE', cause instanceof Error ? cause.message : 'Verification email could not be sent');
  }
  return success({ user: { ...user, emailVerified: false }, emailVerificationRequired: true }, 201, 'Verification code sent');
}

async function verifyCode(request: Request, env: NativeAuthEnv): Promise<Response> {
  const body = await readJson<{ email?: string; code?: string }>(request);
  const rate = await consumeVerificationRateLimit(request, env, 'verify', body?.email || '');
  if (!rate.allowed) {
    const response = error(429, 'RATE_LIMITED', 'Too many verification attempts. Try again later');
    response.headers.set('retry-after', String(rate.retryAfter));
    return response;
  }
  const result = await verifyNativeEmailCode(env, body?.email || '', body?.code || '');
  return result.success
    ? success(null, 200, 'Email verified successfully')
    : error(400, 'VERIFICATION_FAILED', result.error || 'Failed to verify email');
}

async function resendVerification(request: Request, env: NativeAuthEnv): Promise<Response> {
  const body = await readJson<{ email?: string }>(request);
  const rate = await consumeVerificationRateLimit(request, env, 'resend', body?.email || '');
  if (!rate.allowed) {
    const response = error(429, 'RATE_LIMITED', 'Too many resend attempts. Try again later');
    response.headers.set('retry-after', String(rate.retryAfter));
    return response;
  }
  const user = body?.email ? await findNativeUserByEmail(env, body.email) : null;
  if (!user) return error(400, 'RESEND_FAILED', 'User not found');
  if (user.email_verified) return error(400, 'RESEND_FAILED', 'Email is already verified');
  try {
    await sendNativeVerificationCode(env, nativePublicUser(user));
    return success(null, 200, 'Verification email sent successfully');
  } catch (cause) {
    return error(503, 'EMAIL_UNAVAILABLE', cause instanceof Error ? cause.message : 'Verification email could not be sent');
  }
}

async function changePassword(request: Request, env: NativeAuthEnv): Promise<Response> {
  const user = await authenticatedUser(request, env);
  if (!user) return error(401, 'UNAUTHORIZED', 'Authentication required');
  const body = await readJson<{ currentPassword?: string; newPassword?: string }>(request);
  if (!body?.currentPassword || !body.newPassword) {
    return error(400, 'VALIDATION_ERROR', 'Current password and new password are required');
  }
  if (!validPassword(body.newPassword)) {
    return error(400, 'VALIDATION_ERROR', 'New password must contain between 8 and 128 characters');
  }
  if (!(await verifyNativePassword(user, body.currentPassword))) {
    return error(401, 'INVALID_PASSWORD', 'Current password is incorrect');
  }
  await updateNativePassword(env, user.id, body.newPassword);
  return success({ passwordChanged: true, changedAt: new Date().toISOString() });
}

async function getProfile(request: Request, env: NativeAuthEnv): Promise<Response> {
  const user = await authenticatedUser(request, env);
  if (!user) return error(401, 'UNAUTHORIZED', 'Authentication required');
  return success(await profile(env, user));
}

async function updateProfile(request: Request, env: NativeAuthEnv): Promise<Response> {
  const user = await authenticatedUser(request, env);
  if (!user) return error(401, 'UNAUTHORIZED', 'Authentication required');
  const body = await readJson<{ username?: string; avatar?: string | null }>(request);
  if (!body) return error(400, 'VALIDATION_ERROR', 'A JSON body is required');
  if (body.username !== undefined && (body.username.trim().length < 3 || body.username.trim().length > 50)) {
    return error(400, 'VALIDATION_ERROR', 'Username must contain between 3 and 50 characters');
  }
  if (body.avatar !== undefined && body.avatar !== null) {
    try {
      new URL(body.avatar);
    } catch {
      return error(400, 'VALIDATION_ERROR', 'Avatar must be a valid URL');
    }
  }
  await env.DB.prepare(
    `UPDATE native_users
     SET username = COALESCE(?1, username), avatar = CASE WHEN ?2 = 1 THEN ?3 ELSE avatar END,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?4`,
  ).bind(
    body.username === undefined ? null : body.username.trim(),
    body.avatar === undefined ? 0 : 1,
    body.avatar ?? null,
    user.id,
  ).run();
  const updated = await findNativeUserById(env, user.id);
  return success(await profile(env, updated!), 200, 'Profile updated successfully');
}

async function updateEmail(request: Request, env: NativeAuthEnv): Promise<Response> {
  const user = await authenticatedUser(request, env);
  if (!user) return error(401, 'UNAUTHORIZED', 'Authentication required');
  const body = await readJson<{ newEmail?: string; currentPassword?: string }>(request);
  const email = body?.newEmail?.trim().toLowerCase() ?? '';
  if (!validEmail(email) || !body?.currentPassword) {
    return error(400, 'VALIDATION_ERROR', 'A valid new email and current password are required');
  }
  if (!(await verifyNativePassword(user, body.currentPassword))) {
    return error(401, 'INVALID_PASSWORD', 'Current password is incorrect');
  }
  const existing = await findNativeUserByEmail(env, email);
  if (existing && existing.id !== user.id) return error(409, 'CONFLICT', 'Email is already registered');
  await env.DB.prepare(
    `UPDATE native_users SET email = ?1, email_verified = 0, verification_code_hash = NULL,
       verification_expires_at = NULL, verification_attempts = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?2`,
  ).bind(email, user.id).run();
  try {
    await sendNativeVerificationCode(env, { id: user.id, email, username: user.username });
  } catch (cause) {
    await env.DB.prepare(
      `UPDATE native_users SET email = ?1, email_verified = ?2, verification_code_hash = NULL,
         verification_expires_at = NULL, verification_attempts = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?3`,
    ).bind(user.email, user.email_verified, user.id).run();
    return error(503, 'EMAIL_UNAVAILABLE', cause instanceof Error ? cause.message : 'Verification email could not be sent');
  }
  const updated = await findNativeUserById(env, user.id);
  const response = success({ profile: await profile(env, updated!), emailVerificationRequired: true }, 200, 'Email updated; verification code sent');
  clearShopCookies(response.headers);
  return response;
}

async function exportAccount(request: Request, env: NativeAuthEnv): Promise<Response> {
  const user = await authenticatedUser(request, env);
  if (!user) return error(401, 'UNAUTHORIZED', 'Authentication required');
  const [resumes, facts, savedJobs, packs, versions, applications, submissions, interviews, smtp] = await Promise.all([
    env.DB.prepare('SELECT id, name, summary, created_at, updated_at FROM native_rr_resumes WHERE user_id = ?1 ORDER BY updated_at DESC').bind(user.id).all(),
    env.DB.prepare('SELECT id, resume_id, kind, label, value, confirmed_at, created_at, updated_at FROM native_rr_resume_facts WHERE user_id = ?1 ORDER BY created_at ASC').bind(user.id).all(),
    env.DB.prepare('SELECT id, title, company, location, description, created_at, updated_at FROM native_rr_saved_jobs WHERE user_id = ?1 ORDER BY updated_at DESC').bind(user.id).all(),
    env.DB.prepare('SELECT id, saved_job_id, resume_id, approved_version_id, created_at, updated_at FROM native_rr_application_packs WHERE user_id = ?1 ORDER BY updated_at DESC').bind(user.id).all(),
    env.DB.prepare('SELECT id, pack_id, version, resume_snapshot, cover_letter, answers, approved_at, created_at FROM native_rr_application_pack_versions WHERE user_id = ?1 ORDER BY created_at ASC').bind(user.id).all(),
    env.DB.prepare('SELECT id, saved_job_id, pack_id, pack_version_id, status, applied_at, note, created_at, updated_at FROM native_rr_job_applications WHERE user_id = ?1 ORDER BY updated_at DESC').bind(user.id).all(),
    env.DB.prepare('SELECT id, application_id, pack_version_id, channel, transport, recipient, subject, status, error_code, sent_at, created_at, updated_at FROM remoteradar_application_submissions WHERE user_id = ?1 ORDER BY created_at DESC').bind(user.id).all(),
    env.DB.prepare('SELECT id, application_id, starts_at, ends_at, timezone, meeting_url, notes, status, reminder_at, created_at, updated_at FROM remoteradar_interviews WHERE user_id = ?1 ORDER BY starts_at ASC').bind(user.id).all(),
    env.DB.prepare('SELECT host, port, secure, username, from_email, from_name, reply_to, enabled, created_at, updated_at FROM remoteradar_user_smtp_configs WHERE user_id = ?1').bind(user.id).all(),
  ]);
  return new Response(JSON.stringify({
    exportedAt: new Date().toISOString(),
    account: nativePublicUser(user),
    resumes: resumes.results,
    resumeFacts: facts.results,
    savedJobs: savedJobs.results,
    applicationPacks: packs.results,
    applicationPackVersions: versions.results,
    applications: applications.results,
    submissions: submissions.results,
    interviews: interviews.results,
    smtp: smtp.results,
  }), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': 'attachment; filename="remoteradar-account-export.json"',
      'cache-control': 'no-store',
      'x-jiffoo-runtime': RUNTIME,
    },
  });
}

async function deleteAccount(request: Request, env: NativeAuthEnv): Promise<Response> {
  const user = await authenticatedUser(request, env);
  if (!user) return error(401, 'UNAUTHORIZED', 'Authentication required');
  if (user.role !== 'USER') return error(403, 'FORBIDDEN', 'Admins are managed separately');
  const body = await readJson<{ currentPassword?: string; confirm?: boolean }>(request);
  if (body?.confirm !== true || !body.currentPassword) {
    return error(400, 'VALIDATION_ERROR', 'Account deletion confirmation and current password are required');
  }
  if (!(await verifyNativePassword(user, body.currentPassword))) {
    return error(401, 'INVALID_PASSWORD', 'Current password is incorrect');
  }
  const deletedAt = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE native_users SET email = ?1, username = 'Deleted user', avatar = NULL, is_active = 0,
       updated_at = CURRENT_TIMESTAMP WHERE id = ?2`,
  ).bind(`deleted-${user.id}@deleted.invalid`, user.id).run();
  const headers = new Headers();
  clearShopCookies(headers);
  const response = success({ deleted: true, deletedAt });
  for (const value of headers.getSetCookie()) response.headers.append('set-cookie', value);
  return response;
}

export async function tryNativeShopperAccount(request: Request, env: NativeAuthEnv): Promise<Response | null> {
  const path = new URL(request.url).pathname;

  if (path === '/api/v1/shop/auth/capabilities' && request.method === 'GET') {
    return success({
      emailAvailable: true,
      passwordReset: false,
      passwordChange: true,
      emailCodeLogin: false,
      registrationVerification: true,
    });
  }
  if (path === '/api/v1/shop/auth/providers' && request.method === 'GET') return success([]);
  if (path === '/api/v1/shop/auth/register' && request.method === 'POST') return register(request, env);
  if (path === '/api/v1/shop/auth/verify-email/code' && request.method === 'POST') return verifyCode(request, env);
  if (path === '/api/v1/shop/auth/resend-verification' && request.method === 'POST') return resendVerification(request, env);
  if (path === '/api/v1/shop/auth/password' && request.method === 'POST') return changePassword(request, env);
  if (path === '/api/v1/account/profile' && request.method === 'GET') return getProfile(request, env);
  if (path === '/api/v1/account/profile' && request.method === 'PUT') return updateProfile(request, env);
  if (path === '/api/v1/account/email' && request.method === 'PUT') return updateEmail(request, env);
  if (path === '/api/v1/account/export' && request.method === 'GET') return exportAccount(request, env);
  if (path === '/api/v1/account' && request.method === 'DELETE') return deleteAccount(request, env);

  if (/^\/api\/v1\/shop\/auth\/(?:login\/code(?:\/verify)?|register\/code|password\/(?:code|reset))$/.test(path)) {
    return error(503, 'EMAIL_UNAVAILABLE', 'Email authentication is not configured for this Cloudflare deployment');
  }
  if (path.startsWith('/api/v1/shop/auth/social')) {
    return error(503, 'SOCIAL_AUTH_UNAVAILABLE', 'Social authentication is not configured for this Cloudflare deployment');
  }

  return null;
}
