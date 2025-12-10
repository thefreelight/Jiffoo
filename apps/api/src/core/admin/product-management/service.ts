/**
 * Admin Product Service (单商户版本)
 * 
 * 简化版本，移除了多租户相关逻辑。
 */

import { prisma } from '@/config/database';

export interface AdminProductSearchFilters {
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  lowStock?: boolean;
  lowStockThreshold?: number;
  sortBy?: 'name' | 'price' | 'createdAt' | 'stock';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateProductData {
  name: string;
  description?: string;
  price: number;
  stock: number;
  category?: string;
  images?: string[];
}

export interface UpdateProductData {
  name?: string;
  description?: string;
  price?: number;
  stock?: number;
  category?: string;
  images?: string[];
}

export class AdminProductService {
  /**
   * 获取商品列表
   */
  static async getProducts(page = 1, limit = 10, filters: AdminProductSearchFilters = {}) {
    const skip = (page - 1) * limit;

    const where: any = {};
    
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    
    if (filters.category) {
      where.category = filters.category;
    }
    
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      where.price = {};
      if (filters.minPrice !== undefined) where.price.gte = filters.minPrice;
      if (filters.maxPrice !== undefined) where.price.lte = filters.maxPrice;
    }
    
    if (filters.inStock !== undefined) {
      where.stock = filters.inStock ? { gt: 0 } : { lte: 0 };
    }

    if (filters.lowStock !== undefined && filters.lowStock) {
      const threshold = filters.lowStockThreshold || 10;
      where.stock = { lte: threshold, gt: 0 };
    }

    const orderBy: any = {};
    orderBy[filters.sortBy || 'createdAt'] = filters.sortOrder || 'desc';

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          variants: true
        }
      }),
      prisma.product.count({ where })
    ]);

    return {
      products: products.map(p => ({
        ...p,
        images: p.images ? JSON.parse(p.images as string) : [],
        price: Number(p.price)
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * 获取单个商品
   */
  static async getProductById(productId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: true,
        translations: true
      }
    });

    if (!product) {
      return null;
    }

    return {
      ...product,
      images: product.images ? JSON.parse(product.images as string) : [],
      price: Number(product.price)
    };
  }

  /**
   * 创建商品
   */
  static async createProduct(data: CreateProductData) {
    const product = await prisma.product.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        stock: data.stock,
        category: data.category || 'Uncategorized',
        images: data.images ? JSON.stringify(data.images) : null
      }
    });

    return {
      ...product,
      images: product.images ? JSON.parse(product.images as string) : [],
      price: Number(product.price)
    };
  }

  /**
   * 更新商品
   */
  static async updateProduct(productId: string, data: UpdateProductData) {
    const updateData: any = {};
    
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.stock !== undefined) updateData.stock = data.stock;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.images !== undefined) updateData.images = JSON.stringify(data.images);

    const product = await prisma.product.update({
      where: { id: productId },
      data: updateData
    });

    return {
      ...product,
      images: product.images ? JSON.parse(product.images as string) : [],
      price: Number(product.price)
    };
  }

  /**
   * 删除商品
   */
  static async deleteProduct(productId: string) {
    await prisma.product.delete({
      where: { id: productId }
    });
    return { success: true };
  }

  /**
   * 批量删除商品
   */
  static async deleteProducts(productIds: string[]) {
    await prisma.product.deleteMany({
      where: { id: { in: productIds } }
    });
    return { success: true, count: productIds.length };
  }

  /**
   * 更新库存
   */
  static async updateStock(productId: string, stock: number) {
    const product = await prisma.product.update({
      where: { id: productId },
      data: { stock }
    });

    return {
      ...product,
      images: product.images ? JSON.parse(product.images as string) : [],
      price: Number(product.price)
    };
  }

  /**
   * 获取分类列表
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
}
