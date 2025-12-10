import { apiClient } from './api';
import type { ApiResponse } from './types';

// ============================================
// 分销分润管理API类型定义
// ============================================

export interface TenantCommissionConfig {
  id: string;
  tenantId: number;
  enabled: boolean;
  defaultRate: number;
  settlementDays: number;
  minPayoutAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateConfigRequest {
  enabled?: boolean;
  defaultRate?: number;
  settlementDays?: number;
  minPayoutAmount?: number;
}

export interface AffiliateUser {
  id: string;
  username: string;
  email: string;
  referralCode: string | null;
  customCommissionRate: number | null;
  totalEarnings: number;
  availableBalance: number;
  pendingBalance: number;
  totalReferrals: number;
  createdAt: string;
}

export interface Commission {
  id: string;
  tenantId: number;
  userId: string;
  orderId: string;
  buyerId: string;
  orderAmount: number;
  rate: number;
  amount: number;
  status: 'PENDING' | 'SETTLED' | 'PAID' | 'REFUNDED';
  settleAt: string;
  settledAt: string | null;
  paidAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    username: string;
    email: string;
  };
  buyer?: {
    id: string;
    username: string;
    email: string;
  };
  order?: {
    id: string;
    totalAmount: number;
    status: string;
  };
}

export interface CommissionsListResponse {
  commissions: Commission[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface Payout {
  id: string;
  tenantId: number;
  userId: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  method: string | null;
  accountInfo: string | null;
  processedAt: string | null;
  processedBy: string | null;
  failureReason: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

export interface PayoutsListResponse {
  payouts: Payout[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ProcessPayoutRequest {
  status: 'COMPLETED' | 'FAILED' | 'CANCELLED';
  note?: string;
  failureReason?: string;
}

// ============================================
// 分销分润管理API客户端
// ============================================

export const affiliateAdminApi = {
  /**
   * 获取分润配置
   */
  getConfig: (): Promise<ApiResponse<TenantCommissionConfig>> =>
    apiClient.get('/plugins/affiliate-commission/api/admin/config'),

  /**
   * 更新分润配置
   */
  updateConfig: (data: UpdateConfigRequest): Promise<ApiResponse<TenantCommissionConfig>> =>
    apiClient.put('/plugins/affiliate-commission/api/admin/config', data),

  /**
   * 设置用户个性化分润比例
   */
  setUserCommissionRate: (
    userId: string,
    rate: number | null
  ): Promise<ApiResponse<{ success: boolean }>> =>
    apiClient.put(`/plugins/affiliate-commission/api/admin/affiliates/${userId}/rate`, { rate }),

  /**
   * 获取所有佣金记录
   */
  getCommissions: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<CommissionsListResponse>> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.userId) queryParams.append('userId', params.userId);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);

    const queryString = queryParams.toString();
    return apiClient.get(`/plugins/affiliate-commission/api/admin/commissions${queryString ? `?${queryString}` : ''}`);
  },

  /**
   * 获取所有提现申请
   */
  getPayouts: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    userId?: string;
  }): Promise<ApiResponse<PayoutsListResponse>> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.userId) queryParams.append('userId', params.userId);

    const queryString = queryParams.toString();
    return apiClient.get(`/plugins/affiliate-commission/api/admin/payouts${queryString ? `?${queryString}` : ''}`);
  },

  /**
   * 处理提现申请
   */
  processPayout: (
    payoutId: string,
    data: ProcessPayoutRequest
  ): Promise<ApiResponse<Payout>> =>
    apiClient.put(`/plugins/affiliate-commission/api/admin/payouts/${payoutId}/process`, data),

  /**
   * 获取所有分销商用户
   */
  getAffiliateUsers: (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<ApiResponse<{
    users: AffiliateUser[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);

    const queryString = queryParams.toString();
    return apiClient.get(`/plugins/affiliate-commission/api/admin/affiliates${queryString ? `?${queryString}` : ''}`);
  },
};

