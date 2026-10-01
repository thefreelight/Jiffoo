import { beforeEach, describe, expect, it, vi } from 'vitest';

const authenticateNativeUser = vi.fn();
const encryptNativeUserSecret = vi.fn(async () => ({ iv: 'iv', ciphertext: 'cipher' }));
const sendSmtpEmail = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeUser }));
vi.mock('./plugin-settings', () => ({ encryptNativeUserSecret, decryptNativeUserSecret: vi.fn() }));
vi.mock('./smtp', () => ({ sendSmtpEmail }));
const { tryNativeRemoteRadarSmtp } = await import('./remoteradar-smtp');
const base = 'https://api.example/api/v1/plugins/remoteradar-smtp/store';

function env(row: unknown = null, recent = 0) {
  const prepare = vi.fn((sql: string) => ({ bind: (...args: unknown[]) => ({
    first: async () => sql.includes('COUNT(*)') ? { count: recent } : row,
    run: async () => ({ success: true, args }),
  }) }));
  return { DB: { prepare } };
}

describe('RemoteRadar user SMTP', () => {
  beforeEach(() => { vi.clearAllMocks(); authenticateNativeUser.mockResolvedValue({ id: 'u1', email: 'user@example.com' }); });

  it('requires authentication', async () => {
    authenticateNativeUser.mockResolvedValue(null);
    const response = await tryNativeRemoteRadarSmtp(new Request(`${base}/config`), env() as never);
    expect(response?.status).toBe(401);
  });

  it('rejects local or malformed SMTP hosts', async () => {
    const response = await tryNativeRemoteRadarSmtp(new Request(`${base}/config`, { method: 'PUT', body: JSON.stringify({ host: '127.0.0.1', port: 25, username: 'u', password: 'p', fromEmail: 'u@example.com' }) }), env() as never);
    expect(response?.status).toBe(400);
    expect(encryptNativeUserSecret).not.toHaveBeenCalled();
  });

  it('never returns the encrypted password', async () => {
    const row = { id: 's1', user_id: 'u1', host: 'smtp.example.com', port: 587, secure: 0, username: 'u', encrypted_password: 'secret', from_email: 'u@example.com', from_name: null, reply_to: null, enabled: 1, created_at: 'now', updated_at: 'now' };
    const response = await tryNativeRemoteRadarSmtp(new Request(`${base}/config`), env(row) as never);
    const payload = await response?.json() as { data: Record<string, unknown> };
    expect(payload.data.passwordConfigured).toBe(true);
    expect(JSON.stringify(payload)).not.toContain('secret');
  });

  it('rate limits SMTP test messages', async () => {
    const row = { id: 's1', user_id: 'u1', enabled: 1 };
    const response = await tryNativeRemoteRadarSmtp(new Request(`${base}/test`, { method: 'POST' }), env(row, 3) as never);
    expect(response?.status).toBe(429);
    expect(sendSmtpEmail).not.toHaveBeenCalled();
  });
});
