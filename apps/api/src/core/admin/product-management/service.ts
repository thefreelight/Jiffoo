/**
* Admin Product Service
* 
* Product management service for the self-hosted Core.
*/

import { prisma } from '@/config/database';
import { ApiError, knownPrismaOperation } from '@/utils/api-errors';
import { CacheService } from '@/core/cache/service';
import { InventoryService } from '@/core/inventory/service';
import { systemSettingsService } from '@/core/settings/service';
import { emitEvent } from '@/infra/events/emit';
import { productSnapshot } from '@/infra/events/snapshots';
import { Prisma } from '@prisma/client';
import { OrderService } from '@/core/order/service';
import { currencyExponent } from '@/core/shared/money';
import { resolveProductCode, withProductCodeRetry } from './codes';
import { productIds, productCount } from './list-query';
import { CATEGORY_SLUG_PATTERN } from './schemas';

function validateCategorySlug(slug: string) {
  if (typeof slug !== 'string' || !new RegExp(CATEGORY_SLUG_PATTERN).test(slug)) {
    throw new ApiError('VALIDATION_ERROR');
  }
}

async function protectOrderedCatalog<T>(operation: () => Promise<T>, references: () => Prisma.OrderItemWhereInput): Promise<T> {
  try { return await operation(); }
  catch (error) {
    if (OrderService.isOrderItemCatalogRestriction(error)) throw new ApiError('PRODUCT_HAS_ORDERS');
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      // Prisma can omit the PostgreSQL constraint name. Confirm the order reference after rollback.
      if (await prisma.orderItem.count({ where: references() })) throw new ApiError('PRODUCT_HAS_ORDERS');
    }
    throw error;
  }
}

/**
 * Transaction surface required to lock the variant rows of a product.
 *
 * A Prisma transaction client satisfies it, so the caller passes its own
 * transaction client straight through.
 */
type VariantRowLockTx = {
  $queryRaw: (...args: any[]) => Promise<any>;
};

/**
 * Take the row lock of every variant of a product.
 *
 * The rows are locked in the order of their identifiers, so every writer of
 * these rows takes the locks in the same order and two concurrent admin edits
 * of the same product cannot deadlock. The lock is taken before the variants
 * are read, so the read and the write of a variant belong to the same locked
 * state and a concurrent edit of a variant cannot be overwritten silently.
 *
 * @param tx Transaction client owned by the caller
 * @param productId Product whose variant rows are locked
 */
export async function lockProductVariantRows(tx: VariantRowLockTx, productId: string): Promise<void> {
  await tx.$queryRaw`
    SELECT id FROM public.product_variants
    WHERE "productId" = ${productId}
    ORDER BY id FOR UPDATE
  `;
}

export class CatalogConflictError extends ApiError {
  constructor(public readonly code: 'DEFAULT_LOCALE_TRANSLATION' | 'CATEGORY_NOT_EMPTY') {
    super(code);
  }
}

async function rejectDefaultLocaleTranslation(translations?: ContentTranslation[]) {
  if (!translations?.length) return;
  const defaultLocale = await systemSettingsService.getShopLocale();
  if (translations.some((row) => row.locale === defaultLocale)) {
    throw new CatalogConflictError('DEFAULT_LOCALE_TRANSLATION');
  }
}

function calculateTrendPercent(current: number, previous: number): number {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

function activeProductWhere(): Prisma.ProductWhereInput {
  return { isActive: true, variants: { some: { isActive: true } } };
}

function productAvailability(isActive: boolean, activeVariants: number, stock: number) {
  const active = isActive && activeVariants > 0;
  return { active, outOfStock: active && stock === 0 };
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
    throw new ApiError('INTERNAL_SERVER_ERROR');
  }
  return normalized;
}

/**
 * Whether a price is representable in a currency.
 *
 * The money module reads a price as the text of its number and refuses the
 * amount whose decimal places beyond the exponent of the currency are not all
 * zeros, so the same text decides here whether the price is representable.
 * A text the money module cannot read at all is not representable either.
 *
 * @param value Price the admin writes
 * @param exponent Exponent of the currency of the store
 */
export function isPriceRepresentable(value: number, exponent: number): boolean {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(String(value).trim());
  if (!match) return false;
  return (match[3] ?? '').slice(exponent).replace(/0/g, '') === '';
}

