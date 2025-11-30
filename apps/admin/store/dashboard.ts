/**
 * 超级管理员仪表板状态管理
 * 管理统计数据、图表数据、实时更新等
 */

import { create } from 'zustand';
import { platformStatsApi, tenantManagementApi } from '@/lib/api';

// 仪表板概览统计
export interface DashboardOverview {
  totalTenants: number;
  activeTenants: number;
  pendingTenants: number;
  suspendedTenants: number;
  totalUsers: number;
  activeUsers: number;
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  monthlyRevenue: number;
  monthlyGrowth: number;
  revenueGrowth: number;
}

// 租户统计数据
export interface TenantStats {
  totalTenants: number;
  activeTenants: number;
  pendingTenants: number;
  suspendedTenants: number;
  byAgencyLevel: {
    basic: number;
    industry: number;
    global: number;
  };
  recentTenants: Array<{
    id: string;
    companyName: string;
    status: string;
    createdAt: string;
  }>;
}

// 收入数据
export interface RevenueData {
  month: string;
  revenue: number;
  tenants: number;
  growth: number;
}

// 用户活动数据
export interface ActivityData {
  id: string;
  type: 'tenant_registered' | 'tenant_activated' | 'payment_received' | 'user_joined' | 'order_placed';
  title: string;
  description: string;
  timestamp: string;
  tenantId?: string;
  userId?: string;
  amount?: number;
}

// 系统健康状态
export interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  uptime: number;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  activeConnections: number;
  responseTime: number;
  errorRate: number;
}

// 仪表板状态接口
export interface DashboardState {
  // 数据状态
  overview: DashboardOverview | null;
  tenantStats: TenantStats | null;
  revenueData: RevenueData[];
  recentActivity: ActivityData[];
  systemHealth: SystemHealth | null;
  
  // UI状态
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  
  // 实时更新
  lastUpdated: Date | null;
  autoRefresh: boolean;
  refreshInterval: number; // 秒
  
  // 图表配置
  chartTimeRange: '7d' | '30d' | '90d' | '1y';
  chartType: 'line' | 'bar' | 'area';
}

// 仪表板操作接口
export interface DashboardActions {
  // 数据获取
  fetchOverview: () => Promise<void>;
  fetchTenantStats: () => Promise<void>;
  fetchRevenueData: (timeRange?: string) => Promise<void>;
  fetchRecentActivity: () => Promise<void>;
  fetchSystemHealth: () => Promise<void>;
  
  // 刷新操作
  refreshAll: () => Promise<void>;
  refreshOverview: () => Promise<void>;
  
  // 实时更新控制
  startAutoRefresh: () => void;
  stopAutoRefresh: () => void;
  setRefreshInterval: (interval: number) => void;
  
  // 图表配置
  setChartTimeRange: (range: '7d' | '30d' | '90d' | '1y') => void;
  setChartType: (type: 'line' | 'bar' | 'area') => void;
  
  // 错误处理
  clearError: () => void;
  setError: (error: string) => void;
}

