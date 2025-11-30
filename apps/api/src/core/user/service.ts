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
  static async getAllUsers(page = 1, limit = 10, search?: string, tenantId?: string) {
    const skip = (page - 1) * limit;

    // 构建搜索条件
    const whereCondition: any = {};

    if (search) {
      whereCondition.OR = [
        { username: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } }
      ];
    }

    // 如果指定了租户ID，只获取该租户的用户
    if (tenantId) {
      whereCondition.tenantUsers = {
        some: {
          tenantId: tenantId
        }
      };
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

  static async getUserById(id: string, tenantId?: string) {
    // 构建查询条件
    const where: any = { id };

    // 如果指定了租户ID，确保用户属于该租户
    if (tenantId) {
      where.tenantId = parseInt(tenantId);
    }

    return prisma.user.findFirst({
      where,
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

  static async updateUser(id: string, data: UpdateUserRequest, tenantId?: string) {
    // 首先验证用户是否属于指定租户
    if (tenantId) {
      const userExists = await prisma.user.findFirst({
        where: {
          id,
          tenantId: parseInt(tenantId)
        }
      });

      if (!userExists) {
        throw new Error('User not found in the specified tenant');
      }
    }

    // Check if username is already taken (if provided)
    if (data.username) {
      const whereCondition: any = {
        username: data.username,
        NOT: { id },
      };

      // 如果指定了租户，只在该租户内检查用户名冲突
      if (tenantId) {
        whereCondition.tenantId = parseInt(tenantId);
      }

      const existingUser = await prisma.user.findFirst({
        where: whereCondition,
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

  static async updateUserRole(id: string, data: UpdateUserRoleRequest, tenantId?: string) {
    // 首先验证用户是否属于指定租户
    if (tenantId) {
      const userExists = await prisma.user.findFirst({
        where: {
          id,
          tenantId: parseInt(tenantId)
        }
      });

      if (!userExists) {
        throw new Error('User not found in the specified tenant');
      }
    }

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

  static async deleteUser(id: string, tenantId?: string) {
    // 首先验证用户是否属于指定租户
    if (tenantId) {
      const userExists = await prisma.user.findFirst({
        where: {
          id,
          tenantId: parseInt(tenantId)
        }
      });

      if (!userExists) {
        throw new Error('User not found in the specified tenant');
      }
    }

    return prisma.user.delete({
      where: { id },
    });
  }

  // === User Profile Management Methods ===

  /**
   * Get user profile with language preferences
   * 🔒 安全修复：添加租户过滤，防止跨租户数据泄露
   */
  static async getProfile(userId: string, tenantId?: string) {
    // 构建查询条件，包含租户过滤
    const where: any = { id: userId };

    // 如果指定了租户ID，确保用户属于该租户
    if (tenantId) {
      where.tenantUsers = {
        some: {
          tenantId: tenantId
        }
      };
    }

    const user = await prisma.user.findFirst({
      where,
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

    if (!user) {
      throw new Error('User not found or access denied');
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

    const statusStats = statusCounts.reduce((acc: any, item: any) => {
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
}
