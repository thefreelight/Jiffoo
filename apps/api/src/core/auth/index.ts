/**
 * 统一认证和权限管理模块导出
 * 
 * 这个文件统一导出所有认证和权限相关的功能，
 * 替代了原来分散在 middleware/auth.ts 和 core/permissions/ 中的功能
 */

// 简化的权限管理 - 基于用户角色
import { prisma } from '@/config/database';

// 中间件
export {
  authMiddleware,
  optionalAuthMiddleware,
  adminMiddleware,
  requireRole,
  requirePermission,
  tenantMiddleware,
  tenantResolver,
  optionalTenantMiddleware,
  auditLog,
  withTenantContextMiddleware
} from './middleware';

// 服务
export { AuthService } from './service';

// 类型
export type { LoginRequest, RegisterRequest, AuthResponse } from './types';
export { LoginSchema, RegisterSchema } from './types';

// 路由
export { authRoutes } from './routes';

// 导入所需的函数和对象
import {
  authMiddleware,
  optionalAuthMiddleware,
  requireRole,
  requirePermission
} from './middleware';
// 权限管理器已简化，不再需要复杂的权限管理

/**
 * 便捷的中间件别名，保持向后兼容
 */
export const authenticateUser = authMiddleware;
export const optionalAuth = optionalAuthMiddleware;
export const requireAnyRole = requireRole; // 现在支持数组参数
export const requireAnyPermission = requirePermission; // 现在支持数组参数

/**
 * 简化的权限检查辅助函数
 */
export const hasPermission = async (userId: string, permission: string, tenantId?: number) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, tenantId: true }
  });

  if (!user) return false;

  // 超级管理员拥有所有权限
  if (user.role === 'SUPER_ADMIN' && user.tenantId === 0) {
    return true;
  }

  // 租户管理员在自己租户内拥有管理权限
  if (user.role === 'TENANT_ADMIN' && user.tenantId === tenantId) {
    return true;
  }

  // 普通用户只有基本权限
  if (user.role === 'USER' && user.tenantId === tenantId) {
    return ['read', 'create', 'update'].includes(permission);
  }

  return false;
};

export const getUserPermissions = async (userId: string, _tenantId?: number) => { // eslint-disable-line @typescript-eslint/no-unused-vars
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, tenantId: true }
  });

  if (!user) return [];

  if (user.role === 'SUPER_ADMIN') return ['*'];
  if (user.role === 'TENANT_ADMIN') return ['read', 'create', 'update', 'delete', 'manage'];
  return ['read', 'create', 'update'];
};

export const getUserRoles = async (userId: string, _tenantId?: number) => { // eslint-disable-line @typescript-eslint/no-unused-vars
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, tenantId: true }
  });

  if (!user) return [];

  return [{
    role: {
      name: user.role,
      displayName: user.role,
      level: user.role === 'SUPER_ADMIN' ? 100 : user.role === 'TENANT_ADMIN' ? 50 : 10
    },
    tenantId: user.tenantId,
    isActive: true
  }];
};

export const assignRole = async (userId: string, roleName: string, _tenantId?: number) => { // eslint-disable-line @typescript-eslint/no-unused-vars
  // 简化的角色分配：直接更新用户的role字段
  await prisma.user.update({
    where: { id: userId },
    data: { role: roleName }
  });
  return true;
};

/**
 * 常用的权限常量
 */
export const PERMISSIONS = {
  // 用户管理
  USERS_CREATE: 'users.create',
  USERS_VIEW: 'users.view',
  USERS_UPDATE: 'users.update',
  USERS_DELETE: 'users.delete',
  USERS_MANAGE: 'users.*',

  // 租户管理
  TENANTS_CREATE: 'tenants.create',
  TENANTS_VIEW: 'tenants.view',
  TENANTS_UPDATE: 'tenants.update',
  TENANTS_DELETE: 'tenants.delete',
  TENANTS_MANAGE: 'tenants.*',

  // 系统权限
  SYSTEM_CONFIG: 'system.config',
  ALL_PERMISSIONS: '*'
} as const;

/**
 * 常用的角色常量
 */
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  TENANT_ADMIN: 'TENANT_ADMIN',
  TENANT_MANAGER: 'TENANT_MANAGER',
  USER: 'USER'
} as const;
