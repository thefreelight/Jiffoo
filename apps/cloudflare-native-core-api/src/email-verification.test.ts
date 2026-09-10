import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));

const { sendNativeVerificationCode, verifyNativeEmailCode } = await import('./email-verification');
const { tryNativeAuth } = await import('./auth');

function emailDb(options: { existing?: Record<string, unknown> } = {}) {
  const statements: Array<{ sql: string; values?: unknown[] }> = [];
  const db = {
    prepare: (sql: string) => ({
      bind: (...values: unknown[]) => {
        statements.push({ sql, values });
        if (sql.includes('FROM native_users WHERE')) {
          return { first: async () => options.existing ?? null };
        }
        return { first: async () => null, run: async () => ({ success: true }) };
      },
      first: async () => null,
      run: async () => ({ success: true }),
    }),
    batch: async (items: unknown[]) => items,
  } as never;
  return { db, statements };
}

const smtp = vi.hoisted(() => ({ sendSmtpEmail: vi.fn() }));
vi.mock('./smtp', () => ({ sendSmtpEmail: smtp.sendSmtpEmail }));

describe('verification email template and auto-login session', () => {
  it('sends a branded card-style verification email with the code and expiry', async () => {
    smtp.sendSmtpEmail.mockReset().mockResolvedValue(undefined);
    const { db } = emailDb();
    await sendNativeVerificationCode(
      { DB: db, JWT_SECRET_VALUE: 'secret' } as never,
      { id: 'u1', email: 'user@example.com', username: 'Jordan' },
    );
    expect(smtp.sendSmtpEmail).toHaveBeenCalledTimes(1);
    const call = smtp.sendSmtpEmail.mock.calls[0]![1] as { subject: string; text: string; html: string };
    expect(call.subject).toMatch(/verification code: \d{6}$/);
    expect(call.html).toContain('Verify your email');
    expect(call.html).toContain('font-variant-numeric:tabular-nums');
    expect(call.html).toContain('expires in <strong');
    expect(call.html).not.toMatch(/<script/i);
  });

  it('escapes user-controlled values in the verification email', async () => {
    smtp.sendSmtpEmail.mockReset().mockResolvedValue(undefined);
    const { db } = emailDb();
    await sendNativeVerificationCode(
      { DB: db, JWT_SECRET_VALUE: 'secret' } as never,
      { id: 'u2', email: 'x@example.com', username: '<b>Evil</b> & Co' },
    );
    const call = smtp.sendSmtpEmail.mock.calls[0]![1] as { html: string };
    expect(call.html).toContain('&lt;b&gt;Evil&lt;/b&gt; &amp; Co');
    expect(call.html).not.toContain('<b>Evil</b>');
  });

  it('issues a shop session when a known active user completes verification', async () => {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode('secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode('u1:123456')));
    const codeHash = Array.from(signature, (byte) => byte.toString(16).padStart(2, '0')).join('');
    const { db } = emailDb({
      existing: {
        id: 'u1', email: 'user@example.com', username: 'Jordan', role: 'USER', is_active: 1,
        email_verified: 0, verification_code_hash: codeHash,
        verification_expires_at: new Date(Date.now() + 300_000).toISOString(), verification_attempts: 0,
      },
    });
    const proxyRequest = vi.fn();
    const response = await tryNativeAuth(
      new Request('https://api.example/api/v1/auth/verify-email/code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', code: '123456' }),
      }),
      { DB: db, JWT_SECRET_VALUE: 'secret' } as never,
      proxyRequest,
    );
    expect(response?.status).toBe(200);
    const payload = await response?.json() as { success: boolean; message?: string; data?: { access_token?: string; user?: unknown } };
    expect(payload.success).toBe(true);
    expect(payload.message).toBe('Email verified successfully');
    expect(payload.data?.access_token).toBeTruthy();
    expect(payload.data?.user).toMatchObject({ email: 'user@example.com' });
    const setCookie = response?.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('auth_token=');
    expect(proxyRequest).not.toHaveBeenCalled();
  });
});
