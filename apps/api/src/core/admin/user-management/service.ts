import { prisma } from '@/config/database';
import { UpdateUserRequest, UpdateUserRoleRequest, GetUsersRequest, BatchUpdateRequest } from './types';

/**
 * 管理员用户管理服务
 * 提供管理员专用的用户管理功能
 */
export class UserManagementService {
  
  /**
   * 获取所有用户列表（管理员专用）
   */
  static async getAllUsers(params: GetUsersRequest) {
    const { page = 1, limit = 10, search, role, status, tenantId } = params;
    const skip = (page - 1) * limit;

    // 构建查询条件
    const whereCondition: any = {};

    // 租户过滤
    if (tenantId) {
      whereCondition.tenantId = parseInt(tenantId);
    }

    // 搜索条件
    if (search) {
      whereCondition.OR = [
        { username: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } }
      ];
    }

    // 角色过滤
    if (role) {
      whereCondition.role = role;
    }

    // 状态过滤（假设有status字段）
    if (status) {
      whereCondition.status = status;
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
          updatedAt: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where: whereCondition })
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages
      }
    };
  }

  /**
   * 获取用户详情（管理员专用）
   */
  static async getUserById(userId: string, tenantId: string) {
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: parseInt(tenantId)
      },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        // 语言偏好 - 暂时禁用
        // languagePreference: {
        //   select: {
        //     preferredLanguage: true,
        //     timezone: true,
        //     dateFormat: true,
        //     timeFormat: true
        //   }
        // }
      }
    });

    return user;
  }

  /**
   * 更新用户信息（管理员专用）
   */
  static async updateUser(userId: string, updateData: UpdateUserRequest, tenantId: string) {
    // 验证用户是否属于当前租户
    const existingUser = await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: parseInt(tenantId)
      }
    });

    if (!existingUser) {
      throw new Error('User not found or access denied');
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...updateData,
        updatedAt: new Date()
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

    return updatedUser;
  }

  /**
   * 更新用户角色（管理员专用）
   */
  static async updateUserRole(userId: string, roleData: UpdateUserRoleRequest, tenantId: string) {
    // 验证用户是否属于当前租户
    const existingUser = await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: parseInt(tenantId)
      }
    });

    if (!existingUser) {
      throw new Error('User not found or access denied');
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        role: roleData.role,
        updatedAt: new Date()
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

    return updatedUser;
  }

  /**
   * 删除用户（管理员专用）
   */
  static async deleteUser(userId: string, tenantId: string) {
    // 验证用户是否属于当前租户
    const existingUser = await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: parseInt(tenantId)
      }
    });

    if (!existingUser) {
      throw new Error('User not found or access denied');
    }

    // 软删除 + 数据匿名化
    // 1. 标记用户为非活跃状态
    // 2. 匿名化个人信息（符合GDPR等隐私法规）
    // 3. 保留订单等业务数据用于审计和财务报表
    const timestamp = Date.now();
    await prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        email: `deleted_${userId}_${timestamp}@deleted.local`,
        username: `deleted_user_${timestamp}`,
        password: 'DELETED_ACCOUNT',
        avatar: null,
        updatedAt: new Date()
      }
    });

    return true;
  }

  /**
   * 批量操作用户（管理员专用）
   */
  static async batchUpdateUsers(params: BatchUpdateRequest) {
    const { action, userIds, role, tenantId, operatorId } = params;

    // 验证所有用户都属于当前租户
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        tenantId: parseInt(tenantId)
      },
      select: { id: true }
    });

    if (users.length !== userIds.length) {
      throw new Error('Some users not found or access denied');
    }

    // 防止操作自己
    if (userIds.includes(operatorId)) {
      throw new Error('Cannot perform batch operation on yourself');
    }

    let updateData: any = { updatedAt: new Date() };

    switch (action) {
      case 'activate':
        // updateData.status = 'active';  // User模型中暂时没有status字段
        throw new Error('Activate action not supported - User model has no status field');
      case 'deactivate':
        // updateData.status = 'inactive';  // User模型中暂时没有status字段
        throw new Error('Deactivate action not supported - User model has no status field');
      case 'delete': {
        // 批量软删除 + 数据匿名化
        const timestamp = Date.now();
        const updatePromises = userIds.map((userId, index) =>
          prisma.user.update({
            where: { id: userId },
            data: {
              isActive: false,
              email: `deleted_${userId}_${timestamp}_${index}@deleted.local`,
              username: `deleted_user_${timestamp}_${index}`,
              password: 'DELETED_ACCOUNT',
              avatar: null,
              updatedAt: new Date()
            }
          })
        );

        await Promise.all(updatePromises);

        return {
          updatedCount: userIds.length,
          action,
          userIds
        };
      }
      case 'updateRole':
        if (!role) {
          throw new Error('Role is required for updateRole action');
        }
        updateData.role = role;
        break;
      default:
        throw new Error('Invalid batch action');
    }

    const result = await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: updateData
    });

    return {
      updatedCount: result.count,
      action,
      userIds
    };
  }

  /**
   * 获取用户统计信息（管理员专用）
   */
  static async getUserStats(tenantId: string) {
    const stats = await prisma.user.groupBy({
      by: ['role'],
      where: {
        tenantId: parseInt(tenantId)
      },
      _count: {
        id: true
      }
    });

    const totalUsers = await prisma.user.count({
      where: {
        tenantId: parseInt(tenantId)
      }
    });

    const activeUsers = await prisma.user.count({
      where: {
        tenantId: parseInt(tenantId)
        // status: 'active'  // 注意：User模型中可能没有status字段
      }
    });

    return {
      totalUsers,
      activeUsers,
      roleDistribution: stats.reduce((acc, stat) => {
        acc[stat.role] = stat._count.id;
        return acc;
      }, {} as Record<string, number>)
    };
  }
}
