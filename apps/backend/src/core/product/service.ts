import { prisma } from '@/config/database';
import { CreateProductRequest, UpdateProductRequest } from './types';
import { CacheService } from '@/core/cache/service';
import { LoggerService, OperationType } from '@/core/logger/logger';

export interface ProductSearchFilters {
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sortBy?: 'name' | 'price' | 'createdAt' | 'stock';
  sortOrder?: 'asc' | 'desc';
}

export class ProductService {
  static async getAllProducts(page = 1, limit = 10, filters: ProductSearchFilters = {}) {
    const { search, category, minPrice, maxPrice, inStock, sortBy = 'createdAt', sortOrder = 'desc' } = filters;

    // 创建缓存键
    const cacheKey = JSON.stringify({ page, limit, filters });
    const cached = await CacheService.getProductList(page, limit, { cacheKey });
    if (cached) {
      LoggerService.logCache('GET', `product_list_${cacheKey}`, true);
      return cached;
    }

    const skip = (page - 1) * limit;

    // 构建查询条件
    const where: any = {};

    // 搜索条件
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    // 分类筛选
    if (category) {
      where.category = category;
    }

    // 价格筛选
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) {
        where.price.gte = minPrice;
      }
      if (maxPrice !== undefined) {
        where.price.lte = maxPrice;
      }
    }

    // 库存筛选
    if (inStock !== undefined) {
      if (inStock) {
        where.stock = { gt: 0 };
      } else {
        where.stock = { lte: 0 };
      }
    }

    // 排序条件
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    LoggerService.logDatabase('SELECT', 'product', { where, skip, take: limit, orderBy });

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      prisma.product.count({ where }),
    ]);

    const result = {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        search,
        category,
        minPrice,
        maxPrice,
        inStock,
        sortBy,
        sortOrder,
      },
    };

    // 缓存结果
    await CacheService.setProductList(page, limit, result, { cacheKey });
    LoggerService.logCache('SET', `product_list_${cacheKey}`, false);

    return result;
  }

  static async getProductById(id: string) {
    // 尝试从缓存获取
    const cached = await CacheService.getProduct(id);
    if (cached) {
      LoggerService.logCache('GET', `product_${id}`, true);
      return cached;
    }

    LoggerService.logDatabase('SELECT', 'product', { id });

    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (product) {
      // 缓存产品信息
      await CacheService.setProduct(id, product);
      LoggerService.logCache('SET', `product_${id}`, false);
    }

    return product;
  }

  static async createProduct(data: CreateProductRequest) {
    const product = await prisma.product.create({
      data,
    });

    // 清除商品相关缓存，确保新商品立即显示
    await CacheService.clearProductCache();
    LoggerService.logCache('CLEAR', 'product_*', false);

    return product;
  }

  static async updateProduct(id: string, data: UpdateProductRequest) {
    const product = await prisma.product.update({
      where: { id },
      data,
    });

    // 清除商品相关缓存
    await CacheService.clearProductCache();
    LoggerService.logCache('CLEAR', 'product_*', false);

    return product;
  }

  static async deleteProduct(id: string) {
    const product = await prisma.product.delete({
      where: { id },
    });

    // 清除商品相关缓存
    await CacheService.clearProductCache();
    LoggerService.logCache('CLEAR', 'product_*', false);

    return product;
  }

  static async updateStock(id: string, quantity: number) {
    const product = await prisma.product.findUnique({
      where: { id },
      select: { stock: true },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    const newStock = product.stock + quantity;
    if (newStock < 0) {
      throw new Error('Insufficient stock');
    }

    return prisma.product.update({
      where: { id },
      data: { stock: newStock },
    });
  }

  static async checkStock(id: string, requiredQuantity: number): Promise<boolean> {
    const product = await prisma.product.findUnique({
      where: { id },
      select: { stock: true },
    });

    if (!product) {
      return false;
    }

    return product.stock >= requiredQuantity;
  }

  /**
   * 获取搜索建议
   */
  static async getSearchSuggestions(query: string, limit = 5) {
    if (!query || query.length < 2) {
      return [];
    }

    const products = await prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: query } },
          { description: { contains: query } },
        ],
      },
      select: {
        id: true,
        name: true,
      },
      take: limit,
      orderBy: {
        name: 'asc',
      },
    });

    return products.map(product => ({
      id: product.id,
      text: product.name,
      type: 'product',
    }));
  }

  /**
   * 获取商品分类列表
   */
  static async getCategories() {
    // 由于当前数据库模型中没有分类表，我们从商品中提取唯一的分类
    // 在实际应用中，应该有专门的分类表
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
      },
    });

    // 模拟分类数据
    const categories = [
      { id: 'electronics', name: 'Electronics', count: 0 },
      { id: 'accessories', name: 'Accessories', count: 0 },
      { id: 'audio', name: 'Audio', count: 0 },
      { id: 'computers', name: 'Computers', count: 0 },
      { id: 'mobile', name: 'Mobile', count: 0 },
    ];

    // 简单的分类匹配逻辑
    products.forEach(product => {
      const name = product.name.toLowerCase();
      if (name.includes('headphone') || name.includes('speaker')) {
        categories.find(c => c.id === 'audio')!.count++;
      } else if (name.includes('watch') || name.includes('phone')) {
        categories.find(c => c.id === 'mobile')!.count++;
      } else if (name.includes('laptop') || name.includes('computer')) {
        categories.find(c => c.id === 'computers')!.count++;
      } else if (name.includes('stand') || name.includes('hub') || name.includes('mouse')) {
        categories.find(c => c.id === 'accessories')!.count++;
      } else {
        categories.find(c => c.id === 'electronics')!.count++;
      }
    });

    return categories.filter(category => category.count > 0);
  }

  /**
   * 获取价格范围统计
   */
  static async getPriceRanges() {
    const priceStats = await prisma.product.aggregate({
      _min: { price: true },
      _max: { price: true },
      _avg: { price: true },
    });

    const ranges = [
      { id: '0-50', label: '$0 - $50', min: 0, max: 50, count: 0 },
      { id: '50-100', label: '$50 - $100', min: 50, max: 100, count: 0 },
      { id: '100-200', label: '$100 - $200', min: 100, max: 200, count: 0 },
      { id: '200-500', label: '$200 - $500', min: 200, max: 500, count: 0 },
      { id: '500+', label: '$500+', min: 500, max: 999999, count: 0 },
    ];

    // 获取每个价格范围的商品数量
    for (const range of ranges) {
      const count = await prisma.product.count({
        where: {
          price: {
            gte: range.min,
            lte: range.max === 999999 ? undefined : range.max,
          },
        },
      });
      range.count = count;
    }

    return {
      ranges: ranges.filter(range => range.count > 0),
      stats: {
        min: priceStats._min.price || 0,
        max: priceStats._max.price || 0,
        avg: priceStats._avg.price || 0,
      },
    };
  }

  /**
   * 获取热门搜索关键词
   */
  static async getPopularSearchTerms(limit = 10) {
    // 在实际应用中，这些数据应该来自搜索日志
    // 这里返回模拟数据
    return [
      { term: 'headphones', count: 150 },
      { term: 'laptop', count: 120 },
      { term: 'smartphone', count: 100 },
      { term: 'wireless', count: 80 },
      { term: 'bluetooth', count: 75 },
      { term: 'gaming', count: 60 },
      { term: 'accessories', count: 45 },
      { term: 'speakers', count: 40 },
    ].slice(0, limit);
  }
}
