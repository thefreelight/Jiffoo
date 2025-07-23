/**
 * React Query hooks for API data fetching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, PaginationParams, ApiResponse, PaginatedResponse } from '../api';
import { toast } from 'sonner';

// 类型定义
export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  category?: string;
  images?: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  userId: string;
  status: string;
  totalAmount: number;
  items: any[];
  user?: any;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  role: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalUsers: number;
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  todayOrders: number;
  todayRevenue: number;
  userGrowth: number;
  orderGrowth: number;
  revenueGrowth: number;
}

// Query keys
export const queryKeys = {
  products: ['products'] as const,
  product: (id: string) => ['products', id] as const,
  orders: ['orders'] as const,
  order: (id: string) => ['orders', id] as const,
  users: ['users'] as const,
  user: (id: string) => ['users', id] as const,
  dashboardStats: ['dashboard-stats'] as const,
  salesStats: (period: string) => ['sales-stats', period] as const,
  productStats: ['product-stats'] as const,
};

// Products hooks
export function useProducts(params: PaginationParams = {}) {
  return useQuery({
    queryKey: [...queryKeys.products, params],
    queryFn: async () => {
      const response = await apiClient.getProducts(params);
      // 后端返回格式: { products: [...], pagination: {...} }
      // 转换为前端期望的格式
      return {
        data: response.data?.products || [],
        pagination: response.data?.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 }
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: queryKeys.product(id),
    queryFn: async () => {
      const response = await apiClient.getProduct(id);
      // 后端返回的格式是 { product: {...} }，需要提取product字段
      return response.data?.product || response.data;
    },
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productData: Partial<Product>) => {
      const response = await apiClient.createProduct(productData);
      // 后端返回格式: { product: {...} }
      return response.data?.product || response.data;
    },
    onSuccess: () => {
      // 清除所有商品相关的查询缓存
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.products,
        exact: false 
      });
      queryClient.refetchQueries({ 
        queryKey: queryKeys.products,
        exact: false 
      });
      toast.success('Product created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Product> }) => {
      const response = await apiClient.updateProduct(id, data);
      // 后端返回格式: { product: {...} }
      return response.data?.product || response.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.products,
        exact: false 
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.product(id) });
      toast.success('Product updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.deleteProduct(id);
      // Axios 返回的是 response.data
      return response.data;
    },
    onSuccess: (_, deletedId) => {
      // 清除所有商品相关的查询缓存
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.products,
        exact: false // 这会匹配所有以 ['products'] 开头的查询键
      });
      // 删除特定商品的缓存
      queryClient.removeQueries({ 
        queryKey: queryKeys.product(deletedId) 
      });
      // 强制重新获取商品列表
      queryClient.refetchQueries({ 
        queryKey: queryKeys.products,
        exact: false 
      });
      toast.success('Product deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Orders hooks
export function useOrders(params: PaginationParams = {}) {
  return useQuery({
    queryKey: [...queryKeys.orders, params],
    queryFn: async () => {
      const response = await apiClient.getOrders(params);
      // Axios 返回的是 response.data
      return response.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: queryKeys.order(id),
    queryFn: async () => {
      const response = await apiClient.getOrder(id);
      // Axios 返回的是 response.data
      return response.data;
    },
    enabled: !!id,
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiClient.updateOrderStatus(id, status);
      // Axios 返回的是 response.data
      return response.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      queryClient.invalidateQueries({ queryKey: queryKeys.order(id) });
      toast.success('Order status updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Users hooks
export function useUsers(params: PaginationParams = {}) {
  return useQuery({
    queryKey: [...queryKeys.users, params],
    queryFn: async () => {
      const response = await apiClient.getUsers(params);
      // Axios 返回的是 response.data
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: queryKeys.user(id),
    queryFn: async () => {
      const response = await apiClient.getUser(id);
      // Axios 返回的是 response.data
      return response.data;
    },
    enabled: !!id,
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.deleteUser(id);
      // Axios 返回的是 response.data
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
      toast.success('User deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Dashboard hooks
export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboardStats,
    queryFn: async () => {
      const response = await apiClient.getDashboardStats();
      // Axios 返回的是 response.data，而不是包装的 ApiResponse
      return response.data;
    },
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

export function useSalesStats(period: string = '30d') {
  return useQuery({
    queryKey: queryKeys.salesStats(period),
    queryFn: async () => {
      const response = await apiClient.getSalesStats(period);
      // Axios 返回的是 response.data
      return response.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useProductStats() {
  return useQuery({
    queryKey: queryKeys.productStats,
    queryFn: async () => {
      const response = await apiClient.getProductStats();
      // Axios 返回的是 response.data
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Upload hooks
export function useUploadProductImage() {
  return useMutation({
    mutationFn: async (file: File) => {
      const response = await apiClient.uploadProductImage(file);
      // Axios 返回的是 response.data
      return response.data;
    },
    onSuccess: () => {
      toast.success('Image uploaded successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Search hooks
export function useSearchProducts(query: string, filters: any = {}) {
  return useQuery({
    queryKey: ['search-products', query, filters],
    queryFn: async () => {
      // const response = await apiClient.searchProducts(query, filters);
      // Mock response for now
      const response = { data: { products: [], total: 0 } };
      // Axios 返回的是 response.data
      return response.data;
    },
    enabled: !!query && query.length > 2,
    staleTime: 30 * 1000, // 30 seconds
  });
}
