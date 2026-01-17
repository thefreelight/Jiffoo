/**
 * React Query hooks for API data fetching
 *
 * Uses unified DashboardStats type from types.ts
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PaginationParams, productsApi, ordersApi, usersApi, statisticsApi, pluginsApi, uploadApi } from '../api';
import { toast } from 'sonner';
import { ProductForm, DashboardStats, Product, Order, User, OrderItem } from '../types';

// Extra type definitions
export interface PaginatedApiResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
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
      // Backend returns: { success: true, data: { products: [...], pagination: {...} } }
      const responseData = response.data as any;
      return {
        data: responseData?.products || [],
        pagination: responseData?.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 }
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: queryKeys.product(id),
    queryFn: async () => {
      const response = await productsApi.getProduct(id);
      // Backend return format is { success: true, data: {...} }
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
      // Backend return format: { product: {...} }
      return (response.data as { product?: Product })?.product || response.data;
    },
    onSuccess: () => {
      // Clear all product related query cache
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
      // Backend return format: { product: {...} }
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
      // Axios returns response.data
      return response.data;
    },
    onSuccess: (_, deletedId) => {
      // Clear all product related query cache
      queryClient.invalidateQueries({
        queryKey: queryKeys.products,
        exact: false // This will match all query keys starting with ['products']
      });
      // Remove specific product cache
      queryClient.removeQueries({
        queryKey: queryKeys.product(deletedId)
      });
      // Force refetch product list
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
      // Backend returns: { success: true, data: { orders: [...], pagination: {...} } }
      const responseData = response.data as any;
      return {
        data: responseData?.orders || [],
        pagination: responseData?.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 }
      };
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: queryKeys.order(id),
    queryFn: async () => {
      const response = await ordersApi.getOrder(id);
      // Backend return format: { success: true, data: {...} }
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
      // Axios returns response.data
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
      // Backend returns: { success: true, data: { users: [...], pagination: {...} } }
      const responseData = response.data as any;
      return {
        data: responseData?.users || [],
        pagination: responseData?.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 }
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: queryKeys.user(id),
    queryFn: async () => {
      const response = await usersApi.getUser(id);
      // Backend return format: { success: true, data: {...} }
      return response.data;
    },
    enabled: !!id,
  });
}

// Dashboard hooks
export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboardStats,
    queryFn: async () => {
      const response = await statisticsApi.getDashboardStats();
      // Axios returns response.data, not wrapped ApiResponse
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
      // Axios returns response.data
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
      // Axios returns response.data
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

// Stock management hooks REMOVED per Alpha Gate

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
  installed: (params?: any) => [...pluginQueryKeys.all, 'installed', params] as const,
  config: (slug: string) => [...pluginQueryKeys.all, 'config', slug] as const,
};



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
      const response = enabled
        ? await pluginsApi.enable(slug)
        : await pluginsApi.disable(slug);
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
      const response = await pluginsApi.uninstall(slug);
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


