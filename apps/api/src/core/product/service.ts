/**
 * Product Service (单商户版本)
 *
 * 简化版本，移除了多租户和代理商相关逻辑。
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
  product: { id: string; name: string; description: string | null; [key: string]: any },
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
   * 获取公开商品列表
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
      where.category = filters.category;
    }

    if (filters.minPrice !== undefined) {
      where.price = { ...where.price, gte: filters.minPrice };
    }

    if (filters.maxPrice !== undefined) {
      where.price = { ...where.price, lte: filters.maxPrice };
    }

    if (filters.inStock) {
      where.stock = { gt: 0 };
    }

    // Build orderBy
    const orderBy: any = {};
    if (filters.sortBy) {
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
          price: true,
          stock: true,
          images: true,
          category: true,
          createdAt: true,
          updatedAt: true,
          variants: {
            select: {
              id: true,
              name: true,
              skuCode: true,
              basePrice: true,
              baseStock: true,
              isActive: true,
              attributes: true
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
      const translated = applyTranslation(product, translations, locale);
      return {
        ...translated,
        images: product.images ? JSON.parse(product.images as string) : [],
        price: Number(product.price)
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
   * 获取单个商品详情
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

    return {
      ...product,
      name: translation?.name || product.name,
      description: translation?.description || product.description,
      images: product.images ? JSON.parse(product.images as string) : [],
      price: Number(product.price)
    };
  }

  /**
   * 获取商品分类列表
   */
  static async getCategories() {
    const categories = await prisma.product.groupBy({
      by: ['category'],
      _count: { category: true }
    });

    return categories.map(c => ({
      name: c.category,
      count: c._count.category
    }));
  }

  /**
   * 搜索商品
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
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        images: true,
        category: true
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
      const translated = applyTranslation(product, translations, locale);
      return {
        ...translated,
        images: product.images ? JSON.parse(product.images as string) : [],
        price: Number(product.price)
      };
    });
  }
}
