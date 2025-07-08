/**
 * API Client for Jiffoo Mall Admin
 * Centralized API communication layer
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ProductsResponse {
  products: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: {
    sortBy: string;
    sortOrder: string;
  };
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    // Use direct backend API
    this.baseUrl = 'http://localhost:3001/api';
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;

      const defaultHeaders = {
        'Content-Type': 'application/json',
      };

      // Get auth token from cookies if available
      if (typeof window !== 'undefined') {
        // Import Cookies dynamically to avoid SSR issues
        const Cookies = require('js-cookie');
        const token = Cookies.get('admin_token');
        if (token) {
          (defaultHeaders as any)['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch(url, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // 处理无内容响应（如DELETE操作）
      let data = null;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const text = await response.text();
        if (text) {
          data = JSON.parse(text);
        }
      } else if (response.status !== 204) {
        // 如果不是JSON且不是204无内容状态，尝试解析
        const text = await response.text();
        if (text) {
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }
        }
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Auth methods
  async login(email: string, password: string) {
    return this.request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(userData: { email: string; username: string; password: string }) {
    return this.request<{ token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async logout() {
    return this.request('/auth/logout', {
      method: 'POST',
    });
  }

  // Products methods
  async getProducts(params: PaginationParams = {}) {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.search) searchParams.set('search', params.search);

    return this.request<ProductsResponse>(`/products?${searchParams}`);
  }

  async getProduct(id: string) {
    return this.request<any>(`/products/${id}`);
  }

  async createProduct(productData: any) {
    return this.request<any>('/products', {
      method: 'POST',
      body: JSON.stringify(productData),
    });
  }

  async updateProduct(id: string, productData: any) {
    return this.request<any>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(productData),
    });
  }

  async deleteProduct(id: string) {
    return this.request(`/products/${id}`, {
      method: 'DELETE',
    });
  }

  // Orders methods
  async getOrders(params: PaginationParams = {}) {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.search) searchParams.set('search', params.search);

    return this.request<PaginatedResponse<any>>(`/orders?${searchParams}`);
  }

  async getOrder(id: string) {
    return this.request<any>(`/orders/${id}`);
  }

  async updateOrderStatus(id: string, status: string) {
    return this.request<any>(`/orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  // Users methods
  async getUsers(params: PaginationParams = {}) {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.search) searchParams.set('search', params.search);

    return this.request<PaginatedResponse<any>>(`/users?${searchParams}`);
  }

  async getUser(id: string) {
    return this.request<any>(`/users/${id}`);
  }

  async updateUser(id: string, userData: any) {
    return this.request<any>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(id: string) {
    return this.request(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  // Statistics methods
  async getDashboardStats() {
    return this.request<any>('/statistics/dashboard');
  }

  async getSalesStats(period: string = '30d') {
    return this.request<any>(`/statistics/sales?period=${period}`);
  }

  async getProductStats() {
    return this.request<any>('/statistics/products');
  }

  // Upload methods
  async uploadProductImage(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    return this.request<{ filename: string; url: string; size: number }>('/upload/product-image', {
      method: 'POST',
      body: formData,
      headers: {}, // Let browser set Content-Type for FormData
    });
  }

  // Search methods
  async searchProducts(query: string, filters: any = {}) {
    const searchParams = new URLSearchParams();
    searchParams.set('q', query);
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.set(key, value.toString());
      }
    });

    return this.request<PaginatedResponse<any>>(`/search/products?${searchParams}`);
  }

  // SaaS Marketplace methods
  async getMarketplaceApps(params: { category?: string; search?: string; page?: number; limit?: number } = {}) {
    const searchParams = new URLSearchParams();
    if (params.category) searchParams.set('category', params.category);
    if (params.search) searchParams.set('search', params.search);
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());

    return this.request<{ data: SaaSApp[]; pagination: any }>(`/marketplace/apps?${searchParams}`);
  }

  async getMarketplaceCategories() {
    return this.request<MarketplaceCategory[]>('/marketplace/categories');
  }

  async getAppDetails(appId: string) {
    return this.request<SaaSApp>(`/marketplace/apps/${appId}`);
  }

  async installApp(appId: string) {
    return this.request<AppInstallation>(`/marketplace/apps/${appId}/install`, {
      method: 'POST',
    });
  }

  async getUserApps() {
    return this.request<AppInstallation[]>('/my/apps');
  }

  async uninstallApp(appId: string) {
    return this.request(`/my/apps/${appId}`, {
      method: 'DELETE',
    });
  }

  async generateSSOToken(appId: string) {
    return this.request<{ ssoToken: string; expiresIn: number }>(`/my/apps/${appId}/sso`, {
      method: 'POST',
    });
  }

  // OAuth 2.0 and Authentication methods
  async getAuthProviders() {
    return this.request<AuthProvider[]>('/auth/providers');
  }

  async getAuthProviderConfig(providerId: string) {
    return this.request<any>(`/auth/${providerId}/config`);
  }

  async updateAuthProviderConfig(providerId: string, config: any) {
    return this.request(`/auth/${providerId}/config`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  async testAuthProvider(providerId: string) {
    return this.request<{ authUrl: string }>(`/auth/${providerId}/test`);
  }

  // Plugin Store methods
  async getPlugins(params: { category?: string; search?: string; installed?: boolean } = {}) {
    const searchParams = new URLSearchParams();
    if (params.category) searchParams.set('category', params.category);
    if (params.search) searchParams.set('search', params.search);
    if (params.installed !== undefined) searchParams.set('installed', params.installed.toString());

    return this.request<Plugin[]>(`/plugin-store/plugins?${searchParams}`);
  }

  async purchasePlugin(pluginId: string) {
    return this.request(`/plugin-store/plugins/${pluginId}/purchase`, {
      method: 'POST',
    });
  }

  async getPluginLicenses() {
    return this.request<PluginLicense[]>('/licenses');
  }

  // Developer methods
  async getDeveloperApps() {
    return this.request<DeveloperApp[]>('/developer/apps');
  }

  async registerApp(appData: any) {
    return this.request('/developer/apps', {
      method: 'POST',
      body: JSON.stringify(appData),
    });
  }

  async getAppRevenue(appId: string, period: 'month' | 'year' = 'month') {
    return this.request<RevenueData>(`/developer/apps/${appId}/revenue?period=${period}`);
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export types for use in components
export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  images: string;
  createdAt: string;
  updatedAt: string;
  sku?: string;
  category?: string;
  sales?: number;
};

export type Order = {
  id: string;
  userId: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    username: string;
  };
  items: OrderItem[];
};

export type OrderItem = {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  product: Product;
};

export type User = {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  role: string;
  createdAt: string;
  updatedAt: string;
};

export type DashboardStats = {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  totalUsers: number;
  revenueGrowth: number;
  ordersGrowth: number;
  productsGrowth: number;
  usersGrowth: number;
};

// SaaS Marketplace types
export type SaaSApp = {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: string;
  price: number;
  currency: string;
  billingType: string;
  logo: string;
  features: string[];
  rating: number;
  reviewCount: number;
  totalInstalls: number;
  isActive: boolean;
  isApproved: boolean;
};

export type MarketplaceCategory = {
  id: string;
  name: string;
  count: number;
};

export type AppInstallation = {
  id: string;
  appId: string;
  name: string;
  status: string;
  installedAt: string;
  lastAccessedAt: string;
  subscriptionId: string;
};

// Authentication types
export type AuthProvider = {
  id: string;
  name: string;
  version: string;
  isConfigured: boolean;
  isLicensed: boolean;
};

// Plugin types
export type Plugin = {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: string;
  price: number;
  currency: string;
  billingType: string;
  logo: string;
  features: string[];
  rating: number;
  reviewCount: number;
  totalInstalls: number;
  isInstalled: boolean;
  isLicensed: boolean;
};

export type PluginLicense = {
  id: string;
  pluginId: string;
  pluginName: string;
  licenseKey: string;
  status: string;
  expiresAt: string;
  createdAt: string;
};

// Developer types
export type DeveloperApp = {
  id: string;
  name: string;
  status: string;
  totalInstalls: number;
  monthlyRevenue: number;
  rating: number;
};

export type RevenueData = {
  totalRevenue: number;
  platformRevenue: number;
  developerRevenue: number;
  subscriptions: number;
  period: string;
  breakdown: {
    month: string;
    revenue: number;
    subscriptions: number;
  }[];
};
