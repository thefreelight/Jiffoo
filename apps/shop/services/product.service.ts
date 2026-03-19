/**
 * Product Service - Shop Application
 *
 * Service layer for product-related operations.
 * Wraps the productsApi with additional business logic and type exports.
 *
 * 🆕 Agent Mall Support:
 * - Use agentId to get authorized products and valid prices
 */

import { productsApi } from '@/lib/api';

// Re-export DTO types from shared
export type { ShopProductListItemDTO, ShopProductDetailDTO, ProductCategory, ProductSearchFilters } from 'shared';

// Import the DTO types for internal use
import type { ApiResponse, ShopProductListItemDTO, ShopProductDetailDTO, ProductSearchFilters, PageResult } from 'shared';
import type { ProductCategoryDTO } from 'shared';

async function getProductServerSide(
    id: string,
    locale?: string,
    agentId?: string
): Promise<ApiResponse<ShopProductDetailDTO>> {
    const baseUrl = process.env.API_SERVICE_URL;
    if (!baseUrl) {
        throw new Error('API_SERVICE_URL is not set');
    }

    const url = new URL(`/api/products/${id}`, baseUrl);
    if (locale) {
        url.searchParams.set('locale', locale);
    }
    if (agentId) {
        url.searchParams.set('agentId', agentId);
    }

    const response = await fetch(url.toString(), {
        cache: 'no-store',
        headers: {
            'Accept': 'application/json',
            'X-App-Type': 'shop',
            'X-Client-Version': '1.0.0',
        },
    });

    const data = await response.json() as ApiResponse<ShopProductDetailDTO>;
    if (!response.ok) {
        return {
            success: false,
            error: data?.error || {
                code: String(response.status),
                message: `Failed to fetch product ${id}`,
            },
        };
    }

    return data;
}

export interface ProductListResponse {
    items: ShopProductListItemDTO[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
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
            throw new Error(response.error?.message || 'Failed to fetch products');
        }

        // Handle both response formats:
        // - New format: { products: [], pagination: { page, limit, total, totalPages } }
        // - Legacy format: { items: [], page, limit, total, totalPages }
        const data = response.data as any;
        const items = data.items || data.products || [];
        const pagination = data.pagination || data;

        return {
            items,
            page: pagination.page || 1,
            limit: pagination.limit || 12,
            total: pagination.total || items.length,
            totalPages: pagination.totalPages || 1,
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
    ): Promise<ShopProductDetailDTO> {
        const response = typeof window === 'undefined'
            ? await getProductServerSide(id, locale, agentId)
            : await productsApi.getProduct(id, locale, agentId);

        if (!response.success || !response.data) {
            throw new Error(response.error?.message || 'Product not found');
        }

        return response.data;
    },

    /**
     * Get product categories
     * @param page - Page number
     * @param limit - Items per page
     */
    async getCategories(page = 1, limit = 20): Promise<PageResult<ProductCategoryDTO>> {
        const response = await productsApi.getCategories({ page, limit });

        if (!response.success || !response.data) {
            throw new Error(response.error?.message || 'Failed to fetch categories');
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
        const { locale, ...rest } = filters;
        const hasAdvancedFilters = Boolean(
            rest.category ||
            rest.minPrice !== undefined ||
            rest.maxPrice !== undefined ||
            rest.rating !== undefined ||
            rest.inStock !== undefined ||
            (rest.tags && rest.tags.length > 0) ||
            rest.sortBy ||
            rest.sortOrder ||
            rest.agentId
        );

        // Use dedicated search endpoint by default.
        // Fallback to list endpoint when advanced filters are present.
        if (!hasAdvancedFilters) {
            const response = await productsApi.searchProducts({
                q: query,
                page,
                limit,
                locale,
            });

            if (!response.success || !response.data) {
                throw new Error(response.error?.message || 'Failed to search products');
            }

            return {
                items: response.data.items || [],
                page: response.data.page || page,
                limit: response.data.limit || limit,
                total: response.data.total || 0,
                totalPages: response.data.totalPages || 1,
            };
        }

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
    ): Promise<ShopProductListItemDTO[]> {
        const response = await this.getProducts(1, limit, {
            ...filters,
            sortBy: 'createdAt',
            sortOrder: 'desc',
        });
        return response.items;
    },

    /**
     * Get bestseller products (placeholder - sorted by stock descending as proxy)
     * @param limit - Number of products to fetch
     * @param filters - Additional filters
     */
    async getBestsellers(
        limit = 8,
        filters: Partial<ProductSearchFilters> & { locale?: string; agentId?: string } = {}
    ): Promise<ShopProductListItemDTO[]> {
        const response = await this.getProducts(1, limit, {
            ...filters,
            sortBy: 'stock',
            sortOrder: 'desc',
        });
        return response.items;
    },
};

export default ProductService;
