/**
 * Admin User Service
 */

import { prisma } from '@/config/database';
import { ApiError, knownPrismaOperation, type ErrorCode } from '@/utils/api-errors';
import { PasswordUtils } from '@/utils/password';
import { CacheService } from '@/core/cache/service';
import { emitEvent } from '@/infra/events/emit';
import { customerSnapshot } from '@/infra/events/snapshots';
import { Prisma } from '@prisma/client';
import { customerList, customerNeighbors, customerBase, customerItem, type CustomerQuery, type CustomerRow } from './list-query';
import { AuditService } from '@/core/audit/service';
import { AuthIdentityService } from '@/core/auth/identity-service';
import { systemSettingsService } from '@/core/settings/service';

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

  static async getUsers(query: CustomerQuery = {}) {
    return customerList(query);
  }

  static async getUserNeighbors(id: string, query: CustomerQuery = {}) {
    return customerNeighbors(id, query);
  }

  static async getUserById(userId: string) {
    const currency = await systemSettingsService.getShopCurrency();
    const [rows, recentOrders, addressOrder] = await prisma.$transaction([
      prisma.$queryRaw<CustomerRow[]>(Prisma.sql`${customerBase(Prisma.sql`u.role = 'USER' AND u.id = ${userId}`)}`),
      prisma.order.findMany({ where: { userId }, take: 10, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { id: true, orderNumber: true, status: true, paymentStatus: true, totalAmount: true, currency: true, createdAt: true } }),
      prisma.order.findFirst({ where: { userId, shippingAddress: { isNot: null } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { id: true, orderNumber: true, shippingAddress: true } }),
    ], { isolationLevel: 'RepeatableRead' });
    if (!rows[0]) return null;
    const address = addressOrder?.shippingAddress;
    return { ...customerItem(rows[0], currency),
      recentOrders: recentOrders.map(order => ({ ...order, totalAmount: Number(order.totalAmount), createdAt: order.createdAt.toISOString() })),
      latestShippingAddress: address ? {
        orderId: addressOrder!.id, orderNumber: addressOrder!.orderNumber, recipientName: [address.firstName, address.lastName].filter(Boolean).join(' '),
        phone: address.phone, street: address.addressLine1, street2: address.addressLine2,
        city: address.city, state: address.state, zipCode: address.postalCode, country: address.country,
      } : null,
    };
  }

  static async createUser(data: {
    email: string;
    password: string;
    username?: string;
    role?: string;
  }) {
    if (Object.prototype.hasOwnProperty.call(data, 'role')) {
      throw new CustomerManagementError('Role cannot be changed here', 'ROLE_CHANGE_FORBIDDEN', 400);
    }
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (existingUser) {
      throw new ApiError('BAD_REQUEST');
    }

    const hashedPassword = await PasswordUtils.hash(data.password);

    const user = await prisma.$transaction(async (tx) => {
      const created = await AuthIdentityService.createCustomer(tx, {
        email: data.email,
        password: hashedPassword,
        username: data.username || data.email.split('@')[0],
      }, {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        createdAt: true,
        isActive: true,
        updatedAt: true,
        locale: true,
        emailVerified: true,
      });
      await emitEvent(tx, 'customer.created', 1, created.id, customerSnapshot(created));
      return created;
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
    isActive?: boolean;
  }, actorId: string) {
    if (Object.prototype.hasOwnProperty.call(data, 'role')) {
      throw new CustomerManagementError('Role cannot be changed here', 'ROLE_CHANGE_FORBIDDEN', 400);
    }
    const user = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM public.users WHERE id = ${userId} FOR UPDATE`);
      const target = await tx.user.findUnique({ where: { id: userId }, select: { role: true, email: true, username: true, isActive: true } });
      if (!target) throw new ApiError('NOT_FOUND');
      if (target?.role === 'ADMIN') throw new CustomerManagementError('Administrator accounts are managed separately', 'ADMIN_ACCOUNT_PROTECTED', 409);
      const updated = await AuthIdentityService.updateCustomer(tx, userId, {
        username: data.username,
        isActive: data.isActive,
      }, {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      });
      const summary = { email: updated.email, username: updated.username };
      if (updated.username !== target.username) {
        await AuditService.write(tx, { actorId, action: 'customer.renamed', targetType: 'customer', targetId: userId,
          summary: { ...summary, from: target.username, to: updated.username } });
      }
      if (updated.isActive !== target.isActive) {
        await AuditService.write(tx, { actorId, action: updated.isActive ? 'customer.reactivated' : 'customer.deactivated', targetType: 'customer', targetId: userId, summary });
      }
      return updated;
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

  static async deleteUser(userId: string, actorId: string) {
    await prisma.$transaction(async (tx) => {
      // Lock before reading the snapshot so it matches the deleted customer.
      await tx.$queryRaw(Prisma.sql`SELECT id FROM public.users WHERE id = ${userId} FOR UPDATE`);
      const existingUser = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, email: true, username: true },
      });

      if (!existingUser) {
        throw new ApiError('NOT_FOUND');
      }
      if (existingUser.role === 'ADMIN') {
        throw new CustomerManagementError('Administrator accounts are managed separately', 'ADMIN_ACCOUNT_PROTECTED', 409);
      }

      if (await tx.order.count({ where: { userId } }) > 0) throw new ApiError('CUSTOMER_HAS_ORDERS');

      await knownPrismaOperation(() => AuthIdentityService.deleteCustomer(tx, userId), { notFound: 'NOT_FOUND' });
      await AuditService.write(tx, { actorId, action: 'customer.deleted', targetType: 'customer', targetId: userId,
        summary: { email: existingUser.email, username: existingUser.username } });
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

}

export class CustomerManagementError extends ApiError {
  constructor(_message: string, code: ErrorCode, _statusCode: number) {
    super(code);
  }
}
