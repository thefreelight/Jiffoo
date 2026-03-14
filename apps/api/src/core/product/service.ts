/**
 * Product Service (Single Merchant Version)
 *
 * Simplified version, removed multi-tenant related logic.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { Locale, DEFAULT_LOCALE } from '@/utils/i18n';
import { CacheService } from '@/core/cache/service';
import { InventoryService } from '@/core/inventory/service';

interface ProductSearchFilters {
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

function parseImageList(typeData: unknown): string[] {
  const parsedTypeData = parseTypeData(typeData);
  const images = parsedTypeData.images;
  return Array.isArray(images)
    ? images.filter((item): item is string => typeof item === 'string')
    : [];
}

function parseAttributes(attributes: unknown): Record<string, unknown> {
  if (!attributes) {
    return {};
  }

  if (typeof attributes === 'string') {
    try {
      const parsed = JSON.parse(attributes) as Record<string, unknown>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  return typeof attributes === 'object' ? (attributes as Record<string, unknown>) : {};
}

function parseTypeData(typeData: unknown): Record<string, unknown> {
  if (!typeData) {
    return {};
  }

  if (typeof typeData === 'string') {
    try {
      const parsed = JSON.parse(typeData) as Record<string, unknown>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  return typeof typeData === 'object' ? (typeData as Record<string, unknown>) : {};
}

/**
 * Apply translation to a product
 *
 * If the requested locale is not the default locale and a translation exists,
 * replaces the product's name and description with the translated versions.
 * Falls back to default locale values if translation is not found.
 *
 * @param product Product object to translate
 * @param translations Array of product translations
 * @param locale Target locale for translation
 */
function applyTranslation(
  product: { id: string; name: string; description: string | null;[key: string]: any },
  translations: Array<{ productId: string; locale: string; name: string; description: string | null }>,
  locale: Locale
): typeof product {
  if (locale === DEFAULT_LOCALE) {
    return product;
  }

  const translation = translations.find(
    (t) => t.productId === product.id && t.locale === locale
  );

  if (!translation) {
    return product;
  }

  return {
    ...product,
    name: translation.name || product.name,
    description: translation.description ?? product.description,
  };
}

/**
 * Product Service
 *
 * Manages product catalog operations including retrieval, search, and filtering.
 * Supports internationalization with locale-based translations.
 * Single merchant version without multi-tenancy logic.
 */
export class ProductService {
  private static async loadOdooProductLinks(productIds: string[]) {
    if (productIds.length === 0) return new Map<string, { sourceIsActive: boolean | null }>();

    const links = await prisma.externalProductLink.findMany({
      where: {
        provider: 'odoo',
        coreProductId: { in: productIds },
      },
      select: {
        coreProductId: true,
        sourceIsActive: true,
      },
    });

    return new Map(links.map((link) => [link.coreProductId, { sourceIsActive: link.sourceIsActive }]));
  }

  private static async loadOdooVariantLinks(variantIds: string[]) {
    if (variantIds.length === 0) return new Map<string, { sourceIsActive: boolean | null }>();

    const links = await prisma.externalVariantLink.findMany({
      where: {
        provider: 'odoo',
        coreVariantId: { in: variantIds },
      },
      select: {
        coreVariantId: true,
        sourceIsActive: true,
      },
    });

    return new Map(links.map((link) => [link.coreVariantId, { sourceIsActive: link.sourceIsActive }]));
  }

  private static async filterPublicProductsBySource<T extends { id: string; variants: Array<{ id: string }> }>(
    products: T[]
  ): Promise<T[]> {
    const productLinks = await this.loadOdooProductLinks(products.map((product) => product.id));
    const variantLinks = await this.loadOdooVariantLinks(products.flatMap((product) => product.variants.map((variant) => variant.id)));

    return products
      .filter((product) => {
        const productLink = productLinks.get(product.id);
        return !productLink || (productLink as any).sourceIsActive !== false;
      })
      .map((product) => ({
        ...product,
        variants: product.variants.filter((variant) => {
          const variantLink = variantLinks.get(variant.id);
          return !variantLink || (variantLink as any).sourceIsActive !== false;
        }),
      } as T))
      .filter((product) => product.variants.length > 0);
  }

