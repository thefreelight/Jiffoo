import { prisma } from '@/config/database';
import { redisCache } from '@/core/cache/redis';

export interface RoleDefinition {
  name: string;
  displayName: string;
  description: string;
  level: number;
  permissions: string[];
}

export interface PermissionDefinition {
  name: string;
  displayName: string;
  description: string;
  module: string;
  action: string;
  resource?: string;
}

export class PermissionManager {

  // 预定义的角色
  private static readonly ROLES: RoleDefinition[] = [
    {
      name: 'SUPER_ADMIN',
      displayName: 'Super Administrator',
      description: 'Full system access with all permissions',
      level: 100,
      permissions: ['*'] // 所有权限
    },
    {
      name: 'ADMIN',
      displayName: 'Administrator',
      description: 'System administrator with most permissions',
      level: 90,
      permissions: [
        'users.*',
        'tenants.*',
        'sales.*',
        'plugins.*',
        'templates.*',
        'analytics.*',
        'system.config'
      ]
    },
    {
      name: 'TENANT_ADMIN',
      displayName: 'Tenant Administrator',
      description: 'Full access within tenant scope',
      level: 50,
      permissions: [
        'tenant.manage',
        'tenant.users.*',
        'tenant.sales.*',
        'tenant.pricing.*',
        'tenant.analytics.*',
        'plugins.purchase',
        'templates.purchase'
      ]
    },
    {
      name: 'TENANT_MANAGER',
      displayName: 'Tenant Manager',
      description: 'Limited management access within tenant',
      level: 30,
      permissions: [
        'tenant.view',
        'tenant.users.view',
        'tenant.sales.view',
        'tenant.pricing.view',
        'tenant.analytics.view',
        'plugins.purchase',
        'templates.purchase'
      ]
    },
    {
      name: 'USER',
      displayName: 'Regular User',
      description: 'Basic user with limited permissions',
      level: 10,
      permissions: [
        'profile.manage',
        'plugins.purchase',
        'templates.purchase',
        'orders.own'
      ]
    }
  ];

