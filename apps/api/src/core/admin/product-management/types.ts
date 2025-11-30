import { z } from 'zod';

/**
 * 管理员商品管理相关类型定义
 */

// 创建商品的Schema
export const CreateProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(200, 'Product name too long'),
  description: z.string().optional(),
  price: z.number().positive('Price must be positive'),
  stock: z.number().int().min(0, 'Stock cannot be negative').default(0),
  category: z.string().optional(),
  images: z.string().default(""),
});

// 更新商品的Schema
export const UpdateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  price: z.number().positive().optional(),
  stock: z.number().int().min(0).optional(),
  category: z.string().optional(),
  images: z.string().optional(),
});

// 批量操作Schema
export const BatchProductSchema = z.object({
  action: z.enum(['delete', 'updateStock']),
  productIds: z.array(z.string()).min(1),
  stockQuantity: z.number().int().min(0).optional(),
});

// TypeScript类型定义
export type CreateProductRequest = z.infer<typeof CreateProductSchema>;
export type UpdateProductRequest = z.infer<typeof UpdateProductSchema>;
export type BatchProductRequest = z.infer<typeof BatchProductSchema>;

// 获取商品列表请求参数
export interface GetProductsRequest {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sortBy?: 'name' | 'price' | 'createdAt' | 'stock';
  sortOrder?: 'asc' | 'desc';
  tenantId: string;
}

// 批量更新请求参数
export interface BatchProductRequestBody extends BatchProductRequest {
  tenantId: string;
  operatorId: string;
}

// 商品响应数据结构（管理员版本）
export interface AdminProductResponse {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  category?: string;
  images: string;
  createdAt: Date;
  updatedAt: Date;
  tenantId: number;
}

// 商品统计响应结构
export interface ProductStatsResponse {
  totalProducts: number;
  inStockProducts: number;
  outOfStockProducts: number;
  categoryDistribution: Record<string, number>;
}