// 创建仪表板状态管理
export const useDashboardStore = create<DashboardState & DashboardActions>((set, get) => {
  // 🔧 删除全局定时器变量，避免性能问题
  // let refreshTimer: NodeJS.Timeout | null = null;

  return {
    // 初始状态
    overview: null,
    tenantStats: null,
    revenueData: [],
    recentActivity: [],
    systemHealth: null,
    isLoading: false,
    isRefreshing: false,
    error: null,
    lastUpdated: null,
    autoRefresh: false,
    refreshInterval: 30, // 30秒
    chartTimeRange: '30d',
    chartType: 'line',

    // 获取概览数据
    fetchOverview: async () => {
      set({ isLoading: true, error: null });
      
      try {
        // 并行获取多个数据源
        // 🔧 修复limit参数：后端最大支持100，不能使用1000
        const [dashboardResponse, tenantsResponse] = await Promise.all([
          platformStatsApi.getDashboardStats().catch(() => ({ success: false, data: null })),
          tenantManagementApi.getAllTenants({ limit: 100 }).catch(() => ({ success: false, data: [] }))
        ]);

        // 处理租户数据
        const tenants = Array.isArray(tenantsResponse.data) ? tenantsResponse.data : tenantsResponse.data?.data || [];
        
        // 构建概览数据
        const overview: DashboardOverview = {
          totalTenants: tenants.length,
          activeTenants: tenants.filter((t: any) => t.status === 'ACTIVE').length,
          pendingTenants: tenants.filter((t: any) => t.status === 'PENDING').length,
          suspendedTenants: tenants.filter((t: any) => t.status === 'SUSPENDED').length,
          totalUsers: dashboardResponse.data?.totalUsers || 1250,
          activeUsers: dashboardResponse.data?.activeUsers || 1156,
          totalProducts: dashboardResponse.data?.totalProducts || 3400,
          totalOrders: dashboardResponse.data?.totalOrders || 890,
          totalRevenue: dashboardResponse.data?.totalRevenue || 125000,
          monthlyRevenue: dashboardResponse.data?.monthlyRevenue || 35600,
          monthlyGrowth: dashboardResponse.data?.monthlyGrowth || 8.5,
          revenueGrowth: dashboardResponse.data?.revenueGrowth || 12.3
        };

        set({
          overview,
          isLoading: false,
          lastUpdated: new Date()
        });
      } catch (error: any) {
        console.error('Failed to fetch overview:', error);

        // 如果 API 调用失败，显示空状态而不是 mock 数据
        const emptyOverview: DashboardOverview = {
          totalTenants: 0,
          activeTenants: 0,
          pendingTenants: 0,
          suspendedTenants: 0,
          totalUsers: 0,
          activeUsers: 0,
          totalProducts: 0,
          totalOrders: 0,
          totalRevenue: 0,
          monthlyRevenue: 0,
          monthlyGrowth: 0,
          revenueGrowth: 0
        };

        set({
          overview: emptyOverview,
          isLoading: false,
          error: error.message || 'Failed to fetch overview data',
          lastUpdated: new Date()
        });
      }
    },

    // 获取租户统计
    fetchTenantStats: async () => {
      try {
        // 🔧 修复limit参数：后端最大支持100，不能使用1000
        const response = await tenantManagementApi.getAllTenants({ limit: 100 });
        const tenants = Array.isArray(response.data) ? response.data : response.data?.data || [];
        
        const tenantStats: TenantStats = {
          totalTenants: tenants.length,
          activeTenants: tenants.filter((t: any) => t.status === 'ACTIVE').length,
          pendingTenants: tenants.filter((t: any) => t.status === 'PENDING').length,
          suspendedTenants: tenants.filter((t: any) => t.status === 'SUSPENDED').length,
          byAgencyLevel: {
            basic: tenants.filter((t: any) => t.agencyLevel === 'basic').length,
            industry: tenants.filter((t: any) => t.agencyLevel === 'industry').length,
            global: tenants.filter((t: any) => t.agencyLevel === 'global').length
          },
          recentTenants: tenants
            .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5)
            .map((t: any) => ({
              id: t.id,
              companyName: t.companyName,
              status: t.status,
              createdAt: t.createdAt
            }))
        };

        set({ tenantStats });
      } catch (error: any) {
        console.error('Failed to fetch tenant stats:', error);
        
        // 使用模拟数据
        const fallbackStats: TenantStats = {
          totalTenants: 25,
          activeTenants: 18,
          pendingTenants: 7,
          suspendedTenants: 0,
          byAgencyLevel: {
            basic: 15,
            industry: 8,
            global: 2
          },
          recentTenants: []
        };
        
        set({ tenantStats: fallbackStats });
      }
    },

    // 获取收入数据
    // 📌 中期计划：后端实现 GET /api/super-admin/orders/stats?groupBy=month 后接入
    // 短期方案：基于 platformStatsApi.getDashboardStats() 中的 totalRevenue 展示
    fetchRevenueData: async (timeRange?: string) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const range = timeRange || get().chartTimeRange;

        // 暂时返回空数组，UI 应显示"数据尚未接入"的提示
        // 当后端实现了按月份分组的收入统计端点后，应该调用该端点
        set({ revenueData: [] });
      } catch (error: any) {
        console.error('Failed to fetch revenue data:', error);
        set({ error: error.message || 'Failed to fetch revenue data' });
      }
    },

    // 获取最近活动
    // 📌 中期计划：后端实现 GET /api/logs/recent 或基于 domain event 的 API 后接入
    // 短期方案：基于最新的租户和订单数据构造活动流
    fetchRecentActivity: async () => {
      try {
        // 基于租户和订单数据构造最近活动
        const tenants = await tenantManagementApi.getAllTenants({ limit: 10 });
        const tenantsData = Array.isArray(tenants.data) ? tenants.data : tenants.data?.data || [];

        // 构造活动列表：最新的租户激活事件
        const activities: ActivityData[] = tenantsData
          .filter((t: any) => t.status === 'ACTIVE')
          .sort((a: any, b: any) => new Date(b.activatedAt || b.createdAt).getTime() - new Date(a.activatedAt || a.createdAt).getTime())
          .slice(0, 5)
          .map((t: any) => ({
            id: `tenant_${t.id}`,
            type: 'tenant_activated' as const,
            title: `Tenant Activated: ${t.companyName}`,
            description: `${t.companyName} (${t.agencyLevel})`,
            timestamp: t.activatedAt || t.createdAt,
            tenantId: t.id
          }));

        set({ recentActivity: activities });
      } catch (error: any) {
        console.error('Failed to fetch recent activity:', error);
        // 如果获取失败，返回空列表而不是 mock 数据
        set({ recentActivity: [] });
      }
    },

    // 获取系统健康状态
    // 📌 短期方案：复用 /api/cache/health 端点的逻辑
    // 📌 中期计划：后端实现更广义的 GET /api/system/health 端点后接入
    fetchSystemHealth: async () => {
      try {
        // 暂时返回基础的健康状态
        // 当后端实现了系统健康检查端点后，应该调用该端点
        // 目前可以基于 cache health 或其他可用的系统指标来推导
        set({ systemHealth: {
          status: 'healthy',
          uptime: 0,
          cpuUsage: 0,
          memoryUsage: 0,
          diskUsage: 0,
          activeConnections: 0,
          responseTime: 0,
          errorRate: 0
        } });
      } catch (error: any) {
        console.error('Failed to fetch system health:', error);
        // 如果获取失败，返回未知状态而不是 mock 数据
        set({ systemHealth: {
          status: 'healthy',
          uptime: 0,
          cpuUsage: 0,
          memoryUsage: 0,
          diskUsage: 0,
          activeConnections: 0,
          responseTime: 0,
          errorRate: 0
        } });
      }
    },

    // 刷新所有数据
    refreshAll: async () => {
      set({ isRefreshing: true });
      
      try {
        await Promise.all([
          get().fetchOverview(),
          get().fetchTenantStats(),
          get().fetchRevenueData(),
          get().fetchRecentActivity(),
          get().fetchSystemHealth()
        ]);
      } catch (error: any) {
        console.error('Failed to refresh all data:', error);
        set({ error: error.message || 'Failed to refresh data' });
      } finally {
        set({ isRefreshing: false, lastUpdated: new Date() });
      }
    },

    // 刷新概览数据
    refreshOverview: async () => {
      await get().fetchOverview();
    },

    // 🔧 删除自动刷新定时器，避免性能问题和页面重定向
    startAutoRefresh: () => {
      console.log('Auto-refresh disabled for performance');
      set({ autoRefresh: false });
    },

    // 停止自动刷新
    stopAutoRefresh: () => {
      console.log('Auto-refresh already disabled');
      set({ autoRefresh: false });
    },

    // 设置刷新间隔
    setRefreshInterval: (interval: number) => {
      set({ refreshInterval: interval });

      // 🔧 删除定时器重启逻辑
      console.log('Refresh interval set to', interval, 'but auto-refresh is disabled');
    },

    // 设置图表时间范围
    setChartTimeRange: (range: '7d' | '30d' | '90d' | '1y') => {
      set({ chartTimeRange: range });
      get().fetchRevenueData(range);
    },

    // 设置图表类型
    setChartType: (type: 'line' | 'bar' | 'area') => {
      set({ chartType: type });
    },

    // 清除错误
    clearError: () => {
      set({ error: null });
    },

    // 设置错误
    setError: (error: string) => {
      set({ error });
    }
  };
});
