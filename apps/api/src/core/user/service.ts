// @ts-nocheck
/**
 * User Service (Single Merchant Version)
 * 
 * Simplified version, removed multi-tenant related logic.
 */

import { prisma } from '@/config/database';
import { PasswordUtils } from '@/utils/password';
import { UpdateUserRequest, UpdateUserRoleRequest } from './types';

export interface UpdateProfileRequest {
  username?: string;
  avatar?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateRecommendationConsentRequest {
  consent: boolean;
}

export class UserService {
  /**
   * Get all users
   */
  static async getAllUsers(page = 1, limit = 10, search?: string) {
    const skip = (page - 1) * limit;

    const whereCondition: any = {};

    if (search) {
      whereCondition.OR = [
        { username: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } }
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereCondition,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          username: true,
          avatar: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.user.count({ where: whereCondition }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get user by ID
   */
  static async getUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Get user by email
   */
  static async getUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Update user profile
   */
  static async updateProfile(userId: string, data: UpdateProfileRequest) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        username: data.username,
        avatar: data.avatar,
      },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Change password
   */
  static async changePassword(userId: string, data: ChangePasswordRequest) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const isValid = await PasswordUtils.verify(data.currentPassword, user.password);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    const hashedPassword = await PasswordUtils.hash(data.newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { success: true };
  }

  /**
   * Update user role (Admin)
   */
  static async updateUserRole(userId: string, data: UpdateUserRoleRequest) {
    return prisma.user.update({
      where: { id: userId },
      data: { role: data.role },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Delete user (Admin)
   */
  static async deleteUser(userId: string) {
    await prisma.user.delete({
      where: { id: userId },
    });
    return { success: true };
  }

  /**
   * Create user (Admin)
   */
  static async createUser(data: {
    email: string;
    password: string;
    username?: string;
    role?: string;
  }) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error('Email already exists');
    }

    const hashedPassword = await PasswordUtils.hash(data.password);

    return prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        username: data.username || data.email.split('@')[0],
        role: data.role || 'USER',
      },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Update recommendation consent (GDPR)
   */
  static async updateRecommendationConsent(
    userId: string,
    data: UpdateRecommendationConsentRequest
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return prisma.user.update({
      where: { id: userId },
      data: {
        recommendationConsent: data.consent,
        recommendationConsentDate: new Date(),
      },
      select: {
        id: true,
        email: true,
        username: true,
        recommendationConsent: true,
        recommendationConsentDate: true,
      },
    });
  }

  /**
   * Get recommendation consent status
   */
  static async getRecommendationConsent(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        recommendationConsent: true,
        recommendationConsentDate: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return {
      userId: user.id,
      consent: user.recommendationConsent,
      consentDate: user.recommendationConsentDate,
    };
  }
}
