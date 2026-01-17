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
  lastLoginAt?: string
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
  basePrice?: number
  stock?: number
  baseStock?: number
  sku?: string
}

export interface Product {
  id: string
  name: string
  description: string
  price: number
  originalPrice?: number
  sku: string
  stock: number
  categoryId: string
  category: string | Category
  images: ProductImage[]
  variants?: ProductVariant[]
  status: string
  isActive: boolean
  isFeatured: boolean
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

// Order types
export interface Order {
  id: string
  orderNumber: string
  userId: string
  user: User
  customerEmail: string
  status: OrderStatus
  paymentStatus?: string // Added to match backend and enable refund check
  totalAmount: number
  shippingAddress: Address
  billingAddress: Address
  items: OrderItem[]
  createdAt: string
  updatedAt: string
}

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
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
  street: string
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
  // Today's metrics
  todayOrders: number
  todayRevenue: number
  // Growth percentages
  userGrowth: number
  productGrowth: number
  orderGrowth: number
  revenueGrowth: number
  // Order status breakdown
  ordersByStatus?: {
    PENDING: number
    PAID: number
    SHIPPED: number
    DELIVERED: number
    CANCELLED: number
  }
  // Product stats
  inStockProducts?: number
  outOfStockProducts?: number
  // Optional chart data
  recentOrders?: Order[]
  topProducts?: Product[]
  revenueChart?: ChartData[]
}

export interface ChartData {
  date: string
  value: number
  label?: string
}

// API Response types
export interface ApiResponse<T> {
  data?: T
  message?: string
  success: boolean
  error?: string
  code?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
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
  images?: string
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

// Plugin types
export interface Plugin {
  id: string
  slug: string
  name: string
  description: string
  version: string
  developer: string
  category: string
  businessModel: 'free' | 'freemium' | 'subscription' | 'usage_based'
  supportsSubscription: boolean
  trialDays: number
  tags: string[]
  iconUrl: string | null
  screenshots: string[]
  rating: number
  installCount: number
  subscriptionPlans?: SubscriptionPlan[]
}

export interface PluginInstallation {
  id: string
  pluginId: string
  plugin: Plugin
  status: 'ACTIVE' | 'INACTIVE'
  enabled: boolean
  configData: Record<string, any>
  installedAt: string
  subscription?: {
    id: string
    planId: string
    status: string
    currentPeriodEnd: string
  }
}

export interface SubscriptionPlan {
  id: string
  pluginId: string
  planId: string
  name: string
  description: string
  amount: number
  currency: string
  billingCycle: 'monthly' | 'yearly'
  trialDays: number
  features: string
  limits: string
  isActive: boolean
  isPublic: boolean
  sortOrder: number
  metadata: any
  createdAt: string
  updatedAt: string
}

export interface PluginCategory {
  name: string
  count: number
}
