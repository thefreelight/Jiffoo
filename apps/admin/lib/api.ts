/**
 * Admin API客户端
 * 使用统一的AuthClient，移除独立的js-cookie token管理逻辑
 */

import {
  createAdminClient,
  getAdminClient,
  type ApiResponse,
  type PaginatedResponse,
  type UserProfile
} from 'shared';

import type {
  DashboardStats,
  ProductForm,
  Product,
  Order
} from './types';

// 类型定义（保留Admin特有的类型）
export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  role?: string;
}

// 延迟初始化 API 客户端，避免模块加载时的环境变量问题
let _apiClient: ReturnType<typeof createAdminClient> | null = null;

const getApiClient = () => {
  if (!_apiClient) {
    _apiClient = createAdminClient({
      // 🔧 修复API路径重复：不传递basePath，使用默认的后端URL配置
      // Next.js代理会自动将/api/*转发到后端，无需重复/api前缀
      storageType: 'hybrid', // 使用混合存储策略
      customConfig: {
        timeout: 10000,
      }
    });
  }
  return _apiClient;
};

// 导出 Proxy 以保持向后兼容
export const apiClient = new Proxy({} as ReturnType<typeof createAdminClient>, {
  get: (target, prop) => {
    return getApiClient()[prop as keyof ReturnType<typeof createAdminClient>];
  }
});

// 导出工厂函数供其他模块使用
export { getAdminClient };

// Auth API - 使用统一的AuthClient方法
export const authApi = {
  login: (email: string, password: string) =>
    apiClient.login({ email, password }),

  me: (): Promise<ApiResponse<UserProfile>> => apiClient.getProfile(),

  logout: () => apiClient.logout(),

  refreshToken: () =>
    // 🔧 修复类型定义：直接使用AuthClient的返回类型
    apiClient.refreshAuthToken(),
};



// Products API - 使用统一的apiClient，调用admin专用端点
export const productsApi = {
  getAll: (page = 1, limit = 10, search?: string): Promise<ApiResponse<PaginatedResponse<Product>>> =>
    apiClient.get('/admin/products', { params: { page, limit, search } }),

  // 兼容现有代码的别名方法
  getProducts: (params: PaginationParams = {}): Promise<ApiResponse<PaginatedResponse<Product>>> => {
    const { page = 1, limit = 10, search } = params;
    return apiClient.get('/admin/products', { params: { page, limit, search } });
  },

  getById: (id: string): Promise<ApiResponse<Product>> => apiClient.get(`/admin/products/${id}`),
  getProduct: (id: string): Promise<ApiResponse<Product>> => apiClient.get(`/admin/products/${id}`), // 别名

  create: (data: ProductForm): Promise<ApiResponse<Product>> => apiClient.post('/admin/products', data),
  createProduct: (data: ProductForm): Promise<ApiResponse<Product>> => apiClient.post('/admin/products', data), // 别名

  update: (id: string, data: Partial<ProductForm>): Promise<ApiResponse<Product>> => apiClient.put(`/admin/products/${id}`, data),
  updateProduct: (id: string, data: Partial<ProductForm>): Promise<ApiResponse<Product>> => apiClient.put(`/admin/products/${id}`, data), // 别名

  delete: (id: string): Promise<ApiResponse<void>> => apiClient.delete(`/admin/products/${id}`),
  deleteProduct: (id: string): Promise<ApiResponse<void>> => apiClient.delete(`/admin/products/${id}`), // 别名

  // 库存管理API
  adjustStock: (id: string, data: { operation: 'increase' | 'decrease', quantity: number, reason: string }): Promise<ApiResponse<{ newStock: number }>> =>
    apiClient.post(`/admin/products/${id}/stock/adjust`, data),

  getStockOverview: (lowStockThreshold?: number): Promise<ApiResponse<{ products: Array<{ id: string; name: string; stock: number; lowStockThreshold: number }> }>> =>
    apiClient.get('/admin/products/stock/overview', { params: lowStockThreshold ? { lowStockThreshold } : {} }),

  getLowStockProducts: (params?: { threshold?: number, page?: number, limit?: number }): Promise<ApiResponse<PaginatedResponse<Product>>> =>
    apiClient.get('/admin/products/stock/low', { params }),

  // 批量操作API
  batchOperations: (data: { operation: string, productIds: string[], [key: string]: unknown }): Promise<ApiResponse<{ processed: number; failed: number }>> =>
    apiClient.post('/admin/products/batch', data),
};

