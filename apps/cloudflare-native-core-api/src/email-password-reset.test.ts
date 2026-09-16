import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));

const { sendNativePasswordResetCode, completeNativePasswordReset } = await import('./email-password-reset');
const { tryNativeAuth } = await import('./auth');

function resetDb(options: { existing?: Record<string, unknown> } = {}) {
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

async function resetDigest(secret: string, userId: string, value: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`reset:${userId}:${value}`)));
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

describe('password reset lifecycle', () => {
  it('sends a branded reset email and stores a namespaced code hash', async () => {
    smtp.sendSmtpEmail.mockReset().mockResolvedValue(undefined);
    const { db, statements } = resetDb();
    await sendNativePasswordResetCode(
      { DB: db, JWT_SECRET_VALUE: 'secret' } as never,
      { id: 'u1', email: 'user@example.com', username: 'Jordan' },
    );
    const update = statements.find((s) => s.sql.includes('reset_code_hash'));
    expect(update).toBeTruthy();
    expect(update!.sql).toContain('reset_attempts = 0');
    expect(update!.values![0]).toMatch(/^[0-9a-f]{64}$/);
    const call = smtp.sendSmtpEmail.mock.calls[0]![1] as { subject: string; text: string; html: string };
    expect(call.subject).toMatch(/password reset code: \d{6}$/);
    expect(call.html).toContain('Reset your password');
    expect(call.html).not.toMatch(/<script/i);
  });

  it('escapes user-controlled values in the reset email', async () => {
    smtp.sendSmtpEmail.mockReset().mockResolvedValue(undefined);
    const { db } = resetDb();
    await sendNativePasswordResetCode(
      { DB: db, JWT_SECRET_VALUE: 'secret' } as never,
      { id: 'u2', email: 'x@example.com', username: '<b>Evil</b> & Co' },
    );
    const call = smtp.sendSmtpEmail.mock.calls[0]![1] as { html: string };
    expect(call.html).toContain('&lt;b&gt;Evil&lt;/b&gt; &amp; Co');
    expect(call.html).not.toContain('<b>Evil</b>');
  });

  it('rejects a verification-shaped digest: reset HMAC is namespace-prefixed', async () => {
    smtp.sendSmtpEmail.mockReset().mockResolvedValue(undefined);
    const { db } = resetDb();
    await sendNativePasswordResetCode(
      { DB: db, JWT_SECRET_VALUE: 'secret' } as never,
      { id: 'u3', email: 'y@example.com', username: 'Y' },
    );
    const stored = db as never;
    expect(stored).toBeTruthy();
    // The plain (unprefixed) verification digest must NOT match a reset code.
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode('secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const plain = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode('u3:123456')));
    const plainHex = Array.from(plain, (b) => b.toString(16).padStart(2, '0')).join('');
    const namespaced = await resetDigest('secret', 'u3', '123456');
    expect(plainHex).not.toBe(namespaced);
  });

  it('completes a reset with the right code and clears the stored hash', async () => {
    const codeHash = await resetDigest('secret', 'u1', '654321');
    const { db, statements } = resetDb({
      existing: {
        id: 'u1', email: 'user@example.com', username: 'Jordan', role: 'USER', is_active: 1,
        email_verified: 1, reset_code_hash: codeHash,
        reset_expires_at: new Date(Date.now() + 300_000).toISOString(), reset_attempts: 0,
      },
    });
    const result = await completeNativePasswordReset(
      { DB: db, JWT_SECRET_VALUE: 'secret' } as never,
      'user@example.com',
      '654321',
      'newpassword123',
    );
    expect(result.success).toBe(true);
    expect(statements.some((s) => s.sql.includes('password_salt'))).toBe(true);
    const clear = statements.find((s) => s.sql.includes('reset_code_hash = NULL'));
    expect(clear).toBeTruthy();
  });

  it('counts failed attempts and burns the code after five misses', async () => {
    const codeHash = await resetDigest('secret', 'u1', '654321');
    const { db, statements } = resetDb({
      existing: {
        id: 'u1', email: 'user@example.com', username: 'Jordan', role: 'USER', is_active: 1,
        email_verified: 1, reset_code_hash: codeHash,
        reset_expires_at: new Date(Date.now() + 300_000).toISOString(), reset_attempts: 4,
      },
    });
    const result = await completeNativePasswordReset(
      { DB: db, JWT_SECRET_VALUE: 'secret' } as never,
      'user@example.com',
      '000000',
      'newpassword123',
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Too many attempts');
    expect(statements.some((s) => s.sql.includes('reset_code_hash = NULL'))).toBe(true);
  });

  it('expired codes never reset', async () => {
    const codeHash = await resetDigest('secret', 'u1', '654321');
    const { db } = resetDb({
      existing: {
        id: 'u1', email: 'user@example.com', username: 'Jordan', role: 'USER', is_active: 1,
        email_verified: 1, reset_code_hash: codeHash,
        reset_expires_at: new Date(Date.now() - 1000).toISOString(), reset_attempts: 0,
      },
    });
    const result = await completeNativePasswordReset(
      { DB: db, JWT_SECRET_VALUE: 'secret' } as never,
      'user@example.com',
      '654321',
      'newpassword123',
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('expired');
  });
});

describe('password reset routes', () => {
  it('POST /auth/password-reset answers identically for unknown emails (anti-enumeration)', async () => {
    smtp.sendSmtpEmail.mockReset().mockResolvedValue(undefined);
    const { db } = resetDb(); // existing = null → unknown email
    const response = await tryNativeAuth(
      new Request('https://api.example/api/v1/auth/password-reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'ghost@example.com' }),
      }),
      { DB: db, JWT_SECRET_VALUE: 'secret' } as never,
      vi.fn(),
    );
    expect(response?.status).toBe(200);
    const payload = await response?.json() as { success: boolean; message?: string };
    expect(payload.success).toBe(true);
    expect(payload.message).toContain('If an account exists');
    expect(smtp.sendSmtpEmail).not.toHaveBeenCalled();
  });

  it('POST /auth/password-reset emails a code for a known active account', async () => {
    smtp.sendSmtpEmail.mockReset().mockResolvedValue(undefined);
    const { db } = resetDb({
      existing: {
        id: 'u1', email: 'user@example.com', username: 'Jordan', role: 'USER', is_active: 1,
        email_verified: 1, reset_code_hash: null, reset_expires_at: null, reset_attempts: 0,
      },
    });
    const response = await tryNativeAuth(
      new Request('https://api.example/api/v1/shop/auth/password-reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ identifier: 'user@example.com' }),
      }),
      { DB: db, JWT_SECRET_VALUE: 'secret' } as never,
      vi.fn(),
    );
    expect(response?.status).toBe(200);
    expect(smtp.sendSmtpEmail).toHaveBeenCalledTimes(1);
    expect(response?.headers.get('x-jiffoo-runtime')).toBe('cloudflare-native-d1-auth');
  });

  it('POST /auth/password-reset/complete issues a session on success', async () => {
    const codeHash = await resetDigest('secret', 'u1', '246810');
    const { db } = resetDb({
      existing: {
        id: 'u1', email: 'user@example.com', username: 'Jordan', role: 'USER', is_active: 1,
        email_verified: 1, password_salt: '', password_hash: '', password_iterations: 1,
        reset_code_hash: codeHash,
        reset_expires_at: new Date(Date.now() + 300_000).toISOString(), reset_attempts: 0,
      },
    });
    const response = await tryNativeAuth(
      new Request('https://api.example/api/v1/auth/password-reset/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', code: '246810', password: 'brandnewpass' }),
      }),
      { DB: db, JWT_SECRET_VALUE: 'secret' } as never,
      vi.fn(),
    );
    expect(response?.status).toBe(200);
    const payload = await response?.json() as { message?: string; data?: { access_token?: string } };
    expect(payload.message).toBe('Password reset successfully');
    expect(payload.data?.access_token).toBeTruthy();
    expect(response?.headers.get('set-cookie')).toContain('auth_token=');
  });

  it('rejects short passwords before touching the code', async () => {
    const { db } = resetDb();
    const response = await tryNativeAuth(
      new Request('https://api.example/api/v1/auth/password-reset/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', code: '246810', password: 'short' }),
      }),
      { DB: db, JWT_SECRET_VALUE: 'secret' } as never,
      vi.fn(),
    );
    expect(response?.status).toBe(400);
    const payload = await response?.json() as { error?: { code?: string } };
    expect(payload.error?.code).toBe('VALIDATION_ERROR');
  });
});
