import type { NativeAuthEnv } from './auth';

export type NativeSecurityEventAction =
  | 'password.changed'
  | 'password.reset_requested'
  | 'password.reset'
  | 'password.admin_reset';

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