  // 预定义的权限
  private static readonly PERMISSIONS: PermissionDefinition[] = [
    // 用户管理
    { name: 'users.create', displayName: 'Create Users', description: 'Create new users', module: 'users', action: 'create' },
    { name: 'users.view', displayName: 'View Users', description: 'View user information', module: 'users', action: 'read' },
    { name: 'users.update', displayName: 'Update Users', description: 'Update user information', module: 'users', action: 'update' },
    { name: 'users.delete', displayName: 'Delete Users', description: 'Delete users', module: 'users', action: 'delete' },
    { name: 'users.*', displayName: 'Manage Users', description: 'Full user management', module: 'users', action: 'manage' },

    // 租户管理
    { name: 'tenants.create', displayName: 'Create Tenants', description: 'Register new tenants', module: 'tenants', action: 'create' },
    { name: 'tenants.view', displayName: 'View Tenants', description: 'View tenant information', module: 'tenants', action: 'read' },
    { name: 'tenants.update', displayName: 'Update Tenants', description: 'Update tenant information', module: 'tenants', action: 'update' },
    { name: 'tenants.delete', displayName: 'Delete Tenants', description: 'Delete tenants', module: 'tenants', action: 'delete' },
    { name: 'tenants.*', displayName: 'Manage Tenants', description: 'Full tenant management', module: 'tenants', action: 'manage' },

    // 租户内部权限
    { name: 'tenant.manage', displayName: 'Manage Tenant', description: 'Manage own tenant', module: 'tenant', action: 'manage', resource: 'own' },
    { name: 'tenant.view', displayName: 'View Tenant', description: 'View own tenant', module: 'tenant', action: 'read', resource: 'own' },
    { name: 'tenant.users.create', displayName: 'Add Tenant Users', description: 'Add users to tenant', module: 'tenant', action: 'create', resource: 'users' },
    { name: 'tenant.users.view', displayName: 'View Tenant Users', description: 'View tenant users', module: 'tenant', action: 'read', resource: 'users' },
    { name: 'tenant.users.*', displayName: 'Manage Tenant Users', description: 'Manage tenant users', module: 'tenant', action: 'manage', resource: 'users' },

    // 销售管理
    { name: 'sales.create', displayName: 'Create Sales', description: 'Process sales', module: 'sales', action: 'create' },
    { name: 'sales.view', displayName: 'View Sales', description: 'View sales data', module: 'sales', action: 'read' },
    { name: 'sales.update', displayName: 'Update Sales', description: 'Update sales records', module: 'sales', action: 'update' },
    { name: 'sales.*', displayName: 'Manage Sales', description: 'Full sales management', module: 'sales', action: 'manage' },

    // 租户销售权限
    { name: 'tenant.sales.view', displayName: 'View Tenant Sales', description: 'View tenant sales', module: 'tenant', action: 'read', resource: 'sales' },
    { name: 'tenant.sales.*', displayName: 'Manage Tenant Sales', description: 'Manage tenant sales', module: 'tenant', action: 'manage', resource: 'sales' },

    // 定价管理
    { name: 'pricing.create', displayName: 'Create Pricing', description: 'Set product pricing', module: 'pricing', action: 'create' },
    { name: 'pricing.view', displayName: 'View Pricing', description: 'View pricing information', module: 'pricing', action: 'read' },
    { name: 'pricing.update', displayName: 'Update Pricing', description: 'Update pricing', module: 'pricing', action: 'update' },
    { name: 'pricing.*', displayName: 'Manage Pricing', description: 'Full pricing management', module: 'pricing', action: 'manage' },

    // 租户定价权限
    { name: 'tenant.pricing.view', displayName: 'View Tenant Pricing', description: 'View tenant pricing', module: 'tenant', action: 'read', resource: 'pricing' },
    { name: 'tenant.pricing.*', displayName: 'Manage Tenant Pricing', description: 'Manage tenant pricing', module: 'tenant', action: 'manage', resource: 'pricing' },

    // 插件管理
    { name: 'plugins.create', displayName: 'Create Plugins', description: 'Create new plugins', module: 'plugins', action: 'create' },
    { name: 'plugins.view', displayName: 'View Plugins', description: 'View plugin information', module: 'plugins', action: 'read' },
    { name: 'plugins.update', displayName: 'Update Plugins', description: 'Update plugins', module: 'plugins', action: 'update' },
    { name: 'plugins.delete', displayName: 'Delete Plugins', description: 'Delete plugins', module: 'plugins', action: 'delete' },
    { name: 'plugins.purchase', displayName: 'Purchase Plugins', description: 'Purchase plugins', module: 'plugins', action: 'purchase' },
    { name: 'plugins.*', displayName: 'Manage Plugins', description: 'Full plugin management', module: 'plugins', action: 'manage' },

    // 模板管理
    { name: 'templates.create', displayName: 'Create Templates', description: 'Create new templates', module: 'templates', action: 'create' },
    { name: 'templates.view', displayName: 'View Templates', description: 'View template information', module: 'templates', action: 'read' },
    { name: 'templates.update', displayName: 'Update Templates', description: 'Update templates', module: 'templates', action: 'update' },
    { name: 'templates.delete', displayName: 'Delete Templates', description: 'Delete templates', module: 'templates', action: 'delete' },
    { name: 'templates.purchase', displayName: 'Purchase Templates', description: 'Purchase templates', module: 'templates', action: 'purchase' },
    { name: 'templates.*', displayName: 'Manage Templates', description: 'Full template management', module: 'templates', action: 'manage' },

    // 分析权限
    { name: 'analytics.view', displayName: 'View Analytics', description: 'View system analytics', module: 'analytics', action: 'read' },
    { name: 'analytics.*', displayName: 'Manage Analytics', description: 'Full analytics access', module: 'analytics', action: 'manage' },
    { name: 'tenant.analytics.view', displayName: 'View Tenant Analytics', description: 'View tenant analytics', module: 'tenant', action: 'read', resource: 'analytics' },
    { name: 'tenant.analytics.*', displayName: 'Manage Tenant Analytics', description: 'Manage tenant analytics', module: 'tenant', action: 'manage', resource: 'analytics' },

    // 个人权限
    { name: 'profile.manage', displayName: 'Manage Profile', description: 'Manage own profile', module: 'profile', action: 'manage', resource: 'own' },
    { name: 'orders.own', displayName: 'View Own Orders', description: 'View own orders', module: 'orders', action: 'read', resource: 'own' },

    // 系统权限
    { name: 'system.config', displayName: 'System Configuration', description: 'Configure system settings', module: 'system', action: 'config' },
    { name: '*', displayName: 'All Permissions', description: 'Full system access', module: '*', action: '*' }
  ];

  /**
   * 初始化权限系统
   */
  async initializePermissions(): Promise<void> {
    try {
      // 创建权限
      for (const permDef of PermissionManager.PERMISSIONS) {
        await prisma.permission.upsert({
          where: { name: permDef.name },
          update: {
            displayName: permDef.displayName,
            description: permDef.description,
            module: permDef.module,
            action: permDef.action,
            resource: permDef.resource
          },
          create: permDef
        });
      }

      // 创建角色
      for (const roleDef of PermissionManager.ROLES) {
        const role = await prisma.role.upsert({
          where: { name: roleDef.name },
          update: {
            displayName: roleDef.displayName,
            description: roleDef.description,
            level: roleDef.level
          },
          create: {
            name: roleDef.name,
            displayName: roleDef.displayName,
            description: roleDef.description,
            level: roleDef.level
          }
        });

        // 分配权限给角色
        for (const permissionName of roleDef.permissions) {
          if (permissionName === '*') {
            // 分配所有权限
            const allPermissions = await prisma.permission.findMany();
            for (const permission of allPermissions) {
              await prisma.rolePermission.upsert({
                where: {
                  roleId_permissionId: {
                    roleId: role.id,
                    permissionId: permission.id
                  }
                },
                update: {},
                create: {
                  roleId: role.id,
                  permissionId: permission.id
                }
              });
            }
          } else if (permissionName.endsWith('.*')) {
            // 分配模块所有权限
            const module = permissionName.replace('.*', '');
            const modulePermissions = await prisma.permission.findMany({
              where: { module }
            });
            for (const permission of modulePermissions) {
              await prisma.rolePermission.upsert({
                where: {
                  roleId_permissionId: {
                    roleId: role.id,
                    permissionId: permission.id
                  }
                },
                update: {},
                create: {
                  roleId: role.id,
                  permissionId: permission.id
                }
              });
            }
          } else {
            // 分配具体权限
            const permission = await prisma.permission.findUnique({
              where: { name: permissionName }
            });
            if (permission) {
              await prisma.rolePermission.upsert({
                where: {
                  roleId_permissionId: {
                    roleId: role.id,
                    permissionId: permission.id
                  }
                },
                update: {},
                create: {
                  roleId: role.id,
                  permissionId: permission.id
                }
              });
            }
          }
        }
      }

      console.log('Permission system initialized successfully');
    } catch (error) {
      console.error('Failed to initialize permission system:', error);
      throw error;
    }
  }