// Orders API - 使用统一的apiClient，调用admin专用端点
export const ordersApi = {
  getAll: (page = 1, limit = 10): Promise<ApiResponse<PaginatedResponse<Order>>> =>
    apiClient.get('/admin/orders', { params: { page, limit } }),

  // 兼容现有代码的别名方法
  getOrders: (params: PaginationParams = {}): Promise<ApiResponse<PaginatedResponse<Order>>> => {
    const { page = 1, limit = 10 } = params;
    return apiClient.get('/admin/orders', { params: { page, limit } });
  },

  getById: (id: string): Promise<ApiResponse<Order>> => apiClient.get(`/admin/orders/${id}`),
  getOrder: (id: string): Promise<ApiResponse<Order>> => apiClient.get(`/admin/orders/${id}`), // 别名

  updateStatus: (id: string, status: string): Promise<ApiResponse<Order>> =>
    apiClient.patch(`/admin/orders/${id}/status`, { status }),

  updateOrderStatus: (id: string, status: string): Promise<ApiResponse<Order>> =>
    apiClient.patch(`/admin/orders/${id}/status`, { status }), // 别名

  // 添加admin专用的统计API
  getStats: (): Promise<ApiResponse<DashboardStats>> => apiClient.get('/admin/orders/stats'),

  // 批量操作API
  batchOperations: (data: { operation: string, orderIds: string[], [key: string]: unknown }): Promise<ApiResponse<{ processed: number; failed: number }>> =>
    apiClient.post('/admin/orders/batch', data),
};

// Users API - 使用统一的apiClient，调用admin专用端点
export const usersApi = {
  getAll: (params: PaginationParams = {}): Promise<ApiResponse<PaginatedResponse<UserProfile>>> => {
    const { page = 1, limit = 10, search } = params;
    return apiClient.get('/admin/users', { params: { page, limit, search } });
  },

  getUsers: (params: PaginationParams = {}): Promise<ApiResponse<PaginatedResponse<UserProfile>>> => {
    const { page = 1, limit = 10, search } = params;
    return apiClient.get('/admin/users', { params: { page, limit, search } });
  },

  getById: (id: string): Promise<ApiResponse<UserProfile>> => apiClient.get(`/admin/users/${id}`),
  getUser: (id: string): Promise<ApiResponse<UserProfile>> => apiClient.get(`/admin/users/${id}`), // 别名

  // 注意：admin用户管理不支持创建用户，用户只能通过注册流程创建

  update: (id: string, data: Partial<UserProfile>): Promise<ApiResponse<UserProfile>> => apiClient.put(`/admin/users/${id}`, data),
  updateUser: (id: string, data: Partial<UserProfile>): Promise<ApiResponse<UserProfile>> => apiClient.put(`/admin/users/${id}`, data), // 别名

  delete: (id: string): Promise<ApiResponse<void>> => apiClient.delete(`/admin/users/${id}`),
  deleteUser: (id: string): Promise<ApiResponse<void>> => apiClient.delete(`/admin/users/${id}`), // 别名

  // 角色管理API
  updateRole: (id: string, role: 'USER' | 'TENANT_ADMIN'): Promise<ApiResponse<UserProfile>> =>
    apiClient.patch(`/admin/users/${id}/role`, { role }),

  // 批量操作API
  batchOperations: (data: { operation: string, userIds: string[], [key: string]: unknown }): Promise<ApiResponse<{ processed: number; failed: number }>> =>
    apiClient.post('/admin/users/batch', data),
};

