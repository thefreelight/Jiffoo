import { prisma } from '@/config/database';
import { PasswordUtils } from '@/utils/password';
import { UpdateEmailRequest, UpdateProfileRequest } from './types';
import { EmailVerificationService } from '@/services/email-verification.service';

/**
 * User Account Service
 * Focused on personal profile management
 */
export class AccountService {
  private static readonly profileSelect = {
    id: true,
    email: true,
    username: true,
    avatar: true,
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
      throw new Error('User not found');
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
    const updatedProfile = await prisma.user.update({
      where: { id: userId },
      data: {
        ...updateData,
        updatedAt: new Date()
      },
      select: this.profileSelect
    });

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
      throw new Error('User not found');
    }

    const isValidPassword = await PasswordUtils.verify(data.currentPassword, user.password);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    const existing = await prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        id: { not: userId },
      },
      select: { id: true },
    });

    if (existing) {
      throw new Error('Email is already in use');
    }

    const updatedProfile = await prisma.user.update({
      where: { id: userId },
      data: {
        email: normalizedEmail,
        emailVerified: false,
        verificationToken: null,
        verificationTokenExpiry: null,
        updatedAt: new Date(),
      },
      select: this.profileSelect,
    });

    const verification = await EmailVerificationService.sendVerificationEmail(
      userId,
      updatedProfile.email,
      updatedProfile.username,
    );
    if (!verification.success) {
      throw new Error(verification.error || 'Failed to send email verification code');
    }

    return {
      ...updatedProfile,
      ...(await this.getOrderStats(userId)),
    };
  }
}
