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
    adminMembership: {
      findUnique: vi.fn(),
    },
  },
}));

import { JwtUtils } from '@/utils/jwt';
import { prisma } from '@/config/database';
import { authMiddleware, optionalAuthMiddleware } from '@/core/auth/middleware';
import { resetAuthCompatibilityCache } from '@/core/auth/user-compat';
import { resetAdminMembershipCompatibilityCache } from '@/core/auth/admin-membership-compat';

const mockJwtUtils = JwtUtils as {
  verify: ReturnType<typeof vi.fn>;
};

const mockPrismaUser = prisma.user as {
  findUnique: ReturnType<typeof vi.fn>;
};

const mockPrismaAdminMembership = prisma.adminMembership as {
  findUnique: ReturnType<typeof vi.fn>;
};

describe('authMiddleware compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthCompatibilityCache();
    resetAdminMembershipCompatibilityCache();
    mockPrismaAdminMembership.findUnique.mockResolvedValue(null);
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

  it('derives scoped permissions for non-ADMIN staff roles', async () => {
    mockJwtUtils.verify.mockReturnValue({ userId: 'user-3' });
    mockPrismaUser.findUnique.mockResolvedValueOnce({
      id: 'user-3',
      email: 'support@jiffoo.com',
      username: 'support',
      role: 'SUPPORT_AGENT',
      isActive: true,
      avatar: null,
      emailVerified: true,
    });

    const request = {
      headers: { authorization: 'Bearer token' },
    } as any;
    const reply = {} as any;

    await authMiddleware(request, reply);

    expect(request.user).toEqual(
      expect.objectContaining({
        role: 'SUPPORT_AGENT',
        adminRole: 'SUPPORT_AGENT',
        isOwner: false,
      })
    );
    expect(request.user.permissions).toContain('customers.read');
    expect(request.user.permissions).not.toContain('products.read');
  });

  it('prefers AdminMembership access when storefront role stays USER', async () => {
    mockJwtUtils.verify.mockReturnValue({ userId: 'user-4' });
    mockPrismaUser.findUnique.mockResolvedValueOnce({
      id: 'user-4',
      email: 'staff@jiffoo.com',
      username: 'staff',
      role: 'USER',
      isActive: true,
      avatar: null,
      emailVerified: true,
    });
    mockPrismaAdminMembership.findUnique.mockResolvedValueOnce({
      id: 'membership-1',
      userId: 'user-4',
      role: 'ANALYST',
      status: 'ACTIVE',
      isOwner: false,
      extraPermissions: null,
      revokedPermissions: null,
      createdByUserId: null,
      updatedByUserId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = {
      headers: { authorization: 'Bearer token' },
    } as any;

    await authMiddleware(request, {} as any);

    expect(request.user).toEqual(
      expect.objectContaining({
        role: 'USER',
        adminRole: 'ANALYST',
        isOwner: false,
      })
    );
    expect(request.user.permissions).toContain('dashboard.read');
    expect(request.user.permissions).toContain('health.read');
  });
});
