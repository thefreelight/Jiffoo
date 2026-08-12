import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, verifyPasswordMock, sendVerificationMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    order: {
      count: vi.fn(),
      aggregate: vi.fn(),
    },
  },
  verifyPasswordMock: vi.fn(),
  sendVerificationMock: vi.fn(),
}));

vi.mock('@/config/database', () => ({ prisma: prismaMock }));
vi.mock('@/utils/password', () => ({
  PasswordUtils: { verify: verifyPasswordMock },
}));
vi.mock('@/services/email-verification.service', () => ({
  EmailVerificationService: { sendVerificationEmail: sendVerificationMock },
}));

import { AccountService } from '@/core/account/service';

describe('AccountService.updateEmail', () => {
  const user = {
    id: 'user-1',
    email: 'old@example.com',
    username: 'buyer',
    password: 'hash',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue(user);
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.user.update.mockResolvedValue({
      id: user.id,
      email: 'new@example.com',
      username: user.username,
      avatar: null,
      role: 'USER',
      isActive: true,
      emailVerified: false,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
    });
    prismaMock.order.count.mockResolvedValue(0);
    prismaMock.order.aggregate.mockResolvedValue({ _sum: { totalAmount: null } });
    verifyPasswordMock.mockResolvedValue(true);
    sendVerificationMock.mockResolvedValue({ success: true });
  });

  it('revokes verification and sends a code to the normalized new address', async () => {
    const result = await AccountService.updateEmail(user.id, {
      newEmail: ' NEW@Example.com ',
      currentPassword: 'password',
    });

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: { email: 'new@example.com', id: { not: user.id } },
      select: { id: true },
    });
    expect(prismaMock.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: user.id },
      data: expect.objectContaining({
        email: 'new@example.com',
        emailVerified: false,
        verificationToken: null,
        verificationTokenExpiry: null,
      }),
    }));
    expect(sendVerificationMock).toHaveBeenCalledWith(
      user.id,
      'new@example.com',
      user.username,
    );
    expect(result.emailVerified).toBe(false);
  });

  it('fails explicitly when the verification email cannot be accepted', async () => {
    sendVerificationMock.mockResolvedValue({ success: false, error: 'provider unavailable' });

    await expect(AccountService.updateEmail(user.id, {
      newEmail: 'new@example.com',
      currentPassword: 'password',
    })).rejects.toThrow('provider unavailable');
  });
});
