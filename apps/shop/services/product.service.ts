/**
 * Product Service - Shop Application
 *
 * Service layer for product-related operations.
 * Wraps the productsApi with additional business logic and type exports.
 *
 * 🆕 Agent Mall 支持：
 * - 使用 agentId 获取授权商品和有效价格
 */

import { productsApi } from '@/lib/api';

// Re-export types from shared
export type { Product, ProductCategory, ProductSearchFilters } from 'shared/src';

// Import the Product type for internal use
import type { Product, ProductSearchFilters } from 'shared/src';

export interface ProductListResponse {
    products: Product[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

/**
 * ProductService - High-level service for product operations
 */
export const ProductService = {
    /**
     * Get paginated list of products
     * @param page - Page number (1-indexed)
     * @param limit - Items per page
     * @param filters - Optional search filters including locale and agentId
     */
    async getProducts(
        page = 1,
        limit = 12,
        filters: ProductSearchFilters & { locale?: string; agentId?: string } = {}
    ): Promise<ProductListResponse> {
        const response = await productsApi.getProducts({
            page,
            limit,
            ...filters,
        });

        if (!response.success || !response.data) {
            throw new Error(response.error || 'Failed to fetch products');
        }

        // Handle both response formats:
        // 1. { products: [...], pagination: {...} } - from backend
        // 2. { data: [...], page, limit, total, totalPages } - legacy PaginatedResponse
        const data = response.data as any;
        const products = data.products || data.data || [];
        const pagination = data.pagination || {
            page: data.page || page,
            limit: data.limit || limit,
            total: data.total || 0,
            totalPages: data.totalPages || 1,
        };

        return {
            products,
            pagination,
        };
    },

    /**
     * Get single product by ID
     * @param id - Product ID
     * @param locale - Optional locale for translated content
     * @param agentId - Optional agent ID for Agent Mall context
     */
    async getProduct(
        id: string,
        locale?: string,
        agentId?: string
    ): Promise<Product> {
        const response = await productsApi.getProduct(id, locale, agentId);

        if (!response.success || !response.data) {
            throw new Error(response.error || 'Product not found');
        }

        return response.data;
    },

    /**
     * Get product categories
     * @param locale - Optional locale for translated category names
     */
    async getCategories(locale?: string) {
        const response = await productsApi.getCategories(locale);

        if (!response.success || !response.data) {
            throw new Error(response.error || 'Failed to fetch categories');
        }

        return response.data;
    },

    /**
     * Search products with text query
     * @param query - Search text
     * @param page - Page number
     * @param limit - Items per page
     * @param filters - Additional filters
     */
    async searchProducts(
        query: string,
        page = 1,
        limit = 12,
        filters: Partial<ProductSearchFilters> & { locale?: string; agentId?: string } = {}
    ): Promise<ProductListResponse> {
        return this.getProducts(page, limit, {
            ...filters,
            search: query,
        });
    },

    /**
     * Get products by category
     * @param category - Category slug or ID
     * @param page - Page number
     * @param limit - Items per page
     * @param filters - Additional filters
     */
    async getProductsByCategory(
        category: string,
        page = 1,
        limit = 12,
        filters: Partial<ProductSearchFilters> & { locale?: string; agentId?: string } = {}
    ): Promise<ProductListResponse> {
        return this.getProducts(page, limit, {
            ...filters,
            category,
        });
    },

    /**
     * Get featured/new arrival products
     * @param limit - Number of products to fetch
     * @param filters - Additional filters
     */
    async getNewArrivals(
        limit = 8,
        filters: Partial<ProductSearchFilters> & { locale?: string; agentId?: string } = {}
    ): Promise<Product[]> {
        const response = await this.getProducts(1, limit, {
            ...filters,
            sortBy: 'createdAt',
            sortOrder: 'desc',
        });
        return response.products;
    },

    /**
     * Get bestseller products (placeholder - sorted by stock descending as proxy)
     * @param limit - Number of products to fetch
     * @param filters - Additional filters
     */
    async getBestsellers(
        limit = 8,
        filters: Partial<ProductSearchFilters> & { locale?: string; agentId?: string } = {}
    ): Promise<Product[]> {
        const response = await this.getProducts(1, limit, {
            ...filters,
            sortBy: 'stock',
            sortOrder: 'desc',
        });
        return response.products;
    },
};

export default ProductService;
