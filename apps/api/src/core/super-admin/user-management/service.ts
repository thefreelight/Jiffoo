/**
 * Super Admin User Management Service
 *
 * 用户列表范围：只展示 role === 'USER' 的普通终端用户
 * 不展示：TENANT_ADMIN、SUPER_ADMIN
 *
 * 用户状态：统一基于 isActive 字段
 * - isActive === true → ACTIVE（启用）
 * - isActive === false → INACTIVE（停用）
 */
import { prisma } from '@/config/database';
import {
  UpdateUserRequest,
  UpdateUserRoleRequest,
  BatchUserOperationRequest,
  GetUsersRequest,
  SuperAdminUserResponse,
  SuperAdminUserListResponse,
  SuperAdminUserStatsResponse,
  BatchUserOperationResponse
} from './types';

export class SuperAdminUserService {
  /**
   * 获取所有用户列表（超级管理员）- 跨租户
   *
   * 范围限制：只返回 role='USER' 的普通用户
   * 不返回 TENANT_ADMIN / SUPER_ADMIN
   */
  static async getAllUsers(params: GetUsersRequest): Promise<SuperAdminUserListResponse> {
    const { page = 1, limit = 10, search, role, isActive, tenantId } = params;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    // 构建查询条件
    const whereCondition: any = {};

    // ⚠️ 核心限制：只返回普通用户
    // 即使前端传入其他角色，也强制限制为 USER
    whereCondition.role = 'USER';

    // 租户过滤
    if (tenantId) {
      whereCondition.tenantId = parseInt(tenantId);
    }

    // 搜索条件
    if (search) {
      whereCondition.OR = [
        { username: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
        { tenant: { companyName: { contains: search, mode: 'insensitive' as const } } }
      ];
    }

    // 状态过滤：基于 isActive 字段
    if (isActive !== undefined) {
      whereCondition.isActive = isActive === 'true' || isActive === true;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereCondition,
        skip,
        take: take,
        select: {
          id: true,
          email: true,
          username: true,
          avatar: true,
          role: true,
          isActive: true, // 🔧 修复：添加isActive字段
          createdAt: true,
          updatedAt: true,
          tenantId: true,
          // languagePreference: {
          //   select: {
          //     preferredLanguage: true,
          //     timezone: true,
          //     dateFormat: true,
          //     timeFormat: true,
          //   },
          // },
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where: whereCondition })
    ]);

