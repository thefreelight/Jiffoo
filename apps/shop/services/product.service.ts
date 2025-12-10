/**
 * Product Service
 *
 * Provides API methods for product-related operations.
 * Supports locale parameter for multilingual product data.
 *
 * 🆕 Agent Mall 支持：
 * - agentId 参数用于获取代理授权的商品和有效价格
 * - 变体信息包含 isAuthorized 标记
 */

import { apiClient } from '../lib/api';
import type { Product } from 'shared/src/types/product';

// Re-export Product type for convenience
export type { Product };

export interface ProductSearchFilters {
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sortBy?: 'name' | 'price' | 'createdAt' | 'stock';
  sortOrder?: 'asc' | 'desc';
  locale?: string; // Language code for translated product data
  /** 🆕 Agent ID for Agent Mall context */
  agentId?: string;
}

export interface ProductListResponse {
  products: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: ProductSearchFilters;
}

export class ProductService {
  private static async makeRequest<T>(endpoint: string, options?: { params?: Record<string, unknown> }): Promise<T> {
    // Construct URL - avoid trailing slash which causes 308 redirect
    const url = endpoint === '/' || endpoint === '' ? '/products' : `/products${endpoint}`;
    const response = await apiClient.get(url, options);
    if (response.success && response.data !== undefined) {
      // For product list, need to transform data format
      if ((endpoint === '/' || endpoint === '') && Array.isArray(response.data)) {
        return {
          products: response.data,
          pagination: (response as any).pagination || { page: 1, limit: 12, total: response.data.length, totalPages: 1 },
          filters: options?.params || {}
        } as T;
      }
      return response.data as T;
    }
    throw new Error(response.message || 'API request failed');
  }

  /**
   * Get products with optional locale for translated data
   * @param page - Page number
   * @param limit - Items per page
   * @param filters - Search filters including locale
   */
  static async getProducts(page = 1, limit = 12, filters: ProductSearchFilters = {}): Promise<ProductListResponse> {
    const params = { page: page.toString(), limit: limit.toString(), ...filters };
    return this.makeRequest<ProductListResponse>('/', { params });
  }

  /**
   * Get single product by ID with optional locale
   * @param id - Product ID
   * @param locale - Language code for translated data
   * @param agentId - 🆕 Optional agent ID for Agent Mall context
   */
  static async getProductById(id: string, locale?: string, agentId?: string): Promise<{ product: Product }> {
    const params: Record<string, string> = {};
    if (locale) {
      params.locale = locale;
    }
    if (agentId) {
      params.agentId = agentId;
    }
    const response = await apiClient.get(`/products/${id}`, { params });
    if (response.success && response.data !== undefined) {
      // Backend returns product object directly, wrap in { product: Product } format
      return { product: response.data as Product };
    }
    throw new Error(response.message || 'Failed to load product');
  }

  /**
   * Search products with optional locale
   */
  static async searchProducts(query: string, page = 1, limit = 12, filters: ProductSearchFilters = {}): Promise<ProductListResponse> {
    const params = {
      search: query,
      page: page.toString(),
      limit: limit.toString(),
      ...filters
    };
    return this.makeRequest<ProductListResponse>('/', { params });
  }



  static async getPriceRanges(): Promise<{ minPrice: number; maxPrice: number; ranges: Array<{ label: string; min: number; max: number; count: number }> }> {
    // TODO: Backend API /api/products/price-ranges not yet implemented
    // This feature is under development and will be available in a future release
    throw new Error('Price ranges API is not yet available. This feature is under development.');
  }
}

