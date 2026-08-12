import { beforeEach, describe, expect, it, vi } from 'vitest';

const authenticateNativeUser = vi.fn();
const findNativeUserByEmail = vi.fn();
const findNativeUserById = vi.fn();
const nativePublicUser = vi.fn((user: Record<string, unknown>) => ({
  id: user.id,
  email: user.email,
  username: user.username,
  role: user.role,
  avatar: user.avatar ?? null,
  emailVerified: user.email_verified === 1,
}));
const verifyNativePassword = vi.fn();
const sendNativeVerificationCode = vi.fn();

vi.mock('./auth', () => ({
  authenticateNativeUser,
  findNativeUserByEmail,
  findNativeUserById,
  nativePublicUser,
  verifyNativePassword,
}));
vi.mock('./email-verification', () => ({ sendNativeVerificationCode }));

const { tryNativeShopperAccount } = await import('./shopper-account');

type Row = Record<string, unknown>;

function env(rows: Record<string, Row | null | Row[]> = {}) {
  const prepare = vi.fn((sql: string) => ({
    bind: (..._args: unknown[]) => ({
      first: async () => {
        if (sql.includes('native_rr_resumes')) return rows.resumes ?? null;
        return rows.first ?? null;
      },
      all: async () => ({ results: Array.isArray(rows[sql] as Row[]) ? rows[sql] : [] }),
      run: async () => ({ success: true, meta: { changes: 1 } }),
    }),
  }));
  return { DB: { prepare } };
}

describe('RemoteRadar account privacy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateNativeUser.mockResolvedValue({ id: 'u1', email: 'old@example.com', username: 'user', role: 'USER', avatar: null, emailVerified: true });
    findNativeUserByEmail.mockResolvedValue(null);
    findNativeUserById.mockResolvedValue({ id: 'u1', email: 'new@example.com', username: 'user', role: 'USER', avatar: null, email_verified: 0, is_active: 1, migrated_at: 'now', updated_at: 'now' });
    verifyNativePassword.mockResolvedValue(true);
    sendNativeVerificationCode.mockResolvedValue(undefined);
  });

  it('requires authentication for account export', async () => {
    authenticateNativeUser.mockResolvedValueOnce(null);
    const response = await tryNativeShopperAccount(new Request('https://api.example/api/v1/account/export'), env() as never);
    expect(response?.status).toBe(401);
  });

  it('exports user-owned data without SMTP password or source fields', async () => {
    const prepare = vi.fn((sql: string) => ({
      bind: (..._args: unknown[]) => ({
        first: async () => null,
        all: async () => ({ results: sql.includes('remoteradar_user_smtp_configs') ? [{ host: 'smtp.example.com', username: 'user', from_email: 'user@example.com' }] : [] }),
      }),
    }));
    const response = await tryNativeShopperAccount(new Request('https://api.example/api/v1/account/export'), { DB: { prepare } } as never);
    expect(response?.status).toBe(200);
    expect(response?.headers.get('content-disposition')).toContain('remoteradar-account-export.json');
    const payload = await response?.json() as Record<string, unknown>;
    expect(payload).toHaveProperty('account');
    expect(JSON.stringify(payload)).not.toContain('sourceUrl');
    expect(JSON.stringify(payload)).not.toContain('encrypted_password');
  });

  it('resets verification and sends a code when changing email', async () => {
    const response = await tryNativeShopperAccount(new Request('https://api.example/api/v1/account/email', {
      method: 'PUT',
      body: JSON.stringify({ newEmail: 'new@example.com', currentPassword: 'correct-password' }),
    }), env() as never);
    expect(response?.status).toBe(200);
    expect(sendNativeVerificationCode).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ email: 'new@example.com' }));
    expect(response?.headers.get('set-cookie')).toContain('auth_token=;');
    expect(response?.headers.get('set-cookie')).toContain('refresh_token=;');
    await expect(response?.json()).resolves.toMatchObject({ data: { emailVerificationRequired: true } });
  });

  it('rolls back the email when verification delivery fails', async () => {
    sendNativeVerificationCode.mockRejectedValueOnce(new Error('SMTP unavailable'));
    const response = await tryNativeShopperAccount(new Request('https://api.example/api/v1/account/email', {
      method: 'PUT',
      body: JSON.stringify({ newEmail: 'new@example.com', currentPassword: 'correct-password' }),
    }), env() as never);
    expect(response?.status).toBe(503);
  });
});
