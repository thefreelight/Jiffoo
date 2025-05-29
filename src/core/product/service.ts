import { prisma } from '@/config/database';
import { CreateProductRequest, UpdateProductRequest } from './types';
import { CacheService } from '@/core/cache/service';
import { LoggerService, OperationType } from '@/core/logger/logger';

export class ProductService {
  static async getAllProducts(page = 1, limit = 10, search?: string) {
    const filters = { search };

    // 尝试从缓存获取
    const cached = await CacheService.getProductList(page, limit, filters);
    if (cached) {
      LoggerService.logCache('GET', `product_list_${page}_${limit}`, true);
      return cached;
    }

    const skip = (page - 1) * limit;

    const where = search ? {
      OR: [
        { name: { contains: search } },
        { description: { contains: search } },
      ],
    } : {};

    LoggerService.logDatabase('SELECT', 'product', { where, skip, take: limit });

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
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
    };

    // 缓存结果
    await CacheService.setProductList(page, limit, result, filters);
    LoggerService.logCache('SET', `product_list_${page}_${limit}`, false);

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
    return prisma.product.create({
      data,
    });
  }

  static async updateProduct(id: string, data: UpdateProductRequest) {
    return prisma.product.update({
      where: { id },
      data,
    });
  }

  static async deleteProduct(id: string) {
    return prisma.product.delete({
      where: { id },
    });
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
}