  private static async getInStockVariantIds(): Promise<Set<string>> {
    const variantIds = await InventoryService.getVariantIdsByAvailability({
      minAvailable: 1,
      onlyActiveVariants: true,
    });
    return new Set(variantIds);
  }

  private static async getVariantStockMap(variantIds: string[]): Promise<Map<string, number>> {
    return InventoryService.getAvailableStockByVariantIds(variantIds);
  }

  /**
   * Get public product list with pagination, filtering, and localization
   *
   * Supports advanced filtering by search query, category, price range, and stock availability.
   * Applies internationalization by fetching and applying product translations for the requested locale.
   * Calculates display price from default or first variant, and aggregates total stock across all variants.
   *
   * @param page Page number for pagination (1-indexed)
   * @param limit Number of items per page
   * @param filters Search and filter criteria (search, category, price range, stock, sorting)
   * @param locale Target locale for product translations (defaults to DEFAULT_LOCALE)
   */
  static async getPublicProducts(
    page = 1,
    limit = 10,
    filters: ProductSearchFilters = {},
    locale: Locale = DEFAULT_LOCALE
  ) {
    // Read-through cache: check Redis first
    const version = await CacheService.getProductVersion();
    // Sort filter keys for stable cache key regardless of parameter order
    const sortedFilter: Record<string, string | number | boolean | undefined> = {};
    for (const k of Object.keys(filters).sort()) {
      if (filters[k as keyof ProductSearchFilters] !== undefined) {
        sortedFilter[k] = filters[k as keyof ProductSearchFilters];
      }
    }
    const filterKey = JSON.stringify(sortedFilter);
    const filterHash = Buffer.from(filterKey).toString('base64').slice(0, 64);
    const cacheKey = `pub:products:list:v${version}:${locale}:${page}:${limit}:${filterHash}`;
    const cached = await CacheService.get<Record<string, unknown>>(cacheKey);
    if (cached) return cached;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.ProductWhereInput = {
      isActive: true,
    };

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    if (filters.category) {
      where.categoryId = filters.category;
    }

    // Price filters need to check variants in the new schema
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      where.variants = {
        some: {
          salePrice: {
            ...(filters.minPrice !== undefined ? { gte: filters.minPrice } : {}),
            ...(filters.maxPrice !== undefined ? { lte: filters.maxPrice } : {})
          },
          isActive: true
        }
      };
    }

    if (filters.inStock) {
      const inStockVariantIds = await this.getInStockVariantIds();
      if (inStockVariantIds.size === 0) {
        return {
          items: [],
          page,
          limit,
          total: 0,
          totalPages: 0,
        };
      }
      where.variants = {
        ...where.variants,
        some: {
          ...(where.variants?.some || {}),
          id: { in: [...inStockVariantIds] },
          isActive: true
        }
      };
    }

    // Build orderBy
    // Note: sorting by price or stock is more complex now as they are in variants
    // For now, we keep sorting by basic product fields
    let orderBy: Prisma.ProductOrderByWithRelationInput;
    if (filters.sortBy && ['name', 'createdAt', 'updatedAt'].includes(filters.sortBy)) {
      orderBy = { [filters.sortBy]: filters.sortOrder || 'asc' };
    } else {
      orderBy = { createdAt: 'desc' };
    }

