/**
 * Super Admin API客户端
 * 使用统一的AuthClient，移除独立的localStorage token管理逻辑
 */

import {
  createSuperAdminClient,
  getSuperAdminClient,
  type ApiResponse,

  type LoginCredentials,
  type UserProfile
} from 'shared';

// 延迟初始化 API 客户端，避免模块加载时的环境变量问题
let _apiClient: ReturnType<typeof createSuperAdminClient> | null = null;

const getApiClient = () => {
  if (!_apiClient) {
    _apiClient = createSuperAdminClient({
      // 🔧 统一环境管理：使用共享envConfig
      // Next.js代理会自动将/api/*转发到后端，无需重复/api前缀
      // 使用浏览器存储策略（localStorage）
      storageType: 'browser', // Super Admin使用浏览器存储策略，与默认配置一致
      customConfig: {
        timeout: 10000,
        // 移除baseURL覆盖，使用默认的getBackendApiBaseUrl()
      }
    });
  }
  return _apiClient;
};

// 导出 Proxy 以保持向后兼容
export const apiClient = new Proxy({} as ReturnType<typeof createSuperAdminClient>, {
  get: (target, prop) => {
    return getApiClient()[prop as keyof ReturnType<typeof createSuperAdminClient>];
  }
});

// 导出工厂函数供其他模块使用
export { getSuperAdminClient };

// Authentication API - 使用统一的authClient
export const authApi = {
  login: (credentials: LoginCredentials): Promise<ApiResponse<any>> => apiClient.login(credentials),

  logout: () => apiClient.logout(),

  getProfile: (): Promise<ApiResponse<UserProfile>> => apiClient.getProfile(),

  refreshToken: () =>
    // 🔧 统一环境管理：使用共享envConfig
    apiClient.refreshAuthToken(),

  // 获取当前用户信息（从 JWT token 解析）
  getCurrentUser: (): UserProfile | null => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return null;

      // 解析JWT token获取用户信息
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(atob(parts[1]));
      return {
        id: payload.userId,
        email: payload.email,
        username: payload.email?.split('@')[0] || 'user',
        role: payload.role,
        tenantId: payload.tenantId?.toString(),
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as UserProfile;
    } catch {
      return null;
    }
  },

  // 检查是否是超级管理员
  isSuperAdmin: (): boolean => {
    try {
      const user = authApi.getCurrentUser();
      return user?.role === 'SUPER_ADMIN' || user?.role === 'super_admin';
    } catch {
      return false;
    }
  },
};

