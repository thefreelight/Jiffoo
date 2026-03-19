// User types
export interface User {
  id: string
  email: string
  name: string
  username: string
  avatar?: string
  role: UserRole
  isActive: boolean
  createdAt: string
  updatedAt: string
  lastLoginAt?: string | null
  totalOrders?: number
  totalSpent?: number
}

export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER'
}

// Product types
export interface ProductVariant {
  id: string
  name: string
  price?: number
  salePrice?: number
  stock?: number
  baseStock?: number
  sku?: string
  skuCode?: string
  isActive?: boolean
  attributes?: any
}

export interface Product {
  id: string
  name: string
  description?: string | null
  requiresShipping?: boolean

  // Flattened List Fields
  categoryName?: string | null
  categoryId?: string | null
  skuCode?: string | null
  price?: number
  stock?: number
  isActive?: boolean
  variantsCount?: number

  // Detail Fields
  images?: string[]
  variants?: ProductVariant[]

  status?: string
  isFeatured?: boolean
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: string
  name: string
  description?: string
  parentId?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ProductImage {
  id: string
  url: string
  alt?: string
  isPrimary: boolean
  order: number
}

// Order types - Flattened list format
export interface Order {
  id: string
  status: OrderStatus | string
  paymentStatus?: string
  totalAmount: number
  currency: string
  createdAt: string
  itemsCount?: number

  // Flattened customer info (for list)
  customer: {
    id: string | null
    email: string | null
    username: string | null
  }
}

// Order detail type - Projected detail format
export interface OrderDetail {
  id: string
  status: OrderStatus | string
  paymentStatus?: string
  totalAmount: number
  currency: string
  notes?: string | null
  cancelReason?: string | null
  cancelledAt?: string | null
  createdAt: string
  updatedAt?: string
  customer: {
    id: string | null
    email: string | null
    username: string | null
  }
  shippingAddress?: Address | null
  items: OrderDetailItem[]
  shipments?: OrderShipment[]
  paymentMethod?: string | null
  paymentAttempts?: number
  lastPaymentAttemptAt?: string | null
  expiresAt?: string | null
}

// Theme types
export interface ThemeMeta {
  slug: string
  name: string
  version: string
  description?: string
  author?: string
  previewImage?: string
  source: 'builtin' | 'installed' | 'local-zip' | 'official-market'
  type?: 'pack' | 'app'
  target: 'shop' | 'admin'
}

export interface ActiveTheme {
  slug: string
  version: string
  source: string
  type?: 'pack' | 'app'
  config: Record<string, any>
  activatedAt: string
  previousSlug?: string
}

// Plugin types
export interface PluginMetaWithState {
  slug: string
  name: string
  version: string
  description?: string
  author?: string
  source: 'installed' | 'builtin' | 'local-zip' | 'official-market'
  enabled: boolean
  deletedAt?: string | null
  uninstalled?: boolean
  configRequired?: boolean
  configReady?: boolean
  missingConfigFields?: string[]
}

export interface PluginState {
  slug: string
  enabled: boolean
  hidden?: boolean
  config: Record<string, any>
  configMeta?: PluginConfigMeta
  name?: string
  version?: string
  description?: string
  author?: string
  category?: string
  source?: string
  configSchema?: Record<string, any>
  configRequired?: boolean
  configReady?: boolean
  missingConfigFields?: string[]
  runtimeType?: 'internal-fastify' | 'external-http'
  enabledAt?: string
  disabledAt?: string
}

export interface PluginConfigMeta {
  secretFields?: Record<string, {
    configured: boolean
  }>
}


export interface OrderDetailItem {
  id: string
  quantity: number
  unitPrice: number
  totalPrice: number
  productId: string | null
  productName: string | null
  variantId: string | null
  skuCode: string | null
  variantName: string | null
  fulfillmentStatus?: string | null
}

export interface OrderShipment {
  id: string
  carrier: string
  trackingNumber: string
  status: string
  shippedAt?: string | null
  deliveredAt?: string | null
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED'
}

export interface OrderItem {
  id: string
  productId: string
  product: Product
  quantity: number
  unitPrice: number
  price: number
  totalPrice: number
}

export interface Address {
  id: string
  recipientName?: string
  phone?: string
  street: string
  street2?: string | null
  city: string
  state: string
  zipCode: string
  country: string
}

// Statistics types - Unified DashboardStats for dashboard
export interface DashboardStats {
  // Core metrics
  totalUsers: number
  totalProducts: number
  totalOrders: number
  totalRevenue: number
  currency: string
  totalRevenueTrend: number
  totalOrdersTrend: number
  totalProductsTrend: number
  totalUsersTrend: number

