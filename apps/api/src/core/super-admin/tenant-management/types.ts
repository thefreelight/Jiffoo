import { z } from 'zod';

// ==================== Request Types ====================

export const CreateTenantSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  contactName: z.string().min(1, 'Contact name is required'),
  contactEmail: z.string().email('Valid email is required'),
  contactPhone: z.string().optional(),
  domain: z.string().optional(),
  subdomain: z.string().optional(),
  branding: z.object({
    logo: z.string().optional(),
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
    companyName: z.string().optional(),
    website: z.string().optional(),
    supportEmail: z.string().email().optional(),
    supportPhone: z.string().optional()
  }).optional(),
  settings: z.object({
    timezone: z.string().default('UTC'),
    currency: z.string().default('USD'),
    language: z.string().default('en')
  }).optional(),
  // 必需的租户管理员创建信息
  adminUser: z.object({
    email: z.string().email('Invalid admin email format'),
    username: z.string().min(3, 'Username must be at least 3 characters'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    avatar: z.string().url().optional()
  })
});

export const UpdateTenantSchema = z.object({
  companyName: z.string().min(1).optional(),
  contactName: z.string().min(1).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  domain: z.string().optional(),
  subdomain: z.string().optional(),
  branding: z.object({
    logo: z.string().optional(),
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
    companyName: z.string().optional(),
    website: z.string().optional(),
    supportEmail: z.string().email().optional(),
    supportPhone: z.string().optional()
  }).optional(),
  settings: z.object({
    timezone: z.string().optional(),
    currency: z.string().optional(),
    language: z.string().optional()
  }).optional()
});

export const UpdateTenantStatusSchema = z.object({
  status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED', 'TERMINATED']),
  reason: z.string().optional(),
  notes: z.string().optional(),
  // 激活时的额外参数
  paymentReference: z.string().optional(),
  contractDuration: z.number().default(365).optional() // days
});

// ==================== Query Types ====================

export interface GetTenantsRequest {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
  sortBy?: 'companyName' | 'contactName' | 'createdAt' | 'status';
  sortOrder?: 'asc' | 'desc';
}

// ==================== Response Types ====================

export interface TenantResponse {
  id: number;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  status: string;
  domain?: string;
  subdomain?: string;
  branding?: any;
  settings?: any;
  contractStart?: string;
  contractEnd?: string;
  createdAt: string;
  updatedAt: string;
  stats?: {
    userCount: number;
    productCount: number;
    orderCount: number;
    totalRevenue: number;
  };
}

export interface SuperAdminTenantListResponse {
  success: boolean;
  data: TenantResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SuperAdminTenantResponse {
  success: boolean;
  data: TenantResponse;
}

export interface TenantStatsResponse {
  success: boolean;
  data: {
    totalTenants: number;
    activeTenants: number;
    pendingTenants: number;
    suspendedTenants: number;
    terminatedTenants: number;
    recentTenants: TenantResponse[];
  };
}

// ==================== Request Interface Types ====================

export type CreateTenantRequest = z.infer<typeof CreateTenantSchema>;
export type UpdateTenantRequest = z.infer<typeof UpdateTenantSchema>;
export type UpdateTenantStatusRequest = z.infer<typeof UpdateTenantStatusSchema>;
