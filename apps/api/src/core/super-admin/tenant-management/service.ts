import { prisma } from '@/config/database';
import { PasswordUtils } from '@/utils/password';
import {
  CreateTenantRequest,
  UpdateTenantRequest,
  UpdateTenantStatusRequest,
  GetTenantsRequest,
  SuperAdminTenantListResponse,
  SuperAdminTenantResponse,
  TenantStatsResponse,
  TenantResponse
} from './types';
import { initializeDefaultTheme } from '@/utils/theme-utils';

export class SuperAdminTenantService {

  /**
   * 创建租户（超级管理员）
   */
  static async createTenant(data: CreateTenantRequest): Promise<SuperAdminTenantResponse> {
    // 检查租户邮箱唯一性
    const existingTenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { contactEmail: data.contactEmail },
          ...(data.domain ? [{ domain: data.domain }] : []),
          ...(data.subdomain ? [{ subdomain: data.subdomain }] : [])
        ]
      }
    });

    if (existingTenant) {
      throw new Error('Email, domain, or subdomain already exists');
    }

    // 检查管理员用户邮箱和用户名唯一性
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: data.adminUser.email },
          { username: data.adminUser.username }
        ]
      }
    });

    if (existingUser) {
      throw new Error('Admin user email or username already exists');
    }

    // 使用事务创建租户（和可选的管理员用户）
    const result = await prisma.$transaction(async (tx) => {
      // 1. 创建租户
      const tenant = await tx.tenant.create({
        data: {
          companyName: data.companyName,
          contactName: data.contactName,
          contactEmail: data.contactEmail,
          contactPhone: data.contactPhone,
          domain: data.domain,
          subdomain: data.subdomain,
          branding: JSON.stringify(data.branding || {}),
          settings: JSON.stringify(data.settings || {
            timezone: 'UTC',
            currency: 'USD',
            language: 'en'
          }),
          // 数据库存储统一使用大写状态：PENDING/ACTIVE/SUSPENDED/TERMINATED
          status: 'PENDING'
        }
      });

      // 2. 创建租户管理员用户
      const hashedPassword = await PasswordUtils.hash(data.adminUser.password);

      await tx.user.create({
        data: {
          email: data.adminUser.email,
          username: data.adminUser.username,
          password: hashedPassword,
          avatar: data.adminUser.avatar,
          role: 'TENANT_ADMIN',
          tenantId: tenant.id
        }
      });

      return tenant;
    });

    // 在事务外初始化默认主题（防止主题初始化失败阻塞租户创建）
    await initializeDefaultTheme(result.id, { logger: console.log });

    return {
      success: true,
      data: this.formatTenantResponse(result)
    };
  }

  /**
   * 获取所有租户列表（超级管理员）
   */
  static async getAllTenants(params: GetTenantsRequest): Promise<SuperAdminTenantListResponse> {
    const { page = 1, limit = 10, search, status, sortBy = 'createdAt', sortOrder = 'desc' } = params;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    // 构建查询条件
    const whereCondition: any = {};

    if (status) {
      // 统一使用大写状态：PENDING/ACTIVE/SUSPENDED/TERMINATED
      whereCondition.status = status;
    }

    if (search) {
      whereCondition.OR = [
        { companyName: { contains: search, mode: 'insensitive' as const } },
        { contactName: { contains: search, mode: 'insensitive' as const } },
        { contactEmail: { contains: search, mode: 'insensitive' as const } }
      ];
    }

    // 构建排序条件
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where: whereCondition,
        orderBy,
        skip,
        take,
        include: {
          _count: {
            select: {
              products: true,
              orders: true
            }
          }
        }
      }),
      prisma.tenant.count({ where: whereCondition })
    ]);

    // 获取用户统计
    const tenantIds = tenants.map(t => t.id);
    const userCounts = await prisma.user.groupBy({
      by: ['tenantId'],
      where: { tenantId: { in: tenantIds } },
      _count: { id: true }
    });

    const userCountMap = userCounts.reduce((acc, item) => {
      if (item.tenantId) {
        acc[item.tenantId] = item._count.id;
      }
      return acc;
    }, {} as Record<number, number>);

    const formattedTenants = tenants.map(tenant => ({
      ...this.formatTenantResponse(tenant),
      stats: {
        userCount: userCountMap[tenant.id] || 0,
        productCount: tenant._count.products,
        orderCount: tenant._count.orders,
        totalRevenue: 0 // TODO: Calculate from orders
      }
    }));

    return {
      success: true,
      data: formattedTenants,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    };
  }

  /**
   * 获取租户详情（超级管理员）
   */
  static async getTenantById(tenantId: string): Promise<SuperAdminTenantResponse> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: parseInt(tenantId) },
      include: {
        _count: {
          select: {
            products: true,
            orders: true
          }
        }
      }
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    // 获取用户统计
    const userCount = await prisma.user.count({
      where: { tenantId: tenant.id }
    });

    // 获取总收入统计
    const revenueData = await prisma.order.aggregate({
      where: { tenantId: tenant.id },
      _sum: { totalAmount: true }
    });
    const totalRevenue = revenueData._sum.totalAmount || 0;

    return {
      success: true,
      data: {
        ...this.formatTenantResponse(tenant),
        stats: {
          userCount,
          productCount: tenant._count.products,
          orderCount: tenant._count.orders,
          totalRevenue
        }
      }
    };
  }

  /**
   * 更新租户信息（超级管理员）
   */
  static async updateTenant(
    tenantId: string, 
    updateData: UpdateTenantRequest
  ): Promise<SuperAdminTenantResponse> {
    const tenant = await prisma.tenant.update({
      where: { id: parseInt(tenantId) },
      data: {
        ...updateData,
        branding: updateData.branding ? JSON.stringify(updateData.branding) : undefined,
        settings: updateData.settings ? JSON.stringify(updateData.settings) : undefined,
        updatedAt: new Date()
      }
    });

    return {
      success: true,
      data: this.formatTenantResponse(tenant)
    };
  }



  /**
   * 更新租户状态（超级管理员）- 包括激活、暂停、停用等
   * 同时更新租户状态和该租户下所有用户的激活状态
   * 状态统一使用大写：PENDING/ACTIVE/SUSPENDED/TERMINATED
   */
  static async updateTenantStatus(
    tenantId: string,
    statusData: UpdateTenantStatusRequest
  ): Promise<SuperAdminTenantResponse> {
    // Zod schema 保证 status 已经是大写
    const updateData: any = {
      status: statusData.status,
      updatedAt: new Date()
    };

    console.log(`🔧 Updating tenant ${tenantId} status to: ${statusData.status}`);

    // 使用事务同时更新租户状态和用户状态
    const result = await prisma.$transaction(async (tx) => {
      // 1. 更新租户状态
      const tenant = await tx.tenant.update({
        where: { id: parseInt(tenantId) },
        data: updateData
      });

      // 2. 根据租户状态更新该租户下所有用户的激活状态
      const userIsActive = statusData.status === 'ACTIVE';
      const userUpdateResult = await tx.user.updateMany({
        where: {
          tenantId: parseInt(tenantId),
          role: { not: 'SUPER_ADMIN' } // 不影响超级管理员用户
        },
        data: {
          isActive: userIsActive,
          updatedAt: new Date()
        }
      });

      console.log(`✅ Tenant ${tenantId} status updated to: ${tenant.status}`);
      console.log(`✅ Updated ${userUpdateResult.count} users' active status to: ${userIsActive}`);

      return tenant;
    });

    return {
      success: true,
      data: this.formatTenantResponse(result)
    };
  }

  /**
   * 删除租户（超级管理员）
   */
  static async deleteTenant(tenantId: string): Promise<void> {
    // 检查租户是否有活跃数据
    const [userCount, productCount, orderCount] = await Promise.all([
      prisma.user.count({ where: { tenantId: parseInt(tenantId) } }),
      prisma.product.count({ where: { tenantId: parseInt(tenantId) } }),
      prisma.order.count({ where: { tenantId: parseInt(tenantId) } })
    ]);

    if (userCount > 0 || productCount > 0 || orderCount > 0) {
      throw new Error('Cannot delete tenant with existing data. Please transfer or remove all associated data first.');
    }

    await prisma.tenant.delete({
      where: { id: parseInt(tenantId) }
    });
  }

  /**
   * 获取租户统计信息（超级管理员）
   * 状态统一使用大写：PENDING/ACTIVE/SUSPENDED/TERMINATED
   */
  static async getTenantStats(): Promise<TenantStatsResponse> {
    const [statusStats, recentTenants] = await Promise.all([
      prisma.tenant.groupBy({
        by: ['status'],
        _count: { id: true }
      }),
      prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5
      })
    ]);

    // 使用大写状态映射表
    const statusMap: Record<string, keyof { activeTenants: number; pendingTenants: number; suspendedTenants: number; terminatedTenants: number }> = {
      ACTIVE: 'activeTenants',
      PENDING: 'pendingTenants',
      SUSPENDED: 'suspendedTenants',
      TERMINATED: 'terminatedTenants',
    };

    const stats = statusStats.reduce((acc, item) => {
      const key = statusMap[item.status];
      if (key) {
        acc[key] = (acc[key] || 0) + item._count.id;
      }
      return acc;
    }, {} as Record<string, number>);

    const totalTenants = statusStats.reduce((sum, item) => sum + item._count.id, 0);

    return {
      success: true,
      data: {
        totalTenants,
        activeTenants: stats.activeTenants || 0,
        pendingTenants: stats.pendingTenants || 0,
        suspendedTenants: stats.suspendedTenants || 0,
        terminatedTenants: stats.terminatedTenants || 0,
        recentTenants: recentTenants.map(tenant => this.formatTenantResponse(tenant))
      }
    };
  }

  /**
   * 格式化租户响应数据
   * 状态统一返回大写：PENDING/ACTIVE/SUSPENDED/TERMINATED
   */
  private static formatTenantResponse(tenant: any): TenantResponse {
    return {
      id: tenant.id,
      companyName: tenant.companyName,
      contactName: tenant.contactName,
      contactEmail: tenant.contactEmail,
      contactPhone: tenant.contactPhone,
      // 统一返回大写状态
      status: tenant.status,
      domain: tenant.domain,
      subdomain: tenant.subdomain,
      branding: tenant.branding ? JSON.parse(tenant.branding) : null,
      settings: tenant.settings ? JSON.parse(tenant.settings) : null,
      contractStart: tenant.contractStart?.toISOString(),
      contractEnd: tenant.contractEnd?.toISOString(),
      createdAt: tenant.createdAt.toISOString(),
      updatedAt: tenant.updatedAt.toISOString()
    };
  }
}