// Statistics API - 使用admin专用的统计端点
export const statisticsApi = {
  // 仪表板统计 - 组合多个admin统计端点获取完整数据
  getDashboard: async (): Promise<ApiResponse<DashboardStats>> => {
    try {
      // 并行获取订单、用户、商品统计数据
      const [orderStatsRes, userStatsRes, productStatsRes] = await Promise.all([
        apiClient.get('/admin/orders/stats'),
        apiClient.get('/admin/users/stats'),
        apiClient.get('/admin/products/stats'),
      ]);

      // 提取各端点返回的数据
      const orderStats = orderStatsRes.data || {};
      const userStats = userStatsRes.data || {};
      const productStats = productStatsRes.data || {};

      // 组合统计数据 - 对齐 DashboardStats 接口
      const combinedStats: DashboardStats = {
        // 核心指标
        totalUsers: userStats.totalUsers || 0,
        totalProducts: productStats.totalProducts || 0,
        totalOrders: orderStats.totalOrders || 0,
        totalRevenue: orderStats.totalRevenue || 0,
        // 今日指标 (如果后端返回)
        todayOrders: orderStats.todayOrders || 0,
        todayRevenue: orderStats.todayRevenue || 0,
        // 增长率 (如果后端返回)
        userGrowth: userStats.userGrowth || 0,
        productGrowth: productStats.productGrowth || 0,
        orderGrowth: orderStats.orderGrowth || 0,
        revenueGrowth: orderStats.revenueGrowth || 0,
        // 订单状态分布
        ordersByStatus: orderStats.ordersByStatus || {
          PENDING: 0,
          PAID: 0,
          SHIPPED: 0,
          DELIVERED: 0,
          CANCELLED: 0,
        },
        // 商品库存状态
        inStockProducts: productStats.inStockProducts || 0,
        outOfStockProducts: productStats.outOfStockProducts || 0,
        // 可选数据
        recentOrders: orderStats.recentOrders || [],
        topProducts: orderStats.topProducts || [],
      };

      return {
        success: true,
        data: combinedStats,
        message: 'Dashboard statistics retrieved successfully'
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to fetch dashboard stats:', errorMessage);
      // 返回默认值而不是 undefined，避免 UI 显示问题
      return {
        success: false,
        data: {
          totalUsers: 0,
          totalProducts: 0,
          totalOrders: 0,
          totalRevenue: 0,
          todayOrders: 0,
          todayRevenue: 0,
          userGrowth: 0,
          productGrowth: 0,
          orderGrowth: 0,
          revenueGrowth: 0,
        } as DashboardStats,
        message: errorMessage || 'Failed to retrieve dashboard statistics'
      };
    }
  },

  getDashboardStats: async (): Promise<ApiResponse<DashboardStats>> => {
    // 别名，兼容现有代码
    return statisticsApi.getDashboard();
  },

  // 订单统计 - 使用admin专用端点
  getOrders: (): Promise<ApiResponse<{ totalOrders: number; totalRevenue: number }>> => apiClient.get('/admin/orders/stats'),

  // 用户统计 - 使用admin专用端点
  getUsers: (): Promise<ApiResponse<{ totalUsers: number; activeUsers: number }>> => apiClient.get('/admin/users/stats'),

  // 商品统计 - 使用admin专用端点
  getProducts: (): Promise<ApiResponse<{ totalProducts: number; inStockProducts: number; outOfStockProducts: number }>> => apiClient.get('/admin/products/stats'),

  // 缓存统计 - 使用现有端点
  getCacheStats: (): Promise<ApiResponse<{ totalKeys: number; memoryUsage: number; hitRate: number }>> => apiClient.get('/cache/stats'),
};

// Cache API - 使用统一的apiClient，修复路径
export const cacheApi = {
  getStats: (): Promise<ApiResponse<{ totalKeys: number; memoryUsage: number; hitRate: number }>> =>
    apiClient.get('/cache/stats'),

  clear: (pattern?: string): Promise<ApiResponse<void>> =>
    apiClient.delete('/cache/clear', { params: pattern ? { pattern } : {} }),
};

// 权限系统已简化并合并到auth模块中，不再需要独立的权限API

// Plugin Management API - 使用统一的apiClient，调用admin专用端点
export const pluginsApi = {
  // Get plugin marketplace list
  getMarketplace: (params?: {
    category?: string;
    businessModel?: 'free' | 'freemium' | 'subscription' | 'usage_based';
    sortBy?: 'name' | 'rating' | 'installCount' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
  }): Promise<ApiResponse<any>> =>
    apiClient.get('/admin/plugins/marketplace', { params }),

  // Search plugins
  searchPlugins: (query: string, category?: string): Promise<ApiResponse<any>> =>
    apiClient.get('/admin/plugins/marketplace/search', { params: { q: query, category } }),

  // Get plugin details
  getPluginDetails: (slug: string): Promise<ApiResponse<any>> =>
    apiClient.get(`/admin/plugins/marketplace/${slug}`),

  // Get installed plugins
  getInstalled: (params?: {
    status?: 'ACTIVE' | 'INACTIVE';
    enabled?: boolean;
  }): Promise<ApiResponse<any>> =>
    apiClient.get('/admin/plugins/installed', { params }),

  // Install plugin
  installPlugin: (slug: string, data: {
    planId?: string;
    startTrial?: boolean;
    configData?: Record<string, any>;
  }): Promise<ApiResponse<any>> =>
    apiClient.post(`/admin/plugins/${slug}/install`, data),

  // Get plugin configuration
  getConfig: (slug: string): Promise<ApiResponse<any>> =>
    apiClient.get(`/admin/plugins/${slug}/config`),

  // Update plugin configuration
  updateConfig: (slug: string, configData: Record<string, any>): Promise<ApiResponse<any>> =>
    apiClient.put(`/admin/plugins/${slug}/config`, { configData }),

  // Toggle plugin enabled/disabled
  togglePlugin: (slug: string, enabled: boolean): Promise<ApiResponse<any>> =>
    apiClient.patch(`/admin/plugins/${slug}/toggle`, { enabled }),

  // Uninstall plugin
  uninstallPlugin: (slug: string): Promise<ApiResponse<any>> =>
    apiClient.delete(`/admin/plugins/${slug}/uninstall`),

  // Get plugin categories
  getCategories: (): Promise<ApiResponse<any>> =>
    apiClient.get('/admin/plugins/categories'),

  // Usage and subscription management
  getPluginUsage: (slug: string): Promise<ApiResponse<any>> =>
    apiClient.get(`/admin/plugins/installed/${slug}/usage`),

  getPluginSubscription: (slug: string): Promise<ApiResponse<any>> =>
    apiClient.get(`/admin/plugins/installed/${slug}/subscription`),

  upgradeSubscription: (slug: string, planId: string): Promise<ApiResponse<any>> =>
    apiClient.post(`/admin/plugins/installed/${slug}/upgrade`, { planId }),

  verifyCheckoutSession: (slug: string, sessionId: string): Promise<ApiResponse<any>> =>
    apiClient.post(`/admin/plugins/installed/${slug}/verify-checkout`, { sessionId }),
};

// Stripe Plugin API - Direct calls to Stripe plugin endpoints
export const stripePluginApi = {
  // Get upgrade preview
  getUpgradePreview: (targetPlan: string): Promise<ApiResponse<any>> =>
    apiClient.post('/plugins/stripe/api/plan/upgrade-preview', {
      targetPlan,
    }),

  // Create upgrade checkout session
  createUpgradeCheckout: (
    targetPlan: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<ApiResponse<any>> =>
    apiClient.post('/plugins/stripe/api/plan/upgrade', {
      targetPlan,
      successUrl,
      cancelUrl,
    }),

  // Downgrade plan (effective at period end)
  downgradePlan: (targetPlan: string): Promise<ApiResponse<any>> =>
    apiClient.post('/plugins/stripe/api/plan/downgrade', {
      targetPlan,
    }),

  // Get current plan info
  getCurrentPlan: (): Promise<ApiResponse<any>> =>
    apiClient.get('/plugins/stripe/api/plan/current'),

  // Cancel pending downgrade
  cancelDowngrade: (): Promise<ApiResponse<any>> =>
    apiClient.post('/plugins/stripe/api/plan/cancel-downgrade', {}),
};

// Google OAuth Plugin API - Direct calls to Google OAuth plugin endpoints
export const googleOAuthPluginApi = {
  // Get upgrade preview
  getUpgradePreview: (targetPlan: string): Promise<ApiResponse<any>> =>
    apiClient.post('/plugins/google/api/plan/upgrade-preview', {
      targetPlan,
    }),

  // Create upgrade checkout session
  createUpgradeCheckout: (
    targetPlan: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<ApiResponse<any>> =>
    apiClient.post('/plugins/google/api/plan/upgrade', {
      targetPlanId: targetPlan,
      successUrl,
      cancelUrl,
    }),

  // Downgrade plan (effective at period end)
  downgradePlan: (targetPlan: string): Promise<ApiResponse<any>> =>
    apiClient.post('/plugins/google/api/plan/downgrade', {
      targetPlan,
    }),

  // Get current plan info
  getCurrentPlan: (): Promise<ApiResponse<any>> =>
    apiClient.get('/plugins/google/api/plan/current'),

  // Cancel pending downgrade
  cancelDowngrade: (): Promise<ApiResponse<any>> =>
    apiClient.post('/plugins/google/api/plan/cancel-downgrade', {}),

  // Get plugin statistics
  getStats: (): Promise<ApiResponse<any>> =>
    apiClient.get('/plugins/google/api/stats'),

  // 🆕 Business functionality endpoints
  // OAuth login for mall frontend
  oauthLogin: (code: string, state?: string, redirectUrl?: string): Promise<ApiResponse<any>> =>
    apiClient.post('/plugins/google/api/oauth/login', {
      code,
      state,
      redirectUrl,
    }),

  // Get OAuth users list
  getOAuthUsers: (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<ApiResponse<any>> =>
    apiClient.get('/plugins/google/api/oauth/users', { params }),

  // Get OAuth sessions
  getOAuthSessions: (): Promise<ApiResponse<any>> =>
    apiClient.get('/plugins/google/api/oauth/sessions'),

  // Revoke OAuth authorizations for multiple users
  revokeOAuthUsers: (userIds: string[]): Promise<ApiResponse<any>> =>
    apiClient.post('/plugins/google/api/oauth/revoke-all', {
      userIds,
    }),
};

// Resend Email Plugin API - Direct calls to Resend Email plugin endpoints
export const resendEmailPluginApi = {
  // ============================================
  // Plan Management
  // ============================================

  // Get upgrade preview
  getUpgradePreview: (targetPlan: string): Promise<ApiResponse<any>> =>
    apiClient.post('/plugins/resend/api/plan/upgrade-preview', {
      targetPlan,
    }),

  // Create upgrade checkout session
  createUpgradeCheckout: (
    targetPlan: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<ApiResponse<any>> =>
    apiClient.post('/plugins/resend/api/plan/upgrade', {
      targetPlan,
      successUrl,
      cancelUrl,
    }),

  // Downgrade plan (effective at period end)
  downgradePlan: (targetPlan: string): Promise<ApiResponse<any>> =>
    apiClient.post('/plugins/resend/api/plan/downgrade', {
      targetPlan,
    }),

  // Get current plan info
  getCurrentPlan: (): Promise<ApiResponse<any>> =>
    apiClient.get('/plugins/resend/api/plan/current'),

  // Cancel pending downgrade
  cancelDowngrade: (): Promise<ApiResponse<any>> =>
    apiClient.post('/plugins/resend/api/plan/cancel-downgrade', {}),

  // ============================================
  // Email Operations
  // ============================================

  // Send single email
  sendTestEmail: (to: string, subject: string, html: string, text?: string): Promise<ApiResponse<any>> =>
    apiClient.post('/plugins/resend/api/send', {
      to,
      subject,
      html,
      text,
    }),

  // Get email delivery status
  getEmailStatus: (messageId: string): Promise<ApiResponse<any>> =>
    apiClient.get(`/plugins/resend/api/status/${messageId}`),

  // Get plugin capabilities
  getCapabilities: (): Promise<ApiResponse<any>> =>
    apiClient.get('/plugins/resend/api/capabilities'),

  // ============================================
  // Email Logs
  // ============================================

  // Get email logs with pagination and filtering
  getEmailLogs: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    provider?: string;
  }): Promise<ApiResponse<any>> =>
    apiClient.get('/emails/logs', { params }),
};

// Upload API - 使用统一的apiClient
export const uploadApi = {
  uploadProductImage: (file: File): Promise<ApiResponse<{ url: string }>> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/api/upload/product-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

// 导出默认的apiClient实例
export default apiClient;