/**
 * Refuse a price the currency of the store cannot represent.
 *
 * The money module refuses an amount the currency cannot represent, so a
 * price with a fraction in a store whose currency has no fraction breaks the
 * quote of the checkout long after the merchant entered it. The write is
 * refused here, where the currency of the store is known.
 *
 * The refusal never rounds the price: a representable price is written as it
 * is, a price that is not representable is refused.
 *
 * The reason travels in the structured details of the error, because the
 * error mapper of the Core replaces the message of a validation error with a
 * fixed one.
 *
 * @param value Price the admin writes
 * @param currency Currency of the store
 * @param field Path of the field the price belongs to
 */
function assertPriceRepresentable(value: number, currency: string, field: string): void {
  if (isPriceRepresentable(value, currencyExponent(currency))) return;
  const reason = `Price ${value} cannot be represented in ${currency}`;
  const code = /^[A-Za-z]{2,8}$/.test(currency) ? `PRICE_NOT_REPRESENTABLE_IN_${currency.toUpperCase()}` : 'PRICE_NOT_REPRESENTABLE';
  const error = new ApiError('VALIDATION_ERROR', { issues: [{ path: field, message: reason, code }] });
  error.message = reason;
  throw error;
}

export interface AdminProductSearchFilters {
  productType?: string;
  status?: 'active' | 'inactive' | 'outOfStock';
  search?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'price' | 'stock';
  sortOrder?: 'asc' | 'desc';
}

export interface AdminProductStatsMetrics {
  totalProducts: number;
  activeProducts: number;
  outOfStockProducts: number;
  totalProductsTrend: number;
  activeProductsTrend: number;
  outOfStockProductsTrend: number;
}

export interface AdminProductStatsResult {
  statusCounts: { all: number; active: number; inactive: number; outOfStock: number };
  metrics: AdminProductStatsMetrics;
}

/** One aggregate row of the product statistics query. */
type ProductStatsRow = {
  totalProducts: bigint;
  activeProducts: bigint;
  outOfStockProducts: bigint;
  todayTotal: bigint;
  todayActive: bigint;
  todayOutOfStock: bigint;
  yesterdayTotal: bigint;
  yesterdayActive: bigint;
  yesterdayOutOfStock: bigint;
};

export interface ProductVariantData {
  id?: string;
  name: string;
  salePrice?: number;
  basePrice?: number;
  costPrice?: number | null;
  /** The strike-through price of the variant; it is never below its sale price. */
  compareAtPrice?: number | null;
  stock: number;
  /**
   * Stock level the editor saw. When it is given, the stock write only lands
   * when the stored level is still that level, so an editor that saves a stale
   * level gets a conflict instead of overwriting a concurrent sale.
   */
  expectedStock?: number;
  skuCode?: string;
  isActive?: boolean;
  attributes?: any;
}

/**
 * Options of the single-product write operations.
 *
 * The default keeps the behaviour of the single-product endpoints: the product
 * cache version is bumped, the cached product is dropped and the written
 * product is read back. A bulk caller that discards the read skips that work
 * and bumps the cache version once for the whole batch.
 */
export interface AdminProductWriteOptions {
  /** Skip the cache version bump; the cached product is still dropped. */
  skipCacheVersionBump?: boolean;
  /** Skip the read that returns the product after the write. */
  skipReload?: boolean;
}

/**
 * The product write transactions loop over every variant, so they need more
 * room than the default transaction timeout.
 */
const PRODUCT_WRITE_TRANSACTION_TIMEOUT_MS = 30_000;
const PRODUCT_WRITE_TRANSACTION_MAX_WAIT_MS = 10_000;

export interface ContentTranslation {
  locale: string;
  name: string;
  description?: string | null;
}

export interface CreateProductData {
  isActive?: boolean;
  name: string;
  spuCode?: string;
  slug: string;
  description?: string;
  price?: number; // Compat
  stock?: number; // Compat
  categoryId?: string;
  images?: string[];
  productType?: string;
  requiresShipping?: boolean;
  variants?: ProductVariantData[];
  translations?: ContentTranslation[];
}

export interface UpdateProductData {
  spuCode?: string;
  isActive?: boolean;
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
  translations?: ContentTranslation[];
}