    // Query products
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          name: true,
          description: true,
          typeData: true,
          createdAt: true,
          updatedAt: true,
          variants: {
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              skuCode: true,
              salePrice: true,
              isActive: true,
              attributes: true
            }
          }
        }
      }),
      prisma.product.count({ where })
    ]);

    // Get translations if needed
    let translations: Array<{ productId: string; locale: string; name: string; description: string | null }> = [];
    if (locale !== DEFAULT_LOCALE) {
      translations = await prisma.productTranslation.findMany({
        where: {
          productId: { in: products.map(p => p.id) },
          locale
        }
      });
    }

    // Apply translations and format response
    const filteredProducts = await this.filterPublicProductsBySource(products as any);

    const stockMap = await this.getVariantStockMap(
      filteredProducts.flatMap((product) => product.variants.map((variant) => variant.id))
    );

    const formattedProducts = (filteredProducts as any[]).map(product => {
      const translated = applyTranslation(product as any, translations, locale);

      const displayPrice = product.variants.length > 0
        ? Math.min(...product.variants.map(v => Number(v.salePrice)))
        : 0;
      const totalStock = product.variants.reduce((sum, v) => sum + (stockMap.get(v.id) ?? 0), 0);

      return {
        ...translated,
        // In the new schema images are likely in metadata or typeData,
        // using typeData as fallback if we had images before
        typeData: parseTypeData(product.typeData),
        images: parseImageList(product.typeData),
        price: displayPrice,
        stock: totalStock,
      };
    });

    const result = {
      items: formattedProducts,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    };

    await CacheService.set(cacheKey, result, { ttl: 30 });

    return result;
  }

  /**
   * Get single product details by ID with localization
   *
   * Retrieves a product with all active variants and applies locale-specific translations.
   * Calculates display price from default variant and aggregates total stock.
   * Parses typeData to extract product images.
   * Returns consumer-facing DTO without internal Prisma fields.
   *
   * @param productId Unique identifier of the product
   * @param locale Target locale for product translations (defaults to DEFAULT_LOCALE)
   */
  static async getProductById(
    productId: string,
    locale: Locale = DEFAULT_LOCALE
  ) {
    // Read-through cache
    const version = await CacheService.getProductVersion();
    const cacheKey = `pub:products:detail:v${version}:${productId}:${locale}`;
    const cached = await CacheService.get<Record<string, unknown>>(cacheKey);
    if (cached) return cached;

    const product = await prisma.product.findFirst({
      where: { id: productId, isActive: true },
      include: {
        variants: {
          where: { isActive: true }
        }
      }
    });

    if (!product) {
      return null;
    }

    const [filteredProduct] = await this.filterPublicProductsBySource([product]);
    if (!filteredProduct) {
      return null;
    }

    // Get translation if needed
    let translation = null;
    if (locale !== DEFAULT_LOCALE) {
      translation = await prisma.productTranslation.findUnique({
        where: {
          productId_locale: { productId, locale }
        }
      });
    }

    const displayPrice = filteredProduct.variants.length > 0
      ? Math.min(...filteredProduct.variants.map(v => Number(v.salePrice)))
      : 0;
    const stockMap = await this.getVariantStockMap(
      filteredProduct.variants.map((variant) => variant.id)
    );
    const totalStock = filteredProduct.variants.reduce((sum, v) => sum + (stockMap.get(v.id) ?? 0), 0);

    // Parse typeData for images
    let images: string[] = [];
    images = parseImageList(product.typeData);

    // Return consumer-facing DTO (no Prisma fields, no typeData)
    const dto = {
      id: filteredProduct.id,
      name: translation?.name || filteredProduct.name,
      description: translation?.description || filteredProduct.description,
      typeData: parseTypeData(filteredProduct.typeData),
      images,
      price: displayPrice,
      stock: totalStock,
      requiresShipping: filteredProduct.requiresShipping,
      variants: filteredProduct.variants.map(v => ({
        id: v.id,
        name: v.name,
        skuCode: v.skuCode,
        salePrice: Number(v.salePrice),
        baseStock: stockMap.get(v.id) ?? 0,
        isActive: v.isActive,
        attributes: parseAttributes(v.attributes)
      }))
    };

    await CacheService.set(cacheKey, dto, { ttl: 60 });
    return dto;
  }

  /**
   * Get product category list
   *
   * Retrieves all product categories sorted by sortOrder.
   * Includes product count for each category.
   */
  static async getCategories(page = 1, limit = 20) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const version = await CacheService.getProductVersion();
    const cacheKey = `pub:products:categories:v${version}:${safePage}:${safeLimit}`;
    const cached = await CacheService.get<Record<string, unknown>>(cacheKey);
    if (cached) return cached;

    const skip = (safePage - 1) * safeLimit;

    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        skip,
        take: safeLimit,
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          slug: true,
          _count: {
            select: { products: true }
          }
        }
      }),
      prisma.category.count(),
    ]);

    const result = {
      items: categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        productCount: c._count.products,
      })),
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    };

    await CacheService.set(cacheKey, result, { ttl: 120 });
    return result;
  }

  /**
   * Search products by query with localization
   *
   * Performs case-insensitive search across product names and descriptions.
   * Applies internationalization by fetching and applying translations for the requested locale.
   * Calculates display price from default variant and aggregates total stock.
   * Parses typeData to extract product images.
   * Returns consumer-facing DTOs without internal Prisma fields.
   *
   * @param query Search query string (searches name and description)
   * @param limit Maximum number of results to return
   * @param locale Target locale for product translations (defaults to DEFAULT_LOCALE)
   */
  static async searchProducts(
    query: string,
    page = 1,
    limit = 10,
    locale: Locale = DEFAULT_LOCALE
  ) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 10));

    // Read-through cache
    const version = await CacheService.getProductVersion();
    const qHash = Buffer.from(query || '').toString('base64').slice(0, 64);
    const searchCacheKey = `pub:products:search:v${version}:${locale}:${safePage}:${safeLimit}:${qHash}`;
    const cached = await CacheService.get<Record<string, unknown>>(searchCacheKey);
    if (cached) return cached;

    const skip = (safePage - 1) * safeLimit;

    const where = {
      isActive: true,
      OR: [
        { name: { contains: query, mode: 'insensitive' as const } },
        { description: { contains: query, mode: 'insensitive' as const } }
      ]
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: safeLimit,
        include: {
          variants: {
            where: { isActive: true }
          }
        }
      }),
      prisma.product.count({ where })
    ]);

    // Get translations if needed
    let translations: Array<{ productId: string; locale: string; name: string; description: string | null }> = [];
    if (locale !== DEFAULT_LOCALE) {
      translations = await prisma.productTranslation.findMany({
        where: {
          productId: { in: products.map(p => p.id) },
          locale
        }
      });
    }

    // Return minimal ProductSearchItem DTO (no Prisma fields)
    const filteredProducts = await this.filterPublicProductsBySource(products as any);

    const stockMap = await this.getVariantStockMap(
      filteredProducts.flatMap((product) => product.variants.map((variant) => variant.id))
    );

    const items = (filteredProducts as any[]).map(product => {
      const translation = translations.find(t => t.productId === product.id);
      const displayPrice = product.variants.length > 0
        ? Math.min(...product.variants.map(v => Number(v.salePrice)))
        : 0;
      const totalStock = product.variants.reduce((sum, v) => sum + (stockMap.get(v.id) ?? 0), 0);

      // Parse typeData for images
      let images: string[] = [];
      images = parseImageList(product.typeData);

      return {
        id: product.id,
        name: translation?.name || product.name,
        description: translation?.description || product.description,
        typeData: parseTypeData(product.typeData),
        images,
        price: displayPrice,
        stock: totalStock,
        variants: product.variants.map(v => ({
          id: v.id,
          name: v.name,
          skuCode: v.skuCode,
          salePrice: Number(v.salePrice),
          baseStock: stockMap.get(v.id) ?? 0,
          isActive: v.isActive,
          attributes: parseAttributes(v.attributes)
        }))
      };
    });

    const searchResult = {
      items,
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    };

    await CacheService.set(searchCacheKey, searchResult, { ttl: 20 });
    return searchResult;
  }
}
