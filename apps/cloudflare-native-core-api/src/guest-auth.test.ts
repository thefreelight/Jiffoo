import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));

const { tryNativeAuth } = await import('./auth');

function guestRow(email: string) {
  return {
    id: 'guest-user-1', email, username: 'guest_abc', role: 'GUEST', avatar: null,
    password_salt: 'salt', password_hash: 'hash', password_iterations: 100000,
    is_active: 1, migrated_at: '', updated_at: '', email_verified: 1,
    verification_code_hash: null, verification_expires_at: null, verification_attempts: 0,
  };
}

describe('native guest auth', () => {
  it('creates a stable guest identity and returns a checkout-capable session', async () => {
    const first = vi.fn().mockResolvedValue(null);
    const second = vi.fn().mockImplementation(async () => guestRow('placeholder@guest.bokmoo.invalid'));
    const run = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const prepare = vi.fn((sql: string) => ({
      bind: vi.fn(() => ({ first: sql.includes('SELECT') ? (first.mock.calls.length ? second : first) : undefined, run })),
    }));
    const response = await tryNativeAuth(
      new Request('https://api.example/api/v1/auth/guest', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ installId: 'install-123' }),
      }),
      { DB: { prepare } as never, JWT_SECRET_VALUE: 'test-secret' } as never,
      vi.fn(),
    );
    expect(response?.status).toBe(201);
    const body = await response!.json() as { data: { accountType: string; guestId: string; access_token: string } };
    expect(body.data.accountType).toBe('guest');
    expect(body.data.guestId).toMatch(/^guest_[0-9a-f]{32}$/);
    expect(body.data.access_token).toEqual(expect.any(String));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('reuses an existing guest identity for the same install id', async () => {
    const existing = guestRow('existing@guest.bokmoo.invalid');
    const first = vi.fn().mockResolvedValue(existing);
    const prepare = vi.fn((sql: string) => ({ bind: vi.fn(() => ({ first: sql.includes('SELECT') ? first : undefined })) }));
    const response = await tryNativeAuth(
      new Request('https://api.example/api/v1/auth/guest', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ installId: 'install-123' }),
      }),
      { DB: { prepare } as never, JWT_SECRET_VALUE: 'test-secret' } as never,
      vi.fn(),
    );
    expect(response?.status).toBe(201);
    expect(prepare).toHaveBeenCalledTimes(1);
  });
});
