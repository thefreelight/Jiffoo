/**
 * Product Service
 *
 * Handles public product queries with support for:
 * - Multi-tenant isolation
 * - Locale-based translations
 * - 🆕 Agent Mall authorization filtering (Self path)
 */

import { prisma } from '@/config/database';
import { Locale, DEFAULT_LOCALE } from '@/utils/i18n';
import { AgentAuthorizationService } from '@/plugins/agent/authorization';

interface ProductSearchFilters {
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface MallContext {
  type: 'TENANT' | 'AGENT';
  tenantId: number;
  agentId?: string;
  agentName?: string;
}

/**
 * Apply translation to a product
 * Falls back to original product fields if translation is not available
 */
function applyTranslation(
  product: { id: string; name: string; description: string | null; [key: string]: any },
  translations: Array<{ productId: string; locale: string; name: string; description: string | null }>,
  locale: Locale
): typeof product {
  // If locale is default (en), return original product
  if (locale === DEFAULT_LOCALE) {
    return product;
  }

  // Find translation for this product and locale
  const translation = translations.find(
    (t) => t.productId === product.id && t.locale === locale
  );

  if (!translation) {
    // No translation found, return original
    return product;
  }

  // Apply translation (only override if translation exists)
  return {
    ...product,
    name: translation.name || product.name,
    description: translation.description ?? product.description,
  };
}

export class ProductService {
  /**
   * 获取公开商品列表（面向用户）
   * 只返回展示所需的字段，不包含敏感信息
   * 🆕 支持 Agent Mall 场景下的授权过滤和价格计算
   *
   * @param page - Page number
   * @param limit - Items per page
   * @param filters - Search filters
   * @param tenantId - Tenant ID
   * @param locale - Locale for translations (default: 'en')
   * @param agentId - Agent ID for agent mall context (optional)
   */
  static async getPublicProducts(
    page = 1,
    limit = 10,
    filters: ProductSearchFilters = {},
    tenantId?: string,
    locale: Locale = DEFAULT_LOCALE,
    agentId?: string | null
  ) {
    if (tenantId === undefined || tenantId === null) throw new Error('Tenant ID is required for product access');
    const skip = (page - 1) * limit;
    const numericTenantId = parseInt(tenantId);

    // 🆕 Build mall context
    let mallContext: MallContext = {
      type: 'TENANT',
      tenantId: numericTenantId
    };

    // 🆕 If agentId provided, validate and set agent context
    let selfConfigMap: Map<string, any> | null = null;
    if (agentId) {
      const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        select: { id: true, tenantId: true, status: true, name: true }
      });

      if (agent && agent.tenantId === numericTenantId && agent.status === 'ACTIVE') {
        mallContext = {
          type: 'AGENT',
          tenantId: numericTenantId,
          agentId: agent.id,
          agentName: agent.name || undefined
        };
      }
    }

