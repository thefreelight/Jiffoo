/**
 * React Query hooks for API data fetching
 *
 * Uses unified DashboardStats type from types.ts
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PaginationParams, productsApi, ordersApi, usersApi, statisticsApi, pluginsApi, uploadApi } from '../api';
import { toast } from 'sonner';
import { ProductForm, DashboardStats, Product, Order, User, OrderItem } from '../types';

// 额外的类型定义
export interface PaginatedApiResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface BatchOperationData {
  operation: string;
  productIds?: string[];
  orderIds?: string[];
  userIds?: string[];
  status?: string;
  stockQuantity?: number;
  role?: string;
}

export interface UpdateUserData {
  username?: string;
  avatar?: string;
  role?: string;
  isActive?: boolean;
}

// Re-export types for convenience
export type { DashboardStats, Product, Order, User, OrderItem } from '../types';

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
      const response = await productsApi.getProducts(params);
      // 后端返回格式: { success: true, data: [...], pagination: {...} }
      // 转换为前端期望的格式
      return {
        data: response.data || [],
        pagination: (response as unknown as PaginatedApiResponse<Product>).pagination || { page: 1, limit: 10, total: 0, totalPages: 0 }
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: queryKeys.product(id),
    queryFn: async () => {
      const response = await productsApi.getProduct(id);
      // 后端返回的格式是 { success: true, data: {...} }
      return response.data;
    },
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productData: Partial<Product>) => {
      const response = await productsApi.createProduct(productData as unknown as ProductForm);
      // 后端返回格式: { product: {...} }
      return (response.data as { product?: Product })?.product || response.data;
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
      const response = await productsApi.updateProduct(id, data as Record<string, unknown>);
      // 后端返回格式: { product: {...} }
      return (response.data as { product?: Product })?.product || response.data;
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
      const response = await productsApi.deleteProduct(id);
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
      const response = await ordersApi.getOrders(params);
      // 后端返回格式: { success: true, data: [...], pagination: {...} }
      // 转换为前端期望的格式
      return {
        data: response.data || [],
        pagination: (response as unknown as PaginatedApiResponse<Order>).pagination || { page: 1, limit: 10, total: 0, totalPages: 0 }
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: queryKeys.order(id),
    queryFn: async () => {
      const response = await ordersApi.getOrder(id);
      // 后端返回格式: { success: true, data: {...} }
      return response.data;
    },
    enabled: !!id,
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await ordersApi.updateOrderStatus(id, status);
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

export function useRefundOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { reason?: string; idempotencyKey: string } }) => {
      const response = await ordersApi.refundOrder(id, data);
      return response.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      queryClient.invalidateQueries({ queryKey: queryKeys.order(id) });
      toast.success('Order refunded successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to refund order');
    },
  });
}

// Users hooks
export function useUsers(params: PaginationParams = {}) {
  return useQuery({
    queryKey: [...queryKeys.users, params],
    queryFn: async () => {
      const response = await usersApi.getUsers(params);
      // 后端返回格式: { success: true, data: [...], pagination: {...} }
      // 转换为前端期望的格式
      return {
        data: response.data || [],
        pagination: (response as unknown as PaginatedApiResponse<User>).pagination || { page: 1, limit: 10, total: 0, totalPages: 0 }
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: queryKeys.user(id),
    queryFn: async () => {
      const response = await usersApi.getUser(id);
      // 后端返回格式: { success: true, data: {...} }
      return response.data;
    },
    enabled: !!id,
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string, data: UpdateUserData }) => {
      const response = await usersApi.updateUser(id, data);
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
      queryClient.invalidateQueries({ queryKey: queryKeys.user(variables.id) });
      toast.success('User updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, role }: { id: string, role: 'USER' | 'TENANT_ADMIN' }) => {
      const response = await usersApi.updateRole(id, role);
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
      queryClient.invalidateQueries({ queryKey: queryKeys.user(variables.id) });
      toast.success('User role updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await usersApi.deleteUser(id);
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
      const response = await statisticsApi.getDashboardStats();
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
      const response = await statisticsApi.getDashboardStats();
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
      const response = await productsApi.getProducts();
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
      const response = await uploadApi.uploadProductImage(file);
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

// Stock management hooks
export function useAdjustStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string, data: { operation: 'increase' | 'decrease', quantity: number, reason: string } }) => {
      const response = await productsApi.adjustStock(id, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products });
      toast.success('Stock adjusted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useStockOverview(lowStockThreshold?: number) {
  return useQuery({
    queryKey: ['stockOverview', lowStockThreshold],
    queryFn: async () => {
      const response = await productsApi.getStockOverview(lowStockThreshold);
      return response.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useLowStockProducts(params?: { threshold?: number, page?: number, limit?: number }) {
  return useQuery({
    queryKey: ['lowStockProducts', params],
    queryFn: async () => {
      const response = await productsApi.getLowStockProducts(params);
      return {
        data: response.data || [],
        pagination: (response as unknown as PaginatedApiResponse<Product>).pagination || { page: 1, limit: 10, total: 0, totalPages: 0 }
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Batch operations hooks
export function useProductBatchOperations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: BatchOperationData) => {
      const response = await productsApi.batchOperations(data as unknown as { [key: string]: unknown; operation: string; productIds: string[]; });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products });
      toast.success('Batch operation completed successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useOrderBatchOperations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: BatchOperationData) => {
      const response = await ordersApi.batchOperations(data as unknown as { [key: string]: unknown; operation: string; orderIds: string[]; });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      toast.success('Batch operation completed successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUserBatchOperations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: BatchOperationData) => {
      const response = await usersApi.batchOperations(data as unknown as { [key: string]: unknown; operation: string; userIds: string[]; });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
      toast.success('Batch operation completed successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Order statistics hook
export function useOrderStats() {
  return useQuery({
    queryKey: ['orderStats'],
    queryFn: async () => {
      const response = await ordersApi.getStats();
      return response.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// ==================== Plugin Hooks ====================

// Query keys for plugins
const pluginQueryKeys = {
  all: ['plugins'] as const,
  marketplace: (params?: any) => [...pluginQueryKeys.all, 'marketplace', params] as const,
  installed: (params?: any) => [...pluginQueryKeys.all, 'installed', params] as const,
  details: (slug: string) => [...pluginQueryKeys.all, 'details', slug] as const,
  config: (slug: string) => [...pluginQueryKeys.all, 'config', slug] as const,
  categories: () => [...pluginQueryKeys.all, 'categories'] as const,
};

// Get marketplace plugins
export function useMarketplacePlugins(params?: {
  category?: string;
  businessModel?: 'free' | 'freemium' | 'subscription' | 'usage_based';
  sortBy?: 'name' | 'rating' | 'installCount' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}) {
  return useQuery({
    queryKey: pluginQueryKeys.marketplace(params),
    queryFn: async () => {
      const response = await pluginsApi.getMarketplace(params);
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Search plugins
export function useSearchPlugins(query: string, category?: string) {
  return useQuery({
    queryKey: [...pluginQueryKeys.all, 'search', query, category],
    queryFn: async () => {
      const response = await pluginsApi.searchPlugins(query, category);
      return response.data;
    },
    enabled: query.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Get plugin details
export function usePluginDetails(slug: string) {
  return useQuery({
    queryKey: pluginQueryKeys.details(slug),
    queryFn: async () => {
      const response = await pluginsApi.getPluginDetails(slug);
      // API returns { success: true, data: plugin }, extract the plugin data
      return response.data?.data || response.data;
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get installed plugins
export function useInstalledPlugins(params?: {
  status?: 'ACTIVE' | 'INACTIVE';
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: pluginQueryKeys.installed(params),
    queryFn: async () => {
      const response = await pluginsApi.getInstalled(params);
      return response.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Get plugin configuration
export function usePluginConfig(slug: string) {
  return useQuery({
    queryKey: pluginQueryKeys.config(slug),
    queryFn: async () => {
      const response = await pluginsApi.getConfig(slug);
      return response.data;
    },
    enabled: !!slug,
  });
}

// Get plugin categories
export function usePluginCategories() {
  return useQuery({
    queryKey: pluginQueryKeys.categories(),
    queryFn: async () => {
      const response = await pluginsApi.getCategories();
      return response.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Install plugin mutation
export function useInstallPlugin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ slug, data }: {
      slug: string;
      data: {
        planId?: string;
        startTrial?: boolean;
        configData?: Record<string, any>;
      };
    }) => {
      const response = await pluginsApi.installPlugin(slug, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pluginQueryKeys.installed() });
      toast.success('Plugin installed successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to install plugin');
    },
  });
}

// Update plugin configuration mutation
export function useUpdatePluginConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ slug, configData }: {
      slug: string;
      configData: Record<string, any>;
    }) => {
      const response = await pluginsApi.updateConfig(slug, configData);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: pluginQueryKeys.config(variables.slug) });
      queryClient.invalidateQueries({ queryKey: pluginQueryKeys.installed() });
      toast.success('Plugin configuration updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update plugin configuration');
    },
  });
}

// Toggle plugin enabled/disabled mutation
export function useTogglePlugin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ slug, enabled }: {
      slug: string;
      enabled: boolean;
    }) => {
      const response = await pluginsApi.togglePlugin(slug, enabled);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: pluginQueryKeys.installed() });
      toast.success(`Plugin ${variables.enabled ? 'enabled' : 'disabled'} successfully`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to toggle plugin');
    },
  });
}

// Uninstall plugin mutation
export function useUninstallPlugin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (slug: string) => {
      const response = await pluginsApi.uninstallPlugin(slug);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pluginQueryKeys.installed() });
      toast.success('Plugin uninstalled successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to uninstall plugin');
    },
  });
}


