/**
 * Admin API Client
 * Uses unified AuthClient. Independent cookie token management logic removed.
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

// Type definitions (Admin specific)
export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  role?: string;
}

// Lazy initialize API client to avoid environment variable issues during module loading
let _apiClient: ReturnType<typeof createAdminClient> | null = null;

const getApiClient = () => {
  if (!_apiClient) {
    _apiClient = createAdminClient({
      // 🔧 Fix API path duplication: do not pass basePath, use default backend URL config
      // Next.js proxy will automatically forward /api/* to the backend
      storageType: 'hybrid', // Use hybrid storage strategy
      customConfig: {
        timeout: 10000,
      }
    });
  }
  return _apiClient;
};

// Export Proxy for backward compatibility
export const apiClient = new Proxy({} as ReturnType<typeof createAdminClient>, {
  get: (target, prop) => {
    return getApiClient()[prop as keyof ReturnType<typeof createAdminClient>];
  }
});

// Export factory for other modules
export { getAdminClient };

// Auth API - Using unified AuthClient methods
export const authApi = {
  login: (email: string, password: string) =>
    apiClient.login({ email, password }),

  me: (): Promise<ApiResponse<UserProfile>> => apiClient.getProfile(),

  logout: () => apiClient.logout(),

  refreshToken: () =>
    // 🔧 Fix type definition: direct use of AuthClient's return type
    apiClient.refreshAuthToken(),
};



// Products API - Using unified apiClient targeting admin endpoints
export const productsApi = {
  getAll: (page = 1, limit = 10, search?: string): Promise<ApiResponse<PaginatedResponse<Product>>> =>
    apiClient.get('/admin/products', { params: { page, limit, search } }),

  // Alias methods for backward compatibility
  getProducts: (params: PaginationParams = {}): Promise<ApiResponse<PaginatedResponse<Product>>> => {
    const { page = 1, limit = 10, search } = params;
    return apiClient.get('/admin/products', { params: { page, limit, search } });
  },

  getById: (id: string): Promise<ApiResponse<Product>> => apiClient.get(`/admin/products/${id}`),
  getProduct: (id: string): Promise<ApiResponse<Product>> => apiClient.get(`/admin/products/${id}`), // Alias

  create: (data: ProductForm): Promise<ApiResponse<Product>> => apiClient.post('/admin/products', data),
  createProduct: (data: ProductForm): Promise<ApiResponse<Product>> => apiClient.post('/admin/products', data), // Alias

  update: (id: string, data: Partial<ProductForm>): Promise<ApiResponse<Product>> => apiClient.put(`/admin/products/${id}`, data),
  updateProduct: (id: string, data: Partial<ProductForm>): Promise<ApiResponse<Product>> => apiClient.put(`/admin/products/${id}`, data), // Alias

  delete: (id: string): Promise<ApiResponse<void>> => apiClient.delete(`/admin/products/${id}`),
  deleteProduct: (id: string): Promise<ApiResponse<void>> => apiClient.delete(`/admin/products/${id}`), // Alias

  // Inventory management API removed (Alpha)
};


// Orders API - Using unified apiClient targeting admin endpoints
export const ordersApi = {
  getAll: (page = 1, limit = 10): Promise<ApiResponse<PaginatedResponse<Order>>> =>
    apiClient.get('/admin/orders', { params: { page, limit } }),

  // Alias methods for backward compatibility
  getOrders: (params: PaginationParams = {}): Promise<ApiResponse<PaginatedResponse<Order>>> => {
    const { page = 1, limit = 10 } = params;
    return apiClient.get('/admin/orders', { params: { page, limit } });
  },

  getById: (id: string): Promise<ApiResponse<Order>> => apiClient.get(`/admin/orders/${id}`),
  getOrder: (id: string): Promise<ApiResponse<Order>> => apiClient.get(`/admin/orders/${id}`), // Alias

  updateStatus: (id: string, status: string): Promise<ApiResponse<Order>> =>
    apiClient.put(`/admin/orders/${id}/status`, { status }),

  updateOrderStatus: (id: string, status: string): Promise<ApiResponse<Order>> =>
    apiClient.put(`/admin/orders/${id}/status`, { status }),

  // Add admin specific stats API
  getStats: (): Promise<ApiResponse<DashboardStats>> => apiClient.get('/admin/orders/stats'),

  // Ship order with tracking info (PRD requirement)
  shipOrder: (id: string, data: {
    carrier: string;
    trackingNumber: string;
    items?: Array<{ orderItemId: string; quantity: number }>
  }): Promise<ApiResponse<Order>> =>
    apiClient.post(`/admin/orders/${id}/ship`, data),

  // Cancel order with reason
  cancelOrder: (id: string, cancelReason: string): Promise<ApiResponse<Order>> =>
    apiClient.post(`/admin/orders/${id}/cancel`, { cancelReason }),

  // ❌ Batch operations removed - backend route not implemented
  // batchOperations: (data: { operation: string, orderIds: string[], [key: string]: unknown }) =>
  //   apiClient.post('/admin/orders/batch', data),

  // Refund order
  refundOrder: (id: string, data: { reason?: string; idempotencyKey: string }): Promise<ApiResponse<any>> =>
    apiClient.post(`/admin/orders/${id}/refund`, data),
};

// Users API - Using unified apiClient, targeting admin endpoints
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
  getUser: (id: string): Promise<ApiResponse<UserProfile>> => apiClient.get(`/admin/users/${id}`), // Alias

  // Note: All write operations (create, update, delete, role) removed for Alpha Gate compliance.
};

// Statistics API - Using admin specific statistics endpoints
export const statisticsApi = {
  // Dashboard statistics - Combined multiple admin stats endpoints for complete data
  getDashboard: async (): Promise<ApiResponse<DashboardStats>> => {
    try {
      // Parallel fetch order, user, product stats
      const [orderStatsRes, userStatsRes, productStatsRes] = await Promise.all([
        apiClient.get('/admin/orders/stats'),
        // Admin stats specific
        // For Alpha, stick to minimum viable stats.
        // User stats and product stats might not be fully available on backend in "stats" form
        // Checking whitelist: /api/admin/orders/stats is allowed.
        // /api/admin/users/stats, /api/admin/products/stats are NOT explicitly in the simplified whitelist but Plan says "Dashboard Aggregation: Only use orders stats; do not request users/products stats".
        // SO I WILL REMOVE THEM.
        { data: {} } as any, // Mock response
        { data: {} } as any, // Mock response
      ]);

      // Extract data from endpoints
      const orderStats = orderStatsRes.data || {};
      // const userStats = userStatsRes.data || {};
      // const productStats = productStatsRes.data || {};

      // Combine stats - align with DashboardStats interface
      const combinedStats: DashboardStats = {
        // Core metrics
        totalUsers: 0, // userStats.totalUsers || 0,
        totalProducts: 0, // productStats.totalProducts || 0,
        totalOrders: orderStats.totalOrders || 0,
        totalRevenue: orderStats.totalRevenue || 0,
        // Today metrics (if returned by backend)
        todayOrders: orderStats.todayOrders || 0,
        todayRevenue: orderStats.todayRevenue || 0,
        // Growth rates (if returned by backend)
        userGrowth: 0, // userStats.userGrowth || 0,
        productGrowth: 0, // productStats.productGrowth || 0,
        orderGrowth: orderStats.orderGrowth || 0,
        revenueGrowth: orderStats.revenueGrowth || 0,
        // Order status distribution
        ordersByStatus: orderStats.ordersByStatus || {
          PENDING: 0,
          PAID: 0,
          SHIPPED: 0,
          DELIVERED: 0,
          CANCELLED: 0,
        },
        // Product stock status
        inStockProducts: 0, // productStats.inStockProducts || 0,
        outOfStockProducts: 0, // productStats.outOfStockProducts || 0,
        // Optional data
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
    // Alias, compatible with existing code
    return statisticsApi.getDashboard();
  },

  // Order statistics - Using admin specific endpoint
  getOrders: (): Promise<ApiResponse<{ totalOrders: number; totalRevenue: number }>> => apiClient.get('/admin/orders/stats'),

  // User/Product stats removed from dashboard aggregation as per plan
};

// Cache API - Using unified apiClient, fixed paths
export const cacheApi = {
  getStats: (): Promise<ApiResponse<{ totalKeys: number; memoryUsage: number; hitRate: number }>> =>
    apiClient.get('/cache/stats'),

  clear: (pattern?: string): Promise<ApiResponse<void>> =>
    apiClient.delete('/cache/clear', { params: pattern ? { pattern } : {} }),
};

// Plugin Management API - Simplified for Alpha Gate (Open Source)
export const pluginsApi = {
  // Get all installed plugins (built-in + zip)
  getInstalled: (params?: {
    status?: 'ACTIVE' | 'INACTIVE';
    enabled?: boolean;
  }): Promise<ApiResponse<any>> =>
    apiClient.get('/admin/plugins/installed', { params }),

  // Get specific plugin state (includes config)
  getConfig: async (slug: string): Promise<ApiResponse<any>> => {
    const res = await apiClient.get<any>(`/admin/plugins/${slug}`);
    if (res.success && res.data) {
      // Unify response: frontend expects config object
      return { ...res, data: res.data.config || res.data };
    }
    return res;
  },

  // Save specific plugin configuration
  updateConfig: (slug: string, configData: Record<string, any>): Promise<ApiResponse<any>> =>
    apiClient.put(`/admin/plugins/${slug}/config`, { configData }),

  // Enable a plugin
  enable: (slug: string): Promise<ApiResponse<any>> =>
    apiClient.post(`/admin/plugins/${slug}/enable`),

  // Disable a plugin
  disable: (slug: string): Promise<ApiResponse<any>> =>
    apiClient.post(`/admin/plugins/${slug}/disable`),

  // Install from local ZIP
  installFromZip: (file: File): Promise<ApiResponse<any>> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/extensions/plugin/install', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Uninstall plugin
  uninstall: (slug: string): Promise<ApiResponse<any>> =>
    apiClient.delete(`/extensions/plugin/${slug}`),

  // List all plugins in /extensions (used for discovery/install management)
  getExtensions: (): Promise<ApiResponse<any>> =>
    apiClient.get('/api/extensions/plugin'),
};

// Upload API - Using unified apiClient
export const uploadApi = {
  uploadProductImage: (file: File): Promise<ApiResponse<{ url: string }>> => {
    const formData = new FormData();
    formData.append('file', file);
    // 🔧 Fix API path: Avoid /api/api duplication if base has /api
    // Assuming backend is proxying /api/upload -> backend /upload, or direct.
    // Plan says: "Upload: /api/upload/*".
    // If client base is /api, then request /upload/product-image results in /api/upload/product-image.
    return apiClient.post('/upload/product-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

// Export default apiClient instance
export default apiClient;
