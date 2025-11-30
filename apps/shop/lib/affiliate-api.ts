import { apiClient } from './api';

// API Response type
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ============================================
// 分销分润API类型定义
// ============================================

export interface AffiliateStats {
  totalEarnings: number;
  availableBalance: number;
  pendingBalance: number;
  totalReferrals: number;
  totalCommissions: number;
  pendingCommissions: number;
  settledCommissions: number;
  paidCommissions: number;
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

export interface RequestPayoutData {
  amount: number;
  method: 'BANK_TRANSFER' | 'PAYPAL' | 'ALIPAY' | 'WECHAT';
  accountInfo: {
    accountName?: string;
    accountNumber?: string;
    bankName?: string;
    email?: string;
  };
}

// ============================================
// 分销分润API客户端
// ============================================

export const affiliateApi = {
  /**
   * 获取我的邀请码
   */
  getMyReferralCode: (): Promise<ApiResponse<{ referralCode: string }>> =>
    apiClient.get('/plugins/affiliate-commission/api/referral-code'),

  /**
   * 获取我的分销统计
   */
  getMyStats: (): Promise<ApiResponse<AffiliateStats>> =>
    apiClient.get('/plugins/affiliate-commission/api/stats'),

  /**
   * 获取我的佣金记录
   */
  getMyCommissions: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<CommissionsListResponse>> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);

    const queryString = queryParams.toString();
    return apiClient.get(`/plugins/affiliate-commission/api/commissions${queryString ? `?${queryString}` : ''}`);
  },

  /**
   * 申请提现
   */
  requestPayout: (data: RequestPayoutData): Promise<ApiResponse<Payout>> =>
    apiClient.post('/plugins/affiliate-commission/api/payouts', data),

  /**
   * 获取我的提现记录
   */
  getMyPayouts: (params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<ApiResponse<PayoutsListResponse>> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);

    const queryString = queryParams.toString();
    return apiClient.get(`/plugins/affiliate-commission/api/payouts${queryString ? `?${queryString}` : ''}`);
  },
};

