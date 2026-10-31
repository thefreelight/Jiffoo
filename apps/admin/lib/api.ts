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
  parsePluginConfigSchema,
  validatePluginConfig,
} from 'shared';

export type { ApiResponse, ListResult, PageResult, UserProfile };

export type AdminNotification = {
  id: string;
  type: string;
  channel: string;
  recipientUserId: string | null;
  toAddress: string;
  locale: string;
  subject: string;
  html: string;
  text: string;
  status: 'PENDING' | 'SENDING' | 'SENT' | 'FAILED';
  attempts: number;
  nextAttemptAt: string;
  lastError: string | null;
  providerSlug: string | null;
  providerMessageId: string | null;
  relatedType: string | null;
  relatedId: string | null;
  resentFromId: string | null;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
};

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

  constructor(message: string, code: string = 'ERROR', details?: unknown, readonly status: number = 0,
    readonly source: 'core' | 'plugin-business' = 'core') {
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
  }

  throw new AdminApiError(message, code, details, response.httpStatus, response.pluginBusinessError ? 'plugin-business' : 'core');
}

export interface DashboardData {
  today: { paidSales: number; orders: number; newCustomers: number };
  yesterday: { paidSales: number; orders: number; newCustomers: number };
  attention: { paymentReviewCount: number; toShipCount: number };
  dailySales: Array<{ date: string; paidSales: number; orders: number }>;
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
  recentOrders: Array<Omit<Order, 'itemQuantitySum'>>;
}

export type SystemSettingsMap = Record<string, unknown>;

export interface ProductStatsData {
  statusCounts: { all: number; active: number; inactive: number; outOfStock: number };
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
  statusCounts: Record<string, number>;
  paymentReviewCount: number;
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
  customerId?: string;
  categoryId?: string;
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  role?: string;
  productType?: string;
  paymentStatus?: 'PAID' | 'UNPAID' | 'REFUNDED';
  paymentReview?: 'required';
  sortBy?: 'createdAt' | 'totalAmount' | 'name' | 'updatedAt' | 'price' | 'stock';
  sortOrder?: 'asc' | 'desc';
  createdFrom?: string;
  createdTo?: string;
}

export interface AccountProfile {
  id: string;
  email: string;
  username: string;
  locale: 'en' | 'zh-Hans' | 'zh-Hant' | null;
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
  invite: async (token: string) => unwrapApiResponse(await apiClient.get<{ email: string; storeName: string }>('/auth/invite?token=' + encodeURIComponent(token))),
  inspectReset: async (token: string) => unwrapApiResponse(await apiClient.get<{ valid: boolean }>('/auth/reset-password?token=' + encodeURIComponent(token))),
  forgotPassword: (email: string): Promise<ApiResponse<void>> =>
    apiClient.forgotPassword(email, 'admin'),

  resetPassword: (data: { token: string; newPassword: string }): Promise<ApiResponse<void>> =>
    apiClient.resetPassword(data),

  acceptInvite: async (token: string, password: string): Promise<ApiResponse<{ completed: boolean }>> => {
    const response = await apiClient.post<{ completed: boolean }>('/auth/accept-invite', { token, password });
    unwrapApiResponse(response);
    return response;
  },

  login: async (identifier: string, password: string) => {
    const response = await apiClient.post<{
      access_token: string;
      token_type: string;
      expires_in: number;
      refresh_token?: string;
    }>('/auth/login', { identifier, password, surface: 'admin' }, { withCredentials: true });
    if (response.success && response.data?.access_token) {
      apiClient.setToken(response.data.access_token);
      if (response.data.refresh_token) {
        (apiClient as unknown as { setRefreshToken: (token: string) => void })
          .setRefreshToken(response.data.refresh_token);
      }
    }
    return response;
  },

  me: (): Promise<ApiResponse<UserProfile>> => apiClient.get('/auth/me'),

  logout: async () => {
    const response = await apiClient.post<void>('/auth/logout', {}, { withCredentials: true });
    unwrapApiResponse(response);
    window.dispatchEvent(new Event('jiffoo:identity-changing'));
    apiClient.clearAuth();
    return response;
  },

  refreshToken: () => apiClient.post('/auth/refresh', {
    refresh_token: apiClient.getRefreshToken(),
  }, { withCredentials: true }),

