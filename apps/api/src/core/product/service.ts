/**
 * Product Service (Single Merchant Version)
 *
 * Simplified version, removed multi-tenant related logic.
 */

import { prisma } from '@/config/database';
import { Locale, DEFAULT_LOCALE } from '@/utils/i18n';

interface ProductSearchFilters {
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Apply translation to a product
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

export class ProductService {
  /**
   * Get public product list
   */
  static async getPublicProducts(
    page = 1,
    limit = 10,
    filters: ProductSearchFilters = {},
    locale: Locale = DEFAULT_LOCALE
  ) {
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

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
          basePrice: {
            ...(filters.minPrice !== undefined ? { gte: filters.minPrice } : {}),
            ...(filters.maxPrice !== undefined ? { lte: filters.maxPrice } : {})
          },
          isActive: true
        }
      };
    }

    if (filters.inStock) {
      where.variants = {
        ...where.variants,
        some: {
          ...(where.variants?.some || {}),
          baseStock: { gt: 0 },
          isActive: true
        }
      };
    }

    // Build orderBy
    // Note: sorting by price or stock is more complex now as they are in variants
    // For now, we keep sorting by basic product fields
    const orderBy: any = {};
    if (filters.sortBy && ['name', 'createdAt', 'updatedAt'].includes(filters.sortBy)) {
      orderBy[filters.sortBy] = filters.sortOrder || 'asc';
    } else {
      orderBy.createdAt = 'desc';
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
              basePrice: true,
              baseStock: true,
              isActive: true,
              attributes: true,
              isDefault: true
            }
          }
        }
      }),
      prisma.product.count({ where })
    ]);

    // Get translations if needed
    let translations: any[] = [];
    if (locale !== DEFAULT_LOCALE) {
      translations = await prisma.productTranslation.findMany({
        where: {
          productId: { in: products.map(p => p.id) },
          locale
        }
      });
    }

    // Apply translations and format response
    const formattedProducts = products.map(product => {
      const translated = applyTranslation(product as any, translations, locale);

      // Get price from default variant or first variant
      const mainVariant = product.variants.find(v => v.isDefault) || product.variants[0];
      const displayPrice = mainVariant ? Number(mainVariant.basePrice) : 0;
      const totalStock = product.variants.reduce((sum, v) => sum + (v.baseStock || 0), 0);

      return {
        ...translated,
        // In the new schema images are likely in metadata or typeData, 
        // using typeData as fallback if we had images before
        images: product.typeData ? JSON.parse(product.typeData).images || [] : [],
        price: displayPrice,
        stock: totalStock,
        variants: product.variants
      };
    });

    return {
      products: formattedProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get single product details
   */
  static async getProductById(
    productId: string,
    locale: Locale = DEFAULT_LOCALE
  ) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: {
          where: { isActive: true }
        }
      }
    });

    if (!product) {
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

    const mainVariant = product.variants.find(v => v.isDefault) || product.variants[0];
    const displayPrice = mainVariant ? Number(mainVariant.basePrice) : 0;
    const totalStock = product.variants.reduce((sum, v) => sum + (v.baseStock || 0), 0);

    return {
      ...product,
      name: translation?.name || product.name,
      description: translation?.description || product.description,
      images: product.typeData ? JSON.parse(product.typeData).images || [] : [],
      price: displayPrice,
      stock: totalStock
    };
  }

  /**
   * Get product category list
   */
  static async getCategories() {
    return prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: {
          select: { products: true }
        }
      }
    });
  }

  /**
   * Search products
   */
  static async searchProducts(
    query: string,
    limit = 10,
    locale: Locale = DEFAULT_LOCALE
  ) {
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } }
        ]
      },
      take: limit,
      include: {
        variants: {
          where: { isActive: true }
        }
      }
    });

    // Get translations if needed
    let translations: any[] = [];
    if (locale !== DEFAULT_LOCALE) {
      translations = await prisma.productTranslation.findMany({
        where: {
          productId: { in: products.map(p => p.id) },
          locale
        }
      });
    }

    return products.map(product => {
      const translated = applyTranslation(product as any, translations, locale);

      const mainVariant = product.variants.find(v => v.isDefault) || product.variants[0];
      const displayPrice = mainVariant ? Number(mainVariant.basePrice) : 0;

      return {
        ...translated,
        images: product.typeData ? JSON.parse(product.typeData).images || [] : [],
        price: displayPrice
      };
    });
  }
}
