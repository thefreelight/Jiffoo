import { sendSmtpEmail } from './smtp';
import { findNativeUserByEmail, getNativeJwtSecret, type NativeAuthEnv } from './auth';
import { nativeSiteName } from './site-name';

const CODE_TTL_SECONDS = 600;
const MAX_ATTEMPTS = 5;
const encoder = new TextEncoder();

function code(): string {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return String(value[0]! % 1_000_000).padStart(6, '0');
}

async function digest(secret: string, userId: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`${userId}:${value}`)));
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function equal(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function sendNativeVerificationCode(
  env: NativeAuthEnv,
  user: { id: string; email: string; username: string },
): Promise<void> {
  const value = code();
  const secret = await getNativeJwtSecret(env);
  const expiresAt = new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString();
  const siteName = await nativeSiteName(env);
  await env.DB.prepare(
    `UPDATE native_users SET verification_code_hash = ?1, verification_expires_at = ?2,
      verification_attempts = 0, email_verified = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?3`,
  ).bind(await digest(secret, user.id, value), expiresAt, user.id).run();

  await sendSmtpEmail(env, {
    to: user.email,
    subject: `Your ${siteName} verification code`,
    text: `Hi ${user.username},\n\nYour ${siteName} verification code is ${value}. It expires in 10 minutes.`,
    html: `<p>Hi ${user.username},</p><p>Your ${siteName} verification code is:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px">${value}</p><p>This code expires in 10 minutes.</p>`,
  });
}

export async function verifyNativeEmailCode(
  env: NativeAuthEnv,
  email: string,
  value: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await findNativeUserByEmail(env, email.trim().toLowerCase());
  if (!user || !/^\d{6}$/.test(value)) return { success: false, error: 'Invalid email or verification code' };
  if (user.email_verified) return { success: false, error: 'Email is already verified' };
  if (!user.verification_code_hash || !user.verification_expires_at) return { success: false, error: 'Request a new verification code' };
  if (Date.parse(user.verification_expires_at) <= Date.now()) return { success: false, error: 'Verification code has expired' };

  const secret = await getNativeJwtSecret(env);
  const valid = equal(user.verification_code_hash, await digest(secret, user.id, value));
  if (!valid) {
    const attempts = user.verification_attempts + 1;
    await env.DB.prepare(
      attempts >= MAX_ATTEMPTS
        ? `UPDATE native_users SET verification_code_hash = NULL, verification_expires_at = NULL,
            verification_attempts = ?1 WHERE id = ?2`
        : 'UPDATE native_users SET verification_attempts = ?1 WHERE id = ?2',
    ).bind(attempts, user.id).run();
    return { success: false, error: attempts >= MAX_ATTEMPTS
      ? 'Too many attempts. Request a new verification code'
      : 'Invalid email or verification code' };
  }

  await env.DB.prepare(
    `UPDATE native_users SET email_verified = 1, verification_code_hash = NULL,
      verification_expires_at = NULL, verification_attempts = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?1`,
  ).bind(user.id).run();
  return { success: true };
}
