import type { NativeAuthEnv } from './auth';

export type NativeSecurityEventAction =
  | 'password.changed'
  | 'password.reset_requested'
  | 'password.reset'
  | 'password.admin_reset'
  | 'login.success'
  | 'login.failed';

export async function recordNativeSecurityEvent(
  env: NativeAuthEnv,
  event: {
    action: NativeSecurityEventAction;
    email: string;
    userId?: string;
    source?: 'storefront' | 'admin';
    ip?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO native_user_security_events
      (id, user_id, email, action, source, ip, metadata, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
  ).bind(
    crypto.randomUUID(),
    event.userId ?? null,
    event.email,
    event.action,
    event.source ?? 'storefront',
    event.ip ?? null,
    event.metadata ? JSON.stringify(event.metadata) : null,
    new Date().toISOString(),
  ).run();
}

// Audit writes must never block authentication: a broken audit table should
// degrade visibility, not lock users out.
export async function recordLoginAudit(
  env: NativeAuthEnv,
  event: {
    action: 'login.success' | 'login.failed';
    email: string;
    userId?: string;
    source: 'storefront' | 'admin';
    ip?: string | null;
    userAgent?: string | null;
  },
): Promise<void> {
  try {
    await recordNativeSecurityEvent(env, {
      ...event,
      metadata: event.userAgent ? { userAgent: event.userAgent } : undefined,
    });
  } catch (error) {
    console.warn(JSON.stringify({ message: 'login audit write failed', action: event.action, error: String(error) }));
  }
}

export async function recordNativeLoginSuccess(
  env: NativeAuthEnv,
  event: {
    email: string;
    userId: string;
    source: 'storefront' | 'admin';
    ip?: string | null;
    userAgent?: string | null;
  },
): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare(
    'UPDATE native_users SET last_login_at = ?1, last_login_ip = ?2, updated_at = ?3 WHERE id = ?4',
  ).bind(now, event.ip ?? null, now, event.userId).run();
  await recordLoginAudit(env, { ...event, action: 'login.success' });
}
