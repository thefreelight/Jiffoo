import { sendSmtpEmail } from './smtp';
import { findNativeUserByEmail, getNativeJwtSecret, updateNativePassword, type NativeAuthEnv } from './auth';
import { nativeSiteName } from './site-name';

const RESET_TTL_SECONDS = 600;
const MAX_RESET_ATTEMPTS = 5;
const encoder = new TextEncoder();

function code(): string {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return String(value[0]! % 1_000_000).padStart(6, '0');
}

// Namespaced with `reset:` so a reset code can never satisfy an email
// verification check (or vice versa) even though both are HMAC-SHA256 keyed
// by the same JWT secret.
async function digest(secret: string, userId: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`reset:${userId}:${value}`)));
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

function resetEmailHtml(siteName: string, username: string, value: string): string {
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
        <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#1d2433;">Reset your password</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#5a6172;">Hi ${name}, enter the code below in the ${brand} app to choose a new password.</p>
      </td></tr>
      <tr><td style="padding:0 40px 24px;" align="center">
        <div style="background:#f4f6ff;border:1px solid #d7defc;border-radius:12px;padding:20px 12px;font-size:36px;font-weight:800;letter-spacing:12px;color:#3157e5;font-variant-numeric:tabular-nums;">${escapeHtml(value)}</div>
      </td></tr>
      <tr><td style="padding:0 40px 32px;">
        <p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#5a6172;">This code expires in <strong style="color:#1d2433;">10 minutes</strong> and can be used once.</p>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#8a90a3;">If you didn't request a password reset, you can safely ignore this email — your current password stays unchanged.</p>
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

export async function sendNativePasswordResetCode(
  env: NativeAuthEnv,
  user: { id: string; email: string; username: string },
): Promise<void> {
  const value = code();
  const secret = await getNativeJwtSecret(env);
  const expiresAt = new Date(Date.now() + RESET_TTL_SECONDS * 1000).toISOString();
  const siteName = await nativeSiteName(env);
  await env.DB.prepare(
    `UPDATE native_users SET reset_code_hash = ?1, reset_expires_at = ?2,
      reset_attempts = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?3`,
  ).bind(await digest(secret, user.id, value), expiresAt, user.id).run();

  await sendSmtpEmail(env, {
    to: user.email,
    subject: `${siteName} password reset code: ${value}`,
    text: `Hi ${user.username},\n\nYour ${siteName} password reset code is ${value}. It expires in 10 minutes and can be used once.\n\nIf you didn't request a password reset, you can safely ignore this email.`,
    html: resetEmailHtml(siteName, user.username, value),
  });
}

export async function completeNativePasswordReset(
  env: NativeAuthEnv,
  email: string,
  value: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await findNativeUserByEmail(env, email.trim().toLowerCase());
  // Deliberately uniform: never reveal whether the account exists.
  if (!user || !/^\d{6}$/.test(value)) return { success: false, error: 'Invalid email or reset code' };
  if (!user.reset_code_hash || !user.reset_expires_at) return { success: false, error: 'Request a new reset code' };
  if (Date.parse(user.reset_expires_at) <= Date.now()) return { success: false, error: 'Reset code has expired' };

  const secret = await getNativeJwtSecret(env);
  const valid = equal(user.reset_code_hash, await digest(secret, user.id, value));
  if (!valid) {
    const attempts = (user.reset_attempts ?? 0) + 1;
    await env.DB.prepare(
      attempts >= MAX_RESET_ATTEMPTS
        ? `UPDATE native_users SET reset_code_hash = NULL, reset_expires_at = NULL,
            reset_attempts = ?1 WHERE id = ?2`
        : 'UPDATE native_users SET reset_attempts = ?1 WHERE id = ?2',
    ).bind(attempts, user.id).run();
    return { success: false, error: attempts >= MAX_RESET_ATTEMPTS
      ? 'Too many attempts. Request a new reset code'
      : 'Invalid email or reset code' };
  }

  await updateNativePassword(env, user.id, newPassword);
  await env.DB.prepare(
    `UPDATE native_users SET reset_code_hash = NULL, reset_expires_at = NULL,
      reset_attempts = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?1`,
  ).bind(user.id).run();
  return { success: true };
}
