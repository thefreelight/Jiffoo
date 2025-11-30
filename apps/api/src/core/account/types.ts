import { z } from 'zod';

/**
 * 用户个人账户相关类型定义 - 精简版
 * 专注于个人资料管理
 */

// 更新个人资料Schema
export const UpdateProfileSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  avatar: z.string().url().optional(),
});

// TypeScript类型定义
export type UpdateProfileRequest = z.infer<typeof UpdateProfileSchema>;

// 用户资料响应结构
export interface UserProfileResponse {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  languagePreferences?: {
    preferredLanguage: string;
    timezone: string;
    dateFormat: string;
    timeFormat: string;
    numberFormat: string;
    currencyFormat: string;
  };
}

// 订单响应结构
export interface OrderResponse {
  id: string;
  status: string;
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
  orderItems: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    product: {
      id: string;
      name: string;
      images?: string;
    };
  }>;
}

// 订单列表响应结构
export interface OrdersListResponse {
  orders: OrderResponse[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// 订单统计响应结构
export interface OrderStatsResponse {
  totalOrders: number;
  totalSpent: number;
  statusDistribution: Record<string, number>;
}

// 租户信息响应结构
export interface TenantResponse {
  id: number;
  name: string;
  settings?: any;
}

// 切换租户响应结构
export interface SwitchTenantResponse {
  user: UserProfileResponse;
  tenant: TenantResponse;
}

// 用户活动日志响应结构
export interface UserActivityResponse {
  id: string;
  action: string;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

// 活动日志列表响应结构
export interface ActivityLogResponse {
  activities: UserActivityResponse[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// 删除账户请求
export interface DeleteAccountRequest {
  password: string;
}

// API响应基础结构
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// 分页参数
export interface PaginationParams {
  page?: number;
  limit?: number;
}

// 通用分页响应
export interface PaginationResponse {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
