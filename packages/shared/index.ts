/**
 * Unified shared package exports
 * Provides consistent APIs and tools for all applications
 */

// Environment configuration
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

// API client
export {
  ApiClient,
  type ApiResponse,
  type PaginatedResponse,
  type LoginCredentials,
  type RegisterData,
  type UserProfile,

  type ApiClientConfig,
} from './api/client';

export type { AuthBootstrapStatus } from './src/types/auth';

// Auth client
export {
  AuthClient,
  authClient,
} from './api/auth-client';

// API client factory
export {
  createApiClient,
  createShopClient,

  createAdminClient,
  getShopClient,

  getAdminClient,
  useApiClient,
  ApiClientManager,
  type AppType,
  type CreateClientOptions,
} from './api/create-client';

// Storage adapters
export {
  StorageAdapterFactory,
  type StorageAdapter,
} from './api/storage-adapters';

// Extension and marketplace contracts



// Constants
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

// Validation Schemas
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

// Warehouse Schemas
export {
  warehouseSchema,
  warehouseInventorySchema,
  createWarehouseSchema,
  updateWarehouseSchema,
  setDefaultWarehouseSchema,
  warehouseFiltersSchema,
  warehouseInventoryFiltersSchema,
  bulkInventoryUpdateSchema,
  importInventorySchema,
  type WarehouseSchema,
  type WarehouseInventorySchema,
  type CreateWarehouseFormData,
  type UpdateWarehouseFormData,
  type SetDefaultWarehouseFormData,
  type WarehouseFiltersFormData,
  type WarehouseInventoryFiltersFormData,
  type BulkInventoryUpdateFormData,
} from './src/schemas/warehouse';

// Inventory Schemas
export {
  inventoryAdjustmentTypeSchema,
  inventoryTransferStatusSchema,
  inventoryAdjustmentSchema,
  inventoryTransferSchema,
  createInventoryAdjustmentSchema,
  createInventoryTransferSchema,
  updateInventoryTransferSchema,
  approveInventoryTransferSchema,
  cancelInventoryTransferSchema,
  inventoryAdjustmentFiltersSchema,
  inventoryTransferFiltersSchema,
  type InventoryAdjustmentSchema,
  type InventoryTransferSchema,
  type CreateInventoryAdjustmentFormData,
  type CreateInventoryTransferFormData,
  type UpdateInventoryTransferFormData,
  type ApproveInventoryTransferFormData,
  type CancelInventoryTransferFormData,
  type InventoryAdjustmentFiltersFormData,
  type InventoryTransferFiltersFormData,
} from './src/schemas/inventory';


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

// Types and Utilities from src
export * from './src/index';

// DTO Types - Strictly aligned with actual backend response structure
export type {
  // Product DTOs
  ShopProductListItemDTO,
  ShopProductDetailDTO,
  AdminProductListItemDTO,
  AdminProductDetailDTO,
  ProductVariantDTO,
  ProductSpecificationDTO,
  ProductCategoryDTO,
  // Order DTOs
  ShopOrderListItemDTO,
  ShopOrderDetailDTO,
  AdminOrderListItemDTO,
  AdminOrderDetailDTO,
  OrderItemDTO,
  AdminOrderItemDTO,
  OrderAddressDTO,
  OrderStatus,
  PaymentStatus,
  // Cart DTOs
  CartDTO,
  CartItemDTO,
  AddToCartRequestDTO,
  UpdateCartItemRequestDTO,
} from './src/types/dto';


// Warehouse Types
export type {
  Warehouse,
  WarehouseInventory,
  WarehouseWithInventory,
  WarehouseInventoryDetail,
  WarehouseStats,
  WarehouseFilters,
  WarehouseInventoryFilters,
  CreateWarehouseRequest,
  UpdateWarehouseRequest,
  SetDefaultWarehouseRequest,
  BulkInventoryUpdate,
  ImportInventoryResult,
} from './src/types/warehouse';

// Inventory Types
export type {
  InventoryAdjustment,
  InventoryAdjustmentType,
  InventoryTransfer,
  InventoryTransferStatus,
  InventoryAdjustmentDetail,
  InventoryTransferDetail,
  InventoryStats,
  InventoryAdjustmentFilters,
  InventoryTransferFilters,
  CreateInventoryAdjustmentRequest,
  CreateInventoryTransferRequest,
  UpdateInventoryTransferRequest,
  ApproveInventoryTransferRequest,
  CancelInventoryTransferRequest,
} from './src/types/inventory';

