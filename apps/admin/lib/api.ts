import axios from 'axios'
import Cookies from 'js-cookie'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'

// 类型定义
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
  status?: string;
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

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = Cookies.get('admin_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token but don't force redirect - let the auth store handle it
      Cookies.remove('admin_token')
      console.warn('Authentication failed, token cleared')
    }
    return Promise.reject(error)
  }
)

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/api/auth/login', { email, password }),

  me: () => api.get('/api/auth/me'),

  logout: () => {
    Cookies.remove('admin_token')
    // Don't force redirect - let the auth store handle it
  }
}



// Products API
export const productsApi = {
  getAll: (page = 1, limit = 10, search?: string) =>
    api.get(`/api/products?page=${page}&limit=${limit}${search ? `&search=${search}` : ''}`),

  // 兼容现有代码的别名方法
  getProducts: (params: any = {}) => {
    const { page = 1, limit = 10, search } = params;
    return api.get(`/api/products?page=${page}&limit=${limit}${search ? `&search=${search}` : ''}`);
  },

  getById: (id: string) => api.get(`/api/products/${id}`),
  getProduct: (id: string) => api.get(`/api/products/${id}`), // 别名

  create: (data: any) => api.post('/api/products', data),
  createProduct: (data: any) => api.post('/api/products', data), // 别名

  update: (id: string, data: any) => api.put(`/api/products/${id}`, data),
  updateProduct: (id: string, data: any) => api.put(`/api/products/${id}`, data), // 别名

  delete: (id: string) => api.delete(`/api/products/${id}`),
  deleteProduct: (id: string) => api.delete(`/api/products/${id}`), // 别名
}

// Orders API
export const ordersApi = {
  getAll: (page = 1, limit = 10) =>
    api.get(`/api/orders?page=${page}&limit=${limit}`),

  // 兼容现有代码的别名方法
  getOrders: (params: any = {}) => {
    const { page = 1, limit = 10 } = params;
    return api.get(`/api/orders?page=${page}&limit=${limit}`);
  },

  getById: (id: string) => api.get(`/api/orders/${id}`),
  getOrder: (id: string) => api.get(`/api/orders/${id}`), // 别名

  updateStatus: (id: string, status: string) =>
    api.patch(`/api/orders/${id}/status`, { status }),

  updateOrderStatus: (id: string, status: string) =>
    api.patch(`/api/orders/${id}/status`, { status }), // 别名
}

// Users API
export const usersApi = {
  getAll: (params: any = {}) => {
    const { page = 1, limit = 10, search } = params;
    return api.get(`/api/users?page=${page}&limit=${limit}${search ? `&search=${search}` : ''}`);
  },

  getUsers: (params: any = {}) => {
    const { page = 1, limit = 10, search } = params;
    return api.get(`/api/users?page=${page}&limit=${limit}${search ? `&search=${search}` : ''}`);
  },

  getById: (id: string) => api.get(`/api/users/${id}`),
  getUser: (id: string) => api.get(`/api/users/${id}`), // 别名

  create: (data: any) => api.post('/api/users', data),
  createUser: (data: any) => api.post('/api/users', data), // 别名

  update: (id: string, data: any) => api.put(`/api/users/${id}`, data),
  updateUser: (id: string, data: any) => api.put(`/api/users/${id}`, data), // 别名

  delete: (id: string) => api.delete(`/api/users/${id}`),
  deleteUser: (id: string) => api.delete(`/api/users/${id}`), // 别名
}

// Statistics API
export const statisticsApi = {
  getDashboard: () => api.get('/api/statistics/dashboard'),
  getDashboardStats: () => api.get('/api/statistics/dashboard'), // 别名，兼容现有代码

  getUsers: () => api.get('/api/statistics/users'),

  getProducts: () => api.get('/api/statistics/products'),

  getOrders: () => api.get('/api/statistics/orders'),

  getRevenue: (period?: string) =>
    api.get(`/api/statistics/revenue${period ? `?period=${period}` : ''}`),

  getSalesStats: (period: string = '30d') =>
    api.get(`/api/statistics/sales?period=${period}`),

  getProductStats: () => api.get('/api/statistics/products'),
}

// Cache API
export const cacheApi = {
  getStats: () => api.get('/api/cache/stats'),

  clear: (pattern?: string) =>
    api.delete(`/api/cache/clear${pattern ? `?pattern=${pattern}` : ''}`),
}

// Permissions API
export const permissionsApi = {
  getUserPermissions: (userId: string) =>
    api.get(`/api/permissions/user/${userId}`),

  getRoles: () => api.get('/api/permissions/roles'),

  checkPermission: (resource: string, action: string) =>
    api.post('/api/permissions/check', { resource, action }),
}

// Plugins API
export const pluginsApi = {
  getList: () => api.get('/api/plugins/list'),

  getInfo: (name: string) => api.get(`/api/plugins/${name}/info`),

  getStatus: () => api.get('/api/plugins/status'),
}

// Upload API
export const uploadApi = {
  uploadProductImage: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/api/upload/product-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
}

// 创建统一的API客户端实例，兼容现有代码
export const apiClient = {
  // 统计相关
  getDashboardStats: () => statisticsApi.getDashboard(),
  getSalesStats: (period: string = '30d') => statisticsApi.getSalesStats(period),
  getProductStats: () => statisticsApi.getProductStats(),

  // 商品相关
  getProducts: (params: any = {}) => productsApi.getProducts(params),
  getProduct: (id: string) => productsApi.getProduct(id),
  createProduct: (data: any) => productsApi.createProduct(data),
  updateProduct: (id: string, data: any) => productsApi.updateProduct(id, data),
  deleteProduct: (id: string) => productsApi.deleteProduct(id),

  // 订单相关
  getOrders: (params: any = {}) => ordersApi.getOrders(params),
  getOrder: (id: string) => ordersApi.getOrder(id),
  updateOrderStatus: (id: string, status: string) => ordersApi.updateOrderStatus(id, status),

  // 用户相关
  getUsers: (params: any = {}) => usersApi.getUsers(params),
  getUser: (id: string) => usersApi.getUser(id),
  createUser: (data: any) => usersApi.createUser(data),
  updateUser: (id: string, data: any) => usersApi.updateUser(id, data),
  deleteUser: (id: string) => usersApi.deleteUser(id),

  // 上传相关
  uploadProductImage: (file: File) => uploadApi.uploadProductImage(file),
}