  changePassword: (currentPassword: string, newPassword: string): Promise<ApiResponse<{ passwordChanged: boolean; changedAt: string; access_token: string; refresh_token: string }>> =>
    apiClient.post('/auth/change-password', { currentPassword, newPassword }),
};

export const accountApi = {
  getProfile: (): Promise<ApiResponse<AccountProfile>> =>
    apiClient.get('/account/profile'),

  updateProfile: (data: { username?: string; avatar?: string; locale?: string }): Promise<ApiResponse<AccountProfile>> =>
    apiClient.put('/account/profile', data),
  removeAvatar: (): Promise<ApiResponse<AccountProfile>> => apiClient.delete('/account/avatar'),

  updateEmail: (newEmail: string, currentPassword: string): Promise<ApiResponse<AccountProfile>> =>
    apiClient.put('/account/email', { newEmail, currentPassword }),
};

// Products API
export type ProductSelection = { mode: 'ids'; ids: string[] } | { mode: 'filter'; filter: Pick<PaginationParams, 'search' | 'status' | 'categoryId' | 'productType'>; excludeIds?: string[] };
export type BulkPriceMode = { mode: 'amount'; value: string } | { mode: 'percentage'; value: string };
export type BulkPriceRequest = {
  selection: ProductSelection;
  salePrice?: BulkPriceMode;
  compareAtPrice?: BulkPriceMode;
  clearCompareAtPrice?: boolean;
  dryRun?: boolean;
};
export type BulkPriceSkipReason = 'PRICE_NOT_REPRESENTABLE' | 'NEGATIVE_PRICE' | 'COMPARE_AT_BELOW_SALE' | 'COMPARE_AT_MISSING' | 'CHANGED_CONCURRENTLY';
export interface BulkPriceChange {
  variantId: string;
  productId: string;
  productName: string;
  previousSalePrice: number;
  salePrice: number;
  previousCompareAtPrice: number | null;
  compareAtPrice: number | null;
}
export interface BulkPriceVariantSkip {
  variantId: string;
  productId: string;
  productName: string;
  reason: BulkPriceSkipReason;
}
export interface BulkPriceResult {
  matched: number;
  processed: number;
  skippedCount: number;
  skipped: { id: string; name: string; reason: string }[];
  variantsProcessed: number;
  variantsSkippedCount: number;
  variantsSkipped: BulkPriceVariantSkip[];
  changes: BulkPriceChange[];
}
export interface ProductBulkResult { matched: number; processed: number; skippedCount: number; skipped: { id: string; name: string; reason: 'HAS_ORDERS' | 'NOT_FOUND' }[]; processedPreview: { id: string; name: string }[] }
export type ProductBulkAction = 'activate' | 'deactivate' | 'setCategory' | 'delete';
async function exportCsv(path: string, data: unknown, locale: string) {
  return unwrapApiResponse(await apiClient.request<{ blob: Blob; filename: string; count: number; skipped: number }>({ method: 'POST', url: path, data, headers: { 'Accept-Language': locale }, responseType: 'blob',
    transformResponse: [(blob: Blob, headers: Record<string, string>, status?: number) => status === 200
      ? { success: true, data: { blob, filename: /filename="([^"]+)"/.exec(headers['content-disposition'] ?? '')?.[1], count: Number(headers['x-product-count']), skipped: Number(headers['x-product-skipped']) } }
      : { success: false, error: { code: 'REQUEST_FAILED', message: 'Request failed' } }],
  }));
}
export const productsApi = {
  neighbors: (id: string, params: ReturnType<typeof import('./product-list-state').productListQuery>) => apiClient.get<{ position: number | null; total: number; previousId: string | null; nextId: string | null }>(`/admin/products/${id}/neighbors`, { params }),
  bulk: async (action: ProductBulkAction, selection: ProductSelection, options: { dryRun?: boolean; categoryId?: string | null } = {}) => unwrapApiResponse(await apiClient.post<ProductBulkResult>('/admin/products/bulk', { action, selection, ...options })),
  bulkPrices: async (body: BulkPriceRequest) => unwrapApiResponse(await apiClient.post<BulkPriceResult>('/admin/products/bulk-prices', body)),
  export: (selection: ProductSelection, sort: Pick<PaginationParams, 'sortBy' | 'sortOrder'>, locale: string) => exportCsv('/admin/products/export', { selection, ...sort }, locale),
  getAll: (
    page = 1,
    limit = 20,
    search?: string,
    productType?: string,
    status?: string,
    categoryId?: string,
    sort: Pick<PaginationParams, 'sortBy' | 'sortOrder'> = {}
  ): Promise<ApiResponse<PageResult<AdminProductListItemDTO>>> =>
    apiClient.get('/admin/products', { params: { page, limit, search, productType, status, categoryId, ...sort } }),

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
export type OrderPrintSelection = { mode: 'ids'; ids: string[] } | { mode: 'filter'; filter: PaginationParams; excludeIds?: string[] };
export interface OrderPrintCustomer { email: string | null; username: string | null; displayName: string | null }
export interface OrderPrintAddress {
  firstName: string; lastName: string; phone: string | null; email: string | null;
  addressLine1: string; addressLine2: string | null; city: string; state: string | null; postalCode: string | null; country: string;
}
export interface OrderPrintItem { productName: string; variantName: string; quantity: number; unitPrice: number; lineTotal: number }
export interface OrderPrintAmounts { subtotalAmount: number; shippingAmount: number; taxAmount: number; taxInclusive: boolean; totalAmount: number }
export interface OrderPrintShipment { carrier: string | null; trackingNumber: string | null; shippedAt: string | null }
export interface OrderPrintOrder {
  orderNumber: string; status: string; paymentStatus: string | null; paymentMethod: string | null;
  createdAt: string; currency: string; customer: OrderPrintCustomer; shippingAddress: OrderPrintAddress | null;
  items: OrderPrintItem[]; amounts: OrderPrintAmounts; shipment: OrderPrintShipment | null; paymentRequiresReview: boolean;
}
export interface OrderPrintResult { matched: number; truncated: boolean; orders: OrderPrintOrder[] }
export interface OrderPrintRequest { selection: OrderPrintSelection; sort?: { sortBy: 'createdAt' | 'totalAmount'; sortOrder: 'asc' | 'desc' } }
export const ordersApi = {
  neighbors: (id: string, params: import('./order-list-state').OrderListQuery) => apiClient.get<{ position: number | null; total: number; previousId: string | null; nextId: string | null }>(`/admin/orders/${id}/neighbors`, { params }),
  getAll: (page = 1, limit = 20, status?: string, search?: string, paymentStatus?: PaginationParams['paymentStatus'], paymentReview?: PaginationParams['paymentReview'], options: Pick<PaginationParams, 'sortBy' | 'sortOrder' | 'createdFrom' | 'createdTo' | 'customerId'> = {}): Promise<ApiResponse<PageResult<AdminOrderListItemDTO>>> =>
    apiClient.get('/admin/orders', { params: { page, limit, status, search, paymentStatus, paymentReview, ...options } }),

  export: async (selection: { mode: 'ids'; ids: string[] } | { mode: 'filter'; filter: PaginationParams; excludeIds?: string[] }, sort: Pick<PaginationParams, 'sortBy' | 'sortOrder'>, locale: string) => {
    return exportCsv('/admin/orders/export', { selection, ...sort }, locale);
  },

  print: async (body: OrderPrintRequest) => unwrapApiResponse(await apiClient.post<OrderPrintResult>('/admin/orders/print', body)),

  getStats: (): Promise<ApiResponse<OrderStatsData>> =>
    apiClient.get('/admin/orders/stats'),

  getById: (id: string): Promise<ApiResponse<AdminOrderDetailDTO>> => apiClient.get(`/admin/orders/${id}`),

  updateItemFulfillment: (
    id: string,
    itemId: string,
    data: { fulfillmentStatus?: string; fulfillmentData?: Record<string, unknown> | null }
  ): Promise<ApiResponse<AdminOrderDetailDTO>> =>
    apiClient.put(`/admin/orders/${id}/items/${itemId}/fulfillment`, data),

  recordManualPayment: (id: string, reference: string): Promise<ApiResponse<OrderDetail>> =>
    apiClient.post(`/admin/orders/${id}/record-manual-payment`, { reference }),
  resolvePaymentReview: (id: string, paymentId: string, outcome: 'PAID' | 'NOT_CHARGED', reference: string): Promise<ApiResponse<AdminOrderDetailDTO>> =>
    apiClient.post(`/admin/orders/${id}/${outcome === 'PAID' ? 'confirm-review-payment' : 'close-review-payment'}`, { paymentId, reference }),

  shipOrder: (id: string, data: {
    carrier: string;
    trackingNumber: string;
    items?: Array<{ orderItemId: string; quantity: number }>
  }): Promise<ApiResponse<OrderDetail>> =>
    apiClient.post(`/admin/orders/${id}/ship`, data),

  deliverOrder: (id: string): Promise<ApiResponse<OrderDetail>> =>
    apiClient.post(`/admin/orders/${id}/deliver`, {}),

  cancelOrder: (id: string, cancelReason: string): Promise<ApiResponse<OrderDetail>> =>
    apiClient.post(`/admin/orders/${id}/cancel`, { cancelReason }),

  refundOrder: (id: string, data: { reason?: string; idempotencyKey: string; reference: string }): Promise<ApiResponse<OrderDetail>> =>
    apiClient.post(`/admin/orders/${id}/refund`, data),
  resolveRefundRequiredPayment: (id: string, data: { paymentId: string; providerPaymentId: string; idempotencyKey: string; reference: string }): Promise<ApiResponse<OrderDetail>> =>
    apiClient.post(`/admin/orders/${id}/refund-required-payment`, data),
};

// Users API
export const usersApi = {
  getAll: (params: import('./customer-list-state').CustomerQuery = {}): Promise<ApiResponse<PageResult<import('./types').Customer> & { statusCounts: { all: number; active: number; inactive: number } }>> => {
    return apiClient.get('/admin/users', { params });
  },
  neighbors: (id: string, params: import('./customer-list-state').CustomerQuery) => apiClient.get<{ position: number | null; total: number; previousId: string | null; nextId: string | null }>(`/admin/users/${id}/neighbors`, { params }),
  export: (selection: { mode: 'ids'; ids: string[] } | { mode: 'filter'; filters: import('./customer-list-state').CustomerQuery; excludedIds?: string[] }, sort: Pick<import('./customer-list-state').CustomerQuery, 'sortBy' | 'sortOrder'>, locale: string) => exportCsv('/admin/users/export', { selection, ...sort }, locale),

  getStats: (): Promise<ApiResponse<UserStatsData>> =>
    apiClient.get('/admin/users/stats'),

  getById: (id: string): Promise<ApiResponse<import('./types').CustomerDetail>> => apiClient.get(`/admin/users/${id}`),

  create: (data: {
    email: string;
    password: string;
    username?: string;
    role?: string;
  }): Promise<ApiResponse<UserProfile>> => apiClient.post('/admin/users', data),

  update: (id: string, data: {
    username?: string;
    isActive?: boolean;
  }): Promise<ApiResponse<UserProfile>> => apiClient.put(`/admin/users/${id}`, data),

  delete: (id: string): Promise<ApiResponse<void>> => apiClient.delete(`/admin/users/${id}`),

  generateResetLink: (id: string): Promise<ApiResponse<{ link: string }>> =>
    apiClient.post(`/admin/customers/${id}/password-reset-link`, {}),
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
  lastFailureAt?: string | null;
  lastFailureMessage?: string | null;
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
  if (!configSchema) return { configRequired: false, configReady: true, missingConfigFields: [] };
  const { schema } = parsePluginConfigSchema(configSchema);
  if (!schema) return { configRequired: false, configReady: false, missingConfigFields: [] };
  const current = { ...config };
  for (const [name, field] of Object.entries(schema.properties)) {
    if (field.sensitive && configMeta?.secretFields?.[name]?.configured && !current[name]) current[name] = 'configured';
  }
  const missingConfigFields = validatePluginConfig(schema, current)
    .filter((issue) => issue.message === 'Required field is missing')
    .map((issue) => issue.path.slice('config.'.length));
  return { configRequired: Boolean(schema.required?.length), configReady: !missingConfigFields.length, missingConfigFields };
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

  const configSchema = parsedManifest?.configSchema as Record<string, any> | undefined;
  const config = (instance?.config || {}) as Record<string, any>;
  const readiness = evaluateConfigReadiness(configSchema, config, instance?.configMeta);

  return {
    slug,
    publisherId: detail?.publisherId ?? null,
    packageState: detail?.packageState,
    uninstalled: Boolean(detail?.deletedAt),
    declaredCapabilities: parsedManifest?.contracts?.map((contract: { name: string }) => contract.name) ?? [],
    lastFailureAt: detail?.lastFailureAt ?? null,
    lastFailureMessage: detail?.lastFailureMessage ?? null,
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
    trustLevel: detail?.trustLevel,
    signingRoot: detail?.signingRoot,
    source: detail?.source || 'installed',
  } as PluginState;
}

async function fetchPluginDetail(slug: string): Promise<any> {
  const response = await apiClient.get(`/extensions/plugin/${slug}`) as ApiResponse<any>;
  if (!response.success) {
    const message = response.error?.message || `Plugin "${slug}" not found`;
    const code = response.error?.code || 'NOT_FOUND';
    throw new AdminApiError(message, code, response.error?.details, response.httpStatus);
  }
  return response.data || {};
}

async function fetchPluginInstances(slug: string): Promise<PluginInstance[]> {
  const response = await apiClient.get(`/extensions/plugin/${slug}/instances`, {
    params: { page: 1, limit: 100 },
  }) as ApiResponse<PageResult<PluginInstance>>;
  if (!response.success) unwrapApiResponse(response);
  if (!response.data) return [];
  return response.data.items || [];
}

async function getDefaultInstance(slug: string): Promise<PluginInstance | null> {
  const instances = await fetchPluginInstances(slug);
  return instances.find((item) => item.instanceKey === DEFAULT_PLUGIN_INSTANCE_KEY) || null;
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
  getDisableImpact: async (slug: string): Promise<{ pendingPaymentOrders: number }> => {
    const response = await apiClient.get(`/extensions/plugin/${slug}/disable-impact`);
    return unwrapApiResponse(response as ApiResponse<{ pendingPaymentOrders: number }>);
  },
  getInstalled: async (page = 1, limit = 20, state: 'active' | 'removed' = 'active'): Promise<ApiResponse<PageResult<PluginMetaWithState>>> => {
    const response = await apiClient.get('/extensions/plugin', { params: { page, limit, state } }) as ApiResponse<PageResult<any>>;
    if (!response.success || !response.data) {
      return response as ApiResponse<PageResult<PluginMetaWithState>>;
    }

    const items = await Promise.all(
      (response.data.items || []).map(async (plugin: any) => {
        const defaultInstance = plugin.deletedAt ? null : await getDefaultInstance(plugin.slug);
        const parsedManifest = parseManifestJson(plugin?.manifestJson);
        const configSchema = parsedManifest?.configSchema as Record<string, any> | undefined;
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
      const normalized = toApiErrorPayload(error, 'ERROR', 'Request failed');
      return {
        success: false,
        httpStatus: isAdminApiError(error) ? error.status : undefined,
        error: normalized,
      };
    }
  },

  uninstall: (slug: string): Promise<ApiResponse<{ kind: 'plugin'; slug: string; uninstalled: boolean }>> =>
    apiClient.delete(`/extensions/plugin/${slug}`),

  restore: (slug: string): Promise<ApiResponse<{ kind: 'plugin'; slug: string; restored: boolean }>> =>
    apiClient.post(`/extensions/plugin/${slug}/restore`),

  purge: (slug: string, confirmationSlug: string): Promise<ApiResponse<{ kind: 'plugin'; slug: string; purged: boolean }>> =>
    apiClient.delete(`/extensions/plugin/${slug}/purge`, { data: { confirmationSlug } }),

  // ============================================================================
  // Instance Management API (Multi-instance support)
  // ============================================================================

  /** Get all instances for a plugin */
  getInstances: (slug: string, page = 1, limit = 20): Promise<ApiResponse<PageResult<PluginInstance>>> =>
    apiClient.get(`/extensions/plugin/${slug}/instances`, { params: { page, limit } }),

  /** Update an instance */
  updateInstance: (
    slug: string,
    installationId: string,
    data: UpdateInstanceRequest
  ): Promise<ApiResponse<PluginInstance>> =>
    apiClient.patch(`/extensions/plugin/${slug}/instances/${installationId}`, data),

};

export const notificationsApi = {
  getAll: (page = 1, limit = 20, status?: AdminNotification['status'], filters?: { search?: string; type?: string; sort?: string }): Promise<ApiResponse<PageResult<AdminNotification> & { counts?: Record<string, number>; types?: string[] }>> =>
    apiClient.get('/admin/notifications', { params: { page, limit, status, ...filters } }),
  getById: (id: string): Promise<ApiResponse<AdminNotification>> =>
    apiClient.get(`/admin/notifications/${id}`),
  resend: (id: string, idempotencyKey: string): Promise<ApiResponse<AdminNotification>> =>
    apiClient.post(`/admin/notifications/${id}/resend`, { idempotencyKey }),
};

export interface AdminListView {
  id: string;
  listKey: string;
  name: string;
  query: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface AdminListPreference {
  listKey: string;
  columns: string[];
}

/** Per-user saved views and custom columns for the Admin list pages. */
export const listPreferencesApi = {
  listViews: (list: string): Promise<ApiResponse<{ views: AdminListView[] }>> =>
    apiClient.get('/admin/list-views', { params: { list } }),
  createView: (data: { list: string; name: string; query: Record<string, string> }): Promise<ApiResponse<AdminListView>> =>
    apiClient.post('/admin/list-views', data),
  updateView: (id: string, data: { name?: string; query?: Record<string, string> }): Promise<ApiResponse<AdminListView>> =>
    apiClient.put(`/admin/list-views/${id}`, data),
  deleteView: (id: string): Promise<ApiResponse<null>> =>
    apiClient.delete(`/admin/list-views/${id}`),
  getPreference: (list: string): Promise<ApiResponse<AdminListPreference>> =>
    apiClient.get('/admin/list-preferences', { params: { list } }),
  setPreference: (list: string, columns: string[]): Promise<ApiResponse<AdminListPreference>> =>
    apiClient.put('/admin/list-preferences', { list, columns }),
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
// Administrator Management
// ============================================================

export interface StaffMembership {
  id: string;
  email: string;
  username: string;
  avatar?: string | null;
  status: 'active' | 'invited' | 'removed';
  removedAt: string | null;
  inviteExpiresAt: string | null;
  isActive: boolean;
  emailVerified: boolean;
  isInstallAdmin: boolean;
  createdAt: string;
  updatedAt: string;
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

export interface StaffCreatePayload {
  email: string;
  username: string;
}

export const staffApi = {
  neighbors: (id: string, params: import('./staff-list-state').StaffFilter) => apiClient.get<{ position: number | null; total: number; previousId: string | null; nextId: string | null }>(`/admin/staff/${id}/neighbors`, { params }),
  reinvite: (id: string): Promise<ApiResponse<StaffMembership>> => apiClient.post(`/admin/staff/${id}/reinvite`, {}),
  getAll: (params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: import('./staff-list-state').StaffFilter['status'];
  } = {}): Promise<ApiResponse<PageResult<StaffMembership> & { statusCounts: Record<'all' | 'active' | 'invited' | 'removed', number> }>> => {
    const { page = 1, limit = 20, ...filters } = params;
    return apiClient.get('/admin/staff', { params: { page, limit, ...filters } });
  },

  getByUserId: (userId: string): Promise<ApiResponse<StaffMembership>> =>
    apiClient.get(`/admin/staff/${userId}`),

  getAuditLogs: (userId: string, page = 1, limit = 20): Promise<ApiResponse<PageResult<StaffAuditLogEntry>>> =>
    apiClient.get(`/admin/staff/${userId}/audit`, { params: { page, limit } }),

  create: (data: StaffCreatePayload): Promise<ApiResponse<StaffMembership>> =>
    apiClient.post('/admin/staff', data),

  remove: (userId: string): Promise<ApiResponse<void>> =>
    apiClient.delete(`/admin/staff/${userId}`),

  resendInvite: (userId: string): Promise<ApiResponse<{ userId: string; queued: boolean }>> =>
    apiClient.post(`/admin/staff/${userId}/invite`, {}),

  generateInviteLink: (userId: string): Promise<ApiResponse<{ link: string }>> =>
    apiClient.post(`/admin/staff/${userId}/invite-link`, {}),
};

export default apiClient;
