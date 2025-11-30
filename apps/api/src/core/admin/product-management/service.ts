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

/**
 * 管理员商品管理服务
 * 提供完整的商品CRUD操作和管理功能
 */
export class AdminProductService {
  
  /**
   * 获取商品列表（管理员专用）
   */
  static async getProducts(page = 1, limit = 10, filters: AdminProductSearchFilters = {}, tenantId: string) {
    const skip = (page - 1) * limit;

    const where: any = { tenantId: parseInt(tenantId) };
    
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
      where.stock = { lte: threshold, gt: 0 }; // 低库存但不为0
    }

    const orderBy: any = {};
    orderBy[filters.sortBy || 'createdAt'] = filters.sortOrder || 'desc';

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
          category: true,
          images: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.product.count({ where })
    ]);

    return {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * 获取商品详情（管理员专用）
   * 包含变体信息用于授权管理
   */
  static async getProductById(id: string, tenantId: string) {
    return prisma.product.findFirst({
      where: {
        id,
        tenantId: parseInt(tenantId)
      },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        stock: true,
        category: true,
        images: true,
        createdAt: true,
        updatedAt: true,
        agentCanDelegate: true,
        variants: {
          select: {
            id: true,
            name: true,
            basePrice: true,
            baseStock: true,
            skuCode: true,
            sortOrder: true,
            isActive: true,
            agentCanDelegate: true
          },
          orderBy: { sortOrder: 'asc' }
        }
      }
    });
  }

  /**
   * 创建商品
   */
  static async createProduct(data: any, tenantId: string) {
    return prisma.product.create({
      data: {
        ...data,
        tenantId: parseInt(tenantId)
      },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        stock: true,
        category: true,
        images: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  /**
   * 更新商品
   */
  static async updateProduct(id: string, data: any, tenantId: string) {
    return prisma.product.update({
      where: {
        id,
        tenantId: parseInt(tenantId)
      },
      data,
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        stock: true,
        category: true,
        images: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  /**
   * 删除商品
   */
  static async deleteProduct(id: string, tenantId: string) {
    await prisma.product.delete({
      where: {
        id,
        tenantId: parseInt(tenantId)
      }
    });
  }

  /**
   * 批量操作商品
   */
  static async batchOperation(
    action: string,
    productIds: string[],
    tenantId: string,
    stockQuantity?: number,
    reason?: string,
    operatorId?: string
  ) {
    const where = {
      id: { in: productIds },
      tenantId: parseInt(tenantId)
    };

    switch (action) {
      case 'delete': {
        const deleteResult = await prisma.product.deleteMany({ where });
        return {
          action: 'delete',
          deletedCount: deleteResult.count,
          productIds
        };
      }

      case 'updateStock': {
        if (stockQuantity === undefined) {
          throw new Error('Stock quantity is required for updateStock action');
        }
        const updateResult = await prisma.product.updateMany({
          where,
          data: { stock: stockQuantity }
        });

        // 记录批量操作日志
        if (operatorId) {
          await prisma.auditLog.create({
            data: {
              userId: operatorId,
              action: 'BATCH_STOCK_UPDATE',
              module: 'product',
              resourceId: productIds.join(','),
              metadata: JSON.stringify({
                action: 'updateStock',
                productCount: productIds.length,
                newStock: stockQuantity,
                reason: reason || 'Batch stock update'
              }),
              tenantId: parseInt(tenantId)
            }
          });
        }

        return {
          action: 'updateStock',
          updatedCount: updateResult.count,
          productIds,
          stockQuantity
        };
      }

      case 'increaseStock': {
        if (stockQuantity === undefined) {
          throw new Error('Stock quantity is required for increaseStock action');
        }

        // 批量增加库存需要逐个处理以记录之前的库存
        const increaseResults = [];
        for (const productId of productIds) {
          try {
            const result = await this.adjustStock(
              productId,
              'increase',
              stockQuantity,
              reason || 'Batch stock increase',
              operatorId || 'system',
              tenantId
            );
            increaseResults.push(result);
          } catch (error) {
            // 继续处理其他商品，记录错误
            increaseResults.push({
              productId,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }

        return {
          action: 'increaseStock',
          results: increaseResults,
          successCount: increaseResults.filter(r => !('error' in r)).length,
          errorCount: increaseResults.filter(r => 'error' in r).length,
          stockQuantity
        };
      }

      case 'decreaseStock': {
        if (stockQuantity === undefined) {
          throw new Error('Stock quantity is required for decreaseStock action');
        }

        // 批量减少库存需要逐个处理以记录之前的库存
        const decreaseResults = [];
        for (const productId of productIds) {
          try {
            const result = await this.adjustStock(
              productId,
              'decrease',
              stockQuantity,
              reason || 'Batch stock decrease',
              operatorId || 'system',
              tenantId
            );
            decreaseResults.push(result);
          } catch (error) {
            // 继续处理其他商品，记录错误
            decreaseResults.push({
              productId,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }

        return {
          action: 'decreaseStock',
          results: decreaseResults,
          successCount: decreaseResults.filter(r => !('error' in r)).length,
          errorCount: decreaseResults.filter(r => 'error' in r).length,
          stockQuantity
        };
      }

      default:
        throw new Error(`Unsupported batch action: ${action}`);
    }
  }

  /**
   * 获取商品统计信息
   */
  static async getProductStats(tenantId: string) {
    const where = { tenantId: parseInt(tenantId) };

    const [
      totalProducts,
      inStockProducts,
      outOfStockProducts,
      categoryStats
    ] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.count({ where: { ...where, stock: { gt: 0 } } }),
      prisma.product.count({ where: { ...where, stock: { lte: 0 } } }),
      prisma.product.groupBy({
        by: ['category'],
        where,
        _count: { id: true }
      })
    ]);

    return {
      totalProducts,
      inStockProducts,
      outOfStockProducts,
      categoryDistribution: categoryStats.reduce((acc, stat) => {
        acc[stat.category || 'Uncategorized'] = stat._count.id;
        return acc;
      }, {} as Record<string, number>)
    };
  }

  /**
   * 检查库存可用性（内部服务调用）
   */
  static async checkStock(productId: string, quantity: number, tenantId?: string): Promise<boolean> {
    const where: any = { id: productId };
    if (tenantId) where.tenantId = parseInt(tenantId);
    const product = await prisma.product.findFirst({ where, select: { stock: true } });
    if (!product) return false;
    return (product.stock || 0) >= quantity;
  }

  /**
   * 库存调整（增加或减少）
   */
  static async adjustStock(
    productId: string,
    operation: 'increase' | 'decrease',
    quantity: number,
    reason: string,
    operatorId: string,
    tenantId: string
  ) {
    const where = { id: productId, tenantId: parseInt(tenantId) };

    // 获取当前商品信息
    const product = await prisma.product.findFirst({ where, select: { stock: true, name: true } });
    if (!product) {
      throw new Error('Product not found');
    }

    const previousStock = product.stock;
    let newStock: number;

    if (operation === 'increase') {
      newStock = previousStock + quantity;
    } else {
      newStock = previousStock - quantity;
      if (newStock < 0) {
        throw new Error('Insufficient stock for decrease operation');
      }
    }

    // 更新库存
    const updatedProduct = await prisma.product.update({
      where,
      data: { stock: newStock },
      select: {
        id: true,
        name: true,
        stock: true,
        updatedAt: true
      }
    });

    // 记录操作日志到AuditLog
    await prisma.auditLog.create({
      data: {
        userId: operatorId,
        action: `STOCK_${operation.toUpperCase()}`,
        module: 'product',
        resourceId: productId,
        metadata: JSON.stringify({
          productName: product.name,
          operation,
          quantity,
          previousStock,
          newStock,
          reason
        }),
        tenantId: parseInt(tenantId)
      }
    });

    return {
      product: updatedProduct,
      operation: {
        type: operation,
        quantity,
        previousStock,
        newStock,
        reason
      }
    };
  }

  /**
   * 获取低库存商品列表
   */
  static async getLowStockProducts(tenantId: string, threshold: number = 10, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const where = {
      tenantId: parseInt(tenantId),
      stock: { lte: threshold, gt: 0 } // 库存低于阈值但不为0
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { stock: 'asc' }, // 按库存从低到高排序
        select: {
          id: true,
          name: true,
          stock: true,
          category: true,
          price: true,
          images: true,
          updatedAt: true
        }
      }),
      prisma.product.count({ where })
    ]);

    return {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      threshold
    };
  }

  /**
   * 获取增强的库存统计
   */
  static async getStockOverview(tenantId: string, lowStockThreshold: number = 10) {
    const where = { tenantId: parseInt(tenantId) };

    const [
      totalProducts,
      inStockProducts,
      outOfStockProducts,
      lowStockProducts,
      totalStockValue
    ] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.count({ where: { ...where, stock: { gt: lowStockThreshold } } }),
      prisma.product.count({ where: { ...where, stock: { lte: 0 } } }),
      prisma.product.count({ where: { ...where, stock: { lte: lowStockThreshold, gt: 0 } } }),
      prisma.product.aggregate({
        where,
        _sum: {
          price: true
        }
      })
    ]);

    return {
      totalProducts,
      inStockProducts,
      outOfStockProducts,
      lowStockProducts,
      lowStockThreshold,
      totalStockValue: totalStockValue._sum.price || 0,
      stockStatus: {
        healthy: inStockProducts,
        warning: lowStockProducts,
        critical: outOfStockProducts
      }
    };
  }

  // ==================== Product Translation Management ====================

  /**
   * 获取商品的所有翻译
   */
  static async getProductTranslations(productId: string, tenantId: string) {
    // 首先验证商品属于该租户
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        tenantId: parseInt(tenantId)
      },
      select: {
        id: true,
        name: true,
        description: true
      }
    });

    if (!product) {
      throw new Error('Product not found');
    }

    // 获取所有翻译
    const translations = await prisma.productTranslation.findMany({
      where: { productId },
      select: {
        id: true,
        locale: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { locale: 'asc' }
    });

    return {
      product: {
        id: product.id,
        name: product.name,
        description: product.description
      },
      translations
    };
  }

  /**
   * 创建或更新商品翻译
   */
  static async upsertProductTranslation(
    productId: string,
    locale: string,
    data: { name: string; description?: string },
    tenantId: string
  ) {
    // 首先验证商品属于该租户
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        tenantId: parseInt(tenantId)
      }
    });

    if (!product) {
      throw new Error('Product not found');
    }

    // 使用 upsert 创建或更新翻译
    const translation = await prisma.productTranslation.upsert({
      where: {
        productId_locale: {
          productId,
          locale
        }
      },
      update: {
        name: data.name,
        description: data.description ?? null
      },
      create: {
        productId,
        locale,
        name: data.name,
        description: data.description ?? null
      },
      select: {
        id: true,
        productId: true,
        locale: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return translation;
  }

  /**
   * 删除商品翻译
   */
  static async deleteProductTranslation(productId: string, locale: string, tenantId: string) {
    // 首先验证商品属于该租户
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        tenantId: parseInt(tenantId)
      }
    });

    if (!product) {
      throw new Error('Product not found');
    }

    // 删除翻译
    await prisma.productTranslation.delete({
      where: {
        productId_locale: {
          productId,
          locale
        }
      }
    });
  }
}
