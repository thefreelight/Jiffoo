/**
 * Admin Product Service
 * 
 * Simplified version, removed multi-tenant logic.
 */

import { prisma } from '@/config/database';

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

export interface CreateProductData {
  name: string;
  slug: string;
  description?: string;
  price: number;
  stock: number;
  categoryId?: string;
  images?: string[];
  productType?: string;
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
}

export class AdminProductService {
  /**
   * Get product list
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

    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }

    // Price filters need to check variants
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

    if (filters.inStock !== undefined) {
      if (filters.inStock) {
        where.variants = {
          ...where.variants,
          some: {
            ...(where.variants?.some || {}),
            baseStock: { gt: 0 },
            isActive: true
          }
        };
      } else {
        where.variants = {
          every: {
            baseStock: { lte: 0 }
          }
        };
      }
    }

    if (filters.lowStock !== undefined && filters.lowStock) {
      const threshold = filters.lowStockThreshold || 10;
      where.variants = {
        some: {
          baseStock: { lte: threshold, gt: 0 },
          isActive: true
        }
      };
    }

    const orderBy: any = {};
    if (filters.sortBy && ['name', 'createdAt', 'updatedAt'].includes(filters.sortBy)) {
      orderBy[filters.sortBy] = filters.sortOrder || 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          variants: true,
          category: true
        }
      }),
      prisma.product.count({ where })
    ]);

    return {
      products: products.map(p => {
        const mainVariant = p.variants.find(v => v.isDefault) || p.variants[0];
        const displayPrice = mainVariant ? Number(mainVariant.basePrice) : 0;
        const totalStock = p.variants.reduce((sum, v) => sum + (v.baseStock || 0), 0);

        return {
          ...p,
          images: p.typeData ? JSON.parse(p.typeData).images || [] : [],
          price: displayPrice,
          stock: totalStock
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get single product
   */
  static async getProductById(productId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: true,
        translations: true,
        category: true
      }
    });

    if (!product) {
      return null;
    }

    const mainVariant = product.variants.find(v => v.isDefault) || product.variants[0];
    const displayPrice = mainVariant ? Number(mainVariant.basePrice) : 0;
    const totalStock = product.variants.reduce((sum, v) => sum + (v.baseStock || 0), 0);

    return {
      ...product,
      images: product.typeData ? JSON.parse(product.typeData).images || [] : [],
      price: displayPrice,
      stock: totalStock
    };
  }

  /**
   * Create product
   */
  static async createProduct(data: CreateProductData) {
    const product = await prisma.product.create({
      data: {
        name: data.name,
        slug: data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now(),
        description: data.description,
        categoryId: data.categoryId,
        productType: data.productType || 'physical',
        typeData: data.images ? JSON.stringify({ images: data.images }) : JSON.stringify({ images: [] }),
        variants: {
          create: {
            name: 'Default',
            basePrice: data.price,
            baseStock: data.stock,
            isDefault: true,
            isActive: true
          }
        }
      },
      include: {
        variants: true
      }
    });

    return {
      ...product,
      images: data.images || [],
      price: data.price,
      stock: data.stock
    };
  }

  /**
   * Update product
   */
  static async updateProduct(productId: string, data: UpdateProductData) {
    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
    if (data.productType !== undefined) updateData.productType = data.productType;
    if (data.images !== undefined) updateData.typeData = JSON.stringify({ images: data.images });

    // Update product
    const product = await prisma.product.update({
      where: { id: productId },
      data: updateData,
      include: {
        variants: true
      }
    });

    // Update default variant if price or stock provided
    if (data.price !== undefined || data.stock !== undefined) {
      const defaultVariant = product.variants.find(v => v.isDefault) || product.variants[0];
      if (defaultVariant) {
        await prisma.productVariant.update({
          where: { id: defaultVariant.id },
          data: {
            basePrice: data.price !== undefined ? data.price : defaultVariant.basePrice,
            baseStock: data.stock !== undefined ? data.stock : defaultVariant.baseStock
          }
        });
      }
    }

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
    return { success: true };
  }

  /**
   * Bulk delete products
   */
  static async deleteProducts(productIds: string[]) {
    await prisma.product.deleteMany({
      where: { id: { in: productIds } }
    });
    return { success: true, count: productIds.length };
  }

  /**
   * Update stock (updates default variant)
   */
  static async updateStock(productId: string, stock: number) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { variants: true }
    });

    if (!product) throw new Error('Product not found');

    const defaultVariant = product.variants.find(v => v.isDefault) || product.variants[0];
    if (defaultVariant) {
      await prisma.productVariant.update({
        where: { id: defaultVariant.id },
        data: { baseStock: stock }
      });
    }

    return this.getProductById(productId);
  }

  /**
   * Get categories list
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
}
