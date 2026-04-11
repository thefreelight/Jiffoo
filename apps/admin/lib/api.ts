/**
 * Admin API Client
 * Uses unified AuthClient. 
 */

import {
  createAdminClient,
  getAdminClient,
  type ApiResponse,
  type CommercialPackageProjection,
  type ManagedPackageBrandingResponse,
  type ManagedPackageStatusResponse,
  type ListResult,
  type PageResult,
  type UserProfile,
  // Import DTO types
  type AdminProductListItemDTO,
  type AdminProductDetailDTO,
  type AdminOrderListItemDTO,
  type AdminOrderDetailDTO,
} from 'shared';
import type {
  PlatformConnectionPollRequest,
  PlatformConnectionStartRequest,
  PlatformConnectionStatus,
} from 'shared';

export type { ApiResponse, ListResult, PageResult, UserProfile };

import type {
  ProductForm,
  Product,
  Order,
  OrderDetail,
  ThemeMeta,
  ActiveTheme,
  PluginMetaWithState,
  PluginConfigMeta,
  PluginState,
  HealthMetricsResponse,
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

export interface ThemeTargetsResponse {
  targets: Array<'shop' | 'admin'>;
}

export type SystemSettingsMap = Record<string, unknown>;

export interface ProductStatsData {
  metrics: {
    totalProducts: number;
    activeProducts: number;
    lowStockProducts: number;
    outOfStockProducts: number;
    totalProductsTrend: number;
    activeProductsTrend: number;
    lowStockProductsTrend: number;
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

export interface InventoryStatsData {
  metrics: {
    totalAlerts: number;
    stockoutRisks: number;
    overstockItems: number;
    avgAccuracy: number;
    totalAlertsTrend: number;
    stockoutRisksTrend: number;
    overstockItemsTrend: number;
    avgAccuracyTrend: number;
  };
}

export interface InventoryDashboardData {
  alerts: {
    items: Array<{
      id: string;
      productId: string;
      productName?: string;
      variantId: string;
      variantName?: string | null;
      alertType: 'STOCKOUT_RISK' | 'OVERSTOCK' | 'REORDER_POINT';
      severity: 'HIGH' | 'MEDIUM' | 'LOW';
      status: 'ACTIVE' | 'DISMISSED' | 'RESOLVED';
      message: string;
      threshold: number | null;
      currentStock: number;
      recommendedOrder: number | null;
      resolvedAt: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  context: {
    productId: string | null;
    variantId: string | null;
  };
  accuracy: {
    avgAccuracy: number;
    avgMAPE: number;
    avgMAE: number;
    avgRMSE: number;
    totalForecasts: number;
    accuracyTrend: 'IMPROVING' | 'DECLINING' | 'STABLE';
    period: {
      startDate: string;
      endDate: string;
    };
  } | null;
  latestForecast: {
    id: string;
    productId: string;
    variantId: string;
    forecastDate: string;
    predictedDemand: number;
    confidence: number;
    method: 'MOVING_AVERAGE' | 'LINEAR_REGRESSION' | 'SEASONAL_DECOMPOSITION';
    seasonalFactors: {
      weeklyPattern: number[];
      monthlyPattern: number[];
      dayOfWeekMultipliers: Record<string, number>;
      holidayImpact: Record<string, number> | null;
    } | null;
    trendAnalysis: {
      dailyAverage: number;
      weeklyAverage: number;
      monthlyAverage: number;
      growthRate: number;
      trend: 'INCREASING' | 'DECREASING' | 'STABLE';
      volatility: number;
      confidence: number;
    };
    reorderPoint: {
      reorderPoint: number;
      safetyStock: number;
      averageDailyDemand: number;
      leadTime: number;
      maxDailyDemand: number;
      daysUntilStockout: number | null;
      recommendedOrderQuantity: number;
    };
    createdAt: string;
    updatedAt: string;
  } | null;
}

// Type definitions (Admin specific)
export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  role?: string;
}

export interface AccountProfile {
  id: string;
  email: string;
  username: string;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SourceChangeSummary {
  changedFields?: string[];
  [key: string]: unknown;
}

export interface ProductExternalSourceRecord {
  provider: string;
  installationId: string;
  storeId: string;
  externalProductCode: string;
  externalName: string | null;
  externalHash: string | null;
  sourceName: string | null;
  sourceDescription: string | null;
  sourceCategoryCode: string | null;
  sourceIsActive: boolean | null;
  sourcePayloadJson: Record<string, unknown> | null;
  sourcePayloadHash: string | null;
  syncStatus: string;
  sourceUpdatedAt: string | null;
  lastSyncedAt: string | null;
  lastComparedAt: string | null;
  lastApprovedAt: string | null;
  hasPendingChange: boolean;
  pendingChangeSummary: SourceChangeSummary | null;
}

export interface VariantExternalSourceRecord {
  coreVariantId: string;
  coreSkuCode: string | null;
  externalVariantCode: string;
  externalProductCode: string;
  externalHash: string | null;
  sourceVariantName: string | null;
  sourceSkuCode: string | null;
  sourceCostPrice: number | null;
  sourceIsActive: boolean | null;
  sourceAttributesJson: Record<string, unknown> | null;
  sourcePayloadHash: string | null;
  syncStatus: string;
  sourceUpdatedAt: string | null;
  lastSyncedAt: string | null;
  lastComparedAt: string | null;
  lastApprovedAt: string | null;
  hasPendingChange: boolean;
  pendingChangeSummary: SourceChangeSummary | null;
}

export interface ProductExternalSourceDetails {
  productId: string;
  productName: string;
  sourceProvider: string | null;
  linked: boolean;
  product: ProductExternalSourceRecord | null;
  variants: VariantExternalSourceRecord[];
}

export interface ProductSourceAckResult {
  productId: string;
  acknowledgedAt: string;
  productLinksUpdated: number;
  variantLinksUpdated: number;
}

export interface VariantSourceAckResult {
  productId: string;
  variantId: string;
  acknowledgedAt: string;
  variantLinksUpdated: number;
}

// Lazy initialize API client
let _apiClient: ReturnType<typeof createAdminClient> | null = null;

const getApiClient = () => {
  if (!_apiClient) {
    _apiClient = createAdminClient({
      storageType: 'hybrid',
      customConfig: {
        // Theme App ZIP installs can take longer than typical API calls (upload + unzip + validation)
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
  login: (email: string, password: string) =>
    apiClient.login({ email, password }),

  me: (): Promise<ApiResponse<UserProfile>> => apiClient.getProfile(),

  logout: () => apiClient.logout(),

  refreshToken: () => apiClient.refreshAuthToken(),

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
  getAll: (page = 1, limit = 10, search?: string): Promise<ApiResponse<PageResult<AdminProductListItemDTO>>> =>
    apiClient.get('/admin/products', { params: { page, limit, search } }),

  getStats: (params?: {
    search?: string;
    categoryId?: string;
    lowStockThreshold?: number;
  }): Promise<ApiResponse<ProductStatsData>> =>
    apiClient.get('/admin/products/stats', { params }),

  getById: (id: string): Promise<ApiResponse<AdminProductDetailDTO>> => apiClient.get(`/admin/products/${id}`),

  getExternalSource: (id: string): Promise<ApiResponse<ProductExternalSourceDetails>> => apiClient.get(`/admin/products/${id}/external-source`),

  acknowledgeSourceChanges: (id: string): Promise<ApiResponse<ProductSourceAckResult>> => apiClient.post(`/admin/products/${id}/ack-source-change`),

  acknowledgeVariantSourceChange: (id: string, variantId: string): Promise<ApiResponse<VariantSourceAckResult>> =>
    apiClient.post(`/admin/products/${id}/variants/${variantId}/ack-source-change`),

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
  getMetrics: (): Promise<ApiResponse<HealthMetricsResponse>> =>
    apiClient.get('/admin/health/metrics'),

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

export type OfficialCatalogInstallState = 'not_installed' | 'installed' | 'enabled' | 'active';
export type OfficialCatalogReleaseStatus = 'published' | 'catalog-only' | 'offline';
export type OfficialCatalogPricingModel = 'free' | 'one_time' | 'subscription';

export interface OfficialCatalogItem {
  slug: string;
  name: string;
  kind: 'theme' | 'plugin';
  listingDomain?: 'app_marketplace' | 'goods_marketplace' | 'merchant_store';
  listingKind?: 'theme' | 'plugin';
  providerType?: 'platform' | 'developer' | 'vendor' | 'merchant';
  version: string;
  author: string;
  description: string;
  category: string;
  deliveryMode: 'package-managed' | 'service-managed';
  paymentMode?: 'platform_collect' | 'merchant_collect';
  settlementTargetType?: 'platform' | 'developer' | 'vendor' | 'merchant' | 'none';
  settlementTargetId?: string | null;
  target?: 'shop' | 'admin';
  pricingModel: OfficialCatalogPricingModel;
  price: number;
  currency: string;
  installState: OfficialCatalogInstallState;
  releaseStatus: OfficialCatalogReleaseStatus;
  source: 'builtin' | 'installed' | 'local-zip' | 'official-market' | 'catalog';
  availableInMarket: boolean;
  marketError?: string;
  rating?: number;
  downloads?: number;
  thumbnailUrl?: string;
  compatibility?: string;
  screenshots?: string[];
  configRequired?: boolean;
  configReady?: boolean;
  missingConfigFields?: string[];
  solutionOffer?: {
    offerKind: 'theme_first_solution';
    packageId?: string | null;
    role: 'primary_theme' | 'included_theme' | 'companion_plugin';
    badgeLabel?: string | null;
    ctaLabel?: string | null;
    summary?: string | null;
  } | null;
  solutionPackage?: {
    offerKind: 'theme_first_solution';
    packageId: string;
    packageName: string;
    displayBrandName: string;
    displaySolutionName: string;
    packageStatus: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
    role: 'primary_theme' | 'included_theme' | 'companion_plugin';
    defaultTheme: boolean;
    setupStepCount: number;
  } | null;
}

export interface OfficialCatalogResponse {
  items: OfficialCatalogItem[];
  marketOnline: boolean;
  marketError?: string;
  officialMarketOnly: boolean;
  managedPackage?: CommercialPackageProjection | null;
  generatedAt: string;
}

export interface InstallOfficialExtensionRequest {
  version?: string;
  kind: 'plugin' | 'theme-shop' | 'theme-admin' | 'theme-app-shop' | 'theme-app-admin';
}

export interface InstallOfficialExtensionResult {
  kind: string;
  slug: string;
  version: string;
  source: string;
  fsPath?: string;
}

export interface ActivateManagedPackageRequest {
  activationCode: string;
}

export type {
  PlatformConnectionStatus,
};

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

export const marketApi = {
  getOfficialCatalog: (): Promise<ApiResponse<OfficialCatalogResponse>> =>
    apiClient.get('/admin/market/official-catalog'),

  getHealth: (): Promise<ApiResponse<{
    officialMarketOnly: boolean;
    signatureMode: string;
    officialKeyPresent: boolean;
    marketApiUrl: string;
    marketOnline: boolean;
    marketLatencyMs: number;
    marketStatus?: number;
    marketError?: string;
  }>> =>
    apiClient.get('/admin/market/health'),

  installOfficialExtension: (
    slug: string,
    data: InstallOfficialExtensionRequest
  ): Promise<ApiResponse<InstallOfficialExtensionResult>> =>
    apiClient.post(`/admin/market/extensions/${slug}/install`, data),
};

export const managedPackageApi = {
  getBranding: (): Promise<ApiResponse<ManagedPackageBrandingResponse>> =>
    apiClient.get('/admin/commercial-package/branding'),

  getStatus: (): Promise<ApiResponse<ManagedPackageStatusResponse>> =>
    apiClient.get('/admin/commercial-package/status'),

  activate: (data: ActivateManagedPackageRequest): Promise<ApiResponse<ManagedPackageStatusResponse>> =>
    apiClient.post('/admin/commercial-package/activate', data),

  provision: (): Promise<ApiResponse<ManagedPackageStatusResponse>> =>
    apiClient.post('/admin/commercial-package/provision', {}),
};

export const platformConnectionApi = {
  getStatus: (): Promise<ApiResponse<PlatformConnectionStatus>> =>
    apiClient.get('/admin/platform/connection/status'),

  start: (data: Omit<PlatformConnectionStartRequest, 'instanceKey'>): Promise<ApiResponse<PlatformConnectionStatus>> =>
    apiClient.post('/admin/platform/connection/start', data),

  poll: (data: PlatformConnectionPollRequest): Promise<ApiResponse<PlatformConnectionStatus>> =>
    apiClient.post('/admin/platform/connection/poll', data),

  complete: (data: { deviceCode: string; accountEmail: string; accountName?: string }): Promise<ApiResponse<PlatformConnectionStatus>> =>
    apiClient.post('/admin/platform/connection/complete', data),

  bindTenant: (): Promise<ApiResponse<PlatformConnectionStatus>> =>
    apiClient.post('/admin/platform/connection/bind-tenant', {}),

  disconnect: (): Promise<ApiResponse<PlatformConnectionStatus>> =>
    apiClient.post('/admin/platform/connection/disconnect', {}),
};

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

// Themes Management API
export const themesApi = {
  getTargets: (): Promise<ApiResponse<ThemeTargetsResponse>> =>
    apiClient.get('/admin/themes'),

  getInstalled: (
    target: 'shop' | 'admin' = 'shop',
    page = 1,
    limit = 20
  ): Promise<ApiResponse<PageResult<ThemeMeta>>> =>
    apiClient.get(`/admin/themes/${target}/installed`, { params: { page, limit } }),

  getActive: (target: 'shop' | 'admin' = 'shop'): Promise<ApiResponse<ActiveTheme>> =>
    apiClient.get(`/admin/themes/${target}/active`),

  activate: (
    slug: string,
    target: 'shop' | 'admin' = 'shop',
    config?: Record<string, unknown>,
    type?: 'pack' | 'app'
  ): Promise<ApiResponse<ActiveTheme>> => {
    const body: Record<string, unknown> = {};
    if (config) body.config = config;
    if (type) body.type = type;
    return apiClient.post(`/admin/themes/${target}/${slug}/activate`, body);
  },

  rollback: (target: 'shop' | 'admin' = 'shop'): Promise<ApiResponse<ActiveTheme>> =>
    apiClient.post(`/admin/themes/${target}/rollback`, {}),

  updateConfig: (config: any, target: 'shop' | 'admin' = 'shop'): Promise<ApiResponse<ActiveTheme>> =>
    apiClient.put(`/admin/themes/${target}/config`, config),

  installFromZip: (target: 'shop' | 'admin', file: File): Promise<ApiResponse<{ slug: string; version: string }>> => {
    const formData = new FormData();
    formData.append('file', file);
    const kind = `theme-${target}`;
    return apiClient.post(`/extensions/${kind}/install`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  installThemeAppFromZip: (target: 'shop' | 'admin', file: File): Promise<ApiResponse<{ slug: string; version: string }>> => {
    const formData = new FormData();
    formData.append('file', file);
    const kind = `theme-app-${target}`;
    return apiClient.post(`/extensions/${kind}/install`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  uninstall: (target: 'shop' | 'admin', slug: string, type: 'pack' | 'app' = 'pack'): Promise<ApiResponse<void>> => {
    const kind = type === 'app' ? `theme-app-${target}` : `theme-${target}`;
    return apiClient.delete(`/extensions/${kind}/${slug}`);
  },
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

// Upgrade API
export const upgradeApi = {
  getVersion: (): Promise<ApiResponse<{
    currentVersion: string;
    latestVersion: string;
    updateAvailable: boolean;
    releaseNotes?: string | null;
    changelogUrl?: string | null;
    sourceArchiveUrl?: string | null;
    releaseDate?: string | null;
    releaseChannel: 'stable' | 'prerelease';
    deploymentMode: 'single-host' | 'docker-compose' | 'k8s' | 'unsupported';
    deploymentModeSource: 'env' | 'k8s-signals' | 'compose-signals' | 'single-host-signals' | 'fallback';
    deploymentModeReason?: string | null;
    oneClickUpgradeSupported: boolean;
    updateSource: 'env-manifest' | 'default-public-manifest' | 'local-fallback';
    manifestUrl?: string | null;
    manifestStatus: 'available' | 'missing' | 'unreachable' | 'invalid';
    manifestError?: string | null;
    minimumAutoUpgradableVersion?: string | null;
    requiresManualIntervention?: boolean;
    recoveryMode: 'automatic-recovery';
    manualGuidance?: string | null;
  }>> =>
    apiClient.get('/upgrade/version'),

  getStatus: (): Promise<ApiResponse<{
    status: string;
    progress: number;
    currentStep?: string | null;
    error?: string | null;
  }>> =>
    apiClient.get('/upgrade/status'),

  perform: (targetVersion: string): Promise<ApiResponse<{
    targetVersion: string;
    started: boolean;
    completed: boolean;
    completedAt?: string | null;
  }>> =>
    apiClient.post('/upgrade/perform', { targetVersion }),

  check: (targetVersion: string): Promise<ApiResponse<{
    compatible: boolean;
    currentVersion: string;
    targetVersion: string;
    issues: string[];
    warnings: string[];
  }>> => apiClient.post('/upgrade/check', { targetVersion }),

  backup: (): Promise<ApiResponse<{ id: string; version: string; createdAt: string; size: number }>> =>
    apiClient.post('/upgrade/backup', {}),
};

// Settings API
export const settingsApi = {
  getAll: (): Promise<ApiResponse<SystemSettingsMap>> =>
    apiClient.get('/admin/settings'),

  batchUpdate: (settings: SystemSettingsMap): Promise<ApiResponse<SystemSettingsMap>> =>
    apiClient.put('/admin/settings/batch', { settings }),
};

// Inventory Forecasting API
export const inventoryApi = {
  getDashboard: (params: {
    page?: number;
    limit?: number;
    status?: 'ACTIVE' | 'DISMISSED' | 'RESOLVED';
    productId?: string;
    variantId?: string;
  }): Promise<ApiResponse<InventoryDashboardData>> =>
    apiClient.get('/admin/inventory/dashboard', { params }),

  getStats: (): Promise<ApiResponse<InventoryStatsData>> =>
    apiClient.get('/admin/inventory/stats'),

  generateForecast: (data: {
    productId: string;
    variantId: string;
    days?: number;
    historicalDays?: number;
  }): Promise<ApiResponse<any>> => apiClient.post('/admin/inventory/forecast', data),
  recomputeAll: (data?: {
    days?: number;
    historicalDays?: number;
  }): Promise<ApiResponse<any>> => apiClient.post('/admin/inventory/recompute-all', data || {}),
  checkAndCreateAlerts: (productId: string, variantId: string): Promise<ApiResponse<any>> =>
    apiClient.post('/admin/inventory/alerts/check', { productId, variantId }),

  dismissAlert: (id: string, reason?: string): Promise<ApiResponse<any>> =>
    apiClient.put(`/admin/inventory/alerts/${id}/dismiss`, { reason }),

  resolveAlert: (id: string): Promise<ApiResponse<any>> =>
    apiClient.put(`/admin/inventory/alerts/${id}/resolve`),

  updateAlertStatus: (id: string, status: 'ACTIVE' | 'DISMISSED' | 'RESOLVED', reason?: string): Promise<ApiResponse<any>> =>
    apiClient.put(`/admin/inventory/alerts/${id}/status`, { status, reason }),

  recordAccuracy: (forecastId: string, actualDemand: number): Promise<ApiResponse<any>> =>
    apiClient.post(`/admin/inventory/accuracy/${forecastId}`, { actualDemand }),
};

// SEO Redirect types
export interface SeoRedirect {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
  isActive: boolean;
  hitCount: number;
}

// Promotions/Discounts API
export interface Promotion {
  id: string;
  code: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'BUY_X_GET_Y' | 'FREE_SHIPPING';
  value: number;
  description?: string;
  minAmount?: number;
  maxUses?: number;
  usedCount: number;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  stackable: boolean;
  createdAt: string;
  updatedAt: string;
}

// SEO Redirect API
export const redirectsApi = {
  getAll: (page = 1, limit = 10, search?: string): Promise<ApiResponse<PageResult<SeoRedirect>>> =>
    apiClient.get('/api/seo/redirects', { params: { page, limit, search } }),

  getById: (id: string): Promise<ApiResponse<SeoRedirect>> =>
    apiClient.get(`/api/seo/redirects/${id}`),

  create: (data: { fromPath: string; toPath: string; statusCode?: number; isActive?: boolean }): Promise<ApiResponse<SeoRedirect>> =>
    apiClient.post('/api/seo/redirects', data),

  update: (id: string, data: Partial<SeoRedirect>): Promise<ApiResponse<SeoRedirect>> =>
    apiClient.put(`/api/seo/redirects/${id}`, data),

  delete: (id: string): Promise<ApiResponse<void>> =>
    apiClient.delete(`/api/seo/redirects/${id}`),
};

// SEO Audit types
export interface SeoIssue {
  id: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  entity: {
    type: 'product' | 'category';
    id: string;
    name: string;
    slug: string;
  };
  recommendation?: string;
}

export interface AuditSummary {
  totalIssues: number;
  critical: number;
  warnings: number;
  info: number;
  issuesByType: Record<string, number>;
}

export interface AuditResult {
  summary: AuditSummary;
  issues: SeoIssue[];
  timestamp: string;
}

export interface AuditStats {
  products: {
    total: number;
    missingMetaTitle: number;
    missingMetaDescription: number;
    missingCanonicalUrl: number;
    missingStructuredData: number;
  };
  categories: {
    total: number;
    missingMetaTitle: number;
    missingMetaDescription: number;
    missingCanonicalUrl: number;
    missingStructuredData: number;
  };
}

// SEO Audit API
export const seoAuditApi = {
  runAudit: (options?: {
    includeProducts?: boolean;
    includeCategories?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<AuditResult>> =>
    apiClient.get('/api/seo/audit', { params: options }),

  getStats: (): Promise<ApiResponse<AuditStats>> =>
    apiClient.get('/api/seo/audit/stats'),
};

export interface PromotionForm {
  code: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'BUY_X_GET_Y' | 'FREE_SHIPPING';
  value: number;
  description?: string;
  minAmount?: number;
  maxUses?: number;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
  stackable?: boolean;
  productIds?: string[];
  customerGroups?: string[];
}

export const promotionsApi = {
  getAll: (page = 1, limit = 10, search?: string, type?: string): Promise<ApiResponse<PageResult<Promotion>>> =>
    apiClient.get('/admin/discounts', { params: { page, limit, search, type } }),

  getById: (id: string): Promise<ApiResponse<Promotion>> =>
    apiClient.get(`/admin/discounts/${id}`),

  create: (data: PromotionForm): Promise<ApiResponse<Promotion>> =>
    apiClient.post('/admin/discounts', data),

  update: (id: string, data: Partial<PromotionForm>): Promise<ApiResponse<Promotion>> =>
    apiClient.put(`/admin/discounts/${id}`, data),

  delete: (id: string): Promise<ApiResponse<void>> =>
    apiClient.delete(`/admin/discounts/${id}`),
};

// Errors API
export const errorsApi = {
  getAll: (params: {
    page?: number;
    limit?: number;
    search?: string;
    severity?: string;
    resolved?: boolean;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortOrder?: string;
  } = {}): Promise<ApiResponse<PageResult<any>>> => {
    const { page = 1, limit = 10, ...filters } = params;
    return apiClient.get('/api/admin/errors', { params: { page, limit, ...filters } });
  },

  getById: (id: string): Promise<ApiResponse<any>> =>
    apiClient.get(`/api/admin/errors/${id}`),

  resolve: (id: string): Promise<ApiResponse<any>> =>
    apiClient.patch(`/api/admin/errors/${id}/resolve`, { resolved: true }),

  unresolve: (id: string): Promise<ApiResponse<any>> =>
    apiClient.patch(`/api/admin/errors/${id}/resolve`, { resolved: false }),

  getStats: (): Promise<ApiResponse<any>> =>
    apiClient.get('/api/admin/errors/stats'),

  getTrends: (timeRange?: string): Promise<ApiResponse<any>> =>
    apiClient.get('/api/admin/errors/trends', { params: { timeRange } }),
};

export default apiClient;
