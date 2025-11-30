// Platform Agent Types
export interface PlatformAgent {
  id: string;
  userId: string;
  agentCode: string;
  level: AgentLevel;
  territory: Territory;
  commissionRate: number;
  maxTenants: number;
  canWhiteLabel: boolean;
  canCustomPrice: boolean;
  status: AgentStatus;
  appliedAt: string;
  approvedAt?: string;
  activatedAt?: string;
  suspendedAt?: string;
  personalInfo: PersonalInfo;
  businessInfo?: BusinessInfo;
  initialFee: number;
  feePaidAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  user?: User;
  referrals?: PlatformReferral[];
  commissions?: AgentCommission[];
  payouts?: CommissionPayout[];
  referredTenants?: Tenant[];
}

export interface Territory {
  type: 'global' | 'regional' | 'local';
  name: string;
  code: string;
  countries?: string[];
  states?: string[];
  cities?: string[];
  coordinates?: {
    lat: number;
    lng: number;
  };
  exclusivity: boolean;
}

export interface PersonalInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  idCard?: string;
  bankAccount?: {
    bankName: string;
    accountNumber: string;
    routingNumber: string;
    accountHolder: string;
  };
}

export interface BusinessInfo {
  companyName: string;
  businessLicense: string;
  taxId: string;
  website?: string;
  socialMedia?: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
  };
  employeeCount: number;
  annualRevenue: number;
}

export interface User {
  id: string;
  email: string;
  username: string;
  role: string;
  createdAt: string;
}

export interface PlatformReferral {
  id: string;
  agentId: string;
  tenantId: string;
  referralType: ReferralType;
  referralCode: string;
  referralUrl?: string;
  baseAmount: number;
  commissionRate: number;
  commissionAmount: number;
  currency: string;
  status: ReferralStatus;
  confirmedAt?: string;
  paidAt?: string;
  cancelledAt?: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  agent?: PlatformAgent;
  tenant?: Tenant;
  commissions?: AgentCommission[];
}

export interface AgentCommission {
  id: string;
  agentId: string;
  referralId: string;
  commissionType: CommissionType;
  amount: number;
  currency: string;
  periodStart?: string;
  periodEnd?: string;
  status: CommissionStatus;
  confirmedAt?: string;
  paidAt?: string;
  payoutId?: string;
  createdAt: string;
  updatedAt: string;
  agent?: PlatformAgent;
  referral?: PlatformReferral;
  payout?: CommissionPayout;
}

export interface CommissionPayout {
  id: string;
  agentId: string;
  totalAmount: number;
  currency: string;
  commissionCount: number;
  periodStart: string;
  periodEnd: string;
  payoutMethod: PayoutMethod;
  payoutDetails: any;
  status: PayoutStatus;
  requestedAt: string;
  processedAt?: string;
  completedAt?: string;
  failedAt?: string;
  transactionId?: string;
  transactionFee: number;
  netAmount: number;
  notes?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
  agent?: PlatformAgent;
  commissions?: AgentCommission[];
}

export interface Tenant {
  id: string;
  companyName: string;
  contactEmail: string;
  referredByAgentId?: string;
  referralCode?: string;
  referralDate?: string;
  status: string;
  createdAt: string;
}

// Enums
export type AgentLevel = 'GLOBAL' | 'REGIONAL' | 'LOCAL';
export type AgentStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
export type ReferralType = 'TENANT_SIGNUP' | 'PLUGIN_PURCHASE' | 'SUBSCRIPTION_UPGRADE';
export type ReferralStatus = 'PENDING' | 'CONFIRMED' | 'PAID' | 'CANCELLED';
export type CommissionType = 'REFERRAL' | 'RECURRING' | 'BONUS';
export type CommissionStatus = 'PENDING' | 'CONFIRMED' | 'PAID';
export type PayoutMethod = 'BANK_TRANSFER' | 'PAYPAL' | 'STRIPE' | 'CRYPTO';
export type PayoutStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

// Dashboard Types
export interface DashboardOverview {
  totalAgents: number;
  activeAgents: number;
  pendingApplications: number;
  totalCommissions: number;
  paidCommissions: number;
  pendingPayouts: number;
  totalRevenue: number;
  monthlyGrowth: number;
}

export interface PlatformStats {
  period: string;
  agentStats: {
    total: number;
    active: number;
    new: number;
    byLevel: Record<AgentLevel, number>;
  };
  revenueStats: {
    total: number;
    commissions: number;
    growth: number;
  };
  referralStats: {
    total: number;
    confirmed: number;
    conversionRate: number;
  };
}

export interface AgentPerformance {
  agentId: string;
  agentCode: string;
  level: AgentLevel;
  totalReferrals: number;
  confirmedReferrals: number;
  totalCommissions: number;
  paidCommissions: number;
  conversionRate: number;
  rank: number;
}

// Form Types
export interface CreateAgentRequest {
  level: AgentLevel;
  territory: Territory;
  personalInfo: PersonalInfo;
  businessInfo?: BusinessInfo;
}

export interface UpdateAgentRequest {
  territory?: Territory;
  personalInfo?: Partial<PersonalInfo>;
  businessInfo?: Partial<BusinessInfo>;
  commissionRate?: number;
  maxTenants?: number;
  canWhiteLabel?: boolean;
  canCustomPrice?: boolean;
  notes?: string;
}

export interface AgentStatusUpdate {
  status: AgentStatus;
  reason?: string;
  notes?: string;
}

// User Role Enum
export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN'
}

// Order type for dashboard
export interface Order {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  createdAt: string
  customerId?: string
  customerName?: string
}

// Product type for dashboard
export interface Product {
  id: string
  name: string
  price: number
  stock: number
  soldCount?: number
  imageUrl?: string
}

// Statistics types
export interface DashboardStats {
  totalUsers: number
  totalProducts: number
  totalOrders: number
  totalRevenue: number
  todayOrders?: number
  todayRevenue?: number
  userGrowth: number
  productGrowth?: number
  orderGrowth: number
  revenueGrowth: number
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
  errors?: Record<string, string[]>
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

// Plugin types (basic)
export interface PluginBasic {
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

// Plugin types (full)
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
