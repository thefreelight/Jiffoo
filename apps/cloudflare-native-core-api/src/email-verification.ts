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

const escapeHtml = (value: string): string => value
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function verificationEmailHtml(siteName: string, username: string, value: string): string {
  const brand = escapeHtml(siteName);
  const name = escapeHtml(username);
  return `<!doctype html>
<html lang="en"><body style="margin:0;padding:0;background:#f4f5fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5fa;padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
  <tr><td style="text-align:center;padding-bottom:24px;">
    <span style="display:inline-block;font-size:20px;font-weight:800;color:#1d2433;letter-spacing:.02em;">${brand}</span>
  </td></tr>
  <tr><td>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e6e8f0;overflow:hidden;">
      <tr><td style="background:linear-gradient(135deg,#3157e5,#5b7cf7);height:6px;font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:36px 40px 8px;">
        <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#1d2433;">Verify your email</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#5a6172;">Hi ${name}, use the verification code below to finish setting up your ${brand} account.</p>
      </td></tr>
      <tr><td style="padding:0 40px 24px;" align="center">
        <div style="background:#f4f6ff;border:1px solid #d7defc;border-radius:12px;padding:20px 12px;font-size:36px;font-weight:800;letter-spacing:12px;color:#3157e5;font-variant-numeric:tabular-nums;">${escapeHtml(value)}</div>
      </td></tr>
      <tr><td style="padding:0 40px 32px;">
        <p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#5a6172;">This code expires in <strong style="color:#1d2433;">10 minutes</strong>.</p>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#8a90a3;">If you didn't request this code, you can safely ignore this email — your account stays unused and nothing changes.</p>
      </td></tr>
      <tr><td style="padding:18px 40px;border-top:1px solid #eef0f6;">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#8a90a3;">This is an automated message from ${brand}. Replies to this address are not monitored.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
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
    subject: `${siteName} verification code: ${value}`,
    text: `Hi ${user.username},\n\nYour ${siteName} verification code is ${value}. It expires in 10 minutes.\n\nIf you didn't request this code, you can safely ignore this email.`,
    html: verificationEmailHtml(siteName, user.username, value),
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

function passwordResetEmailHtml(siteName: string, username: string, value: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f6fb;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:14px;padding:36px 40px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td>
<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#8a90a3;">${escapeHtml(siteName)}</p>
<h1 style="margin:0 0 18px;font-size:24px;line-height:1.2;color:#1d2433;">Reset your password</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#5a6172;">Hi ${escapeHtml(username)}, use the code below to reset your ${escapeHtml(siteName)} password.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr><td style="background:#f0f3fa;border-radius:10px;padding:14px 26px;">
<span style="font-size:26px;font-weight:800;letter-spacing:0.34em;color:#1d2433;">${value}</span>
</td></tr></table>
<p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#5a6172;">This code expires in <strong style="color:#1d2433;">10 minutes</strong>.</p>
<p style="margin:0;font-size:13px;line-height:1.6;color:#8a90a3;">If you didn't request a password reset, ignore this email — your password stays unchanged.</p>
</td></tr></table>
</td></tr></table>
</body></html>`;
}

// Password reset reuses the verification-code columns, but unlike email
// verification it must NEVER touch email_verified.
export async function sendNativePasswordResetCode(
  env: NativeAuthEnv,
  user: { id: string; email: string; username: string },
): Promise<void> {
  const value = code();
  const secret = await getNativeJwtSecret(env);
  const expiresAt = new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString();
  const siteName = await nativeSiteName(env);
  await env.DB.prepare(
    `UPDATE native_users SET verification_code_hash = ?1, verification_expires_at = ?2,
      verification_attempts = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?3`,
  ).bind(await digest(secret, user.id, value), expiresAt, user.id).run();

  await sendSmtpEmail(env, {
    to: user.email,
    subject: `${siteName} password reset code: ${value}`,
    text: `Hi ${user.username},\n\nYour ${siteName} password reset code is ${value}. It expires in 10 minutes.\n\nIf you didn't request a password reset, ignore this email — your password stays unchanged.`,
    html: passwordResetEmailHtml(siteName, user.username, value),
  });
}

export async function verifyNativePasswordResetCode(
  env: NativeAuthEnv,
  email: string,
  value: string,
): Promise<{ success: boolean; userId?: string; error?: string }> {
  const user = await findNativeUserByEmail(env, email.trim().toLowerCase());
  if (!user || !/^\d{6}$/.test(value)) return { success: false, error: 'Invalid email or verification code' };
  if (!user.verification_code_hash || !user.verification_expires_at) return { success: false, error: 'Request a new password reset code' };
  if (Date.parse(user.verification_expires_at) <= Date.now()) return { success: false, error: 'Password reset code has expired' };

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
      ? 'Too many attempts. Request a new password reset code'
      : 'Invalid email or verification code' };
  }
  return { success: true, userId: user.id };
}

export async function clearNativePasswordResetCode(env: NativeAuthEnv, userId: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE native_users SET verification_code_hash = NULL, verification_expires_at = NULL,
      verification_attempts = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?1`,
  ).bind(userId).run();
}
