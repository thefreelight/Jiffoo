/**
 * Admin User Service
 */

import { prisma } from '@/config/database';
import { PasswordUtils } from '@/utils/password';
import { CacheService } from '@/core/cache/service';

function calculateTrendPercent(current: number, previous: number): number {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

export class AdminUserService {
  static async getUserStats() {
    const now = new Date();
    const startOfTodayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startOfYesterdayUtc = new Date(startOfTodayUtc);
    startOfYesterdayUtc.setUTCDate(startOfYesterdayUtc.getUTCDate() - 1);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const whereUsers = { role: 'USER' as const };

    const [totalUsers, activeUsers, newThisMonth, todayTotalUsers, yesterdayTotalUsers, todayActiveUsers, yesterdayActiveUsers, todayInactiveUsers, yesterdayInactiveUsers, todayNewUsers, yesterdayNewUsers] = await Promise.all([
      prisma.user.count({ where: whereUsers }),
      prisma.user.count({ where: { ...whereUsers, isActive: true } }),
      prisma.user.count({
        where: {
          ...whereUsers,
          createdAt: { gte: startOfMonth },
        },
      }),
      prisma.user.count({ where: { ...whereUsers, createdAt: { gte: startOfTodayUtc } } }),
      prisma.user.count({ where: { ...whereUsers, createdAt: { gte: startOfYesterdayUtc, lt: startOfTodayUtc } } }),
      prisma.user.count({ where: { ...whereUsers, isActive: true, createdAt: { gte: startOfTodayUtc } } }),
      prisma.user.count({ where: { ...whereUsers, isActive: true, createdAt: { gte: startOfYesterdayUtc, lt: startOfTodayUtc } } }),
      prisma.user.count({ where: { ...whereUsers, isActive: false, createdAt: { gte: startOfTodayUtc } } }),
      prisma.user.count({ where: { ...whereUsers, isActive: false, createdAt: { gte: startOfYesterdayUtc, lt: startOfTodayUtc } } }),
      prisma.user.count({ where: { ...whereUsers, createdAt: { gte: startOfTodayUtc } } }),
      prisma.user.count({ where: { ...whereUsers, createdAt: { gte: startOfYesterdayUtc, lt: startOfTodayUtc } } }),
    ]);

    return {
      metrics: {
        totalUsers,
        activeUsers,
        inactiveUsers: Math.max(0, totalUsers - activeUsers),
        newThisMonth,
        totalUsersTrend: calculateTrendPercent(todayTotalUsers, yesterdayTotalUsers),
        activeUsersTrend: calculateTrendPercent(todayActiveUsers, yesterdayActiveUsers),
        inactiveUsersTrend: calculateTrendPercent(todayInactiveUsers, yesterdayInactiveUsers),
        newUsersTrend: calculateTrendPercent(todayNewUsers, yesterdayNewUsers),
      }
    };
  }

  /**
   * Get users list - flattened response for UI display
   * Returns: { items: [...], pagination: {...} }
   * Uses versioned cache (30s TTL) similar to orders
   */
  static async getUsers(page = 1, limit = 10, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = {
      role: 'USER' // Only return users with USER role
    };

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Try cache first
    const cached = await CacheService.getUserList(page, limit, { search });
    if (cached) return cached;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          username: true,
          avatar: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    const result = {
      items: users.map(u => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    };

    // Save to cache (30s TTL for admin users list)
    await CacheService.setUserList(page, limit, result, { search }, 30);

    return result;
  }

  static async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        orders: {
          select: {
            id: true,
            totalAmount: true,
            status: true,
            paymentStatus: true
          }
        }
      }
    });

    if (!user) return null;

    // Calculate order statistics
    const totalOrders = user.orders.length;
    const completedOrders = user.orders.filter(o => o.paymentStatus === 'PAID');
    const totalSpent = completedOrders.reduce((sum, order) => sum + Number(order.totalAmount), 0);

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      avatar: user.avatar,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      // Order statistics
      totalOrders,
      totalSpent,
      // Note: lastLoginAt is not in the schema yet, would need migration
      lastLoginAt: null
    };
  }

  static async createUser(data: {
    email: string;
    password: string;
    username?: string;
    role?: string;
  }) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (existingUser) {
      throw new Error('Email already exists');
    }

    const hashedPassword = await PasswordUtils.hash(data.password);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        username: data.username || data.email.split('@')[0],
        role: data.role || 'USER'
      },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Invalidate user list cache
    await CacheService.incrementUserVersion();

    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    };
  }

  static async updateUser(userId: string, data: {
    username?: string;
    role?: string;
    avatar?: string;
    isActive?: boolean;
  }) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: data,
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Invalidate user list cache and specific user cache
    await Promise.all([
      CacheService.incrementUserVersion(),
      CacheService.deleteUser(userId)
    ]);

    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    };
  }

  static async deleteUser(userId: string) {
    await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!existingUser) {
        throw new Error('User not found');
      }

      const userOrders = await tx.order.findMany({
        where: { userId },
        select: { id: true },
      });
      const orderIds = userOrders.map((order) => order.id);

      if (orderIds.length > 0) {
        await tx.refund.deleteMany({
          where: { orderId: { in: orderIds } },
        });

        await tx.shipment.deleteMany({
          where: { orderId: { in: orderIds } },
        });

        await tx.payment.deleteMany({
          where: { orderId: { in: orderIds } },
        });

        await tx.order.deleteMany({
          where: { id: { in: orderIds } },
        });
      }

      await tx.user.delete({
        where: { id: userId },
      });
    });

    // Invalidate user list cache and specific user cache
    await Promise.all([
      CacheService.incrementUserVersion(),
      CacheService.deleteUser(userId)
    ]);

    return {
      userId,
      deleted: true,
    };
  }

  static async resetPassword(userId: string, newPassword: string) {
    const hashedPassword = await PasswordUtils.hash(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    // Invalidate specific user cache (password change doesn't affect list)
    await CacheService.deleteUser(userId);
  }
}
