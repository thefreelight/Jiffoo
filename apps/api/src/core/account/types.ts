import { z } from 'zod';

/**
 * User Account Types
 * Focused on personal profile management
 */

// Update profile schema
export const UpdateProfileSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  avatar: z.string().url().optional(),
});

// TypeScript type definition
export type UpdateProfileRequest = z.infer<typeof UpdateProfileSchema>;

// User profile response structure
export interface UserProfileResponse {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  languagePreferences?: {
    preferredLanguage: string;
    timezone: string;
    dateFormat: string;
    timeFormat: string;
    numberFormat: string;
    currencyFormat: string;
  };
}

// Order response structure
export interface OrderResponse {
  id: string;
  status: string;
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
  orderItems: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    product: {
      id: string;
      name: string;
      images?: string;
    };
  }>;
}

// Order list response structure
export interface OrdersListResponse {
  orders: OrderResponse[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Order statistics response structure
export interface OrderStatsResponse {
  totalOrders: number;
  totalSpent: number;
  statusDistribution: Record<string, number>;
}

// Store/Site information response structure (single-tenant mode)
export interface StoreInfoResponse {
  name: string;
  description?: string;
  settings?: any;
}

// User activity log response structure
export interface UserActivityResponse {
  id: string;
  action: string;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

// Activity log list response structure
export interface ActivityLogResponse {
  activities: UserActivityResponse[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Delete account request
export interface DeleteAccountRequest {
  password: string;
}

// API response base structure
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Pagination parameters
export interface PaginationParams {
  page?: number;
  limit?: number;
}

// Generic pagination response
export interface PaginationResponse {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
