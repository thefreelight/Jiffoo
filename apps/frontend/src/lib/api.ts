import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ApiResponse, PaginatedResponse } from 'shared';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  }
);

// Generic API methods
export const apiClient = {
  get: <T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> =>
    api.get(url, config).then((res) => res.data),

  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> =>
    api.post(url, data, config).then((res) => res.data),

  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> =>
    api.put(url, data, config).then((res) => res.data),

  patch: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> =>
    api.patch(url, data, config).then((res) => res.data),

  delete: <T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> =>
    api.delete(url, config).then((res) => res.data),
};

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post('/api/auth/login', { email, password }),

  register: (data: { email: string; password: string; username: string }) =>
    apiClient.post('/api/auth/register', data),

  logout: () =>
    apiClient.post('/api/auth/logout'),

  getProfile: () =>
    apiClient.get('/api/user/profile'),

  updateProfile: (data: any) =>
    apiClient.put('/api/user/profile', data),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    apiClient.post('/api/user/profile/change-password', data),

  updateLanguagePreferences: (data: any) =>
    apiClient.put('/api/user/profile/language-preferences', data),

  refreshToken: () =>
    apiClient.post('/api/auth/refresh'),
};

// Products API
export const productsApi = {
  getProducts: (params?: any): Promise<PaginatedResponse<any>> =>
    apiClient.get('/api/products', { params }).then((res) => res.data),

  getProduct: (id: string) =>
    apiClient.get(`/api/products/${id}`),

  searchProducts: (query: string, filters?: any) =>
    apiClient.get('/api/products/search', { params: { q: query, ...filters } }),

  getCategories: () =>
    apiClient.get('/api/products/categories'),

  getFeaturedProducts: () =>
    apiClient.get('/api/products/featured'),

  getProductReviews: (productId: string) =>
    apiClient.get(`/api/products/${productId}/reviews`),

  // Search and filter APIs
  getSearchSuggestions: (query: string, limit = 5) =>
    apiClient.get('/api/products/search/suggestions', { params: { q: query, limit } }),

  getPriceRanges: () =>
    apiClient.get('/api/products/price-ranges'),

  getPopularSearchTerms: (limit = 10) =>
    apiClient.get('/api/products/search/popular', { params: { limit } }),
};

// Cart API
export const cartApi = {
  getCart: () =>
    apiClient.get('/api/cart'),

  addToCart: (productId: string, quantity: number, variantId?: string) =>
    apiClient.post('/api/cart/add', { productId, quantity, variantId }),

  updateCartItem: (itemId: string, quantity: number) =>
    apiClient.put('/api/cart/update', { itemId, quantity }),

  removeFromCart: (itemId: string) =>
    apiClient.delete(`/api/cart/remove/${itemId}`),

  clearCart: () =>
    apiClient.delete('/api/cart/clear'),
};

// Orders API
export const ordersApi = {
  getOrders: (params?: any) =>
    apiClient.get('/api/orders', { params }),

  getOrder: (id: string) =>
    apiClient.get(`/api/orders/${id}`),

  createOrder: (data: any) =>
    apiClient.post('/api/orders', data),

  updateOrderStatus: (id: string, status: string) =>
    apiClient.patch(`/api/orders/${id}/status`, { status }),

  cancelOrder: (id: string) =>
    apiClient.patch(`/api/orders/${id}/cancel`),

  // User orders
  getUserOrders: (params?: any) =>
    apiClient.get('/api/user/orders', { params }),

  getUserOrderStats: () =>
    apiClient.get('/api/user/orders/stats'),
};

// Users API
export const usersApi = {
  getUsers: (params?: any) =>
    apiClient.get('/api/users', { params }),

  getUser: (id: string) =>
    apiClient.get(`/api/users/${id}`),

  updateUser: (id: string, data: any) =>
    apiClient.put(`/api/users/${id}`, data),

  deleteUser: (id: string) =>
    apiClient.delete(`/api/users/${id}`),

  getUserAddresses: (userId: string) =>
    apiClient.get(`/api/users/${userId}/addresses`),

  addUserAddress: (userId: string, address: any) =>
    apiClient.post(`/api/users/${userId}/addresses`, address),

  updateUserAddress: (userId: string, addressId: string, address: any) =>
    apiClient.put(`/api/users/${userId}/addresses/${addressId}`, address),

  deleteUserAddress: (userId: string, addressId: string) =>
    apiClient.delete(`/api/users/${userId}/addresses/${addressId}`),
};

// Admin API
export const adminApi = {
  getStats: () =>
    apiClient.get('/api/admin/stats'),

  getUsers: (params?: any) =>
    apiClient.get('/api/admin/users', { params }),

  getOrders: (params?: any) =>
    apiClient.get('/api/admin/orders', { params }),

  getProducts: (params?: any) =>
    apiClient.get('/api/admin/products', { params }),

  createProduct: (data: any) =>
    apiClient.post('/api/admin/products', data),

  updateProduct: (id: string, data: any) =>
    apiClient.put(`/api/admin/products/${id}`, data),

  deleteProduct: (id: string) =>
    apiClient.delete(`/api/admin/products/${id}`),

  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/api/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

// I18n API
export const i18nApi = {
  getLanguages: () =>
    apiClient.get('/api/i18n/languages'),

  getTranslation: (key: string, lang?: string, namespace?: string) =>
    apiClient.get(`/api/i18n/translate/${key}`, { params: { lang, namespace } }),

  getTranslations: (keys: string[], lang?: string, namespace?: string) =>
    apiClient.post('/api/i18n/translate/batch', { keys, namespace }, { params: { lang } }),

  switchLanguage: (language: string) =>
    apiClient.post('/api/i18n/language/switch', { language }),

  getUserPreferences: () =>
    apiClient.get('/api/i18n/user/preferences'),

  updateUserPreferences: (preferences: any) =>
    apiClient.put('/api/i18n/user/preferences', preferences),
};

export default api;