  // Order status breakdown
  ordersByStatus: Record<string, number>

  // Recent activity
  recentOrders: Array<Order>
}

export interface ChartData {
  date: string
  value: number
  label?: string
}

// Pagination Params
export interface PaginationParams {
  page?: number
  limit?: number
  search?: string
  status?: string
}

// Form types
export interface LoginForm {
  email: string
  password: string
}

export interface ProductForm {
  name: string
  description?: string
  price: number
  stock?: number
  category?: string
  images?: string | string[]
  requiresShipping?: boolean
  variants?: Array<{
    name: string
    salePrice: number
    costPrice?: number | null
    baseStock: number
    skuCode?: string
    isActive?: boolean
  }>
}

export interface UserForm {
  name: string
  email: string
  role: UserRole
  isActive: boolean
}

// Permission types
export interface Permission {
  id: string
  resource: string
  action: string
  description?: string
}

export interface Role {
  id: string
  name: string
  description?: string
  permissions: Permission[]
}

// Cache types
export interface CacheStats {
  totalKeys: number
  memoryUsage: number
  hitRate: number
  missRate: number
}

// Plugin types
export interface Plugin {
  name: string
  version: string
  description: string
  author: string
  isEnabled: boolean
  config?: Record<string, unknown>
}

// Navigation types
export interface NavItem {
  title: string
  href: string
  icon: string
  badge?: string
  children?: NavItem[]
}

// Health Monitoring types
// Import SystemMetrics from shared package to avoid duplicate definitions
import type { SystemMetrics } from 'shared/observability'
export type { SystemMetrics }

export interface CheckMetrics {
  name: string
  totalCalls: number
  errorCount: number
  successCount: number
  errorRate: number
  avgResponseTime: number
  minResponseTime: number
  maxResponseTime: number
  lastError?: {
    message: string
    timestamp: string
  }
}

export interface RedisCacheStats {
  hitRate: number
  missRate: number
  keyCount: number
  memoryUsed: number
  memoryPeak: number
  evictedKeys: number
  connectedClients: number
  uptime: number
}

export interface HealthCheckResult {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY'
  checks: Record<string, {
    status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY'
    message?: string
    timestamp: string
  }>
  timestamp: string
}

export interface DatabasePoolStatus {
  size: number
  active: number
  idle: number
  max: number
  waiting: number
  usage: number
}

export interface HealthMetricsResponse {
  system: SystemMetrics
  health: HealthCheckResult
  database: DatabasePoolStatus
  cache: RedisCacheStats
  responseMetrics: CheckMetrics[]
  uptimePercent: number
  timestamp: string
}

export interface AlertStatus {
  type: 'cpu' | 'memory' | 'disk' | 'error_rate' | 'response_time' | 'cache_hit_rate'
  value: number
  threshold: number
  severity: 'warning' | 'critical'
  message: string
  triggeredAt: string
}

export interface HealthSummaryResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  alerts: AlertStatus[]
  uptime: number
  stats: {
    cpuUsage: number
    memoryUsage: number
    diskUsage: number
    errorRate: number
    avgResponseTime: number
    cacheHitRate: number
  }
  timestamp: string
}

// Error tracking types
export enum ErrorSeverity {
  CRITICAL = 'CRITICAL',
  ERROR = 'ERROR',
  WARNING = 'WARNING',
  INFO = 'INFO'
}

export interface ErrorLog {
  id: string
  errorHash: string
  message: string
  stack?: string | null
  statusCode?: number | null
  path?: string | null
  method?: string | null
  severity: ErrorSeverity
  environment?: string | null
  firstSeenAt: string
  lastSeenAt: string
  occurrenceCount: number
  resolved: boolean
  resolvedAt?: string | null
  resolvedBy?: string | null
  userId?: string | null
  username?: string | null
  storeId?: string | null
  storeName?: string | null
  requestContext?: any
  userContext?: any
  storeContext?: any
  tags?: any
  metadata?: any
}

export interface ErrorListParams extends PaginationParams {
  severity?: ErrorSeverity
  resolved?: boolean
  startDate?: string
  endDate?: string
  sortBy?: 'lastSeenAt' | 'occurrenceCount' | 'firstSeenAt'
  sortOrder?: 'asc' | 'desc'
}
