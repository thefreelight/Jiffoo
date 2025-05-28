import { prisma } from '@/config/database';
import { CreateProductRequest, UpdateProductRequest } from './types';

export class ProductService {
  static async getAllProducts(page = 1, limit = 10, search?: string) {
    const skip = (page - 1) * limit;
    
    const where = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {};

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

    return {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getProductById(id: string) {
    return prisma.product.findUnique({
      where: { id },
    });
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
