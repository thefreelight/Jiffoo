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

class ApiClient {
  private baseUrl: string;

  constructor() {
    // Use Next.js API proxy
    this.baseUrl = '/api';
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

      // Get auth token from localStorage if available
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('auth_token');
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

      const data = await response.json();
      
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

    return this.request<PaginatedResponse<any>>(`/products?${searchParams}`);
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
