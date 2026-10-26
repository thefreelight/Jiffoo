import { PluginPageService } from "@/core/plugin-pages/service";
import { ApiError, knownPrismaOperation } from '@/utils/api-errors';
import { prisma } from '@/config/database';
import { PasswordUtils } from '@/utils/password';
import { UpdateEmailRequest, UpdateProfileRequest } from './types';
import { EmailVerificationService } from '@/core/auth/email-verification.service';
import { AuthIdentityService } from '@/core/auth/identity-service';

/**
 * User Account Service
 * Focused on personal profile management
 */
export class AccountService {
  static async removeAvatar(userId: string) {
    const profile = await knownPrismaOperation(() => AuthIdentityService.removeAvatar(prisma, userId, this.profileSelect), { notFound: 'NOT_FOUND' });
    return { ...profile, ...(await this.getOrderStats(userId)) };
  }
  static async deleteAccount(userId: string, currentPassword: string): Promise<void> {
    await knownPrismaOperation(() => prisma.$transaction(async (tx) => {
      const user = await AuthIdentityService.requireAccountWithCredentials(tx, userId);
      if (!await PasswordUtils.verify(currentPassword, user.password)) throw new ApiError('INVALID_PASSWORD');
      if (user.role === 'ADMIN') {
        const settings = await tx.systemSettings.findUnique({ where: { id: 'system' }, select: { installedBy: true } });
        throw new ApiError(settings?.installedBy === userId ? 'INSTALL_ADMIN_PROTECTED' : 'SELF_REMOVAL_FORBIDDEN');
      }
      await AuthIdentityService.deactivateCustomer(tx, userId);
      await PluginPageService.revokePrincipalSessions(tx, userId);
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
    const profile = await AuthIdentityService.readAccount(prisma, userId, this.profileSelect);

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
    const updatedProfile = await knownPrismaOperation(() => AuthIdentityService.updateProfile(
      prisma,
      userId,
      updateData,
      this.profileSelect
    ), { notFound: 'NOT_FOUND' });

    return {
      ...updatedProfile,
      ...(await this.getOrderStats(userId)),
    };
  }

  static async updateEmail(userId: string, data: UpdateEmailRequest) {
    const normalizedEmail = data.newEmail.trim().toLowerCase();
    const user = await AuthIdentityService.readAccountWithCredentials(prisma, userId);

    if (!user) {
      throw new ApiError('NOT_FOUND');
    }

    const isValidPassword = await PasswordUtils.verify(data.currentPassword, user.password);
    if (!isValidPassword) {
      throw new ApiError('INVALID_PASSWORD');
    }

    const existing = await AuthIdentityService.findAccountByEmail(prisma, normalizedEmail, userId);

    if (existing) {
      throw new ApiError('EMAIL_TAKEN');
    }

    const updatedProfile = await knownPrismaOperation(() => prisma.$transaction(async (tx) => {
      const updated = await AuthIdentityService.changeEmail(tx, userId, normalizedEmail, this.profileSelect);
      await EmailVerificationService.createVerification(tx, userId, updated.email, updated.username);
      return updated;
    }), { notFound: 'NOT_FOUND', duplicateEmail: 'EMAIL_TAKEN' });

    return {
      ...updatedProfile,
      ...(await this.getOrderStats(userId)),
    };
  }
}
