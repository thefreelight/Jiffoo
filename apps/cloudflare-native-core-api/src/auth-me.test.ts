import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));

const { authenticateNativeUser, createNativeSession, tryNativeAuth } = await import('./auth');

describe('native shopper auth session status', () => {
  it('returns 401 for an anonymous auth/me request without calling the legacy origin', async () => {
    const proxyRequest = vi.fn();
    const response = await tryNativeAuth(
      new Request('https://api.example/api/v1/auth/me'),
      { DB: { prepare: vi.fn() }, JWT_SECRET: 'test-secret' } as never,
      proxyRequest,
    );
    expect(response?.status).toBe(401);
    await expect(response?.json()).resolves.toMatchObject({ error: { code: 'UNAUTHORIZED' } });
    expect(proxyRequest).not.toHaveBeenCalled();
  });

  it('rejects an existing access token after the account becomes unverified', async () => {
    const user = { id: 'u1', email: 'user@example.com', username: 'user', role: 'USER', avatar: null, emailVerified: true };
    const session = await createNativeSession({ DB: {} as never, JWT_SECRET_VALUE: 'test-secret' } as never, user);
    const token = (session.body.data as { access_token: string }).access_token;
    const first = vi.fn().mockResolvedValue({
      id: 'u1', email: 'new@example.com', username: 'user', role: 'USER', avatar: null,
      email_verified: 0, is_active: 1,
    });
    const request = new Request('https://api.example/api/v1/auth/me', { headers: { authorization: `Bearer ${token}` } });
    const authenticated = await authenticateNativeUser(request, {
      DB: { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ first })) })) },
      JWT_SECRET_VALUE: 'test-secret',
    } as never);
    expect(authenticated).toBeNull();
  });

  it('turns malformed refresh tokens into a stable 401 instead of a Worker exception', async () => {
    const response = await tryNativeAuth(
      new Request('https://api.example/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refresh_token: 'not-a-jwt' }),
      }),
      { DB: { prepare: vi.fn() }, JWT_SECRET_VALUE: 'test-secret' } as never,
      vi.fn(),
    );
    expect(response).toBeNull();
  });
});
