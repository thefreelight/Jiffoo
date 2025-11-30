import { create } from 'zustand';
import { affiliateApi, type AffiliateStats, type Commission, type Payout, type RequestPayoutData } from '@/lib/affiliate-api';

interface AffiliateState {
  // 数据
  referralCode: string | null;
  stats: AffiliateStats | null;
  commissions: Commission[];
  payouts: Payout[];
  
  // 分页信息
  commissionsPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null;
  payoutsPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null;
  
  // 加载状态
  isLoading: boolean;
  isLoadingCommissions: boolean;
  isLoadingPayouts: boolean;
  error: string | null;
  
  // Actions
  fetchReferralCode: () => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchCommissions: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    startDate?: string;
    endDate?: string;
  }) => Promise<void>;
  fetchPayouts: (params?: {
    page?: number;
    limit?: number;
    status?: string;
  }) => Promise<void>;
  requestPayout: (data: RequestPayoutData) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  referralCode: null,
  stats: null,
  commissions: [],
  payouts: [],
  commissionsPagination: null,
  payoutsPagination: null,
  isLoading: false,
  isLoadingCommissions: false,
  isLoadingPayouts: false,
  error: null,
};

export const useAffiliateStore = create<AffiliateState>((set, get) => ({
  ...initialState,

  fetchReferralCode: async () => {
    try {
      set({ isLoading: true, error: null });
      const response = await affiliateApi.getMyReferralCode();
      
      if (response.success && response.data) {
        set({ referralCode: response.data.referralCode, isLoading: false });
      } else {
        throw new Error(response.message || 'Failed to fetch referral code');
      }
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.message || 'Failed to fetch referral code',
      });
      throw error;
    }
  },

  fetchStats: async () => {
    try {
      set({ isLoading: true, error: null });
      const response = await affiliateApi.getMyStats();
      
      if (response.success && response.data) {
        set({ stats: response.data, isLoading: false });
      } else {
        throw new Error(response.message || 'Failed to fetch stats');
      }
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.message || 'Failed to fetch stats',
      });
      throw error;
    }
  },

  fetchCommissions: async (params) => {
    try {
      set({ isLoadingCommissions: true, error: null });
      const response = await affiliateApi.getMyCommissions(params);
      
      if (response.success && response.data) {
        set({
          commissions: response.data.commissions,
          commissionsPagination: response.data.pagination,
          isLoadingCommissions: false,
        });
      } else {
        throw new Error(response.message || 'Failed to fetch commissions');
      }
    } catch (error: any) {
      set({
        isLoadingCommissions: false,
        error: error.message || 'Failed to fetch commissions',
      });
      throw error;
    }
  },

  fetchPayouts: async (params) => {
    try {
      set({ isLoadingPayouts: true, error: null });
      const response = await affiliateApi.getMyPayouts(params);
      
      if (response.success && response.data) {
        set({
          payouts: response.data.payouts,
          payoutsPagination: response.data.pagination,
          isLoadingPayouts: false,
        });
      } else {
        throw new Error(response.message || 'Failed to fetch payouts');
      }
    } catch (error: any) {
      set({
        isLoadingPayouts: false,
        error: error.message || 'Failed to fetch payouts',
      });
      throw error;
    }
  },

  requestPayout: async (data) => {
    try {
      set({ isLoading: true, error: null });
      const response = await affiliateApi.requestPayout(data);
      
      if (response.success && response.data) {
        // 刷新统计数据和提现记录
        await get().fetchStats();
        await get().fetchPayouts();
        set({ isLoading: false });
      } else {
        throw new Error(response.message || 'Failed to request payout');
      }
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.message || 'Failed to request payout',
      });
      throw error;
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set(initialState),
}));

