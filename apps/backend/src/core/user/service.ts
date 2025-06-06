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

export class UserService {
  static async getAllUsers(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
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
      prisma.user.count(),
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

  static async updateUser(id: string, data: UpdateUserRequest) {
    // Check if username is already taken (if provided)
    if (data.username) {
      const existingUser = await prisma.user.findFirst({
        where: {
          username: data.username,
          NOT: { id },
        },
      });

      if (existingUser) {
        throw new Error('Username is already taken');
      }
    }

    return prisma.user.update({
      where: { id },
      data,
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

  static async updateUserRole(id: string, data: UpdateUserRoleRequest) {
    return prisma.user.update({
      where: { id },
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

  static async deleteUser(id: string) {
    return prisma.user.delete({
      where: { id },
    });
  }

  // === User Profile Management Methods ===

  /**
   * Get user profile with language preferences
   */
  static async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        languagePreference: {
          select: {
            preferredLanguage: true,
            timezone: true,
            dateFormat: true,
            timeFormat: true,
            numberFormat: true,
            currencyFormat: true,
          }
        }
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  /**
   * Update user profile
   */
  static async updateProfile(userId: string, data: UpdateProfileRequest) {
    // Check if username is already taken (if provided)
    if (data.username) {
      const existingUser = await prisma.user.findFirst({
        where: {
          username: data.username,
          NOT: { id: userId }
        }
      });

      if (existingUser) {
        throw new Error('Username is already taken');
      }
    }

    const updatedUser = await prisma.user.update({
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
      }
    });

    return updatedUser;
  }

  /**
   * Change password
   */
  static async changePassword(userId: string, data: ChangePasswordRequest) {
    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValidPassword = await PasswordUtils.verify(data.currentPassword, user.password);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const hashedNewPassword = await PasswordUtils.hash(data.newPassword);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword }
    });

    return { message: 'Password updated successfully' };
  }

  /**
   * Get user orders with pagination
   */
  static async getUserOrders(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId },
        skip,
        take: limit,
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  images: true,
                  price: true,
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.order.count({ where: { userId } })
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    };
  }

  /**
   * Get user order statistics
   */
  static async getUserOrderStats(userId: string) {
    const [totalOrders, totalSpent, recentOrders] = await Promise.all([
      prisma.order.count({ where: { userId } }),
      prisma.order.aggregate({
        where: { userId },
        _sum: { totalAmount: true }
      }),
      prisma.order.findMany({
        where: { userId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          totalAmount: true,
          createdAt: true,
        }
      })
    ]);

    // Get order status counts
    const statusCounts = await prisma.order.groupBy({
      by: ['status'],
      where: { userId },
      _count: { status: true }
    });

    const statusStats = statusCounts.reduce((acc, item) => {
      acc[item.status.toLowerCase()] = item._count.status;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalOrders,
      totalSpent: totalSpent._sum.totalAmount || 0,
      recentOrders,
      statusStats: {
        pending: statusStats.pending || 0,
        paid: statusStats.paid || 0,
        shipped: statusStats.shipped || 0,
        delivered: statusStats.delivered || 0,
        cancelled: statusStats.cancelled || 0,
      }
    };
  }

  /**
   * Update user language preferences
   */
  static async updateLanguagePreferences(userId: string, preferences: {
    preferredLanguage?: string;
    timezone?: string;
    dateFormat?: string;
    timeFormat?: string;
    numberFormat?: string;
    currencyFormat?: string;
  }) {
    const updatedPreferences = await prisma.userLanguagePreference.upsert({
      where: { userId },
      update: preferences,
      create: {
        userId,
        ...preferences,
      }
    });

    return updatedPreferences;
  }
}