// Tenant Management API - 租户管理API (使用统一的apiClient)
// 🔧 完整对接所有7个Super Admin租户端点
export const tenantManagementApi = {
  // ✅ 1. Create new tenant - POST /api/super-admin/tenants
  createTenant: (data: {
    companyName: string;
    contactName: string;  // Required by API
    contactEmail: string;
    contactPhone?: string;
    address?: string;
    agencyLevel: string;
    adminUser: {
      username: string;
      email: string;
      password: string;
    };
  }): Promise<ApiResponse<any>> => apiClient.post('/super-admin/tenants', data),

  // ✅ 2. Get all tenants - GET /api/super-admin/tenants
  getAllTenants: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    agencyLevel?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<ApiResponse<any>> => apiClient.get('/super-admin/tenants', { params }),

  // ✅ 3. Get tenant by ID - GET /api/super-admin/tenants/:id
  getTenant: (tenantId: string): Promise<ApiResponse<any>> => apiClient.get(`/super-admin/tenants/${tenantId}`),

  // ✅ 4. Update tenant - PUT /api/super-admin/tenants/:id
  updateTenant: (tenantId: string, data: {
    companyName?: string;
    contactEmail?: string;
    contactPhone?: string;
    address?: string;
    agencyLevel?: string;
    settings?: any;
  }): Promise<ApiResponse<any>> => apiClient.put(`/super-admin/tenants/${tenantId}`, data),

  // ✅ 5. Update tenant status - PUT /api/super-admin/tenants/:id/status
  updateTenantStatus: (tenantId: string, data: {
    status: string;
    reason?: string;
  }): Promise<ApiResponse<any>> => apiClient.put(`/super-admin/tenants/${tenantId}/status`, data),

  // ✅ 6. Search and filter tenants - GET /api/super-admin/tenants?search=xxx
  searchTenants: (params: {
    search: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<any>> => apiClient.get('/super-admin/tenants', { params }),

  // ✅ 7. Get tenant statistics - GET /api/super-admin/tenants/stats
  getTenantStats: (): Promise<ApiResponse<any>> => apiClient.get('/super-admin/tenants/stats'),

  // ✅ 8. Activate tenant - PUT /api/super-admin/tenants/:id/status (status: 'ACTIVE')
  activateTenant: (tenantId: string, paymentReference?: string): Promise<ApiResponse<any>> =>
    apiClient.put(`/super-admin/tenants/${tenantId}/status`, {
      status: 'ACTIVE',
      paymentReference
    }),

  // ✅ 9. Suspend tenant - PUT /api/super-admin/tenants/:id/status (status: 'SUSPENDED')
  suspendTenant: (tenantId: string, reason?: string): Promise<ApiResponse<any>> =>
    apiClient.put(`/super-admin/tenants/${tenantId}/status`, {
      status: 'SUSPENDED',
      reason
    }),

  // ✅ 10. Terminate tenant - PUT /api/super-admin/tenants/:id/status (status: 'TERMINATED')
  terminateTenant: (tenantId: string, reason?: string): Promise<ApiResponse<any>> =>
    apiClient.put(`/super-admin/tenants/${tenantId}/status`, {
      status: 'TERMINATED',
      reason
    }),

  // ✅ 11. Delete tenant - DELETE /api/super-admin/tenants/:id
  deleteTenant: (tenantId: string): Promise<ApiResponse<any>> =>
    apiClient.delete(`/super-admin/tenants/${tenantId}`),
};

// Platform Statistics API - 平台统计API (使用统一的apiClient)
// 🔧 根据API文档修复：Super Admin使用专门的统计端点
export const platformStatsApi = {
  // Get platform overview statistics - 使用租户统计作为平台概览
  getPlatformStats: (): Promise<ApiResponse<any>> => apiClient.get('/super-admin/tenants/stats'),

  // Get dashboard statistics - 组合多个Super Admin统计端点
  getDashboard: async (): Promise<ApiResponse<any>> => {
    try {
      // 并行获取各种统计数据
      const [tenantStats, userStats, productStats, orderStats] = await Promise.all([
        apiClient.get('/super-admin/tenants/stats'),
        apiClient.get('/super-admin/users/stats'),
        apiClient.get('/super-admin/products/stats'),
        apiClient.get('/super-admin/orders/stats')
      ]);

      // 组合统计数据
      const combinedStats = {
        tenants: tenantStats.data,
        users: userStats.data,
        products: productStats.data,
        orders: orderStats.data
      };

      return {
        success: true,
        data: combinedStats,
        message: 'Dashboard statistics retrieved successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        message: error.message || 'Failed to retrieve dashboard statistics'
      };
    }
  },

  // Get dashboard statistics - 别名，兼容现有代码
  getDashboardStats: async (): Promise<ApiResponse<any>> => {
    try {
      // 并行获取各种统计数据
      const [tenantStats, userStats, productStats, orderStats] = await Promise.all([
        apiClient.get('/super-admin/tenants/stats'),
        apiClient.get('/super-admin/users/stats'),
        apiClient.get('/super-admin/products/stats'),
        apiClient.get('/super-admin/orders/stats')
      ]);

      // 组合统计数据
      const combinedStats = {
        tenants: tenantStats.data,
        users: userStats.data,
        products: productStats.data,
        orders: orderStats.data
      };

      return {
        success: true,
        data: combinedStats,
        message: 'Dashboard statistics retrieved successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        message: error.message || 'Failed to retrieve dashboard statistics'
      };
    }
  },
};

// Permission Management API - 权限管理API (使用统一的apiClient)
export const permissionManagementApi = {
  // Check single permission - POST /permissions/check
  checkPermission: (data: {
    resource: string;
    action: string;
    resourceId?: string;
  }): Promise<ApiResponse<boolean>> => apiClient.post('/permissions/check', data),

  // Check multiple permissions - POST /permissions/check-multiple
  checkMultiplePermissions: (data: {
    permissions: Array<{
      resource: string;
      action: string;
      resourceId?: string;
    }>;
  }): Promise<ApiResponse<Record<string, boolean>>> => apiClient.post('/permissions/check-multiple', data),
};

// Product Management API - 产品管理API (使用Super Admin端点)
// 🔧 完整对接所有8个Super Admin产品端点
export const productManagementApi = {
  // ✅ 1. Get all products - GET /api/super-admin/products
  getAllProducts: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    tenantId?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<ApiResponse<any>> => apiClient.get('/super-admin/products', { params }),

  // ✅ 2. Get product by ID - GET /api/super-admin/products/:id
  getProduct: (productId: string): Promise<ApiResponse<any>> => apiClient.get(`/super-admin/products/${productId}`),

  // ✅ 3. Create new product - POST /api/super-admin/products
  createProduct: (data: {
    name: string;
    description?: string;
    price: number;
    category: string;
    stock: number;
    tenantId: number;
    images?: string[];
    specifications?: any;
  }): Promise<ApiResponse<any>> => apiClient.post('/super-admin/products', data),

  // ✅ 4. Update product - PUT /api/super-admin/products/:id
  updateProduct: (productId: string, data: {
    name?: string;
    description?: string;
    price?: number;
    category?: string;
    stock?: number;
    images?: string[];
    specifications?: any;
  }): Promise<ApiResponse<any>> => apiClient.put(`/super-admin/products/${productId}`, data),

  // ✅ 5. Batch operations - POST /api/super-admin/products/batch
  batchOperations: (data: {
    action: string; // 'updatePrice' | 'updateStock' | 'updateCategory' | 'delete'
    productIds: string[];
    updateData?: any;
  }): Promise<ApiResponse<any>> => apiClient.post('/super-admin/products/batch', data),

  // ✅ 6. Delete product - DELETE /api/super-admin/products/:id
  deleteProduct: (productId: string): Promise<ApiResponse<void>> => apiClient.delete(`/super-admin/products/${productId}`),

  // ✅ 7. Get product statistics - GET /api/super-admin/products/stats
  getProductStats: (): Promise<ApiResponse<any>> => apiClient.get('/super-admin/products/stats'),

  // ✅ 8. Additional helper methods for product management
  getProductsByTenant: (tenantId: string, params?: any): Promise<ApiResponse<any>> =>
    apiClient.get('/super-admin/products', { params: { ...params, tenantId } }),
};

// Order Management API - 订单管理API (使用Super Admin端点)
// 🔧 完整对接所有5个Super Admin订单端点
export const orderManagementApi = {
  // ✅ 1. Get all orders - GET /api/super-admin/orders
  getAllOrders: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    tenantId?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<ApiResponse<any>> => apiClient.get('/super-admin/orders', { params }),

  // ✅ 2. Get order by ID - GET /api/super-admin/orders/:id
  getOrder: (orderId: string): Promise<ApiResponse<any>> => apiClient.get(`/super-admin/orders/${orderId}`),

  // ✅ 3. Update order status - PATCH /api/super-admin/orders/:id/status
  updateOrderStatus: (orderId: string, status: string): Promise<ApiResponse<any>> =>
    apiClient.patch(`/super-admin/orders/${orderId}/status`, { status }),

  // ✅ 4. Batch order operations - POST /api/super-admin/orders/batch
  batchOperations: (data: {
    action: string; // 'updateStatus' | 'cancel' | 'refund' | 'delete'
    orderIds: string[];
    updateData?: any;
  }): Promise<ApiResponse<any>> => apiClient.post('/super-admin/orders/batch', data),

  // ✅ 5. Get order statistics - GET /api/super-admin/orders/stats
  getOrderStats: (): Promise<ApiResponse<any>> => apiClient.get('/super-admin/orders/stats'),

  // ✅ Additional helper methods for order management
  getOrdersByTenant: (tenantId: string, params?: any): Promise<ApiResponse<any>> =>
    apiClient.get('/super-admin/orders', { params: { ...params, tenantId } }),

  getOrdersByStatus: (status: string, params?: any): Promise<ApiResponse<any>> =>
    apiClient.get('/super-admin/orders', { params: { ...params, status } }),



  // ✅ Batch update order status
  batchUpdateOrderStatus: (orderIds: string[], status: string): Promise<ApiResponse<any>> =>
    apiClient.post('/super-admin/orders/batch', {
      action: 'updateStatus',
      orderIds,
      updateData: { status }
    }),
};



// User Management API - 用户管理API (使用Super Admin端点)
// 🔧 根据API文档修复：Super Admin使用 /super-admin/users 端点
export const userManagementApi = {
  // Get all users - GET /super-admin/users
  getAllUsers: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    tenantId?: string;
  }) => apiClient.get('/super-admin/users', { params }),

  // Get user by ID - GET /super-admin/users/:id
  getUserById: (userId: string) => apiClient.get(`/super-admin/users/${userId}`),

  // Update user - PUT /super-admin/users/:id
  updateUser: (userId: string, data: {
    username?: string;
    avatar?: string;
  }) => apiClient.put(`/super-admin/users/${userId}`, data),

  // Update user role - PATCH /super-admin/users/:id/role
  updateUserRole: (userId: string, data: {
    role: string;
    reason?: string;
  }) => apiClient.patch(`/super-admin/users/${userId}/role`, data),

  // Delete user - DELETE /super-admin/users/:id
  deleteUser: (userId: string) => apiClient.delete(`/super-admin/users/${userId}`),

  // Batch operations - POST /super-admin/users/batch
  batchOperations: (data: {
    action: string;
    userIds: string[];
    role?: string;
  }) => apiClient.post('/super-admin/users/batch', data),

  // Get user statistics - GET /super-admin/users/stats
  getUserStats: () => apiClient.get('/super-admin/users/stats'),
};