    // 获取所有相关的租户信息（包含状态，用于计算 effectiveStatus）
    const tenantIds = [...new Set(users.map(user => user.tenantId).filter(id => id !== 0))];
    const tenants = await prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, companyName: true, contactEmail: true, status: true }
    });
    const tenantMap = tenants.reduce((acc, tenant) => {
      acc[tenant.id] = tenant;
      return acc;
    }, {} as Record<number, any>);

    return {
      success: true,
      data: users.map(user => this.formatSuperAdminUserResponse(user, tenantMap)),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  /**
   * 获取用户详情（超级管理员）
   */
  static async getUserById(userId: string): Promise<SuperAdminUserResponse | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        isActive: true, // 🔧 修复：添加isActive字段
        createdAt: true,
        updatedAt: true,
        tenantId: true,
        // languagePreference: {
        //   select: {
        //     preferredLanguage: true,
        //     timezone: true,
        //     dateFormat: true,
        //     timeFormat: true,
        //   },
        // },
      }
    });

    if (!user) {
      return null;
    }

    // 获取租户信息（包含 status 用于计算 effectiveStatus）
    let tenant = null;
    if (user.tenantId > 0) { // 只有tenantId > 0才查询租户信息
      tenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { id: true, companyName: true, contactEmail: true, status: true }
      });
    }

    const tenantMap = tenant ? { [tenant.id]: tenant } : {};
    return this.formatSuperAdminUserResponse(user, tenantMap);
  }

  /**
   * 更新用户信息（超级管理员）
   */
  static async updateUser(
    userId: string,
    updateData: UpdateUserRequest
  ): Promise<SuperAdminUserResponse> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        tenantId: true,
        // languagePreference: {
        //   select: {
        //     preferredLanguage: true,
        //     timezone: true,
        //     dateFormat: true,
        //     timeFormat: true,
        //   },
        // },
      }
    });

    // 获取租户信息
    let tenant = null;
    if (user.tenantId && user.tenantId !== 0) {
      tenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { id: true, companyName: true, contactEmail: true, status: true }
      });
    }

    const tenantMap = tenant ? { [tenant.id]: tenant } : {};
    return this.formatSuperAdminUserResponse(user, tenantMap);
  }

  /**
   * 更新用户角色（超级管理员）
   */
  static async updateUserRole(
    userId: string,
    roleData: UpdateUserRoleRequest
  ): Promise<SuperAdminUserResponse> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        role: roleData.role,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        tenantId: true,
        // languagePreference: {
        //   select: {
        //     preferredLanguage: true,
        //     timezone: true,
        //     dateFormat: true,
        //     timeFormat: true,
        //   },
        // },
      }
    });

    // 获取租户信息
    let tenant = null;
    if (user.tenantId && user.tenantId !== 0) {
      tenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { id: true, companyName: true, contactEmail: true, status: true }
      });
    }

    const tenantMap = tenant ? { [tenant.id]: tenant } : {};
    return this.formatSuperAdminUserResponse(user, tenantMap);
  }

  /**
   * 删除用户（超级管理员）
   */
  static async deleteUser(userId: string): Promise<void> {
    // 检查用户是否有活跃订单
    const activeOrders = await prisma.order.count({
      where: {
        userId: userId,
        status: { in: ['PENDING', 'PAID', 'SHIPPED'] }
      }
    });

    if (activeOrders > 0) {
      throw new Error('Cannot delete user with active orders');
    }

    await prisma.user.delete({
      where: { id: userId }
    });
  }

  /**
   * 批量操作用户（超级管理员）
   */
  static async batchOperation(
    data: BatchUserOperationRequest
  ): Promise<BatchUserOperationResponse> {
    const { action, userIds, role } = data;

    if (action === 'updateRole' && role) {
      // 批量更新角色
      const result = await prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: {
          role,
          updatedAt: new Date(),
        },
      });

      return {
        success: true,
        data: {
          action: 'updateRole',
          processedCount: result.count,
          userIds,
          role,
        },
        message: `Successfully updated ${result.count} users to ${role}`,
      };
    } else if (action === 'delete') {
      // 批量删除用户
      const result = await prisma.user.deleteMany({
        where: { id: { in: userIds } }
      });

      return {
        success: true,
        data: {
          action: 'delete',
          processedCount: result.count,
          userIds,
        },
        message: `Successfully deleted ${result.count} users`,
      };
    }

    throw new Error('Invalid batch operation');
  }

  /**
   * 获取用户统计信息（超级管理员）- 跨租户统计
   */
  static async getUserStats(): Promise<SuperAdminUserStatsResponse> {
    const [
      totalUsers,
      usersByRole,
      usersByTenant,
      recentUsers
    ] = await Promise.all([
      // 总用户数
      prisma.user.count(),

      // 按角色统计用户
      prisma.user.groupBy({
        by: ['role'],
        _count: { role: true }
      }),

      // 按租户统计用户
      prisma.user.groupBy({
        by: ['tenantId'],
        _count: { tenantId: true },
        where: {
          role: { in: ['USER', 'TENANT_ADMIN'] }
        }
      }),

      // 最近用户
      prisma.user.findMany({
        take: 5,
        select: {
          id: true,
          email: true,
          username: true,
          avatar: true,
          role: true,
          isActive: true, // 🔧 修复：添加isActive字段
          createdAt: true,
          updatedAt: true,
          tenantId: true,
          // languagePreference: {
          //   select: {
          //     preferredLanguage: true,
          //     timezone: true,
          //     dateFormat: true,
          //     timeFormat: true,
          //   },
          // },
        },
        orderBy: { createdAt: 'desc' }
      })

      // TODO: 添加活跃用户数统计（需要 lastLoginAt 字段）
    ]);

    // 格式化按角色统计的数据
    const roleStats = {
      USER: 0,
      TENANT_ADMIN: 0,
      SUPER_ADMIN: 0,
    };

    usersByRole.forEach(item => {
      if (item.role in roleStats) {
        roleStats[item.role as keyof typeof roleStats] = item._count.role;
      }
    });

    // 获取租户信息
    const tenantIds = usersByTenant.map(item => item.tenantId);
    const tenants = await prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, companyName: true }
    });

    const tenantMap = tenants.reduce((acc, tenant) => {
      acc[tenant.id] = tenant.companyName;
      return acc;
    }, {} as Record<number, string>);

    // 获取每个租户的管理员数量
    const adminCounts = await prisma.user.groupBy({
      by: ['tenantId'],
      where: {
        tenantId: { in: tenantIds },
        role: 'TENANT_ADMIN'
      },
      _count: { tenantId: true }
    });

    const adminCountMap = adminCounts.reduce((acc, item) => {
      acc[item.tenantId] = item._count.tenantId;
      return acc;
    }, {} as Record<number, number>);

    const tenantStats = usersByTenant.map(item => ({
      tenantId: item.tenantId,
      tenantName: tenantMap[item.tenantId] || 'Unknown Tenant',
      userCount: item._count.tenantId,
      adminCount: adminCountMap[item.tenantId] || 0,
    }));

    // 为最近用户获取租户信息
    const recentUserTenantIds = [...new Set(recentUsers.map(user => user.tenantId).filter(id => id !== 0))];
    const recentUserTenants = await prisma.tenant.findMany({
      where: { id: { in: recentUserTenantIds } },
      select: { id: true, companyName: true, contactEmail: true, status: true }
    });
    const recentUserTenantMap = recentUserTenants.reduce((acc, tenant) => {
      acc[tenant.id] = tenant;
      return acc;
    }, {} as Record<number, any>);

    return {
      success: true,
      data: {
        totalUsers,
        usersByRole: roleStats,
        usersByTenant: tenantStats,
        recentUsers: recentUsers.map(user => this.formatSuperAdminUserResponse(user, recentUserTenantMap)),
        activeUsers: totalUsers, // 简化版本，实际应该基于lastLoginAt
      },
    };
  }

  /**
   * 格式化超级管理员用户响应
   *
   * effectiveStatus 计算规则：
   * - ACTIVE: isActive === true 且 tenant.status === 'ACTIVE'
   * - INACTIVE: 其他情况
   */
  private static formatSuperAdminUserResponse(user: any, tenantMap: Record<number, any> = {}): SuperAdminUserResponse {
    const tenant = tenantMap[user.tenantId] || {
      id: user.tenantId,
      companyName: user.tenantId === 0 ? 'Platform Admin' : 'Unknown Tenant',
      contactEmail: user.tenantId === 0 ? 'admin@platform.com' : 'unknown@tenant.com',
      status: user.tenantId === 0 ? 'ACTIVE' : 'PENDING', // 平台管理员默认 ACTIVE
    };

    // 计算有效状态
    // 只有当用户 isActive=true 且 租户状态为 ACTIVE 时，用户才处于有效激活状态
    const effectiveStatus = (user.isActive === true && tenant.status === 'ACTIVE') ? 'ACTIVE' : 'INACTIVE';

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      avatar: user.avatar,
      role: user.role,
      isActive: user.isActive,
      effectiveStatus,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      tenantId: user.tenantId,
      tenant: {
        id: tenant.id,
        companyName: tenant.companyName,
        contactEmail: tenant.contactEmail,
        status: tenant.status,
      },
      // languagePreference: user.languagePreference, // Temporarily disabled
    };
  }
}
