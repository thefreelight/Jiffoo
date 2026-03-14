import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/jwt', () => ({
  JwtUtils: {
    verify: vi.fn(),
  },
}));

vi.mock('@/config/database', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { JwtUtils } from '@/utils/jwt';
import { prisma } from '@/config/database';
import { authMiddleware, optionalAuthMiddleware } from '@/core/auth/middleware';
import { resetAuthCompatibilityCache } from '@/core/auth/user-compat';

const mockJwtUtils = JwtUtils as {
  verify: ReturnType<typeof vi.fn>;
};

const mockPrismaUser = prisma.user as {
  findUnique: ReturnType<typeof vi.fn>;
};

describe('authMiddleware compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthCompatibilityCache();
  });

  it('accepts legacy user rows when emailVerified column is missing', async () => {
    mockJwtUtils.verify.mockReturnValue({ userId: 'user-1' });
    mockPrismaUser.findUnique
      .mockRejectedValueOnce(new Error('The column `users.emailVerified` does not exist in the current database.'))
      .mockResolvedValueOnce({
        id: 'user-1',
        email: 'admin@jiffoo.com',
        username: 'admin',
        role: 'ADMIN',
        isActive: true,
        avatar: null,
      });

    const request = {
      headers: { authorization: 'Bearer token' },
    } as any;
    const reply = {} as any;

    await authMiddleware(request, reply);

    expect(request.user).toEqual(
      expect.objectContaining({
        id: 'user-1',
        email: 'admin@jiffoo.com',
        role: 'ADMIN',
        emailVerified: true,
      })
    );
  });

  it('keeps optional auth non-fatal for legacy user rows', async () => {
    mockJwtUtils.verify.mockReturnValue({ userId: 'user-2' });
    mockPrismaUser.findUnique
      .mockRejectedValueOnce(new Error('The column `users.emailVerified` does not exist in the current database.'))
      .mockResolvedValueOnce({
        id: 'user-2',
        email: 'user@jiffoo.com',
        username: 'user',
        role: 'USER',
        isActive: true,
        avatar: null,
      });

    const request = {
      headers: { authorization: 'Bearer token' },
    } as any;

    await optionalAuthMiddleware(request, {} as any);

    expect(request.user).toEqual(
      expect.objectContaining({
        id: 'user-2',
        email: 'user@jiffoo.com',
        role: 'USER',
        emailVerified: true,
      })
    );
  });
});
