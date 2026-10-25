import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/utils/jwt', () => ({ JwtUtils: { verify: vi.fn() } }));
vi.mock('@/config/database', () => ({ prisma: { user: { findUnique: vi.fn() } } }));
import { JwtUtils } from '@/utils/jwt';
import { prisma } from '@/config/database';
import { authMiddleware, optionalAuthMiddleware, verifiedRequestSession } from '@/core/auth/middleware';

describe('authMiddleware dependency isolation', () => {
  beforeEach(() => vi.clearAllMocks());
  it('does not grant trusted session admission to a prepopulated user', async () => {
    const request = { headers: {}, user: { id: 'forged', role: 'ADMIN' } } as Parameters<typeof authMiddleware>[0];
    await authMiddleware(request, {} as Parameters<typeof authMiddleware>[1]);
    expect(verifiedRequestSession(request)).toBeUndefined();
    expect(JwtUtils.verify).not.toHaveBeenCalled();
  });
  it('keeps verified session version request-local without adding it to the public user', async () => {
    vi.mocked(JwtUtils.verify).mockReturnValue({ userId: 'admin-1', sv: 7 } as ReturnType<typeof JwtUtils.verify>);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: 'admin-1', email: 'admin@example.test', role: 'ADMIN', sessionVersion: 7, isActive: true, removedAt: null } as any);
    const request = { headers: { authorization: 'Bearer token' } } as Parameters<typeof authMiddleware>[0];
    await authMiddleware(request, {} as Parameters<typeof authMiddleware>[1]);
    expect(verifiedRequestSession(request)).toEqual({ userId: 'admin-1', sessionVersion: 7 });
    expect(request.user).not.toHaveProperty('sessionVersion');
    expect(request.user).not.toHaveProperty('sv');
  });
  it('retains trusted admission through global optional auth followed by required auth', async () => {
    vi.mocked(JwtUtils.verify).mockReturnValue({ userId: 'admin-chain', sv: 3 } as ReturnType<typeof JwtUtils.verify>);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: 'admin-chain', email: 'admin@example.test', role: 'ADMIN', sessionVersion: 3, isActive: true, removedAt: null } as any);
    const request = { headers: { authorization: 'Bearer token' } } as Parameters<typeof authMiddleware>[0];
    await optionalAuthMiddleware(request, {} as Parameters<typeof optionalAuthMiddleware>[1]);
    await authMiddleware(request, {} as Parameters<typeof authMiddleware>[1]);
    expect(verifiedRequestSession(request)).toEqual({ userId: 'admin-chain', sessionVersion: 3 });
    expect(JwtUtils.verify).toHaveBeenCalledTimes(1);
    expect(request.user).not.toHaveProperty('sessionVersion');
  });
  it('propagates schema failures without querying legacy user rows', async () => {
    vi.mocked(JwtUtils.verify).mockReturnValue({ userId: 'user-1', sv: 0 } as ReturnType<typeof JwtUtils.verify>);
    const failure = new Error('Missing canonical user column');
    vi.mocked(prisma.user.findUnique).mockRejectedValueOnce(failure);
    const request = { headers: { authorization: 'Bearer token' } } as Parameters<typeof authMiddleware>[0];
    await expect(authMiddleware(request, {} as Parameters<typeof authMiddleware>[1])).rejects.toBe(failure);
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
    expect(request.user).toBeUndefined();
  });
  it('propagates optional-auth dependencies instead of treating the caller as anonymous', async () => {
    vi.mocked(JwtUtils.verify).mockReturnValue({ userId: 'user-2', sv: 0 } as ReturnType<typeof JwtUtils.verify>);
    const failure = new Error('Database query failed');
    vi.mocked(prisma.user.findUnique).mockRejectedValueOnce(failure);
    const request = { headers: { authorization: 'Bearer token' } } as Parameters<typeof optionalAuthMiddleware>[0];
    await expect(optionalAuthMiddleware(request, {} as Parameters<typeof optionalAuthMiddleware>[1])).rejects.toBe(failure);
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
    expect(request.user).toBeUndefined();
  });
});
