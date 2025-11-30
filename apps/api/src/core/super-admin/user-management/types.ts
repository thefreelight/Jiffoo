/**
 * Super Admin User Management Types
 *
 * 用户状态规范：
 * - 用户状态统一基于 isActive: boolean
 * - effectiveStatus: 综合计算用户 + 租户状态后的有效状态
 *   - ACTIVE: isActive === true 且 tenant.status === 'ACTIVE'
 *   - INACTIVE: 其他情况
 */
import { z } from 'zod';

// 更新用户信息请求
export const UpdateUserSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  avatar: z.string().optional(),
  // 用户启用/停用状态
  isActive: z.boolean().optional(),
});

// 更新用户角色请求
export const UpdateUserRoleSchema = z.object({
  role: z.enum(['USER', 'TENANT_ADMIN']),
});

// 批量操作请求
export const BatchUserOperationSchema = z.object({
  action: z.enum(['activate', 'deactivate', 'delete', 'updateRole']),
  userIds: z.array(z.string()).min(1, 'At least one user ID is required'),
  role: z.enum(['USER', 'TENANT_ADMIN']).optional(),
});

// TypeScript 类型推断
export type UpdateUserRequest = z.infer<typeof UpdateUserSchema>;
export type UpdateUserRoleRequest = z.infer<typeof UpdateUserRoleSchema>;
export type BatchUserOperationRequest = z.infer<typeof BatchUserOperationSchema>;

// 用户有效状态枚举
export type UserEffectiveStatus = 'ACTIVE' | 'INACTIVE';

// 超级管理员用户响应接口（包含租户信息）
export interface SuperAdminUserResponse {
  id: string;
  email: string;
  username: string;
  avatar: string | null;
  role: 'USER' | 'TENANT_ADMIN' | 'SUPER_ADMIN';
  isActive: boolean;
  // 有效状态：综合 isActive + tenant.status 计算
  effectiveStatus: UserEffectiveStatus;
  createdAt: Date;
  updatedAt: Date;
  tenantId: number;
  tenant: {
    id: number;
    companyName: string;
    contactEmail: string;
    status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
  };
  languagePreference?: {
    preferredLanguage: string;
    timezone: string;
    dateFormat: string;
    timeFormat: string;
  } | null;
}

// 超级管理员用户统计信息
export interface SuperAdminUserStatsResponse {
  success: boolean;
  data: {
    totalUsers: number;
    usersByRole: {
      USER: number;
      TENANT_ADMIN: number;
      SUPER_ADMIN: number;
    };
    usersByTenant: {
      tenantId: number;
      tenantName: string;
      userCount: number;
      adminCount: number;
    }[];
    recentUsers: SuperAdminUserResponse[];
    activeUsers: number;
  };
}

// 分页超级管理员用户列表响应
export interface SuperAdminUserListResponse {
  success: boolean;
  data: SuperAdminUserResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 单个超级管理员用户响应
export interface SingleSuperAdminUserResponse {
  success: boolean;
  data: SuperAdminUserResponse;
}

// 批量操作响应
export interface BatchUserOperationResponse {
  success: boolean;
  data: {
    action: string;
    processedCount: number;
    userIds: string[];
    role?: 'USER' | 'TENANT_ADMIN';
  };
  message: string;
}

// 获取用户请求参数
export interface GetUsersRequest {
  page?: number;
  limit?: number;
  search?: string;
  role?: 'USER' | 'TENANT_ADMIN' | 'SUPER_ADMIN';
  // 状态过滤：基于 isActive 字段
  isActive?: string | boolean;
  tenantId?: string;
}
