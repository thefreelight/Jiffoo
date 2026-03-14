// @ts-nocheck
/**
* Admin Product Service
* 
* Simplified version, removed multi-tenant logic.
*/

import { prisma } from '@/config/database';
import { CacheService } from '@/core/cache/service';
import { CurrencyService } from '@/core/currency/service';
import { InventoryService } from '@/core/inventory/service';
import { WarehouseService } from '@/core/warehouse/service';
import type { CurrencyPriceResponse } from '@/core/currency/types';

function calculateTrendPercent(current: number, previous: number): number {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  return typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function parseImageList(typeData: unknown): string[] {
  const parsed = parseJsonObject(typeData);
  if (!parsed || !Array.isArray(parsed.images)) {
    return [];
  }

  return parsed.images.filter((item): item is string => typeof item === 'string');
}

function parseAttributes(attributes: unknown): Record<string, unknown> {
  return parseJsonObject(attributes) ?? {};
}

function resolveVariantSalePrice(variant: ProductVariantData): number {
  const candidate = variant.salePrice ?? variant.basePrice;
  const normalized = Number(candidate);
  if (!Number.isFinite(normalized) || normalized < 0) {
    throw new Error('Invalid variant price');
  }
  return normalized;
}

export interface AdminProductSearchFilters {
  search?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  lowStock?: boolean;
  lowStockThreshold?: number;
  sortBy?: 'name' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface AdminProductStatsMetrics {
  totalProducts: number;
  activeProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  totalProductsTrend: number;
  activeProductsTrend: number;
  lowStockProductsTrend: number;
  outOfStockProductsTrend: number;
}

export interface AdminProductStatsResult {
  metrics: AdminProductStatsMetrics;
}

export interface ProductVariantData {
  id?: string;
  name: string;
  salePrice?: number;
  basePrice?: number;
  costPrice?: number | null;
  baseStock: number;
  skuCode?: string;
  isActive?: boolean;
  attributes?: any;
}

export interface CreateProductData {
  name: string;
  slug: string;
  description?: string;
  price?: number; // Compat
  stock?: number; // Compat
  categoryId?: string;
  images?: string[];
  productType?: string;
  requiresShipping?: boolean;
  variants?: ProductVariantData[];
}

export interface UpdateProductData {
  name?: string;
  slug?: string;
  description?: string;
  price?: number;
  stock?: number;
  categoryId?: string;
  images?: string[];
  productType?: string;
  requiresShipping?: boolean;
  variants?: ProductVariantData[];
}

type ProductSourceLink = {
  coreProductId: string;
  provider: string;
  sourceIsActive: boolean | null;
  hasPendingChange: boolean;
  pendingChangeSummary: Record<string, unknown> | null;
};

type VariantSourceLink = {
  coreVariantId: string;
  sourceIsActive: boolean | null;
  hasPendingChange: boolean;
  pendingChangeSummary: Record<string, unknown> | null;
};

type ExternalSourceProductSnapshot = {
  provider: string;
  installationId: string;
  storeId: string;
  externalProductCode: string;
  externalName: string | null;
  externalHash: string | null;
  sourceName: string | null;
  sourceDescription: string | null;
  sourceCategoryCode: string | null;
  sourceIsActive: boolean | null;
  sourcePayloadJson: Record<string, unknown> | null;
  sourcePayloadHash: string | null;
  syncStatus: string;
  sourceUpdatedAt: string | null;
  lastSyncedAt: string | null;
  lastComparedAt: string | null;
  lastApprovedAt: string | null;
  hasPendingChange: boolean;
  pendingChangeSummary: Record<string, unknown> | null;
};

type ExternalSourceVariantSnapshot = {
  coreVariantId: string;
  coreSkuCode: string | null;
  externalVariantCode: string;
  externalProductCode: string;
  externalHash: string | null;
  sourceVariantName: string | null;
  sourceSkuCode: string | null;
  sourceCostPrice: number | null;
  sourceIsActive: boolean | null;
  sourceAttributesJson: Record<string, unknown> | null;
  sourcePayloadHash: string | null;
  syncStatus: string;
  sourceUpdatedAt: string | null;
  lastSyncedAt: string | null;
  lastComparedAt: string | null;
  lastApprovedAt: string | null;
  hasPendingChange: boolean;
  pendingChangeSummary: Record<string, unknown> | null;
};

type ExternalSourceDetails = {
  productId: string;
  productName: string;
  sourceProvider: string | null;
  linked: boolean;
  product: ExternalSourceProductSnapshot | null;
  variants: ExternalSourceVariantSnapshot[];
};

type ExternalSourceAckResult = {
  productId: string;
  acknowledgedAt: string;
  productLinksUpdated: number;
  variantLinksUpdated: number;
};

type ExternalSourceVariantAckResult = {
  productId: string;
  variantId: string;
  acknowledgedAt: string;
  variantLinksUpdated: number;
};

function toIsoString(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export class AdminProductService {
  private static async loadProductSourceLinks(productIds: string[]): Promise<Map<string, ProductSourceLink>> {
    if (productIds.length === 0) return new Map();

    const links = await prisma.externalProductLink.findMany({
      where: {
        coreProductId: { in: productIds },
      },
      select: {
        coreProductId: true,
        provider: true,
        sourceIsActive: true,
        hasPendingChange: true,
        pendingChangeSummary: true,
      },
    });

    return new Map(links.map((link) => [link.coreProductId, link]));
  }

  private static async loadVariantSourceLinks(variantIds: string[]): Promise<Map<string, VariantSourceLink>> {
    if (variantIds.length === 0) return new Map();

    const links = await prisma.externalVariantLink.findMany({
      where: {
        coreVariantId: { in: variantIds },
      },
      select: {
        coreVariantId: true,
        sourceIsActive: true,
        hasPendingChange: true,
        pendingChangeSummary: true,
      },
    });

    return new Map(links.map((link) => [link.coreVariantId, link]));
  }

  /**
   * Get product list (Optimized for Admin List View)
   */
  /**
   * Normalize filters for stable cache keys
   */
  private static toNumber(value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const num = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(num) ? num : undefined;
  }

  private static toBoolean(value: unknown): boolean | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes'].includes(normalized)) return true;
      if (['false', '0', 'no'].includes(normalized)) return false;
    }
    return undefined;
  }

  private static normalizeFilters(filters: AdminProductSearchFilters) {

    const validFilters: Record<string, any> = {};

    if (filters.search?.trim()) validFilters.search = filters.search.trim();
    if (filters.categoryId) validFilters.categoryId = filters.categoryId;

    const minPrice = this.toNumber((filters as any).minPrice);
    if (minPrice !== undefined) validFilters.minPrice = minPrice;

    const maxPrice = this.toNumber((filters as any).maxPrice);
    if (maxPrice !== undefined) validFilters.maxPrice = maxPrice;

    const inStock = this.toBoolean((filters as any).inStock);
    if (inStock !== undefined) validFilters.inStock = inStock;

    const lowStock = this.toBoolean((filters as any).lowStock);
    if (lowStock !== undefined) validFilters.lowStock = lowStock;

    const lowStockThreshold = this.toNumber((filters as any).lowStockThreshold);
    if (lowStockThreshold !== undefined) validFilters.lowStockThreshold = lowStockThreshold;

    if (filters.sortBy) validFilters.sortBy = filters.sortBy;
    if (filters.sortOrder) validFilters.sortOrder = filters.sortOrder;

    // Sort by key to ensure stable serialization
    return Object.keys(validFilters)
      .sort()
      .reduce((obj, key) => {
        obj[key] = validFilters[key];
        return obj;
      }, {} as Record<string, any>);
  }

  private static buildWhere(normalizedFilters: Record<string, any>, storeId?: string) {
    const where: any = {};

    // Filter by store if provided
    if (storeId) {
      where.storeId = storeId;
    }

    if (normalizedFilters.search) {
      where.OR = [
        { name: { contains: normalizedFilters.search, mode: 'insensitive' } },
        { description: { contains: normalizedFilters.search, mode: 'insensitive' } },
      ];
    }

    if (normalizedFilters.categoryId) {
      where.categoryId = normalizedFilters.categoryId;
    }

    if (normalizedFilters.minPrice !== undefined || normalizedFilters.maxPrice !== undefined) {
      where.variants = {
        some: {
          salePrice: {
            ...(normalizedFilters.minPrice !== undefined ? { gte: normalizedFilters.minPrice } : {}),
            ...(normalizedFilters.maxPrice !== undefined ? { lte: normalizedFilters.maxPrice } : {}),
          },
          isActive: true
        }
      };
    }

    return where;
  }

  /**
   * Get product list (Optimized for Admin List View)
   */
  static async getProducts(page = 1, limit = 10, filters: AdminProductSearchFilters = {}, storeId?: string) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 10));
    const normalizedFilters = this.normalizeFilters(filters);

    const skip = (safePage - 1) * safeLimit;

    const where = this.buildWhere(normalizedFilters, storeId);

    if (normalizedFilters.lowStock) {
      const threshold = normalizedFilters.lowStockThreshold || 10;
      const lowStockVariantIds = await InventoryService.getVariantIdsByAvailability({
        minAvailable: 1,
        maxAvailable: threshold,
        onlyActiveVariants: true,
      });
      if (lowStockVariantIds.length === 0) {
        return { items: [], page: safePage, limit: safeLimit, total: 0, totalPages: 0 };
      }
      where.variants = {
        ...where.variants,
        some: {
          ...(where.variants?.some || {}),
          id: { in: lowStockVariantIds },
          isActive: true,
        },
      };
    } else if (normalizedFilters.inStock !== undefined) {
      const inStockVariantIds = await InventoryService.getVariantIdsByAvailability({
        minAvailable: 1,
        onlyActiveVariants: true,
      });
      if (normalizedFilters.inStock) {
        if (inStockVariantIds.length === 0) {
          return { items: [], page: safePage, limit: safeLimit, total: 0, totalPages: 0 };
        }
        where.variants = {
          ...where.variants,
          some: {
            ...(where.variants?.some || {}),
            id: { in: inStockVariantIds },
            isActive: true,
          },
        };
      } else {
        where.variants = {
          ...where.variants,
          none: {
            id: { in: inStockVariantIds },
            isActive: true,
          },
        };
      }
    }

    const orderBy: any = {};
    if (normalizedFilters.sortBy && ['name', 'createdAt', 'updatedAt'].includes(normalizedFilters.sortBy)) {
      orderBy[normalizedFilters.sortBy] = normalizedFilters.sortOrder || 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    // Versioned Cache Key: product:list:v{ver}:{page}:{limit}:{filterHash}:flat
    const version = await CacheService.getProductVersion();
    const filterHash = Buffer.from(JSON.stringify(normalizedFilters)).toString('base64');
    const cacheKey = `product:list:v${version}:${safePage}:${safeLimit}:${filterHash}:flat`;

    const cached = await CacheService.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy,
        select: {
          id: true,
          name: true,
          description: true,
          isActive: true,
          requiresShipping: true,
          createdAt: true, // Needed for list DTO
          category: {
            select: {
              id: true,   // Needed for id
              name: true
            }
          },
          variants: {
            where: { isActive: true },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            select: {
              id: true,
              skuCode: true,
              salePrice: true,
              isActive: true
            }
          },
          _count: {
            select: { variants: true }
          }
        }
      }),
      prisma.product.count({ where })
    ]);

    const sourceLinks = await this.loadProductSourceLinks(products.map((product) => product.id));
    const stockMap = await InventoryService.getAvailableStockByVariantIds(
      products.flatMap((product) => product.variants.map((variant) => variant.id))
    );

    const result = {
      items: products.map(p => {
        const skuCount = p.variants.length;
        const stock = p.variants.reduce((sum, v) => sum + (stockMap.get(v.id) ?? 0), 0);
        const minPrice = skuCount > 0
          ? Math.min(...p.variants.map(v => Number(v.salePrice)))
          : 0;
        const minPriceVariant = skuCount > 0
          ? p.variants.reduce((lowest, current) =>
            Number(current.salePrice) < Number(lowest.salePrice) ? current : lowest
          )
          : null;
        const sourceLink = sourceLinks.get(p.id);

        return {
          id: p.id,
          name: p.name,
          description: p.description,
          categoryId: p.category ? p.category.id : null,
          categoryName: p.category ? p.category.name : null,
          skuCode: minPriceVariant?.skuCode || null,
          price: minPrice,
          stock,
          isActive: p.isActive && skuCount > 0,
          sourceProvider: sourceLink?.provider || null,
          sourceIsActive: sourceLink?.sourceIsActive ?? null,
          hasPendingChange: sourceLink?.hasPendingChange ?? false,
          requiresShippingLocked: sourceLink?.provider === 'odoo',
          variantsCount: p._count.variants,
          createdAt: p.createdAt.toISOString()
        };
      }),
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit)
    };

    await CacheService.set(cacheKey, result, { ttl: 30 });

    return result;
  }

  /**
   * Get global product stats for admin products page
   */
  static async getProductStats(): Promise<AdminProductStatsResult> {
    const lowStockThreshold = 10;
    const now = new Date();
    const startOfTodayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startOfYesterdayUtc = new Date(startOfTodayUtc);
    startOfYesterdayUtc.setUTCDate(startOfYesterdayUtc.getUTCDate() - 1);

    const version = await CacheService.getProductVersion();
    const cacheKey = `product:stats:v${version}`;

    const cached = await CacheService.get<AdminProductStatsResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const products = await prisma.product.findMany({
      select: {
        id: true,
        createdAt: true,
        variants: {
          select: {
            id: true,
            isActive: true,
          },
        },
      },
    });

    const stockMap = await InventoryService.getAvailableStockByVariantIds(
      products.flatMap((product) => product.variants.map((variant) => variant.id))
    );

    let totalProducts = 0;
    let activeProducts = 0;
    let lowStockProducts = 0;
    let outOfStockProducts = 0;
    let todayTotalProducts = 0;
    let yesterdayTotalProducts = 0;
    let todayActiveProducts = 0;
    let yesterdayActiveProducts = 0;
    let todayLowStockProducts = 0;
    let yesterdayLowStockProducts = 0;
    let todayOutOfStockProducts = 0;
    let yesterdayOutOfStockProducts = 0;

    for (const product of products) {
      totalProducts += 1;

      const activeVariants = product.variants.filter((variant) => variant.isActive);
      const activeVariantStocks = activeVariants.map((variant) => stockMap.get(variant.id) ?? 0);
      const isActive = activeVariants.length > 0;
      const isLowStock = activeVariantStocks.some((stock) => stock > 0 && stock <= lowStockThreshold);
      const isOutOfStock = activeVariantStocks.some((stock) => stock <= 0);

      if (isActive) activeProducts += 1;
      if (isLowStock) lowStockProducts += 1;
      if (isOutOfStock) outOfStockProducts += 1;

      if (product.createdAt >= startOfTodayUtc) {
        todayTotalProducts += 1;
        if (isActive) todayActiveProducts += 1;
        if (isLowStock) todayLowStockProducts += 1;
        if (isOutOfStock) todayOutOfStockProducts += 1;
      } else if (product.createdAt >= startOfYesterdayUtc && product.createdAt < startOfTodayUtc) {
        yesterdayTotalProducts += 1;
        if (isActive) yesterdayActiveProducts += 1;
        if (isLowStock) yesterdayLowStockProducts += 1;
        if (isOutOfStock) yesterdayOutOfStockProducts += 1;
      }
    }

    const result: AdminProductStatsResult = {
      metrics: {
        totalProducts,
        activeProducts,
        lowStockProducts,
        outOfStockProducts,
        totalProductsTrend: calculateTrendPercent(todayTotalProducts, yesterdayTotalProducts),
        activeProductsTrend: calculateTrendPercent(todayActiveProducts, yesterdayActiveProducts),
        lowStockProductsTrend: calculateTrendPercent(todayLowStockProducts, yesterdayLowStockProducts),
        outOfStockProductsTrend: calculateTrendPercent(todayOutOfStockProducts, yesterdayOutOfStockProducts),
      },
    };

    await CacheService.set(cacheKey, result, { ttl: 30 });

    return result;
  }

  /**
   * Get single product
   */
  static async getProductById(productId: string) {
    // Try cache first
    const cached = await CacheService.getProduct(productId);
    if (cached) return cached;

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: {
          orderBy: { sortOrder: 'asc' }
        },
        category: true
      }
    });

    if (!product) {
      return null;
    }

    const [productSourceLink, variantSourceLinks] = await Promise.all([
      prisma.externalProductLink.findFirst({
        where: { coreProductId: productId },
        select: {
          provider: true,
          sourceIsActive: true,
          hasPendingChange: true,
          pendingChangeSummary: true,
        },
      }),
      this.loadVariantSourceLinks(product.variants.map((variant) => variant.id)),
    ]);
    const stockMap = await InventoryService.getAvailableStockByVariantIds(
      product.variants.map((variant) => variant.id)
    );

    // Transform to ProductDetailDTO
    const dto = {
      id: product.id,
      name: product.name,
      description: product.description,
      isActive: product.isActive,
      categoryId: product.categoryId,
      categoryName: product.category?.name || null,
      images: parseImageList(product.typeData),
      requiresShipping: product.requiresShipping,
      sourceProvider: productSourceLink?.provider || null,
      sourceIsActive: productSourceLink?.sourceIsActive ?? null,
      hasPendingChange: productSourceLink?.hasPendingChange ?? false,
      pendingChangeSummary: parseJsonObject(productSourceLink?.pendingChangeSummary ?? null),
      requiresShippingLocked: productSourceLink?.provider === 'odoo',
      variants: product.variants.map(v => ({
        id: v.id,
        name: v.name,
        skuCode: v.skuCode,
        salePrice: Number(v.salePrice),
        costPrice: v.costPrice !== null && v.costPrice !== undefined ? Number(v.costPrice) : null,
        baseStock: stockMap.get(v.id) ?? 0,
        isActive: v.isActive,
        sourceIsActive: variantSourceLinks.get(v.id)?.sourceIsActive ?? null,
        hasPendingChange: variantSourceLinks.get(v.id)?.hasPendingChange ?? false,
        pendingChangeSummary: parseJsonObject(variantSourceLinks.get(v.id)?.pendingChangeSummary ?? null),
        attributes: parseAttributes(v.attributes)
      })),
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString()
    };

    // Set cache
    await CacheService.setProduct(productId, dto);
    return dto;
  }

  static async getExternalSourceByProductId(productId: string): Promise<ExternalSourceDetails | null> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        variants: {
          select: {
            id: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!product) {
      return null;
    }

    const [productSourceLink, variantSourceLinks] = await Promise.all([
      prisma.externalProductLink.findFirst({
        where: { coreProductId: productId },
        select: {
          provider: true,
          installationId: true,
          storeId: true,
          externalProductCode: true,
          externalName: true,
          externalHash: true,
          sourceName: true,
          sourceDescription: true,
          sourceCategoryCode: true,
          sourceIsActive: true,
          sourcePayloadJson: true,
          sourcePayloadHash: true,
          syncStatus: true,
          sourceUpdatedAt: true,
          lastSyncedAt: true,
          lastComparedAt: true,
          lastApprovedAt: true,
          hasPendingChange: true,
          pendingChangeSummary: true,
        },
      }),
      prisma.externalVariantLink.findMany({
        where: { coreProductId: productId },
        select: {
          coreVariantId: true,
          coreSkuCode: true,
          externalVariantCode: true,
          externalProductCode: true,
          externalHash: true,
          sourceVariantName: true,
          sourceSkuCode: true,
          sourceCostPrice: true,
          sourceIsActive: true,
          sourceAttributesJson: true,
          sourcePayloadHash: true,
          syncStatus: true,
          sourceUpdatedAt: true,
          lastSyncedAt: true,
          lastComparedAt: true,
          lastApprovedAt: true,
          hasPendingChange: true,
          pendingChangeSummary: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return {
      productId: product.id,
      productName: product.name,
      sourceProvider: productSourceLink?.provider ?? null,
      linked: Boolean(productSourceLink || variantSourceLinks.length > 0),
      product: productSourceLink
        ? {
          provider: productSourceLink.provider,
          installationId: productSourceLink.installationId,
          storeId: productSourceLink.storeId,
          externalProductCode: productSourceLink.externalProductCode,
          externalName: productSourceLink.externalName ?? null,
          externalHash: productSourceLink.externalHash ?? null,
          sourceName: productSourceLink.sourceName ?? null,
          sourceDescription: productSourceLink.sourceDescription ?? null,
          sourceCategoryCode: productSourceLink.sourceCategoryCode ?? null,
          sourceIsActive: productSourceLink.sourceIsActive ?? null,
          sourcePayloadJson: parseJsonObject(productSourceLink.sourcePayloadJson),
          sourcePayloadHash: productSourceLink.sourcePayloadHash ?? null,
          syncStatus: productSourceLink.syncStatus,
          sourceUpdatedAt: toIsoString(productSourceLink.sourceUpdatedAt),
          lastSyncedAt: toIsoString(productSourceLink.lastSyncedAt),
          lastComparedAt: toIsoString(productSourceLink.lastComparedAt),
          lastApprovedAt: toIsoString(productSourceLink.lastApprovedAt),
          hasPendingChange: productSourceLink.hasPendingChange,
          pendingChangeSummary: parseJsonObject(productSourceLink.pendingChangeSummary),
        }
        : null,
      variants: variantSourceLinks.map((link) => ({
        coreVariantId: link.coreVariantId,
        coreSkuCode: link.coreSkuCode ?? null,
        externalVariantCode: link.externalVariantCode,
        externalProductCode: link.externalProductCode,
        externalHash: link.externalHash ?? null,
        sourceVariantName: link.sourceVariantName ?? null,
        sourceSkuCode: link.sourceSkuCode ?? null,
        sourceCostPrice: link.sourceCostPrice !== null && link.sourceCostPrice !== undefined ? Number(link.sourceCostPrice) : null,
        sourceIsActive: link.sourceIsActive ?? null,
        sourceAttributesJson: parseJsonObject(link.sourceAttributesJson),
        sourcePayloadHash: link.sourcePayloadHash ?? null,
        syncStatus: link.syncStatus,
        sourceUpdatedAt: toIsoString(link.sourceUpdatedAt),
        lastSyncedAt: toIsoString(link.lastSyncedAt),
        lastComparedAt: toIsoString(link.lastComparedAt),
        lastApprovedAt: toIsoString(link.lastApprovedAt),
        hasPendingChange: link.hasPendingChange,
        pendingChangeSummary: parseJsonObject(link.pendingChangeSummary),
      })),
    };
  }

  static async acknowledgeExternalSourceChanges(productId: string): Promise<ExternalSourceAckResult | null> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!product) {
      return null;
    }

    const approvedAt = new Date();
    const [productLinksUpdated, variantLinksUpdated] = await Promise.all([
      prisma.externalProductLink.updateMany({
        where: { coreProductId: productId },
        data: {
          hasPendingChange: false,
          pendingChangeSummary: null,
          lastApprovedAt: approvedAt,
        },
      }),
      prisma.externalVariantLink.updateMany({
        where: { coreProductId: productId },
        data: {
          hasPendingChange: false,
          pendingChangeSummary: null,
          lastApprovedAt: approvedAt,
        },
      }),
    ]);

    await CacheService.incrementProductVersion();
    await CacheService.deleteProduct(productId);

    return {
      productId,
      acknowledgedAt: approvedAt.toISOString(),
      productLinksUpdated: productLinksUpdated.count,
      variantLinksUpdated: variantLinksUpdated.count,
    };
  }

  static async acknowledgeExternalSourceVariantChange(
    productId: string,
    variantId: string
  ): Promise<ExternalSourceVariantAckResult | null> {
    const variant = await prisma.productVariant.findFirst({
      where: {
        id: variantId,
        productId,
      },
      select: {
        id: true,
        productId: true,
      },
    });

    if (!variant) {
      return null;
    }

    const approvedAt = new Date();
    const variantLinksUpdated = await prisma.externalVariantLink.updateMany({
      where: {
        coreProductId: productId,
        coreVariantId: variantId,
      },
      data: {
        hasPendingChange: false,
        pendingChangeSummary: null,
        lastApprovedAt: approvedAt,
      },
    });

    await CacheService.incrementProductVersion();
    await CacheService.deleteProduct(productId);

    return {
      productId,
      variantId,
      acknowledgedAt: approvedAt.toISOString(),
      variantLinksUpdated: variantLinksUpdated.count,
    };
  }

  /**
   * Create product
   */
  static async createProduct(data: CreateProductData, storeId: string) {
    let variantsToCreate = data.variants;

    if (!variantsToCreate || variantsToCreate.length === 0) {
      throw new Error('At least one variant is required');
    }

    const defaultWarehouse = await WarehouseService.getDefaultWarehouse();
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name: data.name,
          slug: data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now(),
          description: data.description,
          categoryId: data.categoryId,
          productType: data.productType || 'physical',
          requiresShipping: data.requiresShipping ?? true,
          typeData: { images: data.images ?? [] },
          storeId: storeId,
        } as any,
        select: { id: true }
      });

      for (const [index, variant] of variantsToCreate.entries()) {
        const normalizedStock = Math.max(0, Math.trunc(Number(variant.baseStock ?? 0)));
        const salePrice = resolveVariantSalePrice(variant);
        const createdVariant = await tx.productVariant.create({
          data: {
            productId: created.id,
            name: variant.name,
            salePrice,
            ...(variant.costPrice !== undefined ? { costPrice: variant.costPrice } : {}),
            skuCode: variant.skuCode,
            attributes: variant.attributes ?? undefined,
            isActive: variant.isActive ?? true,
            sortOrder: index,
          },
          select: { id: true },
        });

        await InventoryService.setStock(
          tx,
          createdVariant.id,
          normalizedStock,
          defaultWarehouse.id
        );
      }

      return created;
    });

    await CacheService.incrementProductVersion();

    return this.getProductById(product.id) as any;
  }

  /**
   * Update product
   */
  static async updateProduct(productId: string, data: UpdateProductData) {
    const externalSourceLink = await prisma.externalProductLink.findFirst({
      where: {
        coreProductId: productId,
        provider: 'odoo',
      },
      select: {
        id: true,
      },
    });
    const isOdooLinked = Boolean(externalSourceLink);

    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.categoryId !== undefined) {
      if (data.categoryId === null || data.categoryId === '') {
        updateData.categoryId = null;
      } else {
        // Verify category exists to avoid Foreign Key constraint error
        const category = await prisma.category.findUnique({
          where: { id: data.categoryId }
        });
        if (category) {
          updateData.categoryId = data.categoryId;
        } else {
          console.warn(`Category ${data.categoryId} not found, skipping category update.`);
          // Option: throw error or just skip. Skipping is safer for "soft" updates.
        }
      }
    }
    if (data.productType !== undefined) updateData.productType = data.productType;
    if (!isOdooLinked && data.requiresShipping !== undefined) updateData.requiresShipping = data.requiresShipping;
    if (data.images !== undefined) updateData.typeData = { images: data.images };

    const defaultWarehouse = await WarehouseService.getDefaultWarehouse();

    await prisma.$transaction(async (tx) => {
      // Update product core fields
      await tx.product.update({
        where: { id: productId },
        data: updateData,
      });

      // Handle Variants Upsert
      if (data.variants && data.variants.length > 0) {
        let variantsToProcess = data.variants;

        // 1. Get existing variants
        const existingVariants = await tx.productVariant.findMany({
          where: { productId },
          select: { id: true }
        });
        const existingIds = existingVariants.map(v => v.id);

        const incomingIds = variantsToProcess.map(v => v.id).filter(id => id !== undefined) as string[];

        // 2. Identify variants to delete (existing but not in incoming)
        const toDelete = existingIds.filter(id => !incomingIds.includes(id));
        if (toDelete.length > 0) {
          await tx.productVariant.deleteMany({
            where: { id: { in: toDelete } }
          });
        }

        // 3. Upsert variants
        for (const variant of variantsToProcess) {
          const normalizedStock = Math.max(0, Math.trunc(Number(variant.baseStock ?? 0)));
          const salePrice = resolveVariantSalePrice(variant);
          if (variant.id && existingIds.includes(variant.id)) {
            // Update
            await tx.productVariant.update({
              where: { id: variant.id },
              data: {
                name: variant.name,
                salePrice,
                ...(variant.costPrice !== undefined ? { costPrice: variant.costPrice } : {}),
                skuCode: variant.skuCode,
                attributes: variant.attributes ?? undefined,
                isActive: variant.isActive
              }
            });

            await InventoryService.setStock(
              tx,
              variant.id,
              normalizedStock,
              defaultWarehouse.id
            );
          } else {
            // Create
            const createdVariant = await tx.productVariant.create({
              data: {
                productId,
                name: variant.name,
                salePrice,
                ...(variant.costPrice !== undefined ? { costPrice: variant.costPrice } : {}),
                skuCode: variant.skuCode,
                attributes: variant.attributes ?? undefined,
                isActive: variant.isActive ?? true
              }
            });

            await InventoryService.setStock(
              tx,
              createdVariant.id,
              normalizedStock,
              defaultWarehouse.id
            );
          }
        }
      }
    });

    await CacheService.incrementProductVersion();
    await CacheService.deleteProduct(productId);

    const updatedProduct = await this.getProductById(productId);
    return updatedProduct;
  }

  /**
   * Delete product
   */
  static async deleteProduct(productId: string) {
    await prisma.product.delete({
      where: { id: productId }
    });

    await CacheService.incrementProductVersion();
    await CacheService.deleteProduct(productId);
  }

  /**
   * Bulk delete products
   */
  static async deleteProducts(productIds: string[]) {
    await prisma.product.deleteMany({
      where: { id: { in: productIds } }
    });

    await CacheService.incrementProductVersion();
  }

  /**
   * Get categories list
   * Uses simple cache (60s TTL) as categories rarely change
   */
  static async getCategories(page = 1, limit = 20) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (safePage - 1) * safeLimit;

    const [items, total] = await Promise.all([
      prisma.category.findMany({
        skip,
        take: safeLimit,
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true
        }
      }),
      prisma.category.count(),
    ]);

    return {
      items,
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  /**
   * Set currency-specific price for a product variant
   * Allows admins to set fixed prices for variants in different currencies
   */
  static async setCurrencyPrice(
    productId: string,
    variantId: string,
    currency: string,
    price: number
  ): Promise<CurrencyPriceResponse> {
    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: {
          where: { id: variantId }
        }
      }
    });

    if (!product) {
      throw new Error('Product not found');
    }

    if (product.variants.length === 0) {
      throw new Error('Variant not found or does not belong to this product');
    }

    const currencyService = new CurrencyService();
    const result = await currencyService.setCurrencyPrice(variantId, currency, price);

    // Invalidate product cache
    await CacheService.incrementProductVersion();
    await CacheService.deleteProduct(productId);

    return result;
  }

  /**
   * Get all currency-specific prices for a product variant
   * Returns list of custom prices set for different currencies
   */
  static async getVariantCurrencyPrices(
    productId: string,
    variantId: string
  ): Promise<CurrencyPriceResponse[]> {
    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: {
          where: { id: variantId }
        }
      }
    });

    if (!product) {
      throw new Error('Product not found');
    }

    if (product.variants.length === 0) {
      throw new Error('Variant not found or does not belong to this product');
    }

    const currencyService = new CurrencyService();
    return await currencyService.getVariantCurrencyPrices(variantId);
  }
}