    const where: any = {
      tenantId: numericTenantId,
      // Don't filter by stock by default - show all products including out of stock
    };

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters.category) where.category = filters.category;
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      where.price = {};
      if (filters.minPrice !== undefined) where.price.gte = filters.minPrice;
      if (filters.maxPrice !== undefined) where.price.lte = filters.maxPrice;
    }
    if (filters.inStock !== undefined) {
      where.stock = filters.inStock ? { gt: 0 } : { lte: 0 };
    }

    const orderBy: any = {};
    orderBy[filters.sortBy || 'createdAt'] = filters.sortOrder || 'desc';

    const [rawProducts, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          category: true,
          images: true,
          stock: true,
          createdAt: true,
          agentCanDelegate: true,
          variants: {
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              basePrice: true,
              baseStock: true,
              agentCanDelegate: true
            }
          }
        }
      }),
      prisma.product.count({ where })
    ]);

    // 🆕 Get Self configs for both Tenant Mall and Agent Mall
    // 统一使用 AgentAuthorizationService 来决定可售变体和价格
    if (rawProducts.length > 0) {
      selfConfigMap = new Map();
      const ownerType = mallContext.type === 'AGENT' ? 'AGENT' : 'TENANT';
      const ownerId = mallContext.type === 'AGENT' ? mallContext.agentId! : tenantId;

      for (const product of rawProducts) {
        const configs = await AgentAuthorizationService.getSelfVariantConfig({
          tenantId: numericTenantId,
          ownerType,
          ownerId,
          productId: product.id
        });
        configs.forEach((config, variantId) => {
          selfConfigMap!.set(variantId, config);
        });
      }
    }

    // Fetch translations if locale is not default
    let translations: Array<{ productId: string; locale: string; name: string; description: string | null }> = [];
    if (locale !== DEFAULT_LOCALE && rawProducts.length > 0) {
      const productIds = rawProducts.map((p) => p.id);
      translations = await prisma.productTranslation.findMany({
        where: {
          productId: { in: productIds },
          locale: locale,
        },
        select: {
          productId: true,
          locale: true,
          name: true,
          description: true,
        },
      });
    }

    // Transform products to include inventory object and parse images
    const products = rawProducts.map(product => {
      // Apply translation
      const translatedProduct = applyTranslation(product, translations, locale);

      // 🆕 Process variants with authorization (统一应用于 Tenant Mall 和 Agent Mall)
      let processedVariants = product.variants.map(v => {
        let effectivePrice = v.basePrice;
        let canSell = true;

        // 应用授权配置（Tenant Mall 使用 TENANT 的 SelfConfig，Agent Mall 使用 AGENT 的 SelfConfig）
        if (selfConfigMap && selfConfigMap.has(v.id)) {
          const config = selfConfigMap.get(v.id);
          canSell = config.canSellSelf;
          effectivePrice = config.effectivePrice;
        }

        return {
          id: v.id,
          name: v.name,
          price: effectivePrice,
          basePrice: v.basePrice,
          stock: v.baseStock,
          isAuthorized: canSell
        };
      });

      // 🆕 过滤掉未授权的变体（对 Tenant Mall 和 Agent Mall 统一处理）
      processedVariants = processedVariants.filter(v => v.isAuthorized);

      // Calculate display price (lowest variant price or product price)
      const displayPrice = processedVariants.length > 0
        ? Math.min(...processedVariants.map(v => v.price))
        : product.price;

      return {
        ...translatedProduct,
        price: displayPrice,
        images: product.images ? JSON.parse(product.images as string) : [],
        sku: product.id,
        category: {
          id: product.category || 'uncategorized',
          name: product.category || 'Uncategorized',
          slug: product.category || 'uncategorized',
          level: 0,
          isActive: true,
          productCount: 0,
        },
        tags: [],
        variants: processedVariants,
        inventory: {
          quantity: product.stock,
          reserved: 0,
          available: product.stock,
          lowStockThreshold: 10,
          isInStock: product.stock > 0,
          isLowStock: product.stock > 0 && product.stock <= 10,
          trackInventory: true,
        },
        specifications: [],
        isActive: true,
        isFeatured: false,
        rating: 0,
        reviewCount: 0,
        updatedAt: product.createdAt,
        stock: undefined,
      };
    });

    // 🆕 Filter out products with no authorized variants in agent mall
    const filteredProducts = mallContext.type === 'AGENT'
      ? products.filter(p => p.variants.length > 0)
      : products;

    return {
      products: filteredProducts,
      pagination: { page, limit, total: filteredProducts.length, totalPages: Math.ceil(filteredProducts.length / limit) },
      mallContext
    };
  }

  /**
   * 获取公开商品详情（面向用户）
   * 只返回展示所需的字段，不包含敏感信息
   * 🆕 支持 Agent Mall 场景下的授权过滤和价格计算
   *
   * @param id - Product ID
   * @param tenantId - Tenant ID
   * @param locale - Locale for translations (default: 'en')
   * @param agentId - Agent ID for agent mall context (optional)
   */
  static async getPublicProductById(
    id: string,
    tenantId?: string,
    locale: Locale = DEFAULT_LOCALE,
    agentId?: string | null
  ): Promise<{ product: any; mallContext: MallContext } | null> {
    if (tenantId === undefined || tenantId === null) throw new Error('Tenant ID is required for product access');
    const numericTenantId = parseInt(tenantId);

    // 🆕 Build mall context
    let mallContext: MallContext = {
      type: 'TENANT',
      tenantId: numericTenantId
    };

    // 🆕 If agentId provided, validate and set agent context
    if (agentId) {
      const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        select: { id: true, tenantId: true, status: true, name: true }
      });

      if (agent && agent.tenantId === numericTenantId && agent.status === 'ACTIVE') {
        mallContext = {
          type: 'AGENT',
          tenantId: numericTenantId,
          agentId: agent.id,
          agentName: agent.name || undefined
        };
      }
    }

    const product = await prisma.product.findFirst({
      where: {
        id,
        tenantId: numericTenantId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        category: true,
        images: true,
        stock: true,
        createdAt: true,
        agentCanDelegate: true,
        variants: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            basePrice: true,
            baseStock: true,
            agentCanDelegate: true
          }
        }
      }
    });

    if (!product) return null;

    // 🆕 Get Self configs for both Tenant Mall and Agent Mall
    // 统一使用 AgentAuthorizationService 来决定可售变体和价格
    const ownerType = mallContext.type === 'AGENT' ? 'AGENT' : 'TENANT';
    const ownerId = mallContext.type === 'AGENT' ? mallContext.agentId! : tenantId;

    const selfConfigMap = await AgentAuthorizationService.getSelfVariantConfig({
      tenantId: numericTenantId,
      ownerType,
      ownerId,
      productId: id
    });

    // Fetch translation if locale is not default
    let translations: Array<{ productId: string; locale: string; name: string; description: string | null }> = [];
    if (locale !== DEFAULT_LOCALE) {
      const translation = await prisma.productTranslation.findUnique({
        where: {
          productId_locale: {
            productId: id,
            locale: locale,
          },
        },
        select: {
          productId: true,
          locale: true,
          name: true,
          description: true,
        },
      });
      if (translation) {
        translations = [translation];
      }
    }

    // Apply translation
    const translatedProduct = applyTranslation(product, translations, locale);

    // 🆕 Process variants with authorization (统一应用于 Tenant Mall 和 Agent Mall)
    let processedVariants = product.variants.map(v => {
      let effectivePrice = v.basePrice;
      let canSell = true;

      // 应用授权配置
      if (selfConfigMap && selfConfigMap.has(v.id)) {
        const config = selfConfigMap.get(v.id);
        canSell = config.canSellSelf;
        effectivePrice = config.effectivePrice;
      }

      return {
        id: v.id,
        name: v.name,
        price: effectivePrice,
        basePrice: v.basePrice,
        stock: v.baseStock,
        isAuthorized: canSell
      };
    });

    // 🆕 过滤掉未授权的变体（对 Tenant Mall 和 Agent Mall 统一处理）
    processedVariants = processedVariants.filter(v => v.isAuthorized);
    // If no variants are authorized, return null (product not available)
    if (processedVariants.length === 0 && product.variants.length > 0) {
      return null;
    }

    // Calculate display price
    const displayPrice = processedVariants.length > 0
      ? Math.min(...processedVariants.map(v => v.price))
      : product.price;

    // Transform product to include inventory object and parse images
    return {
      product: {
        ...translatedProduct,
        price: displayPrice,
        images: product.images ? JSON.parse(product.images as string) : [],
        sku: product.id,
        category: {
          id: product.category || 'uncategorized',
          name: product.category || 'Uncategorized',
          slug: product.category || 'uncategorized',
          level: 0,
          isActive: true,
          productCount: 0,
        },
        tags: [],
        variants: processedVariants,
        inventory: {
          quantity: product.stock,
          reserved: 0,
          available: product.stock,
          lowStockThreshold: 10,
          isInStock: product.stock > 0,
          isLowStock: product.stock > 0 && product.stock <= 10,
          trackInventory: true,
        },
        specifications: [],
        isActive: true,
        isFeatured: false,
        rating: 0,
        reviewCount: 0,
        updatedAt: product.createdAt,
        stock: undefined,
      },
      mallContext
    };
  }



  /**
   * 获取商品分类（公开）
   */
  static async getCategories(tenantId: string) {
    if (!tenantId) throw new Error('Tenant ID is required for categories');

    const categories = await prisma.product.groupBy({
      by: ['category'],
      where: {
        tenantId: parseInt(tenantId),
        // Don't filter by stock - show all categories
        category: { not: null }
      },
      _count: { id: true }
    });

    return categories
      .filter(cat => cat.category) // 过滤掉空分类
      .map(cat => ({
        name: cat.category,
        count: cat._count.id
      }))
      .sort((a, b) => b.count - a.count); // 按商品数量排序
  }


}
