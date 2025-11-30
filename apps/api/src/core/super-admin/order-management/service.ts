import { prisma } from '@/config/database';
import { OrderStatus, OrderStatusType } from '@/core/order/types';
import { 
  UpdateOrderStatusRequest,
  BatchOrderOperationRequest,
  SuperAdminOrderResponse,
  SuperAdminOrderListResponse,
  SuperAdminOrderStatsResponse,
  BatchOperationResponse
} from './types';

export class SuperAdminOrderService {
  /**
   * 获取所有订单（超级管理员）- 跨租户
   */
  static async getAllOrders(
    page = 1,
    limit = 10,
    search?: string,
    status?: OrderStatusType,
    tenantId?: string
  ): Promise<SuperAdminOrderListResponse> {
    const skip = (page - 1) * limit;
    
    // 构建查询条件
    const where: any = {};

    // 添加租户筛选
    if (tenantId) {
      where.tenantId = parseInt(tenantId);
    }

    // 添加状态筛选
    if (status) {
      where.status = status;
    }

    // 添加搜索条件
    if (search) {
      where.OR = [
        { customerEmail: { contains: search, mode: 'insensitive' } },
        { user: { username: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { tenant: { companyName: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  images: true,
                  category: true,
                },
              },
            },
          },
          user: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          tenant: {
            select: {
              id: true,
              companyName: true,
              contactEmail: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.order.count({ where }),
    ]);

    return {
      success: true,
      data: orders.map(order => this.formatSuperAdminOrderResponse(order)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 获取订单详情（超级管理员）
   */
  static async getOrderById(orderId: string): Promise<SuperAdminOrderResponse | null> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: true,
                category: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        tenant: {
          select: {
            id: true,
            companyName: true,
            contactEmail: true,
          },
        },
      },
    });

    if (!order) {
      return null;
    }

    return this.formatSuperAdminOrderResponse(order);
  }

  /**
   * 更新订单状态（超级管理员）
   */
  static async updateOrderStatus(
    orderId: string,
    data: UpdateOrderStatusRequest
  ): Promise<SuperAdminOrderResponse> {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: data.status,
        updatedAt: new Date(),
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: true,
                category: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        tenant: {
          select: {
            id: true,
            companyName: true,
            contactEmail: true,
          },
        },
      },
    });

    return this.formatSuperAdminOrderResponse(order);
  }

  /**
   * 批量操作订单（超级管理员）
   */
  static async batchOperation(
    data: BatchOrderOperationRequest
  ): Promise<BatchOperationResponse> {
    const { action, orderIds, status } = data;

    if (action === 'updateStatus' && status) {
      // 批量更新状态
      const result = await prisma.order.updateMany({
        where: { id: { in: orderIds } },
        data: {
          status,
          updatedAt: new Date(),
        },
      });

      return {
        success: true,
        data: {
          action: 'updateStatus',
          processedCount: result.count,
          orderIds,
          status,
        },
        message: `Successfully updated ${result.count} orders to ${status}`,
      };
    } else if (action === 'delete') {
      // 批量删除订单
      const result = await prisma.$transaction(async (tx) => {
        // 先删除订单项
        await tx.orderItem.deleteMany({
          where: {
            order: { id: { in: orderIds } }
          }
        });

        // 再删除订单
        const deleteResult = await tx.order.deleteMany({
          where: { id: { in: orderIds } }
        });

        return deleteResult;
      });

      return {
        success: true,
        data: {
          action: 'delete',
          processedCount: result.count,
          orderIds,
        },
        message: `Successfully deleted ${result.count} orders`,
      };
    }

    throw new Error('Invalid batch operation');
  }

  /**
   * 获取订单统计信息（超级管理员）- 跨租户统计
   */
  static async getOrderStats(): Promise<SuperAdminOrderStatsResponse> {
    const [
      totalOrders,
      totalRevenue,
      ordersByStatus,
      ordersByTenant,
      recentOrders,
      topProducts
    ] = await Promise.all([
      // 总订单数
      prisma.order.count(),
      
      // 总收入
      prisma.order.aggregate({
        where: { 
          status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] }
        },
        _sum: { totalAmount: true }
      }),
      
      // 按状态统计订单
      prisma.order.groupBy({
        by: ['status'],
        _count: { status: true }
      }),
      
      // 按租户统计订单
      prisma.order.groupBy({
        by: ['tenantId'],
        _count: { tenantId: true },
        _sum: { totalAmount: true },
        where: {
          status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] }
        }
      }),
      
      // 最近订单
      prisma.order.findMany({
        take: 5,
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  images: true,
                  category: true,
                },
              },
            },
          },
          user: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          tenant: {
            select: {
              id: true,
              companyName: true,
              contactEmail: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' }
      }),
      
      // 热销商品（跨租户）
      prisma.orderItem.groupBy({
        by: ['productId', 'tenantId'],
        where: {
          order: {
            status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] }
          }
        },
        _sum: {
          quantity: true,
          unitPrice: true
        },
        orderBy: {
          _sum: {
            quantity: 'desc'
          }
        },
        take: 5
      })
    ]);

    // 格式化按状态统计的数据
    const statusStats = Object.values(OrderStatus).reduce((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {} as Record<OrderStatusType, number>);

    ordersByStatus.forEach(item => {
      statusStats[item.status as OrderStatusType] = item._count.status;
    });

    // 获取租户信息
    const tenantIds = ordersByTenant.map(item => item.tenantId);
    const tenants = await prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, companyName: true }
    });

    const tenantMap = tenants.reduce((acc, tenant) => {
      acc[tenant.id] = tenant.companyName;
      return acc;
    }, {} as Record<number, string>);

    const tenantStats = ordersByTenant.map(item => ({
      tenantId: item.tenantId,
      tenantName: tenantMap[item.tenantId] || 'Unknown Tenant',
      orderCount: item._count.tenantId,
      revenue: item._sum.totalAmount || 0,
    }));

    // 获取热销商品详情
    const topProductsWithDetails = await Promise.all(
      topProducts.map(async (item) => {
        const [product, tenant] = await Promise.all([
          prisma.product.findUnique({
            where: { id: item.productId },
            select: { name: true }
          }),
          prisma.tenant.findUnique({
            where: { id: item.tenantId },
            select: { companyName: true }
          })
        ]);
        
        return {
          productId: item.productId,
          productName: product?.name || 'Unknown Product',
          totalQuantity: item._sum.quantity || 0,
          totalRevenue: (item._sum.unitPrice || 0) * (item._sum.quantity || 0),
          tenantId: item.tenantId,
          tenantName: tenant?.companyName || 'Unknown Tenant',
        };
      })
    );

    return {
      success: true,
      data: {
        totalOrders,
        totalRevenue: totalRevenue._sum.totalAmount || 0,
        ordersByStatus: statusStats,
        ordersByTenant: tenantStats,
        recentOrders: recentOrders.map(order => this.formatSuperAdminOrderResponse(order)),
        topProducts: topProductsWithDetails,
      },
    };
  }

  /**
   * 格式化超级管理员订单响应
   */
  private static formatSuperAdminOrderResponse(order: any): SuperAdminOrderResponse {
    return {
      id: order.id,
      userId: order.userId,
      status: order.status as OrderStatusType,
      totalAmount: order.totalAmount,
      customerEmail: order.customerEmail,
      shippingAddress: JSON.parse(order.shippingAddress),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      tenantId: order.tenantId,
      tenant: {
        id: order.tenant.id,
        companyName: order.tenant.companyName,
        contactEmail: order.tenant.contactEmail,
      },
      items: order.items.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        product: {
          id: item.product.id,
          name: item.product.name,
          images: item.product.images,
          category: item.product.category,
        },
      })),
      user: {
        id: order.user.id,
        username: order.user.username,
        email: order.user.email,
      },
    };
  }
}