// Plugin Management API - 插件管理API (使用Super Admin端点)
// 🔧 重构为插件中心化API，支持新的端点结构
export const pluginManagementApi = {
  // ==================== 全局插件统计 ====================

  // ✅ GET /api/super-admin/plugins/stats - 获取全局插件统计
  getGlobalStats: (): Promise<ApiResponse<any>> =>
    apiClient.get('/super-admin/plugins/stats'),

  // ✅ GET /api/super-admin/plugins/health - 获取插件健康状态和错误统计
  getPluginHealth: (): Promise<ApiResponse<any>> =>
    apiClient.get('/super-admin/plugins/health'),

  // ✅ GET /api/super-admin/plugins/plugin-usage-overview - 获取插件使用概览
  getPluginUsageOverview: (): Promise<ApiResponse<any>> =>
    apiClient.get('/super-admin/plugins/plugin-usage-overview'),

  // ==================== 插件特定统计 ====================

  // ✅ GET /api/super-admin/plugins/:pluginSlug/stats - 获取特定插件统计
  getPluginStats: (pluginSlug: string): Promise<ApiResponse<any>> =>
    apiClient.get(`/super-admin/plugins/${pluginSlug}/stats`),

  // ✅ GET /api/super-admin/plugins/:pluginSlug/tenants/:tenantId - 获取租户插件详情
  getTenantPluginDetails: (pluginSlug: string, tenantId: string | number): Promise<ApiResponse<any>> =>
    apiClient.get(`/super-admin/plugins/${pluginSlug}/tenants/${tenantId}`),

  // ✅ GET /api/super-admin/plugins/:pluginSlug/tenants/:tenantId/subscription-history - 获取租户订阅历史
  getTenantSubscriptionHistory: (pluginSlug: string, tenantId: string, params?: {
    includeUsage?: boolean;
    includeChanges?: boolean;
  }): Promise<ApiResponse<any>> =>
    apiClient.get(`/super-admin/plugins/${pluginSlug}/tenants/${tenantId}/subscription-history`, { params }),

  // ==================== 订阅管理（插件范围）====================

  // ✅ GET /api/super-admin/plugins/:pluginSlug/subscriptions - 获取插件订阅列表
  getPluginSubscriptions: (pluginSlug: string, params?: {
    page?: number;
    limit?: number;
    status?: string;
    tenantId?: string;
    viewType?: 'tenants' | 'subscriptions'; // 视图类型：租户视图或订阅视图
  }): Promise<ApiResponse<any>> =>
    apiClient.get(`/super-admin/plugins/${pluginSlug}/subscriptions`, { params }),

  // ✅ GET /api/super-admin/plugins/:pluginSlug/subscriptions/:id - 获取订阅详情
  getSubscriptionDetails: (pluginSlug: string, subscriptionId: string): Promise<ApiResponse<any>> =>
    apiClient.get(`/super-admin/plugins/${pluginSlug}/subscriptions/${subscriptionId}`),

  // ✅ PUT /api/super-admin/plugins/:pluginSlug/subscriptions/:id/status - 更新订阅状态
  updateSubscriptionStatus: (pluginSlug: string, subscriptionId: string, data: {
    status: string;
    reason?: string;
  }): Promise<ApiResponse<any>> =>
    apiClient.put(`/super-admin/plugins/${pluginSlug}/subscriptions/${subscriptionId}/status`, data),

  // ✅ PUT /api/super-admin/plugins/:pluginSlug/subscriptions/:id/usage - 更新订阅使用量
  updateSubscriptionUsage: (pluginSlug: string, subscriptionId: string, data: {
    metricName: string; // 支持所有插件的指标：api_calls, transactions, emails_sent 等
    action: 'set' | 'reset';
    value?: number;
  }): Promise<ApiResponse<any>> =>
    apiClient.put(`/super-admin/plugins/${pluginSlug}/subscriptions/${subscriptionId}/usage`, data),

  // 🆕 POST /api/super-admin/plugins/:pluginSlug/tenants/:tenantId/subscriptions - 手动创建订阅
  createTenantSubscription: (pluginSlug: string, tenantId: string | number, data: {
    planId: 'free' | 'business' | 'enterprise';
    reason?: string;
    startDate?: string;
    replaceExisting?: boolean;
  }): Promise<ApiResponse<any>> =>
    apiClient.post(`/super-admin/plugins/${pluginSlug}/tenants/${tenantId}/subscriptions`, data),

  // ==================== 订阅计划管理（插件范围）====================

  // ✅ GET /api/super-admin/plugins/:pluginSlug/plans - 获取订阅计划列表
  getSubscriptionPlans: (pluginSlug: string): Promise<ApiResponse<any>> =>
    apiClient.get(`/super-admin/plugins/${pluginSlug}/plans`),

  // ✅ POST /api/super-admin/plugins/:pluginSlug/plans - 创建订阅计划
  createSubscriptionPlan: (pluginSlug: string, data: {
    planId: string;
    name: string;
    description?: string;
    amount: number;
    currency: string;
    billingCycle: string;
    trialDays?: number;
    stripePriceId?: string;
    features?: string[];
    limits?: Record<string, number>;
    isActive?: boolean;
  }): Promise<ApiResponse<any>> =>
    apiClient.post(`/super-admin/plugins/${pluginSlug}/plans`, data),

  // ✅ PUT /api/super-admin/plugins/:pluginSlug/plans/:planId - 更新订阅计划
  updateSubscriptionPlan: (pluginSlug: string, planId: string, data: {
    name?: string;
    description?: string;
    amount?: number;
    currency?: string;
    billingCycle?: string;
    trialDays?: number;
    stripePriceId?: string;
    features?: string[];
    limits?: Record<string, number>;
    isActive?: boolean;
  }): Promise<ApiResponse<any>> =>
    apiClient.put(`/super-admin/plugins/${pluginSlug}/plans/${planId}`, data),

  // ✅ DELETE /api/super-admin/plugins/:pluginSlug/plans/:planId - 删除订阅计划
  deleteSubscriptionPlan: (pluginSlug: string, planId: string): Promise<ApiResponse<any>> =>
    apiClient.delete(`/super-admin/plugins/${pluginSlug}/plans/${planId}`),

  // ==================== 租户定制（插件范围）====================

  // ✅ POST /api/super-admin/plugins/:pluginSlug/tenants/:tenantId/custom-pricing - 创建定制定价
  createCustomPricing: (pluginSlug: string, tenantId: string | number, data: {
    planId: string;
    features?: string[];
    limits?: Record<string, number>;
    validFrom?: string;
    validTo?: string;
    reason?: string;
  }): Promise<ApiResponse<any>> =>
    apiClient.post(`/super-admin/plugins/${pluginSlug}/tenants/${tenantId}/custom-pricing`, data),

  // ✅ POST /api/super-admin/plugins/:pluginSlug/tenants/:tenantId/feature-overrides - 创建功能覆盖
  createFeatureOverride: (pluginSlug: string, tenantId: string | number, data: {
    feature: string;
    enabled: boolean;
    reason?: string;
  }): Promise<ApiResponse<any>> =>
    apiClient.post(`/super-admin/plugins/${pluginSlug}/tenants/${tenantId}/feature-overrides`, data),

  // ✅ POST /api/super-admin/plugins/:pluginSlug/tenants/:tenantId/usage-overrides - 创建使用量覆盖
  createUsageOverride: (pluginSlug: string, tenantId: string | number, data: {
    metricName: string;
    limitValue: number;
    reason?: string;
    validFrom?: string;
    validTo?: string;
  }): Promise<ApiResponse<any>> =>
    apiClient.post(`/super-admin/plugins/${pluginSlug}/tenants/${tenantId}/usage-overrides`, data),

  // ✅ GET /api/super-admin/plugins/:pluginSlug/tenants/:tenantId/usage-overrides - 获取使用量覆盖列表
  getUsageOverrides: (pluginSlug: string, tenantId: string | number): Promise<ApiResponse<any>> =>
    apiClient.get(`/super-admin/plugins/${pluginSlug}/tenants/${tenantId}/usage-overrides`),

  // ✅ DELETE /api/super-admin/plugins/:pluginSlug/tenants/:tenantId/usage-overrides/:id - 删除使用量覆盖
  deleteUsageOverride: (pluginSlug: string, tenantId: string | number, overrideId: string): Promise<ApiResponse<any>> =>
    apiClient.delete(`/super-admin/plugins/${pluginSlug}/tenants/${tenantId}/usage-overrides/${overrideId}`),

  // ==================== 插件CRUD管理 ====================

  // ✅ GET /api/super-admin/plugins - 获取所有插件列表
  getAllPlugins: (params?: {
    category?: string;
    status?: string;
    runtimeType?: 'internal-fastify' | 'external-http';
  }): Promise<ApiResponse<any>> =>
    apiClient.get('/super-admin/plugins/plugins', { params }),

  // ✅ GET /api/super-admin/plugins/:pluginId - 获取单个插件详情
  getPluginById: (pluginId: string): Promise<ApiResponse<any>> =>
    apiClient.get(`/super-admin/plugins/plugins/${pluginId}`),

  // ✅ POST /api/super-admin/plugins - 创建新插件
  createPlugin: (data: {
    slug: string;
    name: string;
    description?: string;
    category: 'payment' | 'email' | 'integration' | 'theme' | 'analytics' | 'marketing';
    runtimeType?: 'internal-fastify' | 'external-http';
    externalBaseUrl?: string;
    oauthConfig?: {
      installUrl?: string;
      tokenUrl?: string;
      redirectUri?: string;
      scopes?: string;
    };
    integrationSecrets?: {
      sharedSecret?: string;
    };
    autoGenerateSecret?: boolean;
    tags?: string;
    iconUrl?: string;
    status?: 'ACTIVE' | 'INACTIVE';
  }): Promise<ApiResponse<any>> =>
    apiClient.post('/super-admin/plugins/plugins', data),

  // ✅ PUT /api/super-admin/plugins/:pluginId - 更新插件配置
  updatePlugin: (pluginId: string, data: {
    name?: string;
    description?: string;
    category?: 'payment' | 'email' | 'integration' | 'theme' | 'analytics' | 'marketing';
    runtimeType?: 'internal-fastify' | 'external-http';
    externalBaseUrl?: string;
    oauthConfig?: {
      installUrl?: string;
      tokenUrl?: string;
      redirectUri?: string;
      scopes?: string;
    };
    integrationSecrets?: {
      sharedSecret?: string;
    };
    regenerateSecret?: boolean;
    tags?: string;
    iconUrl?: string;
    status?: 'ACTIVE' | 'INACTIVE';
  }): Promise<ApiResponse<any>> =>
    apiClient.put(`/super-admin/plugins/plugins/${pluginId}`, data),

  // ✅ DELETE /api/super-admin/plugins/:pluginId - 删除插件
  deletePlugin: (pluginId: string): Promise<ApiResponse<any>> =>
    apiClient.delete(`/super-admin/plugins/plugins/${pluginId}`),

  // ✅ POST /api/super-admin/plugins/:pluginId/regenerate-secret - 重新生成共享密钥
  regeneratePluginSecret: (pluginId: string): Promise<ApiResponse<any>> =>
    apiClient.post(`/super-admin/plugins/plugins/${pluginId}/regenerate-secret`),

  // ==================== 旧端点（已弃用，保留兼容性）====================

  /** @deprecated 使用 getGlobalStats() 代替 */
  getPluginStatsOld: (): Promise<ApiResponse<any>> =>
    apiClient.get('/super-admin/plugins/stats'),

  /** @deprecated 使用 getPluginSubscriptions() 代替 */
  getAllSubscriptions: (params?: {
    page?: number;
    limit?: number;
    tenantId?: string;
    pluginSlug?: string;
    status?: string;
  }): Promise<ApiResponse<any>> =>
    apiClient.get('/super-admin/plugins/subscriptions', { params }),

  /** @deprecated 使用 getTenantPluginDetails() 代替 */
  getTenantCommercialDetails: (tenantId: string): Promise<ApiResponse<any>> =>
    apiClient.get(`/super-admin/plugins/tenant/${tenantId}/commercial-details`),
};

