/**
 * 超级管理员租户管理状态
 * 管理租户列表、筛选、操作状态等
 */

import { create } from 'zustand';
import { tenantManagementApi } from '@/lib/api';

// 租户接口定义
export interface Tenant {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  agencyLevel: 'basic' | 'industry' | 'global';
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'TERMINATED';
  domain?: string;
  subdomain?: string;
  createdAt: string;
  activatedAt?: string;
  suspendedAt?: string;
  terminatedAt?: string;
  userCount?: number;
  productCount?: number;
  orderCount?: number;
  totalRevenue?: number;
  monthlyRevenue?: number;
  contractStart?: string;
  contractEnd?: string;
  paymentReference?: string;
  notes?: string;
}

// 租户筛选参数
export interface TenantFilters {
  search: string;
  status: string;
  agencyLevel: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

// 租户统计信息
export interface TenantStats {
  totalTenants: number;
  activeTenants: number;
  pendingTenants: number;
  suspendedTenants: number;
  terminatedTenants: number;
  totalRevenue: number;
  monthlyGrowth: number;
  byAgencyLevel: {
    basic: number;
    industry: number;
    global: number;
  };
}

// 租户状态接口
export interface TenantsState {
  // 数据状态
  tenants: Tenant[];
  selectedTenant: Tenant | null;
  stats: TenantStats | null;
  
  // UI状态
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  error: string | null;
  
  // 筛选和分页
  filters: TenantFilters;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  
  // 选择状态
  selectedTenantIds: string[];
  
  // 排序
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

// 租户操作接口
export interface TenantsActions {
  // 数据获取
  fetchTenants: (params?: Partial<TenantFilters>) => Promise<void>;
  fetchTenantById: (id: string) => Promise<void>;
  fetchTenantStats: () => Promise<void>;
  refreshTenants: () => Promise<void>;
  
  // CRUD操作
  createTenant: (data: any) => Promise<void>;
  updateTenant: (id: string, data: Partial<Tenant>) => Promise<void>;
  deleteTenant: (id: string, reason?: string) => Promise<void>;
  
  // 状态管理操作
  activateTenant: (id: string, paymentReference?: string) => Promise<void>;
  suspendTenant: (id: string, reason: string) => Promise<void>;
  terminateTenant: (id: string, reason: string) => Promise<void>;
  
  // 批量操作
  batchActivate: (ids: string[]) => Promise<void>;
  batchSuspend: (ids: string[], reason: string) => Promise<void>;
  batchDelete: (ids: string[], reason: string) => Promise<void>;
  
  // 筛选和排序
  setFilters: (filters: Partial<TenantFilters>) => void;
  clearFilters: () => void;
  setSorting: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  
  // 选择管理
  selectTenant: (tenant: Tenant | null) => void;
  toggleTenantSelection: (id: string) => void;
  selectAllTenants: () => void;
  clearSelection: () => void;
  
