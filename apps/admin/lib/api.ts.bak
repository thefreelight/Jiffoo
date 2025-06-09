import axios from 'axios'
import Cookies from 'js-cookie'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

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
      // Clear token and redirect to login
      Cookies.remove('admin_token')
      window.location.href = '/login'
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
    window.location.href = '/'
  }
}

// Users API
export const usersApi = {
  getAll: (page = 1, limit = 10) =>
    api.get(`/api/users?page=${page}&limit=${limit}`),

  getById: (id: string) => api.get(`/api/users/${id}`),

  update: (id: string, data: any) => api.put(`/api/users/${id}`, data),

  updateRole: (id: string, role: string) =>
    api.patch(`/api/users/${id}/role`, { role }),

  delete: (id: string) => api.delete(`/api/users/${id}`),
}

// Products API
export const productsApi = {
  getAll: (page = 1, limit = 10, search?: string) =>
    api.get(`/api/products?page=${page}&limit=${limit}${search ? `&search=${search}` : ''}`),

  getById: (id: string) => api.get(`/api/products/${id}`),

  create: (data: any) => api.post('/api/products', data),

  update: (id: string, data: any) => api.put(`/api/products/${id}`, data),

  delete: (id: string) => api.delete(`/api/products/${id}`),
}

// Orders API
export const ordersApi = {
  getAll: (page = 1, limit = 10) =>
    api.get(`/api/orders?page=${page}&limit=${limit}`),

  getById: (id: string) => api.get(`/api/orders/${id}`),

  updateStatus: (id: string, status: string) =>
    api.patch(`/api/orders/${id}/status`, { status }),
}

// Statistics API
export const statisticsApi = {
  getDashboard: () => api.get('/api/statistics/dashboard'),

  getUsers: () => api.get('/api/statistics/users'),

  getProducts: () => api.get('/api/statistics/products'),

  getOrders: () => api.get('/api/statistics/orders'),

  getRevenue: (period?: string) =>
    api.get(`/api/statistics/revenue${period ? `?period=${period}` : ''}`),
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
