import { z } from 'zod';

// 创建商品请求
export const CreateProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  price: z.number().positive('Price must be positive'),
  stock: z.number().int().min(0, 'Stock must be non-negative'),
  category: z.string().optional(),
  images: z.string().optional(),
  tenantId: z.number().int().positive('Tenant ID is required'),
});

// 更新商品请求
export const UpdateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().positive().optional(),
  stock: z.number().int().min(0).optional(),
  category: z.string().optional(),
  images: z.string().optional(),
});

// 批量操作请求
export const BatchProductOperationSchema = z.object({
  action: z.enum(['delete', 'updateStock', 'updatePrice', 'updateCategory']),
  productIds: z.array(z.string()).min(1, 'At least one product ID is required'),
  stock: z.number().int().min(0).optional(),
  price: z.number().positive().optional(),
  category: z.string().optional(),
});

// TypeScript 类型推断
export type CreateProductRequest = z.infer<typeof CreateProductSchema>;
export type UpdateProductRequest = z.infer<typeof UpdateProductSchema>;
export type BatchProductOperationRequest = z.infer<typeof BatchProductOperationSchema>;

// 超级管理员产品响应接口（包含租户信息）
export interface SuperAdminProductResponse {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  category: string | null;
  images: string;
  createdAt: Date;
  updatedAt: Date;
  tenantId: number;
  tenant: {
    id: number;
    companyName: string;
    contactEmail: string;
  };
}

// 超级管理员产品统计信息
export interface SuperAdminProductStatsResponse {
  success: boolean;
  data: {
    totalProducts: number;
    productsByCategory: {
      category: string;
      count: number;
    }[];
    productsByTenant: {
      tenantId: number;
      tenantName: string;
      productCount: number;
      totalValue: number;
      averagePrice: number;
    }[];
    lowStockProducts: SuperAdminProductResponse[];
    recentProducts: SuperAdminProductResponse[];
    totalInventoryValue: number;
  };
}

// 分页超级管理员产品列表响应
export interface SuperAdminProductListResponse {
  success: boolean;
  data: SuperAdminProductResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 单个超级管理员产品响应
export interface SingleSuperAdminProductResponse {
  success: boolean;
  data: SuperAdminProductResponse;
}

// 批量操作响应
export interface BatchProductOperationResponse {
  success: boolean;
  data: {
    action: string;
    processedCount: number;
    productIds: string[];
    stock?: number;
    price?: number;
    category?: string;
  };
  message: string;
}

// 获取产品请求参数
export interface GetProductsRequest {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sortBy?: 'name' | 'price' | 'stock' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  tenantId?: string;
}
