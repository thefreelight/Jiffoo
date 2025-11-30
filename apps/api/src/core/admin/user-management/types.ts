import { z } from 'zod';

/**
 * 管理员用户管理相关类型定义
 */

// 更新用户信息的Schema
export const UpdateUserSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  avatar: z.string().url().optional(),
  // 注意：User模型中暂时没有status字段
  // status: z.enum(['active', 'inactive']).optional(),
});

// 更新用户角色的Schema
export const UpdateUserRoleSchema = z.object({
  role: z.enum(['USER', 'TENANT_ADMIN']),
});

// 批量操作Schema
export const BatchUpdateSchema = z.object({
  action: z.enum(['activate', 'deactivate', 'delete', 'updateRole']),
  userIds: z.array(z.string()).min(1),
  role: z.enum(['USER', 'TENANT_ADMIN']).optional(),
});

// TypeScript类型定义
export type UpdateUserRequest = z.infer<typeof UpdateUserSchema>;
export type UpdateUserRoleRequest = z.infer<typeof UpdateUserRoleSchema>;
export type BatchUpdateRequestBody = z.infer<typeof BatchUpdateSchema>;

// 获取用户列表请求参数
export interface GetUsersRequest {
  page?: number;
  limit?: number;
  search?: string;
  role?: 'USER' | 'TENANT_ADMIN';
  status?: 'active' | 'inactive';
  tenantId: string;
}

// 批量更新请求参数
export interface BatchUpdateRequest extends BatchUpdateRequestBody {
  tenantId: string;
  operatorId: string;
}

// 用户响应数据结构
export interface UserResponse {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

// 用户详情响应数据结构
export interface UserDetailResponse extends UserResponse {
  _count: {
    orders: number;
    cartItems: number;
  };
  orders: Array<{
    id: string;
    status: string;
    totalAmount: number;
    createdAt: Date;
  }>;
  languagePreferences?: {
    preferredLanguage: string;
    timezone: string;
    dateFormat: string;
    timeFormat: string;
  };
}

// 分页响应结构
export interface PaginationResponse {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// 用户列表响应结构
export interface UsersListResponse {
  users: UserResponse[];
  pagination: PaginationResponse;
}

// 用户统计响应结构
export interface UserStatsResponse {
  totalUsers: number;
  activeUsers: number;
  roleDistribution: Record<string, number>;
}

// 批量操作响应结构
export interface BatchUpdateResponse {
  updatedCount: number;
  action: string;
  userIds: string[];
}
