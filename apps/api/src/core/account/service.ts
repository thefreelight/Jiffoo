import { ApiError, knownPrismaOperation } from '@/utils/api-errors';
import { prisma } from '@/config/database';
import { PasswordUtils } from '@/utils/password';
import { UpdateEmailRequest, UpdateProfileRequest } from './types';
import { EmailVerificationService } from '@/services/email-verification.service';

/**
 * User Account Service
 * Focused on personal profile management
 */
export class AccountService {
  static async deleteAccount(userId: string, currentPassword: string): Promise<void> {
    await knownPrismaOperation(() => prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (!await PasswordUtils.verify(currentPassword, user.password)) throw new ApiError('INVALID_PASSWORD');
      if (user.role === 'ADMIN') {
        const settings = await tx.systemSettings.findUnique({ where: { id: 'system' }, select: { installedBy: true } });
        throw new ApiError(settings?.installedBy === userId ? 'INSTALL_ADMIN_PROTECTED' : 'SELF_REMOVAL_FORBIDDEN');
      }
      await tx.user.update({ where: { id: userId, role: 'USER' }, data: { isActive: false } });
    }), { notFound: 'NOT_FOUND' });
  }
  private static readonly profileSelect = {
    id: true,
    email: true,
    username: true,
    avatar: true,
    locale: true,
    emailVerified: true,
    role: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  private static async getOrderStats(userId: string) {
    const [orderCount, orderAmount] = await Promise.all([
      prisma.order.count({ where: { userId } }),
      prisma.order.aggregate({
        where: { userId },
        _sum: {
          totalAmount: true,
        },
      }),
    ]);

    return {
      orderCount,
      totalOrders: orderCount,
      totalSpent: Number(orderAmount._sum.totalAmount ?? 0),
    };
  }

  /**
   * Get user profile
   */
  static async getProfile(userId: string) {
    const profile = await prisma.user.findUnique({
      where: { id: userId },
      select: this.profileSelect
    });

    if (!profile) {
      throw new ApiError('NOT_FOUND');
    }

    return {
      ...profile,
      ...(await this.getOrderStats(userId)),
    };
  }

  /**
   * Update user profile
   */
  static async updateProfile(userId: string, updateData: UpdateProfileRequest) {
    const updatedProfile = await knownPrismaOperation(() => prisma.user.update({
      where: { id: userId },
      data: {
        ...updateData,
        updatedAt: new Date()
      },
      select: this.profileSelect
    }), { notFound: 'NOT_FOUND' });

    return {
      ...updatedProfile,
      ...(await this.getOrderStats(userId)),
    };
  }

  static async updateEmail(userId: string, data: UpdateEmailRequest) {
    const normalizedEmail = data.newEmail.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ApiError('NOT_FOUND');
    }

    const isValidPassword = await PasswordUtils.verify(data.currentPassword, user.password);
    if (!isValidPassword) {
      throw new ApiError('INVALID_PASSWORD');
    }

    const existing = await prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        id: { not: userId },
      },
      select: { id: true },
    });

    if (existing) {
      throw new ApiError('EMAIL_TAKEN');
    }

    const updatedProfile = await knownPrismaOperation(() => prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          email: normalizedEmail,
          emailVerified: false,
          updatedAt: new Date(),
        },
        select: this.profileSelect,
      });
      await EmailVerificationService.createVerification(tx, userId, updated.email, updated.username);
      return updated;
    }), { notFound: 'NOT_FOUND', duplicateEmail: 'INTERNAL_SERVER_ERROR' });

    return {
      ...updatedProfile,
      ...(await this.getOrderStats(userId)),
    };
  }
}
