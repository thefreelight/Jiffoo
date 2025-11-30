import { prisma } from '@/config/database';
import { OrderStatus, OrderStatusType } from '@/core/order/types';
import { 
  UpdateOrderStatusRequest,
  BatchOrderOperationRequest,
  AdminOrderResponse,
  AdminOrderListResponse,
  OrderStatsResponse,
  BatchOperationResponse
} from './types';

export class AdminOrderService {
  /**
   * 获取所有订单（管理员）
   */
  static async getAllOrders(
    page = 1,
    limit = 10,
    tenantId: string,
    search?: string,
    status?: OrderStatusType
  ): Promise<AdminOrderListResponse> {
    const skip = (page - 1) * limit;
    
    // 构建查询条件
    const where: any = {
      tenantId: parseInt(tenantId)
    };

    // 添加状态筛选
    if (status) {
      where.status = status;
    }

    // 添加搜索条件
    if (search) {
      where.OR = [
        { customerEmail: { contains: search, mode: 'insensitive' } },
        { user: { username: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } }
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
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.order.count({ where }),
    ]);

    return {
      success: true,
      data: orders.map(order => this.formatAdminOrderResponse(order)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 获取订单详情（管理员）
   */
  static async getOrderById(
    orderId: string,
    tenantId: string
  ): Promise<AdminOrderResponse | null> {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        tenantId: parseInt(tenantId)
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
      },
    });

    if (!order) {
      return null;
    }

    return this.formatAdminOrderResponse(order);
  }

  /**
   * 更新订单状态（管理员）
   */
  static async updateOrderStatus(
    orderId: string,
    data: UpdateOrderStatusRequest,
    tenantId: string
  ): Promise<AdminOrderResponse> {
    const order = await prisma.order.update({
      where: {
        id: orderId,
        tenantId: parseInt(tenantId)
      },
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
      },
    });

    return this.formatAdminOrderResponse(order);
  }

  /**
   * 批量操作订单（管理员）
   */
  static async batchOperation(
    data: BatchOrderOperationRequest,
    tenantId: string
  ): Promise<BatchOperationResponse> {
    const { action, orderIds, status } = data;

    if (action === 'updateStatus' && status) {
      // 批量更新状态
      const result = await prisma.order.updateMany({
        where: {
          id: { in: orderIds },
          tenantId: parseInt(tenantId)
        },
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
            order: {
              id: { in: orderIds },
              tenantId: parseInt(tenantId)
            }
          }
        });

        // 再删除订单
        const deleteResult = await tx.order.deleteMany({
          where: {
            id: { in: orderIds },
            tenantId: parseInt(tenantId)
          }
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
   * 获取订单统计信息（管理员）
   */
  static async getOrderStats(tenantId: string): Promise<OrderStatsResponse> {
    const [
      totalOrders,
      totalRevenue,
      ordersByStatus,
      recentOrders,
      topProducts
    ] = await Promise.all([
      // 总订单数
      prisma.order.count({
        where: { tenantId: parseInt(tenantId) }
      }),
      
      // 总收入
      prisma.order.aggregate({
        where: { 
          tenantId: parseInt(tenantId),
          status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] }
        },
        _sum: { totalAmount: true }
      }),
      
      // 按状态统计订单
      prisma.order.groupBy({
        by: ['status'],
        where: { tenantId: parseInt(tenantId) },
        _count: { status: true }
      }),
      
      // 最近订单
      prisma.order.findMany({
        where: { tenantId: parseInt(tenantId) },
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
        },
        orderBy: { createdAt: 'desc' }
      }),
      
      // 热销商品
      prisma.orderItem.groupBy({
        by: ['productId'],
        where: {
          tenantId: parseInt(tenantId),
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

    // 获取热销商品详情
    const topProductsWithDetails = await Promise.all(
      topProducts.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { name: true }
        });
        
        return {
          productId: item.productId,
          productName: product?.name || 'Unknown Product',
          totalQuantity: item._sum.quantity || 0,
          totalRevenue: (item._sum.unitPrice || 0) * (item._sum.quantity || 0),
        };
      })
    );

    return {
      success: true,
      data: {
        totalOrders,
        totalRevenue: totalRevenue._sum.totalAmount || 0,
        ordersByStatus: statusStats,
        recentOrders: recentOrders.map(order => this.formatAdminOrderResponse(order)),
        topProducts: topProductsWithDetails,
      },
    };
  }

  /**
   * 格式化管理员订单响应
   */
  private static formatAdminOrderResponse(order: any): AdminOrderResponse {
    return {
      id: order.id,
      userId: order.userId,
      status: order.status as OrderStatusType,
      totalAmount: order.totalAmount,
      customerEmail: order.customerEmail,
      shippingAddress: JSON.parse(order.shippingAddress),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
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