  // 分页
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  
  // 错误处理
  clearError: () => void;
  setError: (error: string) => void;
}

// 初始筛选状态
const initialFilters: TenantFilters = {
  search: '',
  status: 'all',
  agencyLevel: 'all'
};

// 初始分页状态
const initialPagination = {
  page: 1,
  limit: 100,  // 增加到100，显示更多租户
  total: 0,
  totalPages: 0
};

// 创建租户状态管理
export const useTenantsStore = create<TenantsState & TenantsActions>((set, get) => ({
  // 初始状态
  tenants: [],
  selectedTenant: null,
  stats: null,
  isLoading: false,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
  error: null,
  filters: initialFilters,
  pagination: initialPagination,
  selectedTenantIds: [],
  sortBy: 'createdAt',
  sortOrder: 'desc',

  // 获取租户列表
  fetchTenants: async (params) => {
    set({ isLoading: true, error: null });
    
    try {
      const { filters, pagination, sortBy, sortOrder } = get();
      const queryParams = {
        page: pagination.page,
        limit: pagination.limit,
        search: params?.search ?? filters.search,
        status: (params?.status ?? filters.status) !== 'all' ? (params?.status ?? filters.status) : undefined,
        agencyLevel: (params?.agencyLevel ?? filters.agencyLevel) !== 'all' ? (params?.agencyLevel ?? filters.agencyLevel) : undefined,
        sortBy,
        sortOrder
      };

      const response = await tenantManagementApi.getAllTenants(queryParams);
      
      if (response.success && response.data) {
        const tenantsData = Array.isArray(response.data) ? response.data : response.data.data || [];
        
        set({
          tenants: tenantsData,
          pagination: {
            ...pagination,
            total: response.data.total || tenantsData.length,
            totalPages: Math.ceil((response.data.total || tenantsData.length) / pagination.limit)
          },
          isLoading: false
        });
      } else {
        throw new Error(response.message || 'Failed to fetch tenants');
      }
    } catch (error: any) {
      console.error('Failed to fetch tenants:', error);
      set({
        isLoading: false,
        error: error.message || 'Failed to fetch tenants'
      });
    }
  },

  // 获取单个租户
  fetchTenantById: async (id: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await tenantManagementApi.getTenant(id);
      
      if (response.success && response.data) {
        set({
          selectedTenant: response.data,
          isLoading: false
        });
      } else {
        throw new Error(response.message || 'Failed to fetch tenant');
      }
    } catch (error: any) {
      console.error('Failed to fetch tenant:', error);
      set({
        isLoading: false,
        error: error.message || 'Failed to fetch tenant'
      });
    }
  },

  // 获取租户统计
  fetchTenantStats: async () => {
    try {
      const response = await tenantManagementApi.getTenantStats();
      
      if (response.success && response.data) {
        set({ stats: response.data });
      }
    } catch (error: any) {
      console.error('Failed to fetch tenant stats:', error);
      // 使用模拟数据作为后备
      const { tenants } = get();
      const stats: TenantStats = {
        totalTenants: tenants.length,
        activeTenants: tenants.filter(t => t.status === 'ACTIVE').length,
        pendingTenants: tenants.filter(t => t.status === 'PENDING').length,
        suspendedTenants: tenants.filter(t => t.status === 'SUSPENDED').length,
        terminatedTenants: tenants.filter(t => t.status === 'TERMINATED').length,
        totalRevenue: tenants.reduce((sum, t) => sum + (t.totalRevenue || 0), 0),
        monthlyGrowth: 8.5,
        byAgencyLevel: {
          basic: tenants.filter(t => t.agencyLevel === 'basic').length,
          industry: tenants.filter(t => t.agencyLevel === 'industry').length,
          global: tenants.filter(t => t.agencyLevel === 'global').length
        }
      };
      set({ stats });
    }
  },

  // 刷新租户数据
  refreshTenants: async () => {
    await Promise.all([
      get().fetchTenants(),
      get().fetchTenantStats()
    ]);
  },

  // 创建租户
  createTenant: async (data: any) => {
    set({ isCreating: true, error: null });
    
    try {
      const response = await tenantManagementApi.createTenant(data);
      
      if (response.success) {
        // 刷新租户列表
        await get().fetchTenants();
        set({ isCreating: false });
      } else {
        throw new Error(response.message || 'Failed to create tenant');
      }
    } catch (error: any) {
      console.error('Failed to create tenant:', error);
      set({
        isCreating: false,
        error: error.message || 'Failed to create tenant'
      });
      throw error;
    }
  },

  // 更新租户
  updateTenant: async (id: string, data: Partial<Tenant>) => {
    set({ isUpdating: true, error: null });
    
    try {
      const response = await tenantManagementApi.updateTenant(id, data);
      
      if (response.success) {
        // 更新本地状态
        const { tenants } = get();
        const updatedTenants = tenants.map(tenant => 
          tenant.id === id ? { ...tenant, ...data } : tenant
        );
        
        set({
          tenants: updatedTenants,
          selectedTenant: get().selectedTenant?.id === id 
            ? { ...get().selectedTenant!, ...data } 
            : get().selectedTenant,
          isUpdating: false
        });
      } else {
        throw new Error(response.message || 'Failed to update tenant');
      }
    } catch (error: any) {
      console.error('Failed to update tenant:', error);
      set({
        isUpdating: false,
        error: error.message || 'Failed to update tenant'
      });
      throw error;
    }
  },

  // 删除租户 - ✅ 使用 DELETE /api/super-admin/tenants/:id
  deleteTenant: async (id: string, reason?: string) => {
    set({ isDeleting: true, error: null });

    try {
      const response = await tenantManagementApi.deleteTenant(id);

      if (response.success) {
        // 从本地状态中移除
        const { tenants } = get();
        const updatedTenants = tenants.filter(tenant => tenant.id !== id);

        set({
          tenants: updatedTenants,
          selectedTenant: get().selectedTenant?.id === id ? null : get().selectedTenant,
          isDeleting: false
        });
      } else {
        throw new Error(response.message || 'Failed to delete tenant');
      }
    } catch (error: any) {
      console.error('Failed to delete tenant:', error);
      set({
        isDeleting: false,
        error: error.message || 'Failed to delete tenant'
      });
      throw error;
    }
  },

  // 激活租户 - 🔧 修复：使用专门的状态更新API
  activateTenant: async (id: string, paymentReference?: string) => {
    set({ isUpdating: true, error: null });

    try {
      const response = await tenantManagementApi.updateTenantStatus(id, {
        status: 'ACTIVE',
        reason: paymentReference ? `Activated with payment reference: ${paymentReference}` : 'Activated by super admin'
      });

      if (response.success) {
        // 刷新租户列表以获取最新状态
        await get().fetchTenants();
        set({ isUpdating: false });
      } else {
        throw new Error(response.message || 'Failed to activate tenant');
      }
    } catch (error: any) {
      console.error('Failed to activate tenant:', error);
      set({
        isUpdating: false,
        error: error.message || 'Failed to activate tenant'
      });
      throw error;
    }
  },

  // 暂停租户 - 🔧 修复：使用专门的状态更新API
  suspendTenant: async (id: string, reason: string) => {
    set({ isUpdating: true, error: null });

    try {
      const response = await tenantManagementApi.updateTenantStatus(id, {
        status: 'SUSPENDED',
        reason
      });

      if (response.success) {
        await get().fetchTenants();
        set({ isUpdating: false });
      } else {
        throw new Error(response.message || 'Failed to suspend tenant');
      }
    } catch (error: any) {
      console.error('Failed to suspend tenant:', error);
      set({
        isUpdating: false,
        error: error.message || 'Failed to suspend tenant'
      });
      throw error;
    }
  },

  // 终止租户 - 🔧 修复：使用专门的状态更新API
  terminateTenant: async (id: string, reason: string) => {
    set({ isUpdating: true, error: null });

    try {
      const response = await tenantManagementApi.updateTenantStatus(id, {
        status: 'TERMINATED',
        reason
      });

      if (response.success) {
        await get().fetchTenants();
        set({ isUpdating: false });
      } else {
        throw new Error(response.message || 'Failed to terminate tenant');
      }
    } catch (error: any) {
      console.error('Failed to terminate tenant:', error);
      set({
        isUpdating: false,
        error: error.message || 'Failed to terminate tenant'
      });
      throw error;
    }
  },

  // 批量激活
  batchActivate: async (ids: string[]) => {
    set({ isUpdating: true, error: null });
    
    try {
      await Promise.all(ids.map(id => get().activateTenant(id)));
      set({ isUpdating: false, selectedTenantIds: [] });
    } catch (error: any) {
      set({ isUpdating: false, error: error.message || 'Failed to activate tenants' });
      throw error;
    }
  },

  // 批量暂停
  batchSuspend: async (ids: string[], reason: string) => {
    set({ isUpdating: true, error: null });
    
    try {
      await Promise.all(ids.map(id => get().suspendTenant(id, reason)));
      set({ isUpdating: false, selectedTenantIds: [] });
    } catch (error: any) {
      set({ isUpdating: false, error: error.message || 'Failed to suspend tenants' });
      throw error;
    }
  },

  // 批量删除
  batchDelete: async (ids: string[], reason: string) => {
    set({ isDeleting: true, error: null });
    
    try {
      await Promise.all(ids.map(id => get().deleteTenant(id, reason)));
      set({ isDeleting: false, selectedTenantIds: [] });
    } catch (error: any) {
      set({ isDeleting: false, error: error.message || 'Failed to delete tenants' });
      throw error;
    }
  },

  // 设置筛选
  setFilters: (newFilters: Partial<TenantFilters>) => {
    const { filters } = get();
    const updatedFilters = { ...filters, ...newFilters };
    set({ 
      filters: updatedFilters,
      pagination: { ...get().pagination, page: 1 } // 重置到第一页
    });
    
    // 自动触发数据获取
    get().fetchTenants(updatedFilters);
  },

  // 清除筛选
  clearFilters: () => {
    set({ 
      filters: initialFilters,
      pagination: { ...get().pagination, page: 1 }
    });
    get().fetchTenants(initialFilters);
  },

  // 设置排序
  setSorting: (sortBy: string, sortOrder: 'asc' | 'desc') => {
    set({ sortBy, sortOrder });
    get().fetchTenants();
  },

  // 选择租户
  selectTenant: (tenant: Tenant | null) => {
    set({ selectedTenant: tenant });
  },

  // 切换租户选择
  toggleTenantSelection: (id: string) => {
    const { selectedTenantIds } = get();
    const isSelected = selectedTenantIds.includes(id);
    
    set({
      selectedTenantIds: isSelected
        ? selectedTenantIds.filter(selectedId => selectedId !== id)
        : [...selectedTenantIds, id]
    });
  },

  // 全选租户
  selectAllTenants: () => {
    const { tenants } = get();
    set({ selectedTenantIds: tenants.map(tenant => tenant.id) });
  },

  // 清除选择
  clearSelection: () => {
    set({ selectedTenantIds: [] });
  },

  // 设置页码
  setPage: (page: number) => {
    set({ pagination: { ...get().pagination, page } });
    get().fetchTenants();
  },

  // 设置每页数量
  setLimit: (limit: number) => {
    set({ 
      pagination: { ...get().pagination, limit, page: 1 }
    });
    get().fetchTenants();
  },

  // 清除错误
  clearError: () => {
    set({ error: null });
  },

  // 设置错误
  setError: (error: string) => {
    set({ error });
  }
}));
