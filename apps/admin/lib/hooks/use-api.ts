/**
 * React Query hooks for API data fetching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, PaginationParams, Product, Order, User, DashboardStats } from '../api-client';
import { toast } from 'sonner';

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
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch products');
      }
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: queryKeys.product(id),
    queryFn: async () => {
      const response = await apiClient.getProduct(id);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch product');
      }
      return response.data;
    },
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productData: Partial<Product>) => {
      const response = await apiClient.createProduct(productData);
      if (!response.success) {
        throw new Error(response.error || 'Failed to create product');
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products });
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
      if (!response.success) {
        throw new Error(response.error || 'Failed to update product');
      }
      return response.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products });
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
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete product');
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products });
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
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch orders');
      }
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
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch order');
      }
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
      if (!response.success) {
        throw new Error(response.error || 'Failed to update order status');
      }
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
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch users');
      }
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
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch user');
      }
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
      const response = await apiClient.getDashboardStats();
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch dashboard stats');
      }
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
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch sales stats');
      }
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
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch product stats');
      }
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
      if (!response.success) {
        throw new Error(response.error || 'Failed to upload image');
      }
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
      const response = await apiClient.searchProducts(query, filters);
      if (!response.success) {
        throw new Error(response.error || 'Failed to search products');
      }
      return response.data;
    },
    enabled: !!query && query.length > 2,
    staleTime: 30 * 1000, // 30 seconds
  });
}