  /**
   * 为用户分配角色
   */
  async assignRole(userId: string, roleName: string, tenantId?: string): Promise<void> {
    const role = await prisma.role.findUnique({
      where: { name: roleName }
    });

    if (!role) {
      throw new Error(`Role ${roleName} not found`);
    }

    // 由于SQLite不支持包含null的复合唯一约束，我们需要手动检查
    const existingRole = await prisma.userRole.findFirst({
      where: {
        userId,
        roleId: role.id,
        tenantId: tenantId || null
      }
    });

    if (existingRole) {
      await prisma.userRole.update({
        where: { id: existingRole.id },
        data: { isActive: true }
      });
    } else {
      await prisma.userRole.create({
        data: {
          userId,
          roleId: role.id,
          tenantId: tenantId || null
        }
      });
    }

    // 清除用户权限缓存
    await this.clearUserPermissionCache(userId);
  }

  /**
   * 检查用户权限
   */
  async hasPermission(
    userId: string,
    permission: string,
    tenantId?: string
  ): Promise<boolean> {
    try {
      const cacheKey = `user-permissions:${userId}:${tenantId || 'global'}`;
      let userPermissions = await redisCache.get(cacheKey);

      if (!userPermissions) {
        userPermissions = await this.getUserPermissions(userId, tenantId);
        await redisCache.set(cacheKey, JSON.stringify(userPermissions), 3600);
      } else {
        userPermissions = JSON.parse(userPermissions as string);
      }

      const permissions = userPermissions as string[];
      // 检查是否有超级权限
      if (permissions.includes('*')) {
        return true;
      }

      // 检查具体权限
      if (permissions.includes(permission)) {
        return true;
      }

      // 检查模块权限
      const [module] = permission.split('.');
      if (permissions.includes(`${module}.*`)) {
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  /**
   * 获取用户所有权限
   */
  async getUserPermissions(userId: string, tenantId?: string): Promise<string[]> {
    const userRoles = await prisma.userRole.findMany({
      where: {
        userId,
        isActive: true,
        OR: [
          { tenantId: tenantId || null },
          { tenantId: null } // 总是包含全局权限
        ]
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              where: { isActive: true },
              include: {
                permission: true
              }
            }
          }
        }
      }
    });

    const permissions = new Set<string>();

    for (const userRole of userRoles) {
      if (userRole.role && userRole.role.rolePermissions) {
        for (const rolePermission of userRole.role.rolePermissions) {
          if (rolePermission.permission && rolePermission.permission.name) {
            permissions.add(rolePermission.permission.name);
          }
        }
      }
    }

    return Array.from(permissions);
  }

  /**
   * 获取用户角色
   */
  async getUserRoles(userId: string, tenantId?: string): Promise<any[]> {
    return await prisma.userRole.findMany({
      where: {
        userId,
        isActive: true,
        OR: [
          { tenantId: tenantId || null },
          { tenantId: null } // 总是包含全局角色
        ]
      },
      include: {
        role: true,
        tenant: tenantId ? {
          select: {
            id: true,
            companyName: true
          }
        } : false
      }
    });
  }

  /**
   * 清除用户权限缓存
   */
  async clearUserPermissionCache(userId: string): Promise<void> {
    const keys = await redisCache.keys(`user-permissions:${userId}:*`);
    if (keys.length > 0) {
      for (const key of keys) {
        await redisCache.del(key);
      }
    }
  }

  /**
   * 记录操作日志
   */
  async logAction(
    userId: string,
    action: string,
    module: string,
    resourceId?: string,
    resourceType?: string,
    oldValues?: any,
    newValues?: any,
    tenantId?: string,
    ipAddress?: string,
    userAgent?: string,
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId,
        tenantId,
        action,
        module,
        resourceId,
        resourceType,
        oldValues: oldValues ? JSON.stringify(oldValues) : null,
        newValues: newValues ? JSON.stringify(newValues) : null,
        ipAddress,
        userAgent,
        success,
        errorMessage
      }
    });
  }
}

// 单例实例
export const permissionManager = new PermissionManager();
