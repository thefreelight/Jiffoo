/**
 * 统一的共享包导出
 * 为所有应用提供一致的API和工具
 */

// 环境配置
export {
  envConfig,
  getApiServiceUrl,
  getApiServiceBaseUrl,
  getShopUrl,
  getApiUrl,
  isDevelopment,
  isProduction,
  isServer,
  isClient,
} from './config/env';

// API客户端
export {
  ApiClient,
  type ApiResponse,
  type PaginatedResponse,
  type LoginCredentials,
  type RegisterData,
  type UserProfile,

  type ApiClientConfig,
} from './api/client';

// 认证客户端
export {
  AuthClient,
  authClient,
} from './api/auth-client';

// API客户端工厂
export {
  createApiClient,
  createShopClient,

  createAdminClient,
  createAdminClient as createSuperAdminClient, // 别名，兼容admin应用
  getShopClient,

  getAdminClient,
  getAdminClient as getSuperAdminClient, // 别名，兼容admin应用
  useApiClient,
  ApiClientManager,
  type AppType,
  type CreateClientOptions,
} from './api/create-client';

// 存储适配器
export {
  StorageAdapterFactory,
  type StorageAdapter,
} from './api/storage-adapters';



// 常量
export {
  API_ENDPOINTS,
  USER_ROLES,
  ORDER_STATUS,
  PAYMENT_STATUS,
  PRODUCT_VARIANT_TYPES,
  CURRENCIES,
  LANGUAGES,
  PAGINATION,
  FILE_UPLOAD,
  VALIDATION,
  CACHE_KEYS,
  CACHE_TTL,
} from './src/utils/constants';

// 验证Schemas
export {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
  type LoginFormData,
  type RegisterFormData,
  type ForgotPasswordFormData,
  type ResetPasswordFormData,
  type ChangePasswordFormData,
  type UpdateProfileFormData,
} from './src/schemas/auth';

// Core Events
export type {
  CoreEvent,
  JiffooEvent,
  EventTypes,
  // User Payloads
  UserCreatedPayload,
  UserUpdatedPayload,
  UserDisabledPayload,
  // Product Payloads
  ProductCreatedPayload,
  ProductUpdatedPayload,
  ProductStockChangedPayload,
  // Order Payloads
  OrderCreatedPayload,
  OrderPaidPayload,
  OrderCancelledPayload,
  OrderShippedPayload,
  OrderRefundedPayload,
  OrderStatusChangedPayload,
  // Payment Payloads
  PaymentSessionCreatedPayload,
  PaymentWebhookProcessedPayload,
} from './src/events/core-events';

// 现有的工具函数（如果存在）
// export {
//   extractTenantId,
//   validateTenantId,
//   getTenantId,
//   withTenantFilter,
//   createErrorResponse,
//   createSuccessResponse,
// } from './src/utils/tenant-utils';

// export {
//   ErrorHandler,
//   type StandardError,
//   type ErrorCode,
// } from './src/utils/error-handler';

// 类型定义（如果存在）
// export type * from './src/types';
