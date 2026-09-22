/**
 * Admin API Client
 * Uses unified AuthClient. 
 */

import {
  createAdminClient,
  getAdminClient,
  type ApiResponse,
  type ListResult,
  type PageResult,
  type UserProfile,
  // Import DTO types
  type AdminProductListItemDTO,
  type AdminProductDetailDTO,
  type AdminOrderListItemDTO,
  type AdminOrderDetailDTO,
} from 'shared';
import type { AuthBootstrapStatus } from 'shared/src/types/auth';

export type { ApiResponse, ListResult, PageResult, UserProfile };

import type {
  ProductForm,
  Product,
  Order,
  OrderDetail,
  PluginMetaWithState,
  PluginConfigMeta,
  PluginState,
  HealthSummaryResponse,
} from './types';

/**
 * Unwrap ApiResponse and throw error if success is false
 * This is the SINGLE SOURCE OF TRUTH for unwrapping in Admin.
 */
export class AdminApiError extends Error {
  code: string;
  details?: unknown;

  constructor(message: string, code: string = 'ERROR', details?: unknown) {
    super(message);
    this.name = 'AdminApiError';
    this.code = code;
    this.details = details;
  }
}

export function isAdminApiError(error: unknown): error is AdminApiError {
  return error instanceof AdminApiError;
}

export function unwrapApiResponse<T>(response: ApiResponse<T>): T {
  if (response.success) {
    return response.data as T;
  }

  const error = response.error;
  let message = 'Request failed';
  let code = 'ERROR';
  let details: unknown = undefined;

  if (typeof error === 'object' && error !== null) {
    message = (error as { message?: string }).message || message;
    code = (error as { code?: string }).code || code;
    details = (error as { details?: unknown }).details;
  } else if (typeof error === 'string') {
    message = error;
  } else if (response.message) {
    message = response.message;
  }

  throw new AdminApiError(message, code, details);
}

export interface DashboardData {
  metrics: {
    totalRevenue: number;
    totalOrders: number;
    totalProducts: number;
    totalUsers: number;
    currency: string;
    totalRevenueTrend: number;
    totalOrdersTrend: number;
    totalProductsTrend: number;
    totalUsersTrend: number;
  };
  ordersByStatus: Record<string, number>;
  recentOrders: Order[];
}

export type SystemSettingsMap = Record<string, unknown>;

export interface ProductStatsData {
  metrics: {
    totalProducts: number;
    activeProducts: number;
    outOfStockProducts: number;
    totalProductsTrend: number;
    activeProductsTrend: number;
    outOfStockProductsTrend: number;
  };
}

export interface OrderStatsData {
  metrics: {
    totalOrders: number;
    paidOrders: number;
    shippedOrders: number;
    refundedOrders: number;
    totalRevenue: number;
    currency: string;
    totalOrdersTrend: number;
    paidOrdersTrend: number;
    shippedOrdersTrend: number;
    refundedOrdersTrend: number;
    totalRevenueTrend: number;
    pendingOrders?: number;
    deliveredOrders?: number;
    pendingOrdersTrend?: number;
    deliveredOrdersTrend?: number;
  };
}

export interface UserStatsData {
  metrics: {
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    newThisMonth: number;
    totalUsersTrend: number;
    activeUsersTrend: number;
    inactiveUsersTrend: number;
    newUsersTrend: number;
  };
}

// Type definitions (Admin specific)
export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  role?: string;
  productType?: string;
}

export interface AccountProfile {
  id: string;
  email: string;
  username: string;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
}

// Lazy initialize API client
let _apiClient: ReturnType<typeof createAdminClient> | null = null;

const getApiClient = () => {
  if (!_apiClient) {
    _apiClient = createAdminClient({
      storageType: 'hybrid',
      customConfig: {
        // Plugin ZIP installs can take longer than typical API calls (upload + unzip + validation)
        timeout: 120000,
      }
    });
  }
  return _apiClient;
};

// Export Proxy
export const apiClient = new Proxy({} as ReturnType<typeof createAdminClient>, {
  get: (target, prop) => {
    return getApiClient()[prop as keyof ReturnType<typeof createAdminClient>];
  }
});

export { getAdminClient };

