import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/utils/jwt', () => ({ JwtUtils: { verify: vi.fn() } }));
vi.mock('@/config/database', () => ({ prisma: { user: { findUnique: vi.fn() } } }));
import { JwtUtils } from '@/utils/jwt';
import { prisma } from '@/config/database';
import { authMiddleware, optionalAuthMiddleware } from '@/core/auth/middleware';

describe('authMiddleware dependency isolation', () => {
  beforeEach(() => vi.clearAllMocks());
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