// ==================== 缺失的 API 模块 ====================

// Statistics API - 统计API (使用平台统计作为别名)
export const statisticsApi = platformStatsApi;

// SaaS Management API - SaaS管理API (使用租户管理作为别名)
export const saasManagementApi = tenantManagementApi;

// Inventory Management API - 库存管理API (使用产品管理作为别名)
export const inventoryManagementApi = productManagementApi;

// License Management API - 许可证管理API (使用插件管理作为别名)
export const licenseManagementApi = pluginManagementApi;

// Notification Management API - 通知管理API (模拟实现)
export const notificationManagementApi = {
  getAllNotifications: (params?: any): Promise<ApiResponse<any>> =>
    apiClient.get('/super-admin/notifications', { params }),

  createNotification: (data: any): Promise<ApiResponse<any>> =>
    apiClient.post('/super-admin/notifications', data),

  updateNotification: (id: string, data: any): Promise<ApiResponse<any>> =>
    apiClient.put(`/super-admin/notifications/${id}`, data),

  deleteNotification: (id: string): Promise<ApiResponse<void>> =>
    apiClient.delete(`/super-admin/notifications/${id}`),

  getNotificationStats: (): Promise<ApiResponse<any>> =>
    apiClient.get('/super-admin/notifications/stats'),
};