// Auth API
export const authApi = {
  forgotPassword: (email: string): Promise<ApiResponse<void>> =>
    apiClient.forgotPassword(email),

  resetPassword: (data: { email: string; code: string; password: string }): Promise<ApiResponse<void>> =>
    apiClient.resetPassword(data),

  login: async (identifier: string, password: string) => {
    const response = await apiClient.post<{
      access_token: string;
      token_type: string;
      expires_in: number;
      refresh_token?: string;
    }>('/auth/login', { identifier, password }, { withCredentials: true });
    if (response.success && response.data?.access_token) {
      apiClient.setToken(response.data.access_token);
      if (response.data.refresh_token) {
        (apiClient as unknown as { setRefreshToken: (token: string) => void })
          .setRefreshToken(response.data.refresh_token);
      }
    }
    return response;
  },

  getLoginConfig: (): Promise<ApiResponse<{
    demoModeEnabled: boolean;
    demoCredentials: {
      email: string;
      password: string;
    } | null;
  }>> =>
    apiClient.get('/auth/login-config'),

  me: (): Promise<ApiResponse<UserProfile>> => apiClient.get('/auth/me'),

  bootstrapStatus: (): Promise<ApiResponse<AuthBootstrapStatus>> =>
    apiClient.get('/auth/bootstrap-status'),

  logout: async () => {
    try {
      return await apiClient.post<void>('/auth/logout', {}, { withCredentials: true });
    } finally {
      apiClient.clearAuth();
    }
  },

  refreshToken: () => apiClient.post('/auth/refresh', {
    refresh_token: apiClient.getRefreshToken(),
  }, { withCredentials: true }),

  changePassword: (currentPassword: string, newPassword: string): Promise<ApiResponse<{ passwordChanged: boolean; changedAt: string }>> =>
    apiClient.post('/auth/change-password', { currentPassword, newPassword }),
};

export const accountApi = {
  getProfile: (): Promise<ApiResponse<AccountProfile>> =>
    apiClient.get('/account/profile'),

  updateProfile: (data: { username?: string; avatar?: string }): Promise<ApiResponse<AccountProfile>> =>
    apiClient.put('/account/profile', data),

  updateEmail: (newEmail: string, currentPassword: string): Promise<ApiResponse<AccountProfile>> =>
    apiClient.put('/account/email', { newEmail, currentPassword }),
};

// Products API
export const productsApi = {
  getAll: (
    page = 1,
    limit = 10,
    search?: string,
    productType?: string
  ): Promise<ApiResponse<PageResult<AdminProductListItemDTO>>> =>
    apiClient.get('/admin/products', { params: { page, limit, search, productType } }),

  getStats: (params?: {
    search?: string;
    categoryId?: string;
  }): Promise<ApiResponse<ProductStatsData>> =>
    apiClient.get('/admin/products/stats', { params }),

  getById: (id: string): Promise<ApiResponse<AdminProductDetailDTO>> => apiClient.get(`/admin/products/${id}`),

  create: (data: ProductForm): Promise<ApiResponse<AdminProductDetailDTO>> => apiClient.post('/admin/products', data),

  update: (id: string, data: Partial<ProductForm>): Promise<ApiResponse<AdminProductDetailDTO>> => apiClient.put(`/admin/products/${id}`, data),

  delete: (id: string): Promise<ApiResponse<void>> => apiClient.delete(`/admin/products/${id}`),

  getCategories: (page = 1, limit = 20): Promise<ApiResponse<PageResult<any>>> =>
    apiClient.get('/admin/products/categories', { params: { page, limit } }),
};

// Orders API
export const ordersApi = {
  getAll: (page = 1, limit = 10, status?: string, search?: string): Promise<ApiResponse<PageResult<AdminOrderListItemDTO>>> =>
    apiClient.get('/admin/orders', { params: { page, limit, status, search } }),

  getStats: (): Promise<ApiResponse<OrderStatsData>> =>
    apiClient.get('/admin/orders/stats'),

  getById: (id: string): Promise<ApiResponse<AdminOrderDetailDTO>> => apiClient.get(`/admin/orders/${id}`),

  updateItemFulfillment: (
    id: string,
    itemId: string,
    data: { fulfillmentStatus?: string; fulfillmentData?: Record<string, unknown> | null }
  ): Promise<ApiResponse<AdminOrderDetailDTO>> =>
    apiClient.put(`/admin/orders/${id}/items/${itemId}/fulfillment`, data),

  updateStatus: (id: string, status: string): Promise<ApiResponse<OrderDetail>> =>
    apiClient.put(`/admin/orders/${id}/status`, { status }),

  shipOrder: (id: string, data: {
    carrier: string;
    trackingNumber: string;
    items?: Array<{ orderItemId: string; quantity: number }>
  }): Promise<ApiResponse<OrderDetail>> =>
    apiClient.post(`/admin/orders/${id}/ship`, data),

  cancelOrder: (id: string, cancelReason: string): Promise<ApiResponse<OrderDetail>> =>
    apiClient.post(`/admin/orders/${id}/cancel`, { cancelReason }),

  refundOrder: (id: string, data: { reason?: string; idempotencyKey: string }): Promise<ApiResponse<OrderDetail>> =>
    apiClient.post(`/admin/orders/${id}/refund`, data),
};

