import { prisma } from '@/config/database';
import { 
  CreateProductRequest,
  UpdateProductRequest,
  BatchProductOperationRequest,
  GetProductsRequest,
  SuperAdminProductResponse,
  SuperAdminProductListResponse,
  SuperAdminProductStatsResponse,
  BatchProductOperationResponse
} from './types';

export class SuperAdminProductService {
  /**
   * 获取所有产品列表（超级管理员）- 跨租户
   */
  static async getAllProducts(params: GetProductsRequest): Promise<SuperAdminProductListResponse> {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      category, 
      minPrice, 
      maxPrice, 
      inStock, 
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      tenantId 
    } = params;
    
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    // 构建查询条件
    const where: any = {};

    // 租户过滤
    if (tenantId) {
      where.tenantId = parseInt(tenantId);
    }

    // 搜索条件
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
        { category: { contains: search, mode: 'insensitive' as const } }
      ];
    }

    // 分类过滤
    if (category) {
      where.category = category;
    }

    // 价格范围过滤
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = Number(minPrice);
      if (maxPrice !== undefined) where.price.lte = Number(maxPrice);
    }

    // 库存过滤
    if (inStock !== undefined) {
      where.stock = inStock ? { gt: 0 } : { lte: 0 };
    }

    // 排序
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take,
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
          tenantId: true,
        },
        orderBy
      }),
      prisma.product.count({ where })
    ]);

    // 获取所有相关的租户信息
    const tenantIds = [...new Set(products.map(product => product.tenantId).filter(id => id !== null))];
    const tenants = await prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, companyName: true, contactEmail: true }
    });
    const tenantMap = tenants.reduce((acc, tenant) => {
      acc[tenant.id] = tenant;
      return acc;
    }, {} as Record<number, any>);

    return {
      success: true,
      data: products.map(product => this.formatSuperAdminProductResponse(product, tenantMap)),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  /**
   * 获取产品详情（超级管理员）
   */
  static async getProductById(productId: string): Promise<SuperAdminProductResponse | null> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
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
        tenantId: true,
      }
    });

    if (!product) {
      return null;
    }

    // 获取租户信息
    let tenant = null;
    if (product.tenantId) {
      tenant = await prisma.tenant.findUnique({
        where: { id: product.tenantId },
        select: { id: true, companyName: true, contactEmail: true }
      });
    }

    const tenantMap = tenant ? { [tenant.id]: tenant } : {};
    return this.formatSuperAdminProductResponse(product, tenantMap);
  }

  /**
   * 创建产品（超级管理员）
   */
  static async createProduct(data: CreateProductRequest): Promise<SuperAdminProductResponse> {
    const product = await prisma.product.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        stock: data.stock,
        category: data.category,
        images: data.images || '',
        tenantId: data.tenantId,
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
        tenantId: true,
      }
    });

    // 获取租户信息
    let tenant = null;
    if (product.tenantId) {
      tenant = await prisma.tenant.findUnique({
        where: { id: product.tenantId },
        select: { id: true, companyName: true, contactEmail: true }
      });
    }

    const tenantMap = tenant ? { [tenant.id]: tenant } : {};
    return this.formatSuperAdminProductResponse(product, tenantMap);
  }

  /**
   * 更新产品信息（超级管理员）
   */
  static async updateProduct(
    productId: string,
    updateData: UpdateProductRequest
  ): Promise<SuperAdminProductResponse> {
    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        ...updateData,
        updatedAt: new Date(),
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
        tenantId: true,
      }
    });

    // 获取租户信息
    let tenant = null;
    if (product.tenantId) {
      tenant = await prisma.tenant.findUnique({
        where: { id: product.tenantId },
        select: { id: true, companyName: true, contactEmail: true }
      });
    }

    const tenantMap = tenant ? { [tenant.id]: tenant } : {};
    return this.formatSuperAdminProductResponse(product, tenantMap);
  }

  /**
   * 删除产品（超级管理员）
   */
  static async deleteProduct(productId: string): Promise<void> {
    // 检查产品是否有相关订单
    const orderItems = await prisma.orderItem.count({
      where: { productId: productId }
    });

    if (orderItems > 0) {
      throw new Error('Cannot delete product with existing orders');
    }

    await prisma.product.delete({
      where: { id: productId }
    });
  }

  /**
   * 批量操作产品（超级管理员）
   */
  static async batchOperation(
    data: BatchProductOperationRequest
  ): Promise<BatchProductOperationResponse> {
    const { action, productIds, stock, price, category } = data;

    if (action === 'delete') {
      // 批量删除产品
      const result = await prisma.product.deleteMany({
        where: { id: { in: productIds } }
      });

      return {
        success: true,
        data: {
          action: 'delete',
          processedCount: result.count,
          productIds,
        },
        message: `Successfully deleted ${result.count} products`,
      };
    } else if (action === 'updateStock' && stock !== undefined) {
      // 批量更新库存
      const result = await prisma.product.updateMany({
        where: { id: { in: productIds } },
        data: {
          stock,
          updatedAt: new Date(),
        },
      });

      return {
        success: true,
        data: {
          action: 'updateStock',
          processedCount: result.count,
          productIds,
          stock,
        },
        message: `Successfully updated stock for ${result.count} products`,
      };
    } else if (action === 'updatePrice' && price !== undefined) {
      // 批量更新价格
      const result = await prisma.product.updateMany({
        where: { id: { in: productIds } },
        data: {
          price,
          updatedAt: new Date(),
        },
      });

      return {
        success: true,
        data: {
          action: 'updatePrice',
          processedCount: result.count,
          productIds,
          price,
        },
        message: `Successfully updated price for ${result.count} products`,
      };
    } else if (action === 'updateCategory' && category !== undefined) {
      // 批量更新分类
      const result = await prisma.product.updateMany({
        where: { id: { in: productIds } },
        data: {
          category,
          updatedAt: new Date(),
        },
      });

      return {
        success: true,
        data: {
          action: 'updateCategory',
          processedCount: result.count,
          productIds,
          category,
        },
        message: `Successfully updated category for ${result.count} products`,
      };
    }

    throw new Error('Invalid batch operation');
  }

  /**
   * 获取产品统计信息（超级管理员）- 跨租户统计
   */
  static async getProductStats(): Promise<SuperAdminProductStatsResponse> {
    const [
      totalProducts,
      productsByCategory,
      productsByTenant,
      lowStockProducts,
      recentProducts,
      totalInventoryValue
    ] = await Promise.all([
      // 总产品数 - 🔧 修复：超级管理员跨租户查询
      prisma.product.count({
        where: { tenantId: { gt: 0 } } // 只统计真实租户的产品总数
      }),

      // 按分类统计产品 - 🔧 修复：超级管理员跨租户查询
      prisma.product.groupBy({
        by: ['category'],
        _count: { category: true },
        where: {
          category: { not: null },
          tenantId: { gt: 0 } // 只统计真实租户的产品分类
        }
      }),

      // 按租户统计产品 - 🔧 修复：超级管理员跨租户查询
      prisma.product.groupBy({
        by: ['tenantId'],
        _count: { tenantId: true },
        _sum: { price: true },
        _avg: { price: true },
        where: { tenantId: { gt: 0 } } // 获取所有真实租户的产品（排除tenantId=0的超级管理员）
      }),

      // 低库存产品 - 🔧 修复：超级管理员跨租户查询
      prisma.product.findMany({
        where: {
          stock: { lte: 10 },
          tenantId: { gt: 0 } // 只查询真实租户的低库存产品
        },
        take: 10,
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
          tenantId: true,
        },
        orderBy: { stock: 'asc' }
      }),

      // 最近产品 - 🔧 修复：超级管理员跨租户查询
      prisma.product.findMany({
        where: {
          tenantId: { gt: 0 } // 只查询真实租户的最近产品
        },
        take: 5,
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
          tenantId: true,
        },
        orderBy: { createdAt: 'desc' }
      }),

      // 总库存价值 - 🔧 修复：超级管理员跨租户查询
      prisma.product.aggregate({
        where: {
          tenantId: { gt: 0 } // 只计算真实租户的库存价值
        },
        _sum: {
          price: true
        }
      })
    ]);

    // 获取租户信息
    const tenantIds = [
      ...new Set([
        ...productsByTenant.map(item => item.tenantId),
        ...lowStockProducts.map(product => product.tenantId),
        ...recentProducts.map(product => product.tenantId)
      ].filter(id => id !== null))
    ];

    const tenants = await prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, companyName: true, contactEmail: true }
    });

    const tenantMap = tenants.reduce((acc, tenant) => {
      acc[tenant.id] = tenant;
      return acc;
    }, {} as Record<number, any>);

    // 格式化分类统计
    const categoryStats = productsByCategory.map(item => ({
      category: item.category || 'Uncategorized',
      count: item._count.category,
    }));

    // 格式化租户统计
    const tenantStats = productsByTenant.map(item => ({
      tenantId: item.tenantId,
      tenantName: tenantMap[item.tenantId]?.companyName || 'Unknown Tenant',
      productCount: item._count.tenantId,
      totalValue: item._sum.price || 0,
      averagePrice: item._avg.price || 0,
    }));

    return {
      success: true,
      data: {
        totalProducts,
        productsByCategory: categoryStats,
        productsByTenant: tenantStats,
        lowStockProducts: lowStockProducts.map(product => this.formatSuperAdminProductResponse(product, tenantMap)),
        recentProducts: recentProducts.map(product => this.formatSuperAdminProductResponse(product, tenantMap)),
        totalInventoryValue: totalInventoryValue._sum.price || 0,
      },
    };
  }

  /**
   * 格式化超级管理员产品响应
   */
  private static formatSuperAdminProductResponse(product: any, tenantMap: Record<number, any> = {}): SuperAdminProductResponse {
    const tenant = tenantMap[product.tenantId] || {
      id: product.tenantId,
      companyName: product.tenantId === 0 ? 'Platform Products' : 'Unknown Tenant',
      contactEmail: product.tenantId === 0 ? 'admin@platform.com' : 'unknown@tenant.com',
    };

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      stock: product.stock,
      category: product.category,
      images: product.images,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      tenantId: product.tenantId,
      tenant: {
        id: tenant.id,
        companyName: tenant.companyName,
        contactEmail: tenant.contactEmail,
      },
    };
  }
}