// Payment Monitoring API - 支付监控API (使用订单管理作为别名)
export const paymentMonitoringApi = orderManagementApi;

// System Management API - 系统管理API
// 🔧 重构为使用现有 /api/cache 端点，移除虚构的 /super-admin/system/* 路由
export const systemManagementApi = {
  // ✅ GET /api/cache/stats - 获取缓存统计
  getCacheStats: (): Promise<ApiResponse<any>> =>
    apiClient.get('/cache/stats'),

  // ✅ GET /api/cache/health - 缓存健康检查
  getCacheHealth: (): Promise<ApiResponse<any>> =>
    apiClient.get('/cache/health'),

  // ✅ DELETE /api/cache/products - 清除产品缓存
  clearProductCache: (): Promise<ApiResponse<any>> =>
    apiClient.delete('/cache/products'),

  // ✅ DELETE /api/cache/search - 清除搜索缓存
  clearSearchCache: (): Promise<ApiResponse<any>> =>
    apiClient.delete('/cache/search'),

  // ✅ DELETE /api/cache/key/:key - 删除特定缓存键
  deleteCacheKey: (key: string): Promise<ApiResponse<any>> =>
    apiClient.delete(`/cache/key/${key}`),

  // ✅ GET /api/cache/key/:key - 获取缓存值
  getCacheValue: (key: string): Promise<ApiResponse<any>> =>
    apiClient.get(`/cache/key/${key}`),

  // ✅ 清除统计缓存 - 使用 DELETE /api/cache/key 删除特定的统计缓存键
  clearStatsCache: (): Promise<ApiResponse<any>> =>
    apiClient.delete('/cache/key/stats:*'),

  // 🔧 已弃用的方法（保留兼容性，但标记为不推荐）
  /** @deprecated 使用 getCacheStats() 代替 */
  getSystemStats: (): Promise<ApiResponse<any>> =>
    apiClient.get('/cache/stats'),

  /** @deprecated 使用 getCacheHealth() 代替 */
  getSystemHealth: (): Promise<ApiResponse<any>> =>
    apiClient.get('/cache/health'),

  /** @deprecated 此功能不再支持 */
  updateSystemConfig: (data: any): Promise<ApiResponse<any>> =>
    Promise.reject(new Error('updateSystemConfig is no longer supported')),

  /** @deprecated 此功能不再支持 */
  getSystemLogs: (params?: any): Promise<ApiResponse<any>> =>
    Promise.reject(new Error('getSystemLogs is no longer supported')),

  /** @deprecated 使用 clearProductCache() 和 clearSearchCache() 代替 */
  clearCache: (): Promise<ApiResponse<any>> =>
    Promise.all([
      apiClient.delete('/cache/products'),
      apiClient.delete('/cache/search')
    ]).then(() => ({ success: true, message: 'All caches cleared' })),

  /** @deprecated 此功能不再支持 */
  restartServices: (services: string[]): Promise<ApiResponse<any>> =>
    Promise.reject(new Error('restartServices is no longer supported')),
};

export default apiClient;