export class AdminProductService {
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
    if (filters.status) validFilters.status = filters.status;
    if (filters.productType) validFilters.productType = filters.productType;

    const minPrice = this.toNumber((filters as any).minPrice);
    if (minPrice !== undefined) validFilters.minPrice = minPrice;

    const maxPrice = this.toNumber((filters as any).maxPrice);
    if (maxPrice !== undefined) validFilters.maxPrice = maxPrice;

    const inStock = this.toBoolean((filters as any).inStock);
    if (inStock !== undefined) validFilters.inStock = inStock;

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


  /**
   * Get product list (Optimized for Admin List View)
   */
  static async getProducts(page = 1, limit = 20, filters: AdminProductSearchFilters = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const normalizedFilters = this.normalizeFilters(filters);

    const skip = (safePage - 1) * safeLimit;


    // Versioned cache key for the required product-code DTO.
    const version = await CacheService.getProductVersion();
    const filterHash = Buffer.from(JSON.stringify(normalizedFilters)).toString('base64');
    const cacheKey = `product:list:v${version}:${safePage}:${safeLimit}:${filterHash}:ordered-v3`;

    const cached = await CacheService.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const currency = await systemSettingsService.getShopCurrency();
    const [ids, total] = await Promise.all([
      productIds(normalizedFilters, normalizedFilters, safeLimit, skip), productCount(normalizedFilters),
    ]);
    const products = await prisma.product.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          name: true,
          spuCode: true,
          description: true,
          isActive: true,
          typeData: true,
          requiresShipping: true,
          createdAt: true,
          updatedAt: true,
          orderItems: { select: { id: true }, take: 1 },
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
      });
    products.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));

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
        return {
          id: p.id,
          name: p.name,
          spuCode: p.spuCode,
          description: p.description,
          categoryId: p.category ? p.category.id : null,
          categoryName: p.category ? p.category.name : null,
          skuCode: minPriceVariant?.skuCode || null,
          price: minPrice,
          currency,
          priceMin: minPrice,
          priceMax: skuCount ? Math.max(...p.variants.map(v => Number(v.salePrice))) : 0,
          images: parseImageList(p.typeData),
          stock,
          isActive: productAvailability(p.isActive, skuCount, stock).active,
          variantsActiveCount: skuCount,
          variantsCount: p._count.variants,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(), hasOrders: p.orderItems.length > 0,
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

    // The whole statistics is one aggregate query. The products and their
    // active variants are counted and summed in the database, so no product
    // row set is materialised in the application. The availability rules are
    // the ones of the product list: a product is active when it is enabled and
    // has at least one active variant, and it is out of stock when the active
    // variants hold no stock at all.
    const activeCondition = Prisma.sql`(p."isActive" AND a.active_count > 0)`;
    const todayCondition = Prisma.sql`p."createdAt" >= (${startOfTodayUtc}::timestamptz AT TIME ZONE 'UTC')`;
    const yesterdayCondition = Prisma.sql`p."createdAt" >= (${startOfYesterdayUtc}::timestamptz AT TIME ZONE 'UTC') AND p."createdAt" < (${startOfTodayUtc}::timestamptz AT TIME ZONE 'UTC')`;
    const [stats] = await prisma.$queryRaw<ProductStatsRow[]>(Prisma.sql`
      SELECT
        COUNT(*) AS "totalProducts",
        COUNT(*) FILTER (WHERE ${activeCondition}) AS "activeProducts",
        COUNT(*) FILTER (WHERE ${activeCondition} AND a.active_stock = 0) AS "outOfStockProducts",
        COUNT(*) FILTER (WHERE ${todayCondition}) AS "todayTotal",
        COUNT(*) FILTER (WHERE ${todayCondition} AND ${activeCondition}) AS "todayActive",
        COUNT(*) FILTER (WHERE ${todayCondition} AND ${activeCondition} AND a.active_stock = 0) AS "todayOutOfStock",
        COUNT(*) FILTER (WHERE ${yesterdayCondition}) AS "yesterdayTotal",
        COUNT(*) FILTER (WHERE ${yesterdayCondition} AND ${activeCondition}) AS "yesterdayActive",
        COUNT(*) FILTER (WHERE ${yesterdayCondition} AND ${activeCondition} AND a.active_stock = 0) AS "yesterdayOutOfStock"
      FROM public.products p
      LEFT JOIN LATERAL (
        SELECT COUNT(*) FILTER (WHERE v."isActive") AS active_count,
          COALESCE(SUM(v.stock) FILTER (WHERE v."isActive"), 0) AS active_stock
        FROM public.product_variants v WHERE v."productId" = p.id
      ) a ON TRUE`);

    const totalProducts = Number(stats?.totalProducts ?? 0);
    const activeProducts = Number(stats?.activeProducts ?? 0);
    const outOfStockProducts = Number(stats?.outOfStockProducts ?? 0);
    const todayTotalProducts = Number(stats?.todayTotal ?? 0);
    const todayActiveProducts = Number(stats?.todayActive ?? 0);
    const todayOutOfStockProducts = Number(stats?.todayOutOfStock ?? 0);
    const yesterdayTotalProducts = Number(stats?.yesterdayTotal ?? 0);
    const yesterdayActiveProducts = Number(stats?.yesterdayActive ?? 0);
    const yesterdayOutOfStockProducts = Number(stats?.yesterdayOutOfStock ?? 0);

    const result: AdminProductStatsResult = {
      statusCounts: { all: totalProducts, active: activeProducts, inactive: totalProducts - activeProducts, outOfStock: outOfStockProducts },
      metrics: {
        totalProducts,
        activeProducts,
        outOfStockProducts,
        totalProductsTrend: calculateTrendPercent(todayTotalProducts, yesterdayTotalProducts),
        activeProductsTrend: calculateTrendPercent(todayActiveProducts, yesterdayActiveProducts),
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
    const key = `admin:product:editor-v1:${await CacheService.getProductVersion()}:${productId}`;
    const decorate = async (dto: any) => {
      const [ordered, currency, stock] = await Promise.all([
        prisma.orderItem.findMany({ where: { variantId: { in: dto.variants.map((variant: any) => variant.id) } }, distinct: ['variantId'], select: { variantId: true } }),
        systemSettingsService.getShopCurrency(),
        InventoryService.getAvailableStockByVariantIds(dto.variants.map((variant: any) => variant.id)),
      ]);
      const sold = new Set(ordered.map(item => item.variantId));
      return { ...dto, currency, variants: dto.variants.map((variant: any) => ({ ...variant, stock: stock.get(variant.id) ?? 0, hasOrders: sold.has(variant.id) })) };
    };
    const cached = await CacheService.get<any>(key);
    if (cached) return decorate(cached);

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: {
          orderBy: { sortOrder: 'asc' }
        },
        translations: true,
        category: true
      }
    });

    if (!product) {
      return null;
    }

    const stockMap = await InventoryService.getAvailableStockByVariantIds(
      product.variants.map((variant) => variant.id)
    );

    // Transform to ProductDetailDTO
    const dto = {
      id: product.id,
      slug: product.slug,
      name: product.name,
      spuCode: product.spuCode,
      description: product.description,
      isActive: product.isActive,
      categoryId: product.categoryId,
      categoryName: product.category?.name || null,
      translations: product.translations.map(({ locale, name, description }) => ({ locale, name, description })),
      images: parseImageList(product.typeData),
      requiresShipping: product.requiresShipping,
      variants: product.variants.map(v => ({
        id: v.id,
        name: v.name,
        skuCode: v.skuCode,
        salePrice: Number(v.salePrice),
        costPrice: v.costPrice !== null && v.costPrice !== undefined ? Number(v.costPrice) : null,
        compareAtPrice: v.compareAtPrice !== null && v.compareAtPrice !== undefined ? Number(v.compareAtPrice) : null,
        stock: stockMap.get(v.id) ?? 0,
        isActive: v.isActive,
        attributes: parseAttributes(v.attributes)
      })),
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString()
    };

    // Set cache
    await CacheService.set(key, dto, { ttl: 60 });
    return decorate(dto);
  }

  /**
   * Refuse the prices of a write the currency of the store cannot represent.
   *
   * The currency of the store decides how many decimal places a price may
   * have, and the request schema is static, so the check belongs here.
   *
   * @param productPrice Price of the product itself, when the write carries one
   * @param variants Variants of the write, when the write carries any
   */
  private static async assertPricesRepresentable(productPrice?: number, variants?: ProductVariantData[]): Promise<void> {
    const currency = await systemSettingsService.getShopCurrency();
    if (typeof productPrice === 'number') assertPriceRepresentable(productPrice, currency, 'price');
    for (const [index, variant] of (variants ?? []).entries()) {
      const salePrice = variant.salePrice ?? variant.basePrice;
      if (typeof salePrice === 'number') {
        const field = typeof variant.salePrice === 'number' ? 'salePrice' : 'basePrice';
        assertPriceRepresentable(salePrice, currency, `variants.${index}.${field}`);
      }
      if (typeof variant.costPrice === 'number') {
        assertPriceRepresentable(variant.costPrice, currency, `variants.${index}.costPrice`);
      }
      if (typeof variant.compareAtPrice === 'number') {
        assertPriceRepresentable(variant.compareAtPrice, currency, `variants.${index}.compareAtPrice`);
      }
    }
  }

  /**
   * Create product
   */
  static async createProduct(data: CreateProductData) {
    await rejectDefaultLocaleTranslation(data.translations);
    await this.assertPricesRepresentable(data.price, data.variants);
    let variantsToCreate = data.variants;

    if (!variantsToCreate || variantsToCreate.length === 0) {
      throw new ApiError('INTERNAL_SERVER_ERROR');
    }

    const product = await withProductCodeRetry(context => prisma.$transaction(async (tx) => {
      const spuCode = await resolveProductCode(tx, context, { field: 'spuCode', input: data.spuCode, name: data.name });
      const created = await tx.product.create({
        data: {
          name: data.name,
          isActive: data.isActive ?? true,
          spuCode,
          slug: data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now(),
          description: data.description,
          categoryId: data.categoryId,
          productType: data.productType || 'physical',
          requiresShipping: data.requiresShipping ?? true,
          typeData: { images: data.images ?? [] },
          translations: { create: (data.translations ?? []).map(({ locale, name, description }) => ({ locale, name, description })) },
        } as any,
        select: { id: true }
      });

      for (const [index, variant] of variantsToCreate.entries()) {
        const normalizedStock = Math.max(0, Math.trunc(Number(variant.stock ?? 0)));
        const salePrice = resolveVariantSalePrice(variant);
        const skuCode = await resolveProductCode(tx, context, { field: 'skuCode', input: variant.skuCode, spuCode, name: data.name, variantIndex: index });
        const createdVariant = await tx.productVariant.create({
          data: {
            productId: created.id,
            name: variant.name,
            salePrice,
            ...(variant.costPrice !== undefined ? { costPrice: variant.costPrice } : {}),
            ...(variant.compareAtPrice !== undefined ? { compareAtPrice: variant.compareAtPrice } : {}),
            skuCode,
            attributes: variant.attributes ?? undefined,
            isActive: variant.isActive ?? true,
            sortOrder: index,
          },
          select: { id: true },
        });

        // The inventory module owns the stock column, so the desired level is applied
        // through it. The surrounding product creation publishes the product change.
        await InventoryService.applyDesiredStock(tx, createdVariant.id, normalizedStock, {
          type: 'initial',
          reason: 'product_created',
          referenceId: created.id,
        }, { publishProductChange: false });
      }

      await emitEvent(tx, 'product.created', 1, created.id, await productSnapshot(tx, created.id));
      return created;
    }, { timeout: PRODUCT_WRITE_TRANSACTION_TIMEOUT_MS, maxWait: PRODUCT_WRITE_TRANSACTION_MAX_WAIT_MS }));

    await CacheService.incrementProductVersion();

    return this.getProductById(product.id) as any;
  }

  /**
   * Update product
   */
  static async updateProduct(productId: string, data: UpdateProductData, options: AdminProductWriteOptions = {}) {
    await rejectDefaultLocaleTranslation(data.translations);
    await this.assertPricesRepresentable(data.price, data.variants);
    const updateData: any = {};
    let removedVariantIds: string[] = [];
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

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
    if (data.requiresShipping !== undefined) updateData.requiresShipping = data.requiresShipping;
    if (data.images !== undefined) updateData.typeData = { images: data.images };


    await knownPrismaOperation(() => protectOrderedCatalog(() => withProductCodeRetry(context => prisma.$transaction(async (tx) => {
      const existingProduct = await tx.product.findUniqueOrThrow({ where: { id: productId }, select: { spuCode: true, name: true } });
      const spuCode = await resolveProductCode(tx, context, { field: 'spuCode', input: data.spuCode,
        existing: existingProduct.spuCode, excludeId: productId, name: data.name ?? existingProduct.name });
      updateData.spuCode = spuCode;
      // Update product core fields
      await tx.product.update({
        where: { id: productId },
        data: updateData,
      });
      if (data.translations !== undefined) {
        await tx.productTranslation.deleteMany({ where: { productId } });
        if (data.translations.length) {
          await tx.productTranslation.createMany({
            data: data.translations.map(({ locale, name, description }) => ({ productId, locale, name, description })),
          });
        }
      }

      // Handle Variants Upsert
      if (data.variants && data.variants.length > 0) {
        let variantsToProcess = data.variants;

        // The variant rows are locked before they are read, so the read and the
        // write of a variant belong to the same locked state and a concurrent
        // admin edit of a variant is serialised instead of overwriting it.
        await lockProductVariantRows(tx, productId);

        // 1. Get existing variants
        const existingVariants = await tx.productVariant.findMany({
          where: { productId },
          select: { id: true, skuCode: true }
        });
        const existingIds = existingVariants.map(v => v.id);

        const incomingIds = variantsToProcess.map(v => v.id).filter(id => id !== undefined) as string[];

        // 2. Identify variants to delete (existing but not in incoming)
        const toDelete = existingIds.filter(id => !incomingIds.includes(id));
        removedVariantIds = toDelete;
        if (toDelete.length > 0) {
          if (await tx.orderItem.count({ where: { variantId: { in: toDelete } } })) {
            throw new ApiError('PRODUCT_HAS_ORDERS');
          }
          await tx.productVariant.deleteMany({
            where: { id: { in: toDelete } }
          });
        }

        // 3. Upsert variants
        for (const [index, variant] of variantsToProcess.entries()) {
          const normalizedStock = Math.max(0, Math.trunc(Number(variant.stock ?? 0)));
          const salePrice = resolveVariantSalePrice(variant);
          const existingVariant = existingVariants.find(v => v.id === variant.id);
          const skuCode = await resolveProductCode(tx, context, { field: 'skuCode', input: variant.skuCode,
            existing: existingVariant?.skuCode, excludeId: existingVariant?.id, spuCode,
            name: data.name ?? existingProduct.name, variantIndex: index, variantId: existingVariant?.id });
          if (variant.id && existingIds.includes(variant.id)) {
            // Update
            await tx.productVariant.update({
              where: { id: variant.id },
              data: {
                name: variant.name,
                salePrice,
                ...(variant.costPrice !== undefined ? { costPrice: variant.costPrice } : {}),
                ...(variant.compareAtPrice !== undefined ? { compareAtPrice: variant.compareAtPrice } : {}),
                skuCode,
                attributes: variant.attributes ?? undefined,
                isActive: variant.isActive
              }
            });

            await InventoryService.applyDesiredStock(tx, variant.id, normalizedStock, {
              type: 'correction',
              reason: 'product_updated',
              referenceId: productId,
            }, { publishProductChange: false, expectedStock: variant.expectedStock });

          } else {
            // Create
            const createdVariant = await tx.productVariant.create({
              data: {
                productId,
                name: variant.name,
                salePrice,
                ...(variant.costPrice !== undefined ? { costPrice: variant.costPrice } : {}),
                ...(variant.compareAtPrice !== undefined ? { compareAtPrice: variant.compareAtPrice } : {}),
                skuCode,
                attributes: variant.attributes ?? undefined,
                isActive: variant.isActive ?? true
              }
            });

            // A new variant has no prior level, so there is nothing to compare
            // the requested stock against.
            await InventoryService.applyDesiredStock(tx, createdVariant.id, normalizedStock, {
              type: 'initial',
              reason: 'product_updated',
              referenceId: productId,
            }, { publishProductChange: false });
          }
        }
      }
      await emitEvent(tx, 'product.updated', 1, productId, await productSnapshot(tx, productId));
    }, { timeout: PRODUCT_WRITE_TRANSACTION_TIMEOUT_MS, maxWait: PRODUCT_WRITE_TRANSACTION_MAX_WAIT_MS })), () => ({ variantId: { in: removedVariantIds } })), { notFound: 'NOT_FOUND' });

    if (!options.skipCacheVersionBump) await CacheService.incrementProductVersion();
    await CacheService.deleteProduct(productId);
    if (options.skipReload) return null;

    const updatedProduct = await this.getProductById(productId);
    return updatedProduct;
  }

  /**
   * Delete product
   */
  static async deleteProduct(productId: string, options: AdminProductWriteOptions = {}) {
    await knownPrismaOperation(() => protectOrderedCatalog(async () => {
      try {
        await prisma.$transaction(async tx => {
          if (await tx.orderItem.count({ where: { productId } })) throw new ApiError('PRODUCT_HAS_ORDERS');
          if (await tx.cartItem.count({ where: { productId } })) throw new ApiError('CONFLICT');
          await tx.product.delete({ where: { id: productId } });
        });
      } catch (error) {
        // Preserve the cart reference if a line was added after the transaction's check.
        const cartRestriction = error instanceof Prisma.PrismaClientUnknownRequestError &&
          /code: "23001"/.test(error.message) && /cart_items_(productId|variantId)_fkey/.test(error.message);
        if (cartRestriction || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003' &&
          await prisma.cartItem.count({ where: { productId } }))) throw new ApiError('CONFLICT');
        throw error;
      }
    }, () => ({ productId })), { notFound: 'NOT_FOUND' });

    if (!options.skipCacheVersionBump) await CacheService.incrementProductVersion();
    await CacheService.deleteProduct(productId);
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
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          translations: { select: { locale: true, name: true, description: true } },
          _count: { select: { products: true, children: true } },
        }
      }),
      prisma.category.count(),
    ]);

    return {
      items: items.map(({ _count, ...category }) => ({ ...category, productCount: _count.products, childCount: _count.children })),
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  static async getCategoryById(id: string) {
    return prisma.category.findUnique({
      where: { id },
      select: {
        id: true, name: true, slug: true, description: true, parentId: true,
        translations: { select: { locale: true, name: true, description: true } },
      },
    });
  }

  static async createCategory(data: { name: string; slug: string; description?: string; translations?: ContentTranslation[] }) {
    validateCategorySlug(data.slug);
    await rejectDefaultLocaleTranslation(data.translations);
    const category = await prisma.category.create({
      data: {
        name: data.name, slug: data.slug, description: data.description,
        translations: { create: data.translations ?? [] },
      },
      select: { id: true },
    });
    await CacheService.incrementProductVersion();
    return this.getCategoryById(category.id);
  }

  static async updateCategory(id: string, data: { name?: string; slug?: string; description?: string; translations?: ContentTranslation[] }) {
    if (data.slug !== undefined) validateCategorySlug(data.slug);
    await rejectDefaultLocaleTranslation(data.translations);
    await knownPrismaOperation(() => prisma.$transaction(async (tx) => {
      await tx.category.update({
        where: { id },
        data: {
          name: data.name, slug: data.slug, description: data.description,
        },
      });
      if (data.translations !== undefined) {
        await tx.categoryTranslation.deleteMany({ where: { categoryId: id } });
        if (data.translations.length) {
          await tx.categoryTranslation.createMany({
            data: data.translations.map(({ locale, name, description }) => ({ categoryId: id, locale, name, description })),
          });
        }
      }
    }), { notFound: 'INTERNAL_SERVER_ERROR' });
    await CacheService.incrementProductVersion();
    return this.getCategoryById(id);
  }

  static async deleteCategory(id: string) {
    await knownPrismaOperation(() => prisma.$transaction(async (tx) => {
      const [products, children] = await Promise.all([
        tx.product.count({ where: { categoryId: id } }),
        tx.category.count({ where: { parentId: id } }),
      ]);
      if (products || children) throw new CatalogConflictError('CATEGORY_NOT_EMPTY');
      await tx.category.delete({ where: { id } });
    }), { notFound: 'INTERNAL_SERVER_ERROR' });
    await CacheService.incrementProductVersion();
  }

}
