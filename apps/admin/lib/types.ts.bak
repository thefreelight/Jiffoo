// User types
export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  role: UserRole
  isActive: boolean
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
}

export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  USER = 'USER'
}

// Product types
export interface Product {
  id: string
  name: string
  description: string
  price: number
  originalPrice?: number
  sku: string
  stock: number
  categoryId: string
  category: Category
  images: ProductImage[]
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
  status: OrderStatus
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

// Statistics types
export interface DashboardStats {
  totalUsers: number
  totalProducts: number
  totalOrders: number
  totalRevenue: number
  userGrowth: number
  productGrowth: number
  orderGrowth: number
  revenueGrowth: number
  recentOrders: Order[]
  topProducts: Product[]
  revenueChart: ChartData[]
}

export interface ChartData {
  date: string
  value: number
  label?: string
}

// API Response types
export interface ApiResponse<T> {
  data: T
  message?: string
  success: boolean
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
  description: string
  price: number
  originalPrice?: number
  sku: string
  stock: number
  categoryId: string
  isActive: boolean
  isFeatured: boolean
  images: File[]
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
  config?: Record<string, any>
}

// Navigation types
export interface NavItem {
  title: string
  href: string
  icon: string
  badge?: string
  children?: NavItem[]
}
