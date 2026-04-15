/**
 * React Query hooks for API data fetching
 *
 * Uses unified DashboardStats type from types.ts
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PaginationParams, productsApi, ordersApi, usersApi, pluginsApi, themesApi, marketApi, managedPackageApi, platformConnectionApi, uploadApi, dashboardApi, inventoryApi, accountApi, authApi, healthApi, errorsApi, promotionsApi, redirectsApi, unwrapApiResponse, ProductStatsData, OrderStatsData, UserStatsData, InventoryStatsData, type SeoRedirect, type Promotion, type PromotionForm as PromotionFormData } from '../api';
import { toast } from 'sonner';
import { ProductForm, DashboardStats, Product, Order, OrderDetail, User, OrderItem, ThemeMeta, ActiveTheme, HealthMetricsResponse, HealthSummaryResponse, ErrorLog, ErrorListParams } from '../types';
import { PageResult } from 'shared';
import { UseQueryResult } from '@tanstack/react-query';
import { useT } from 'shared/src/i18n/react';
import { useAuthStore } from '../store';
import { resolveApiErrorMessage } from '../error-utils';
import { createCrudHooks, CrudPaginationParams } from './crud-factory';

// Re-export CRUD factory for convenience
export { createCrudHooks } from './crud-factory';
export type {
  CrudPaginationParams,
  PaginatedResponse,
  CrudApiMethods,
  CrudFactoryConfig,
  CrudHooks,
} from './crud-factory';

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
export type { DashboardStats, Product, Order, OrderDetail, User, OrderItem, OrderDetailItem } from '../types';
export type { ErrorLog, ErrorListParams } from '../types';
export type { SeoRedirect, Promotion, PromotionForm } from '../api';

// Query keys
export const queryKeys = {
  products: ['products'] as const,
  product: (id: string) => ['products', id] as const,
  productExternalSource: (id: string) => ['products', id, 'external-source'] as const,
  orders: ['orders'] as const,
  order: (id: string) => ['orders', id] as const,
  orderStats: ['order-stats'] as const,
  users: ['users'] as const,
  user: (id: string) => ['users', id] as const,
  userStats: ['user-stats'] as const,
  dashboardStats: ['dashboard-stats'] as const,
  salesStats: (period: string) => ['sales-stats', period] as const,
  productStats: ['product-stats'] as const,
  adminDashboard: ['admin-dashboard'] as const,

  inventoryDashboard: ['inventory-dashboard'] as const,
  inventoryStats: ['inventory-stats'] as const,
  accountProfile: ['account-profile'] as const,
};

function useLocalizedApiFeedback() {
  const t = useT();

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  const getErrorMessage = (
    error: unknown,
    fallbackKey: string = 'common.errors.general',
    fallbackText: string = 'Something went wrong. Please try again.'
  ): string => {
    return resolveApiErrorMessage(error, t, fallbackKey, fallbackText);
  };

  return { getText, getErrorMessage };
}

// Products hooks
export function useProducts(params: PaginationParams = {}) {
  return useQuery({
    queryKey: [...queryKeys.products, params],
    queryFn: async () => {
      const response = await productsApi.getAll(params.page, params.limit, params.search);
      const data = unwrapApiResponse(response);

      // Adapt PageResult to frontend pagination structure
      return {
        data: data.items || [],
        pagination: {
          page: data.page || 1,
          limit: data.limit || 10,
          total: data.total || 0,
          totalPages: data.totalPages || 0,
        }
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: queryKeys.product(id),
    queryFn: async () => {
      const response = await productsApi.getById(id);
      return unwrapApiResponse(response);
    },
    enabled: !!id,
  });
}

export function useProductExternalSource(id: string) {
  return useQuery({
    queryKey: queryKeys.productExternalSource(id),
    queryFn: async () => {
      const response = await productsApi.getExternalSource(id);
      return unwrapApiResponse(response);
    },
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async (productData: Partial<Product>) => {
      const response = await productsApi.create(productData as unknown as ProductForm);
      return unwrapApiResponse(response);
    },
    onSuccess: () => {
      // Clear all product related query cache
      queryClient.invalidateQueries({
        queryKey: queryKeys.products,
        exact: false
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.productStats });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminDashboard });
      queryClient.refetchQueries({
        queryKey: queryKeys.products,
        exact: false
      });
      toast.success('Product created successfully');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Product> }) => {
      const response = await productsApi.update(id, data as Record<string, unknown>);
      return unwrapApiResponse(response);
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.products,
        exact: false
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.product(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.productStats });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminDashboard });
      toast.success('Product updated successfully');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useAcknowledgeProductSourceChanges() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await productsApi.acknowledgeSourceChanges(id);
      return unwrapApiResponse(response);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.product(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.productExternalSource(id) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.products,
        exact: false,
      });
      toast.success('Source changes acknowledged');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useAcknowledgeVariantSourceChange() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async ({ productId, variantId }: { productId: string; variantId: string }) => {
      const response = await productsApi.acknowledgeVariantSourceChange(productId, variantId);
      return unwrapApiResponse(response);
    },
    onSuccess: (_, { productId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.product(productId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.productExternalSource(productId) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.products,
        exact: false,
      });
      toast.success('Variant source change acknowledged');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await productsApi.delete(id);
      return unwrapApiResponse(response);
    },
    onSuccess: (_, deletedId) => {
      // Clear all product related query cache
      queryClient.invalidateQueries({
        queryKey: queryKeys.products,
        exact: false // This will match all query keys starting with ['products']
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.productStats });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminDashboard });
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
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

// Orders hooks
export function useOrders(params: PaginationParams = {}) {
  return useQuery({
    queryKey: [...queryKeys.orders, params],
    queryFn: async () => {
      const response = await ordersApi.getAll(params.page, params.limit, params.status, params.search);
      const data = unwrapApiResponse(response);
      return {
        data: data.items || [],
        pagination: {
          page: data.page || 1,
          limit: data.limit || 10,
          total: data.total || 0,
          totalPages: data.totalPages || 0,
        }
      };
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useOrderStats() {
  return useQuery({
    queryKey: queryKeys.orderStats,
    queryFn: async () => {
      const response = await ordersApi.getStats();
      return unwrapApiResponse(response) as OrderStatsData;
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: queryKeys.order(id),
    queryFn: async () => {
      const response = await ordersApi.getById(id);
      return unwrapApiResponse(response);
    },
    enabled: !!id,
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await ordersApi.updateStatus(id, status);
      return unwrapApiResponse(response);
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      queryClient.invalidateQueries({ queryKey: queryKeys.order(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.orderStats });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminDashboard });
      toast.success('Order status updated successfully');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async ({ id, cancelReason }: { id: string; cancelReason: string }) => {
      const response = await ordersApi.cancelOrder(id, cancelReason);
      return unwrapApiResponse(response);
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      queryClient.invalidateQueries({ queryKey: queryKeys.order(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.orderStats });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminDashboard });
      toast.success('Order cancelled successfully');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useRefundOrder() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { reason?: string; idempotencyKey: string } }) => {
      const response = await ordersApi.refundOrder(id, data);
      return unwrapApiResponse(response);
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      queryClient.invalidateQueries({ queryKey: queryKeys.order(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.orderStats });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminDashboard });
      toast.success('Order refunded successfully');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useShipOrder() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async ({ id, data }: {
      id: string;
      data: {
        carrier: string;
        trackingNumber: string;
        items?: Array<{ orderItemId: string; quantity: number }>;
      };
    }) => {
      const response = await ordersApi.shipOrder(id, data);
      return unwrapApiResponse(response);
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      queryClient.invalidateQueries({ queryKey: queryKeys.order(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.orderStats });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminDashboard });
      toast.success('Order marked as shipped');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

// Users hooks
export function useUsers(params: PaginationParams = {}) {
  return useQuery({
    queryKey: [...queryKeys.users, params],
    queryFn: async () => {
      const response = await usersApi.getAll(params);
      const data = unwrapApiResponse(response);
      return {
        data: (data.items as unknown as User[]) || [],
        pagination: {
          page: data.page || 1,
          limit: data.limit || 10,
          total: data.total || 0,
          totalPages: data.totalPages || 0,
        }
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUserStats() {
  return useQuery({
    queryKey: queryKeys.userStats,
    queryFn: async () => {
      const response = await usersApi.getStats();
      return unwrapApiResponse(response) as UserStatsData;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: queryKeys.user(id),
    queryFn: async () => {
      const response = await usersApi.getById(id);
      return unwrapApiResponse(response) as unknown as User;
    },
    enabled: !!id,
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await usersApi.delete(id);
      return unwrapApiResponse(response);
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.users,
        exact: false
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.userStats });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminDashboard });
      queryClient.removeQueries({
        queryKey: queryKeys.user(deletedId)
      });
      queryClient.refetchQueries({
        queryKey: queryKeys.users,
        exact: false
      });
      toast.success('User deleted successfully');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        username?: string;
        role?: string;
        avatar?: string;
        isActive?: boolean;
      };
    }) => {
      const response = await usersApi.update(id, data);
      return unwrapApiResponse(response);
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.users,
        exact: false,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.user(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.userStats });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminDashboard });
      toast.success('User updated successfully');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

// Dashboard hooks
export function useDashboardStats() {
  // Deprecated: migrating to useAdminDashboard
  return useQuery({
    queryKey: queryKeys.dashboardStats,
    queryFn: async () => {
      const response = await dashboardApi.get();
      const data = unwrapApiResponse(response);
      if (!data) return null;

      const stats: DashboardStats = {
        ...data.metrics,
        ordersByStatus: data.ordersByStatus,
        recentOrders: data.recentOrders,
      };
      return stats;
    },
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    enabled: false, // Disable by default to prevent unwanted calls
  });
}

export function useAdminDashboard() {
  return useQuery({
    queryKey: queryKeys.adminDashboard,
    queryFn: async () => {
      const response = await dashboardApi.get();
      return unwrapApiResponse(response);
    },
    staleTime: 1 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useSalesStats(period: string = '30d') {
  return useQuery({
    queryKey: queryKeys.salesStats(period),
    queryFn: async () => {
      const response = await dashboardApi.get();
      const data = unwrapApiResponse(response);
      if (!data) return null;

      const stats: DashboardStats = {
        ...data.metrics,
        ordersByStatus: data.ordersByStatus,
        recentOrders: data.recentOrders,
      };
      return stats;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useProductStats() {
  return useQuery({
    queryKey: queryKeys.productStats,
    queryFn: async () => {
      const response = await productsApi.getStats();
      return unwrapApiResponse(response) as ProductStatsData;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await productsApi.getCategories();
      const data = unwrapApiResponse(response);
      return data.items || [];
    },
  });
}

// Upload hooks
export function useUploadProductImage() {
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async (file: File) => {
      const response = await uploadApi.uploadProductImage(file);
      return unwrapApiResponse(response);
    },
    onSuccess: () => {
      toast.success('Image uploaded successfully');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUploadAvatar() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async (file: File) => {
      const response = await uploadApi.uploadAvatar(file);
      return unwrapApiResponse(response);
    },
    onSuccess: (result) => {
      const { user, updateUser } = useAuthStore.getState();
      if (user && result?.url) {
        updateUser({
          ...user,
          avatar: result.url,
        });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.accountProfile });
      toast.success('Avatar uploaded successfully');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useAccountProfile() {
  return useQuery({
    queryKey: queryKeys.accountProfile,
    queryFn: async () => {
      const response = await accountApi.getProfile();
      return unwrapApiResponse(response);
    },
  });
}

export function useUpdateAccountProfile() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async (data: { username?: string; avatar?: string }) => {
      const response = await accountApi.updateProfile(data);
      return unwrapApiResponse(response);
    },
    onSuccess: (updatedProfile) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accountProfile });
      const { user, updateUser } = useAuthStore.getState();
      if (user) {
        updateUser({
          ...user,
          username: updatedProfile.username ?? user.username,
          avatar: updatedProfile.avatar ?? user.avatar,
          updatedAt: updatedProfile.updatedAt ?? user.updatedAt,
        });
      }
      toast.success('Profile updated successfully');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUpdateAccountEmail() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async ({ newEmail, currentPassword }: { newEmail: string; currentPassword: string }) => {
      const response = await accountApi.updateEmail(newEmail, currentPassword);
      return unwrapApiResponse(response);
    },
    onSuccess: (updatedProfile) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accountProfile });
      const { user, updateUser } = useAuthStore.getState();
      if (user) {
        updateUser({
          ...user,
          email: updatedProfile.email ?? user.email,
          updatedAt: updatedProfile.updatedAt ?? user.updatedAt,
        });
      }
      toast.success('Email updated successfully');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useChangePassword() {
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) => {
      const response = await authApi.changePassword(currentPassword, newPassword);
      return unwrapApiResponse(response);
    },
    onSuccess: () => {
      toast.success('Password changed successfully');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

// Stock management hooks REMOVED per Alpha Gate

// Order statistics hook removed. Migrated to useAdminDashboard.


// ==================== Plugin Hooks ====================

// Query keys for plugins
const pluginQueryKeys = {
  all: ['plugins'] as const,
  installed: (params?: any) => [...pluginQueryKeys.all, 'installed', params] as const,
  config: (slug: string) => [...pluginQueryKeys.all, 'config', slug] as const,
  instances: (slug: string) => [...pluginQueryKeys.all, 'instances', slug] as const,
};

const marketQueryKeys = {
  all: ['official-catalog'] as const,
};

const platformConnectionQueryKeys = {
  all: ['platform-connection'] as const,
  status: ['platform-connection', 'status'] as const,
};

const managedPackageQueryKeys = {
  all: ['managed-package'] as const,
  branding: ['managed-package', 'branding'] as const,
  status: ['managed-package', 'status'] as const,
};

export function useManagedPackageBranding() {
  return useQuery({
    queryKey: managedPackageQueryKeys.branding,
    queryFn: async () => {
      const response = await managedPackageApi.getBranding();
      return unwrapApiResponse(response);
    },
    staleTime: 30 * 1000,
  });
}

export function useOfficialCatalog() {
  return useQuery({
    queryKey: marketQueryKeys.all,
    queryFn: async () => {
      const response = await marketApi.getOfficialCatalog();
      return unwrapApiResponse(response);
    },
    staleTime: 60 * 1000,
  });
}

export function useInstallOfficialExtension() {
  const queryClient = useQueryClient();
  const { getText, getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async ({
      slug,
      kind,
      version,
      activate,
    }: {
      slug: string;
      kind: 'plugin' | 'theme-shop' | 'theme-admin' | 'theme-app-shop' | 'theme-app-admin';
      version?: string;
      activate?: boolean;
    }) => {
      const response = await marketApi.installOfficialExtension(slug, { kind, version, activate });
      return unwrapApiResponse(response);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: marketQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: pluginQueryKeys.installed() });
      queryClient.invalidateQueries({ queryKey: themeQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: managedPackageQueryKeys.all });
      toast.success(
        variables.kind === 'plugin'
          ? getText('merchant.plugins.installSuccess', 'Plugin installed successfully')
          : getText('merchant.themes.installSuccess', 'Theme installed successfully')
      );
    },
    onError: (error: unknown, variables) => {
      const fallbackKey = variables.kind === 'plugin'
        ? 'merchant.plugins.installFailed'
        : 'merchant.themes.installFailed';
      const fallbackText = variables.kind === 'plugin'
        ? 'Failed to install plugin'
        : 'Failed to install theme';
      toast.error(getErrorMessage(error, fallbackKey, fallbackText));
    },
  });
}

export function useManagedPackageStatus() {
  return useQuery({
    queryKey: managedPackageQueryKeys.status,
    queryFn: async () => {
      const response = await managedPackageApi.getStatus();
      return unwrapApiResponse(response);
    },
    staleTime: 30 * 1000,
  });
}

export function useActivateManagedPackage() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async (activationCode: string) => {
      const response = await managedPackageApi.activate({ activationCode });
      return unwrapApiResponse(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: managedPackageQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: marketQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: themeQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: pluginQueryKeys.all });
      toast.success('Commercial package activated');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'merchant.extensions.managedPackageActivationFailed', 'Failed to activate commercial package'));
    },
  });
}

export function useProvisionManagedPackage() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async () => {
      const response = await managedPackageApi.provision();
      return unwrapApiResponse(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: managedPackageQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: marketQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: themeQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: pluginQueryKeys.all });
      toast.success('Included assets provisioned');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'merchant.extensions.managedPackageProvisionFailed', 'Failed to provision included assets'));
    },
  });
}

export function usePlatformConnectionStatus() {
  return useQuery({
    queryKey: platformConnectionQueryKeys.status,
    queryFn: async () => {
      const response = await platformConnectionApi.getStatus();
      return unwrapApiResponse(response);
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });
}

export function useStartPlatformConnection() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async (data: { instanceName?: string; originUrl?: string; coreVersion?: string }) => {
      const response = await platformConnectionApi.start(data);
      return unwrapApiResponse(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: platformConnectionQueryKeys.all });
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'merchant.extensions.platformConnectFailed', 'Failed to start platform connection'));
    },
  });
}

export function usePollPlatformConnection() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async (data: { deviceCode: string }) => {
      const response = await platformConnectionApi.poll(data);
      return unwrapApiResponse(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: platformConnectionQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: marketQueryKeys.all });
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'merchant.extensions.platformPollFailed', 'Failed to refresh platform connection'));
    },
  });
}

export function useCompletePlatformConnection() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async (data: { deviceCode: string; accountEmail: string; accountName?: string }) => {
      const response = await platformConnectionApi.complete(data);
      return unwrapApiResponse(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: platformConnectionQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: marketQueryKeys.all });
      toast.success('Platform instance connected successfully');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'merchant.extensions.platformCompleteFailed', 'Failed to complete platform connection'));
    },
  });
}

export function useBindPlatformTenant() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async () => {
      const response = await platformConnectionApi.bindTenant();
      return unwrapApiResponse(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: platformConnectionQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: marketQueryKeys.all });
      toast.success('Default store bound to the official platform');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'merchant.extensions.platformBindTenantFailed', 'Failed to bind the default store'));
    },
  });
}

export function useDisconnectPlatformConnection() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async () => {
      const response = await platformConnectionApi.disconnect();
      return unwrapApiResponse(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: platformConnectionQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: marketQueryKeys.all });
      toast.success('Platform connection removed');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'merchant.extensions.platformDisconnectFailed', 'Failed to disconnect platform connection'));
    },
  });
}



// Get installed plugins
export function useInstalledPlugins() {
  return useQuery({
    queryKey: pluginQueryKeys.installed(),
    queryFn: async () => {
      const response = await pluginsApi.getInstalled();
      return unwrapApiResponse(response);
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
      return unwrapApiResponse(response);
    },
    enabled: !!slug,
  });
}



// Update plugin configuration mutation
export function useUpdatePluginConfig() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async ({ slug, config }: {
      slug: string;
      config: Record<string, any>;
    }) => {
      const response = await pluginsApi.updateConfig(slug, config);
      return unwrapApiResponse(response);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: pluginQueryKeys.config(variables.slug) });
      queryClient.invalidateQueries({ queryKey: pluginQueryKeys.installed() });
      queryClient.invalidateQueries({ queryKey: marketQueryKeys.all });
      toast.success('Plugin configuration updated successfully');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

// Toggle plugin enabled/disabled mutation
export function useTogglePlugin() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async ({ slug, enabled }: {
      slug: string;
      enabled: boolean;
    }) => {
      const response = enabled
        ? await pluginsApi.enable(slug)
        : await pluginsApi.disable(slug);
      return unwrapApiResponse(response);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: pluginQueryKeys.installed() });
      queryClient.invalidateQueries({ queryKey: marketQueryKeys.all });
      toast.success(`Plugin ${variables.enabled ? 'enabled' : 'disabled'} successfully`);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

// Uninstall plugin mutation
export function useUninstallPlugin() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async (slug: string) => {
      const response = await pluginsApi.uninstall(slug);
      return unwrapApiResponse(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pluginQueryKeys.installed() });
      queryClient.invalidateQueries({ queryKey: marketQueryKeys.all });
      toast.success('Plugin uninstalled successfully');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

// Restore plugin mutation (soft-uninstall rollback)
export function useRestorePlugin() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async (slug: string) => {
      const response = await pluginsApi.restore(slug);
      return unwrapApiResponse(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pluginQueryKeys.installed() });
      queryClient.invalidateQueries({ queryKey: marketQueryKeys.all });
      toast.success('Plugin restored successfully');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

// Purge plugin mutation (hard delete)
export function usePurgePlugin() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async (slug: string) => {
      const response = await pluginsApi.purge(slug);
      return unwrapApiResponse(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pluginQueryKeys.installed() });
      queryClient.invalidateQueries({ queryKey: marketQueryKeys.all });
      toast.success('Plugin purged permanently');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

// ==================== Plugin Instance Hooks (Multi-instance support) ====================

// Get plugin instances
export function usePluginInstances(slug: string) {
  return useQuery({
    queryKey: pluginQueryKeys.instances(slug),
    queryFn: async () => {
      const response = await pluginsApi.getInstances(slug);
      return unwrapApiResponse(response);
    },
    enabled: !!slug,
    staleTime: 60 * 1000, // 1 minute
  });
}

// Create plugin instance mutation
export function useCreatePluginInstance() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async ({
      slug,
      instanceKey,
      enabled,
      config,
      grantedPermissions,
    }: {
      slug: string;
      instanceKey: string;
      enabled?: boolean;
      config?: Record<string, unknown>;
      grantedPermissions?: string[];
    }) => {
      const response = await pluginsApi.createInstance(slug, {
        instanceKey,
        enabled,
        config,
        grantedPermissions,
      });
      return unwrapApiResponse(response);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: pluginQueryKeys.instances(variables.slug) });
      toast.success(`Instance "${variables.instanceKey}" created successfully`);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

// Update plugin instance mutation
export function useUpdatePluginInstance() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async ({
      slug,
      installationId,
      enabled,
      config,
      grantedPermissions,
    }: {
      slug: string;
      installationId: string;
      enabled?: boolean;
      config?: Record<string, unknown>;
      grantedPermissions?: string[];
    }) => {
      const response = await pluginsApi.updateInstance(slug, installationId, {
        enabled,
        config,
        grantedPermissions,
      });
      return unwrapApiResponse(response);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: pluginQueryKeys.instances(variables.slug) });
      queryClient.invalidateQueries({ queryKey: marketQueryKeys.all });
      toast.success('Instance updated successfully');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

// Delete plugin instance mutation
export function useDeletePluginInstance() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async ({ slug, installationId }: { slug: string; installationId: string }) => {
      const response = await pluginsApi.deleteInstance(slug, installationId);
      return unwrapApiResponse(response);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: pluginQueryKeys.instances(variables.slug) });
      toast.success('Instance deleted successfully');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

// --- Theme Management Hooks ---

const themeQueryKeys = {
  all: ['themes'] as const,
  installed: (target: string) => [...themeQueryKeys.all, 'installed', target] as const,
  active: (target: string) => [...themeQueryKeys.all, 'active', target] as const,
};

export function useThemes(target: 'shop' | 'admin' = 'shop'): UseQueryResult<PageResult<ThemeMeta>> {
  return useQuery({
    queryKey: themeQueryKeys.installed(target),
    queryFn: async () => {
      const response = await themesApi.getInstalled(target);
      return unwrapApiResponse(response);
    },
  });
}

export function useActiveTheme(target: 'shop' | 'admin' = 'shop'): UseQueryResult<ActiveTheme> {
  return useQuery({
    queryKey: themeQueryKeys.active(target),
    queryFn: async () => {
      const response = await themesApi.getActive(target);
      return unwrapApiResponse(response);
    },
  });
}

export function useActivateTheme() {
  const queryClient = useQueryClient();
  const { getText, getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async ({ slug, target, type }: { slug: string; target: 'shop' | 'admin'; type?: 'pack' | 'app' }) => {
      const response = await themesApi.activate(slug, target, undefined, type);
      return unwrapApiResponse(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: themeQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: marketQueryKeys.all });
      toast.success(getText('merchant.themes.activateSuccess', 'Theme activated successfully'));
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'merchant.themes.activateFailed', 'Failed to activate theme'));
    },
  });
}

export function useRollbackTheme() {
  const queryClient = useQueryClient();
  const { getText, getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async (target: 'shop' | 'admin') => {
      const response = await themesApi.rollback(target);
      return unwrapApiResponse(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: themeQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: marketQueryKeys.all });
      toast.success(getText('merchant.themes.rollbackSuccess', 'Theme rolled back successfully'));
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'merchant.themes.rollbackFailed', 'Failed to rollback theme'));
    },
  });
}

// ==================== Inventory Forecasting Hooks ====================

// Get aggregated inventory dashboard data
export function useInventoryDashboard(params: {
  page?: number;
  limit?: number;
  status?: 'ACTIVE' | 'DISMISSED' | 'RESOLVED';
  productId?: string;
  variantId?: string;
} = {}) {
  return useQuery({
    queryKey: [...queryKeys.inventoryDashboard, params],
    queryFn: async () => {
      const response = await inventoryApi.getDashboard(params);
      return unwrapApiResponse(response);
    },
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useInventoryStats() {
  return useQuery({
    queryKey: queryKeys.inventoryStats,
    queryFn: async () => {
      const response = await inventoryApi.getStats();
      return unwrapApiResponse(response) as InventoryStatsData;
    },
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

// Generate forecast mutation
export function useGenerateForecast() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async (data: {
      productId: string;
      variantId: string;
      days?: number;
      historicalDays?: number;
    }) => {
      const response = await inventoryApi.generateForecast(data);
      return unwrapApiResponse(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryStats });
      toast.success('Forecast generated successfully');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useRecomputeAllForecasts() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async (data?: { days?: number; historicalDays?: number }) => {
      const response = await inventoryApi.recomputeAll(data);
      return unwrapApiResponse(response);
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryStats });

      const processed = result?.processedSkus ?? 0;
      const failed = result?.failedSkus ?? 0;
      toast.success(`Recompute finished: ${processed} SKUs processed, ${failed} failed`);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

// Dismiss alert mutation
export function useDismissAlert() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const response = await inventoryApi.dismissAlert(id, reason);
      return unwrapApiResponse(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryStats });
      toast.success('Alert dismissed successfully');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

// Resolve alert mutation
export function useResolveAlert() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await inventoryApi.resolveAlert(id);
      return unwrapApiResponse(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryStats });
      toast.success('Alert resolved successfully');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

// Update alert status mutation
export function useUpdateAlertStatus() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      reason,
    }: {
      id: string;
      status: 'ACTIVE' | 'DISMISSED' | 'RESOLVED';
      reason?: string;
    }) => {
      const response = await inventoryApi.updateAlertStatus(id, status, reason);
      return unwrapApiResponse(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryStats });
      toast.success('Alert status updated successfully');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

// Check and create alerts mutation
export function useCheckAlerts() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async ({ productId, variantId }: { productId: string; variantId: string }) => {
      const response = await inventoryApi.checkAndCreateAlerts(productId, variantId);
      return unwrapApiResponse(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryStats });
      toast.success('Alerts updated successfully');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

// Record forecast accuracy mutation
export function useRecordAccuracy() {
  const queryClient = useQueryClient();
  const { getErrorMessage } = useLocalizedApiFeedback();

  return useMutation({
    mutationFn: async ({ forecastId, actualDemand }: { forecastId: string; actualDemand: number }) => {
      const response = await inventoryApi.recordAccuracy(forecastId, actualDemand);
      return unwrapApiResponse(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryStats });

      toast.success('Forecast accuracy recorded successfully');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

// ==================== Health Monitoring Hooks ====================

const healthQueryKeys = {
  metrics: ['health-metrics'] as const,
  summary: ['health-summary'] as const,
};

export function useHealthMetrics() {
  return useQuery({
    queryKey: healthQueryKeys.metrics,
    queryFn: async () => {
      const response = await healthApi.getMetrics();
      return unwrapApiResponse(response);
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

export function useHealthSummary() {
  return useQuery({
    queryKey: healthQueryKeys.summary,
    queryFn: async () => {
      const response = await healthApi.getSummary();
      return unwrapApiResponse(response);
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

// ==================== Error Tracking Hooks ====================

const errorQueryKeys = {
  all: ['errors'] as const,
  list: (params?: any) => ['errors', 'list', params] as const,
  detail: (id: string) => ['errors', id] as const,
  stats: ['errors', 'stats'] as const,
};

export function useErrors(params: {
  page?: number;
  limit?: number;
  search?: string;
  severity?: string;
  resolved?: boolean;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: string;
} = {}) {
  return useQuery({
    queryKey: errorQueryKeys.list(params),
    queryFn: async (): Promise<{ data: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> => {
      const response = await errorsApi.getAll(params);
      const data = unwrapApiResponse(response);
      // Transform PageResult to PaginatedResponse format
      if (data.items && typeof data.total === 'number') {
        return {
          data: data.items,
          pagination: {
            page: params.page || 1,
            limit: params.limit || 10,
            total: data.total,
            totalPages: Math.ceil(data.total / (params.limit || 10)),
          },
        };
      }
      return data as any;
    },
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

export function useError(id: string) {
  return useQuery({
    queryKey: errorQueryKeys.detail(id),
    queryFn: async () => {
      const response = await errorsApi.getById(id);
      return unwrapApiResponse(response);
    },
    enabled: !!id,
  });
}

export function useErrorStats() {
  return useQuery({
    queryKey: errorQueryKeys.stats,
    queryFn: async () => {
      const response = await errorsApi.getStats();
      return unwrapApiResponse(response);
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useResolveError() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, resolved }: { id: string; resolved: boolean }) => {
      const response = resolved
        ? await errorsApi.resolve(id)
        : await errorsApi.unresolve(id);
      return unwrapApiResponse(response);
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: errorQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: errorQueryKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: errorQueryKeys.stats });
      toast.success('Error status updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update error status');
    },
  });
}


// ==================== Promotions Hooks ====================

const promotionHooks = createCrudHooks<Promotion, Promotion, PromotionFormData, Partial<PromotionFormData>>({
  resource: 'promotions',
  api: {
    getAll: async (params?: CrudPaginationParams) => {
      return promotionsApi.getAll(params?.page, params?.limit, params?.search, params?.type);
    },
    getById: (id: string) => promotionsApi.getById(id),
    create: (data: PromotionFormData) => promotionsApi.create(data),
    update: (id: string, data: Partial<PromotionFormData>) => promotionsApi.update(id, data),
    delete: (id: string) => promotionsApi.delete(id),
  },
  messages: {
    createSuccess: 'Promotion created successfully',
    updateSuccess: 'Promotion updated successfully',
    deleteSuccess: 'Promotion deleted successfully',
  },
  staleTime: 5 * 60 * 1000,
});

export const usePromotion = promotionHooks.useDetail;
export const useCreatePromotion = promotionHooks.useCreate;
export const useUpdatePromotion = promotionHooks.useUpdate;
export const useDeletePromotion = promotionHooks.useDelete;

// ==================== SEO Redirects Hooks ====================

const redirectHooks = createCrudHooks<SeoRedirect, SeoRedirect, { fromPath: string; toPath: string; statusCode?: number; isActive?: boolean }, Partial<SeoRedirect>>({
  resource: 'redirects',
  api: {
    getAll: async (params?: CrudPaginationParams) => {
      return redirectsApi.getAll(params?.page, params?.limit, params?.search);
    },
    getById: (id: string) => redirectsApi.getById(id),
    create: (data: { fromPath: string; toPath: string; statusCode?: number; isActive?: boolean }) => redirectsApi.create(data),
    update: (id: string, data: Partial<SeoRedirect>) => redirectsApi.update(id, data),
    delete: (id: string) => redirectsApi.delete(id),
  },
  messages: {
    createSuccess: 'Redirect created successfully',
    updateSuccess: 'Redirect updated successfully',
    deleteSuccess: 'Redirect deleted successfully',
  },
  staleTime: 5 * 60 * 1000,
});

export const useRedirects = redirectHooks.useList;
export const useCreateRedirect = redirectHooks.useCreate;
export const useUpdateRedirect = redirectHooks.useUpdate;
export const useDeleteRedirect = redirectHooks.useDelete;
