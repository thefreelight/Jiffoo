import { prisma } from '@/config/database';
import { CacheService } from '@/core/cache/service';
import { LoggerService } from '@/core/logger/logger';

export interface SearchFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  tags?: string[];
}

export interface SortOptions {
  field: 'name' | 'price' | 'createdAt' | 'updatedAt' | 'stock';
  order: 'asc' | 'desc';
}

export interface SearchResult {
  products: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: SearchFilters;
  sort: SortOptions;
}

export class SearchService {
  static async searchProducts(
    query?: string,
    filters: SearchFilters = {},
    sort: SortOptions = { field: 'createdAt', order: 'desc' },
    page: number = 1,
    limit: number = 10
  ): Promise<SearchResult> {
    // 尝试从缓存获取搜索结果
    const cached = await CacheService.getSearchResults(query || '', filters, page, limit);
    if (cached) {
      LoggerService.logCache('GET', `search_${query || 'all'}`, true);
      return cached;
    }

    const offset = (page - 1) * limit;

    // 构建搜索条件
    const where: any = {};

    // 文本搜索 (SQLite 不支持 mode: 'insensitive')
    if (query) {
      where.OR = [
        {
          name: {
            contains: query
          }
        },
        {
          description: {
            contains: query
          }
        }
      ];
    }

    // 价格范围过滤
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      where.price = {};
      if (filters.minPrice !== undefined) {
        where.price.gte = filters.minPrice;
      }
      if (filters.maxPrice !== undefined) {
        where.price.lte = filters.maxPrice;
      }
    }

    // 库存过滤
    if (filters.inStock !== undefined) {
      if (filters.inStock) {
        where.stock = { gt: 0 };
      } else {
        where.stock = { lte: 0 };
      }
    }

    // 分类过滤 (假设我们添加了分类字段)
    if (filters.category) {
      where.category = filters.category;
    }

    // 构建排序条件
    const orderBy: any = {};
    orderBy[sort.field] = sort.order;

    // 执行搜索
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
        include: {
          orderItems: {
            select: {
              quantity: true,
              order: {
                select: {
                  status: true,
                  createdAt: true
                }
              }
            }
          }
        }
      }),
      prisma.product.count({ where })
    ]);

    // 计算销量和评分等额外信息
    const enrichedProducts = products.map(product => {
      const totalSold = product.orderItems
        .filter(item => item.order.status === 'COMPLETED')
        .reduce((sum, item) => sum + item.quantity, 0);

      return {
        ...product,
        totalSold,
        orderItems: undefined // 移除详细订单信息
      };
    });

    const totalPages = Math.ceil(total / limit);

    const result = {
      products: enrichedProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages
      },
      filters,
      sort
    };

    // 缓存搜索结果
    await CacheService.setSearchResults(query || '', filters, page, limit, result);
    LoggerService.logCache('SET', `search_${query || 'all'}`, false);

    return result;
  }

  static async getSearchSuggestions(query: string, limit: number = 5): Promise<string[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const products = await prisma.product.findMany({
      where: {
        OR: [
          {
            name: {
              contains: query
            }
          },
          {
            description: {
              contains: query
            }
          }
        ]
      },
      select: {
        name: true
      },
      take: limit
    });

    return products.map(p => p.name);
  }

  static async getPopularSearchTerms(limit: number = 10): Promise<{ term: string; count: number }[]> {
    // 这里可以从搜索日志中获取热门搜索词
    // 暂时返回模拟数据
    return [
      { term: 'iPhone', count: 150 },
      { term: 'MacBook', count: 120 },
      { term: '耳机', count: 100 },
      { term: '手机', count: 90 },
      { term: '电脑', count: 80 }
    ].slice(0, limit);
  }

  static async getProductCategories(): Promise<{ category: string; count: number }[]> {
    // 假设我们有分类字段，这里返回分类统计
    // 由于当前数据库没有分类字段，返回模拟数据
    return [
      { category: '电子产品', count: 25 },
      { category: '服装', count: 18 },
      { category: '家居', count: 12 },
      { category: '运动', count: 8 },
      { category: '图书', count: 5 }
    ];
  }

  static async getPriceRange(): Promise<{ min: number; max: number }> {
    const result = await prisma.product.aggregate({
      _min: {
        price: true
      },
      _max: {
        price: true
      }
    });

    return {
      min: result._min.price || 0,
      max: result._max.price || 0
    };
  }

  static async getRelatedProducts(productId: string, limit: number = 5): Promise<any[]> {
    // 获取相关商品 - 基于分类或标签
    const currentProduct = await prisma.product.findUnique({
      where: { id: productId },
      select: { name: true, price: true }
    });

    if (!currentProduct) {
      return [];
    }

    // 简单的相关商品逻辑：价格相近的商品
    const priceRange = currentProduct.price * 0.3; // 30% 价格范围

    const relatedProducts = await prisma.product.findMany({
      where: {
        AND: [
          { id: { not: productId } },
          {
            price: {
              gte: currentProduct.price - priceRange,
              lte: currentProduct.price + priceRange
            }
          }
        ]
      },
      take: limit,
      orderBy: {
        createdAt: 'desc'
      }
    });

    return relatedProducts;
  }
}