// Users API
export const usersApi = {
  getAll: (params: PaginationParams = {}): Promise<ApiResponse<PageResult<UserProfile>>> => {
    const { page = 1, limit = 10, search } = params;
    return apiClient.get('/admin/users', { params: { page, limit, search } });
  },

  getStats: (): Promise<ApiResponse<UserStatsData>> =>
    apiClient.get('/admin/users/stats'),

  getById: (id: string): Promise<ApiResponse<UserProfile>> => apiClient.get(`/admin/users/${id}`),

  create: (data: {
    email: string;
    password: string;
    username?: string;
    role?: string;
  }): Promise<ApiResponse<UserProfile>> => apiClient.post('/admin/users', data),

  update: (id: string, data: {
    username?: string;
    role?: string;
    avatar?: string;
    isActive?: boolean;
  }): Promise<ApiResponse<UserProfile>> => apiClient.put(`/admin/users/${id}`, data),

  delete: (id: string): Promise<ApiResponse<void>> => apiClient.delete(`/admin/users/${id}`),

  resetPassword: (id: string, newPassword: string): Promise<ApiResponse<{ message: string }>> =>
    apiClient.post(`/admin/users/${id}/reset-password`, { newPassword }),
};

// Dashboard API
export const dashboardApi = {
  get: (): Promise<ApiResponse<DashboardData>> => apiClient.get('/admin/dashboard'),
};

// Health Monitoring API
export const healthApi = {
  getSummary: (): Promise<ApiResponse<HealthSummaryResponse>> =>
    apiClient.get('/admin/health/summary'),
};

// Plugin Instance types
export interface PluginInstance {
  installationId: string;
  pluginSlug: string;
  instanceKey: string;
  enabled: boolean;
  config: Record<string, unknown>;
  configMeta?: PluginConfigMeta;
  grantedPermissions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateInstanceRequest {
  instanceKey: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
  grantedPermissions?: string[];
}

export interface UpdateInstanceRequest {
  enabled?: boolean;
  config?: Record<string, unknown>;
  grantedPermissions?: string[];
}

const DEFAULT_PLUGIN_INSTANCE_KEY = 'default';

type PluginConfigReadiness = {
  configRequired: boolean;
  configReady: boolean;
  missingConfigFields: string[];
};

function isObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function evaluateConfigReadiness(
  configSchema: Record<string, any> | undefined,
  config: Record<string, any> | undefined,
  configMeta?: PluginConfigMeta
): PluginConfigReadiness {
  if (!configSchema || Object.keys(configSchema).length === 0) {
    return {
      configRequired: false,
      configReady: true,
      missingConfigFields: [],
    };
  }

  const currentConfig = isObject(config) ? config : {};
  const missingConfigFields: string[] = [];
  let configRequired = false;

  for (const [key, descriptor] of Object.entries(configSchema)) {
    if (!isObject(descriptor) || !descriptor.required) {
      continue;
    }
    configRequired = true;
    const value = currentConfig[key];
    const type = typeof descriptor.type === 'string' ? descriptor.type : '';
    const secretConfigured = Boolean(configMeta?.secretFields?.[key]?.configured);

    if (value === undefined || value === null) {
      if (type === 'secret' && secretConfigured) {
        continue;
      }
      missingConfigFields.push(key);
      continue;
    }

    if (type === 'string' && (typeof value !== 'string' || value.trim().length === 0)) {
      missingConfigFields.push(key);
      continue;
    }

    if (type === 'secret' && ((typeof value !== 'string' || value.trim().length === 0) && !secretConfigured)) {
      missingConfigFields.push(key);
      continue;
    }

    if (type === 'object') {
      if (!isObject(value) || Object.keys(value).length === 0) {
        missingConfigFields.push(key);
      }
      continue;
    }

    if (type === 'array' && (!Array.isArray(value) || value.length === 0)) {
      missingConfigFields.push(key);
      continue;
    }
  }

  return {
    configRequired,
    configReady: !configRequired || missingConfigFields.length === 0,
    missingConfigFields,
  };
}

function parseManifestJson(value: any): Record<string, any> | null {
  if (!value) return null;
  if (typeof value === 'object') {
    return value as Record<string, any>;
  }
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function toPluginState(slug: string, detail: any, instance: PluginInstance | null): PluginState {
  const parsedManifest = parseManifestJson(detail?.manifestJson);

  const configSchema = (parsedManifest?.configSchema || detail?.configSchema || undefined) as Record<string, any> | undefined;
  const config = (instance?.config || {}) as Record<string, any>;
  const readiness = evaluateConfigReadiness(configSchema, config, instance?.configMeta);

  return {
    slug,
    enabled: instance?.enabled ?? false,
    config,
    configMeta: instance?.configMeta,
    adminUi: parsedManifest?.adminUi || detail?.adminUi || undefined,
    configSchema,
    configRequired: readiness.configRequired,
    configReady: readiness.configReady,
    missingConfigFields: readiness.missingConfigFields,
    name: detail?.name,
    version: detail?.version,
    description: detail?.description,
    author: detail?.author,
    category: detail?.category,
    runtimeType: detail?.runtimeType,
    source: detail?.source || 'installed',
  } as PluginState;
}

async function fetchPluginDetail(slug: string): Promise<any> {
  const response = await apiClient.get(`/extensions/plugin/${slug}`) as ApiResponse<any>;
  if (!response.success) {
    const message = response.error?.message || `Plugin "${slug}" not found`;
    const code = response.error?.code || 'NOT_FOUND';
    throw new AdminApiError(message, code, response.error?.details);
  }
  return response.data || {};
}

async function fetchPluginInstances(slug: string): Promise<PluginInstance[]> {
  const response = await apiClient.get(`/extensions/plugin/${slug}/instances`, {
    params: { page: 1, limit: 100 },
  }) as ApiResponse<PageResult<PluginInstance>>;
  if (!response.success || !response.data) return [];
  return response.data.items || [];
}

async function getDefaultInstance(slug: string): Promise<PluginInstance | null> {
  const instances = await fetchPluginInstances(slug);
  return instances.find((item) => item.instanceKey === DEFAULT_PLUGIN_INSTANCE_KEY) || instances[0] || null;
}

function toApiErrorPayload(
  error: unknown,
  fallbackCode: string,
  fallbackMessage: string
): { code: string; message: string; details?: unknown } {
  if (isAdminApiError(error)) {
    return {
      code: error.code || fallbackCode,
      message: error.message || fallbackMessage,
      details: error.details,
    };
  }
  if (error instanceof Error) {
    return {
      code: fallbackCode,
      message: error.message || fallbackMessage,
    };
  }
  return {
    code: fallbackCode,
    message: fallbackMessage,
  };
}


// Plugin Management API
export const pluginsApi = {
  getInstalled: async (page = 1, limit = 20): Promise<ApiResponse<PageResult<PluginMetaWithState>>> => {
    const response = await apiClient.get('/extensions/plugin', { params: { page, limit } }) as ApiResponse<PageResult<any>>;
    if (!response.success || !response.data) {
      return response as ApiResponse<PageResult<PluginMetaWithState>>;
    }

    const items = await Promise.all(
      (response.data.items || []).map(async (plugin: any) => {
        const defaultInstance = await getDefaultInstance(plugin.slug).catch(() => null);
        const parsedManifest = parseManifestJson(plugin?.manifestJson);
        const configSchema = (parsedManifest?.configSchema || plugin?.configSchema || undefined) as Record<string, any> | undefined;
        const config = (defaultInstance?.config || {}) as Record<string, any>;
        const readiness = evaluateConfigReadiness(configSchema, config, defaultInstance?.configMeta);

        return {
          ...plugin,
          source: (plugin?.source || 'installed') as PluginMetaWithState['source'],
          enabled: plugin?.deletedAt ? false : (defaultInstance?.enabled ?? false),
          deletedAt: plugin?.deletedAt || null,
          uninstalled: Boolean(plugin?.deletedAt),
          configRequired: readiness.configRequired,
          configReady: readiness.configReady,
          missingConfigFields: readiness.missingConfigFields,
        } as PluginMetaWithState;
      })
    );

    return {
      ...response,
      data: {
        ...response.data,
        items,
      },
    } as ApiResponse<PageResult<PluginMetaWithState>>;
  },

  getConfig: async (slug: string): Promise<ApiResponse<PluginState>> => {
    try {
      const [detail, instance] = await Promise.all([
        fetchPluginDetail(slug),
        getDefaultInstance(slug),
      ]);

      return {
        success: true,
        data: toPluginState(slug, detail, instance),
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: error?.message || `Plugin "${slug}" not found`,
        },
      };
    }
  },

  updateConfig: async (slug: string, config: Record<string, any>): Promise<ApiResponse<PluginState>> => {
    try {
      const detail = await fetchPluginDetail(slug);
      const existing = await getDefaultInstance(slug);

      if (existing) {
        const response = await apiClient.patch(`/extensions/plugin/${slug}/instances/${existing.installationId}`, {
          config,
          enabled: existing.enabled,
        });
        unwrapApiResponse(response);
      } else {
        const response = await apiClient.post(`/extensions/plugin/${slug}/instances`, {
          instanceKey: DEFAULT_PLUGIN_INSTANCE_KEY,
          enabled: true,
          config,
        });
        unwrapApiResponse(response);
      }

      const latest = await getDefaultInstance(slug);
      return {
        success: true,
        data: toPluginState(slug, detail, latest),
      };
    } catch (error: any) {
      const normalized = toApiErrorPayload(error, 'UPDATE_ERROR', 'Failed to update plugin config');
      return {
        success: false,
        error: normalized,
      };
    }
  },

  enable: async (slug: string): Promise<ApiResponse<PluginState>> => {
    try {
      const detail = await fetchPluginDetail(slug);
      const existing = await getDefaultInstance(slug);

      if (existing) {
        const response = await apiClient.patch(`/extensions/plugin/${slug}/instances/${existing.installationId}`, {
          enabled: true,
          config: existing.config,
        });
        unwrapApiResponse(response);
      } else {
        const response = await apiClient.post(`/extensions/plugin/${slug}/instances`, {
          instanceKey: DEFAULT_PLUGIN_INSTANCE_KEY,
          enabled: true,
          config: {},
        });
        unwrapApiResponse(response);
      }

      const latest = await getDefaultInstance(slug);
      return {
        success: true,
        data: toPluginState(slug, detail, latest),
      };
    } catch (error: any) {
      const normalized = toApiErrorPayload(error, 'UPDATE_ERROR', 'Failed to enable plugin');
      return {
        success: false,
        error: normalized,
      };
    }
  },

  disable: async (slug: string): Promise<ApiResponse<PluginState>> => {
    try {
      const detail = await fetchPluginDetail(slug);
      const existing = await getDefaultInstance(slug);

      if (existing) {
        const response = await apiClient.patch(`/extensions/plugin/${slug}/instances/${existing.installationId}`, {
          enabled: false,
          config: existing.config,
        });
        unwrapApiResponse(response);
      }

      const latest = await getDefaultInstance(slug);
      return {
        success: true,
        data: toPluginState(slug, detail, latest ? { ...latest, enabled: false } : null),
      };
    } catch (error: any) {
      const normalized = toApiErrorPayload(error, 'UPDATE_ERROR', 'Failed to disable plugin');
      return {
        success: false,
        error: normalized,
      };
    }
  },

  installFromZip: (file: File): Promise<ApiResponse<{ slug: string; version: string }>> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/extensions/plugin/install', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  installBundleFromZip: (file: File): Promise<ApiResponse<any>> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/extensions/bundle/install', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  uninstall: (slug: string): Promise<ApiResponse<{ kind: 'plugin'; slug: string; uninstalled: boolean }>> =>
    apiClient.delete(`/extensions/plugin/${slug}`),

  restore: (slug: string): Promise<ApiResponse<{ kind: 'plugin'; slug: string; restored: boolean }>> =>
    apiClient.post(`/extensions/plugin/${slug}/restore`),

  purge: (slug: string): Promise<ApiResponse<{ kind: 'plugin'; slug: string; purged: boolean }>> =>
    apiClient.delete(`/extensions/plugin/${slug}/purge`),

  // ============================================================================
  // Instance Management API (Multi-instance support)
  // ============================================================================

  /** Get all instances for a plugin */
  getInstances: (slug: string, page = 1, limit = 20): Promise<ApiResponse<PageResult<PluginInstance>>> =>
    apiClient.get(`/extensions/plugin/${slug}/instances`, { params: { page, limit } }),

  /** Create a new instance for a plugin */
  createInstance: (
    slug: string,
    data: CreateInstanceRequest
  ): Promise<ApiResponse<PluginInstance>> =>
    apiClient.post(`/extensions/plugin/${slug}/instances`, data),

  /** Update an instance */
  updateInstance: (
    slug: string,
    installationId: string,
    data: UpdateInstanceRequest
  ): Promise<ApiResponse<PluginInstance>> =>
    apiClient.patch(`/extensions/plugin/${slug}/instances/${installationId}`, data),

  /** Delete (soft-delete) an instance */
  deleteInstance: (slug: string, installationId: string): Promise<ApiResponse<{
    pluginSlug: string;
    installationId: string;
    instanceKey: string;
    deleted: boolean;
  }>> =>
    apiClient.delete(`/extensions/plugin/${slug}/instances/${installationId}`),

};

// Upload API
export const uploadApi = {
  uploadProductImage: (file: File): Promise<ApiResponse<{ url: string }>> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/admin/products/upload-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  uploadAvatar: (file: File): Promise<ApiResponse<{ url: string }>> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/account/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Settings API
export const settingsApi = {
  getAll: (): Promise<ApiResponse<SystemSettingsMap>> =>
    apiClient.get('/admin/settings'),

  batchUpdate: (settings: SystemSettingsMap): Promise<ApiResponse<SystemSettingsMap>> =>
    apiClient.put('/admin/settings/batch', { settings }),
};

// ============================================================
// Staff Management (Admin RBAC)
// ============================================================

export interface StaffMembership {
  membershipId: string;
  userId: string;
  email: string;
  username: string;
  avatar?: string | null;
  accountRole: string;
  accountActive: boolean;
  emailVerified: boolean;
  adminRole: string;
  status: 'ACTIVE' | 'SUSPENDED';
  isOwner: boolean;
  extraPermissions: string[];
  revokedPermissions: string[];
  effectivePermissions: string[];
  createdAt: string;
  updatedAt: string;
  membershipCreatedByUserId?: string | null;
  membershipUpdatedByUserId?: string | null;
  accountCreatedAt: string;
  accountUpdatedAt: string;
}

export interface StaffRoleDefinition {
  role: string;
  label: string;
  permissions: string[];
}

export interface StaffPermissionCatalogGroup {
  group: string;
  label: string;
  permissions: Array<{
    key: string;
    label: string;
    description: string;
  }>;
}

export interface StaffAuditLogEntry {
  id: string;
  staffUserId: string;
  staffEmail: string;
  staffUsername?: string | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorUsername?: string | null;
  action: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface StaffMutationPayload {
  role: string;
  status?: 'ACTIVE' | 'SUSPENDED';
  isOwner?: boolean;
  extraPermissions?: string[];
  revokedPermissions?: string[];
}

export interface StaffCreatePayload extends StaffMutationPayload {
  email: string;
  username: string;
  password?: string;
}

export const staffApi = {
  getAll: (params: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    status?: string;
  } = {}): Promise<ApiResponse<PageResult<StaffMembership>>> => {
    const { page = 1, limit = 20, ...filters } = params;
    return apiClient.get('/admin/staff', { params: { page, limit, ...filters } });
  },

  getRoles: (): Promise<ApiResponse<StaffRoleDefinition[]>> =>
    apiClient.get('/admin/staff/roles'),

  getPermissions: (): Promise<ApiResponse<StaffPermissionCatalogGroup[]>> =>
    apiClient.get('/admin/staff/permissions'),

  getByUserId: (userId: string): Promise<ApiResponse<StaffMembership>> =>
    apiClient.get(`/admin/staff/${userId}`),

  getAuditLogs: (userId: string, page = 1, limit = 20): Promise<ApiResponse<PageResult<StaffAuditLogEntry>>> =>
    apiClient.get(`/admin/staff/${userId}/audit`, { params: { page, limit } }),

  create: (data: StaffCreatePayload): Promise<ApiResponse<StaffMembership>> =>
    apiClient.post('/admin/staff', data),

  update: (userId: string, data: StaffMutationPayload): Promise<ApiResponse<StaffMembership>> =>
    apiClient.patch(`/admin/staff/${userId}`, data),

  remove: (userId: string): Promise<ApiResponse<void>> =>
    apiClient.delete(`/admin/staff/${userId}`),

  resendInvite: (userId: string): Promise<ApiResponse<{ success: boolean }>> =>
    apiClient.post(`/admin/staff/${userId}/invite`, {}),
};

export default apiClient;
