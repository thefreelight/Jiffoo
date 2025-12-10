/**
 * Order Service (单商户版本)
 *
 * 简化版本，移除了多租户和代理商相关逻辑。
 */

import { prisma } from '@/config/database';
import {
  CreateOrderRequest,
  OrderResponse,
  OrderListResponse,
  OrderStatus,
  PaymentStatus,
  OrderStatusType
} from './types';

export class OrderService {
  /**
   * 创建订单
   */
  static async createOrder(
    userId: string,
    data: CreateOrderRequest
  ): Promise<OrderResponse> {
    // 验证商品并计算总价
    let totalAmount = 0;
    const orderItems: Array<{
      productId: string;
      variantId?: string;
      quantity: number;
      unitPrice: number;
    }> = [];

    for (const item of data.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { variants: true }
      });

      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      let unitPrice = Number(product.price);
      let variantId: string | undefined;

      // 如果指定了变体
      if (item.variantId) {
        const variant = product.variants.find(v => v.id === item.variantId);
        if (!variant) {
          throw new Error(`Variant not found: ${item.variantId}`);
        }
        unitPrice = Number(variant.basePrice);
        variantId = variant.id;
      }

      // 检查库存
      const stock = item.variantId 
        ? product.variants.find(v => v.id === item.variantId)?.baseStock || 0
        : product.stock;
      
      if (stock < item.quantity) {
        throw new Error(`Insufficient stock for product: ${product.name}`);
      }

      totalAmount += unitPrice * item.quantity;
      orderItems.push({
        productId: item.productId,
        variantId,
        quantity: item.quantity,
        unitPrice
      });
    }

    // 创建订单
    const order = await prisma.order.create({
      data: {
        userId,
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        totalAmount,
        shippingAddress: data.shippingAddress ? JSON.stringify(data.shippingAddress) : null,
        items: {
          create: orderItems.map(item => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: item.unitPrice
          }))
        }
      },
      include: {
        items: {
          include: {
            product: true,
            variant: true
          }
        }
      }
    });

    // 扣减库存
    for (const item of orderItems) {
      if (item.variantId) {
        await prisma.productVariant.update({
          where: { id: item.variantId },
          data: { baseStock: { decrement: item.quantity } }
        });
      } else {
        await prisma.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } }
        });
      }
    }

    return this.formatOrderResponse(order);
  }

  /**
   * 获取用户订单列表
   */
  static async getUserOrders(
    userId: string,
    page = 1,
    limit = 10,
    status?: OrderStatusType
  ): Promise<OrderListResponse> {
    const skip = (page - 1) * limit;
    const where: any = { userId };
    
    if (status) {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              product: true,
              variant: true
            }
          }
        }
      }),
      prisma.order.count({ where })
    ]);

    return {
      data: orders.map(order => this.formatOrderResponse(order)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * 获取订单详情
   */
  static async getOrderById(
    orderId: string,
    userId?: string
  ): Promise<OrderResponse | null> {
    const where: any = { id: orderId };
    if (userId) {
      where.userId = userId;
    }

    const order = await prisma.order.findFirst({
      where,
      include: {
        items: {
          include: {
            product: true,
            variant: true
          }
        }
      }
    });

    if (!order) {
      return null;
    }

    return this.formatOrderResponse(order);
  }

  /**
   * 更新订单状态
   */
  static async updateOrderStatus(
    orderId: string,
    status: OrderStatusType
  ): Promise<OrderResponse> {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status },
      include: {
        items: {
          include: {
            product: true,
            variant: true
          }
        }
      }
    });

    return this.formatOrderResponse(order);
  }

  /**
   * 取消订单
   */
  static async cancelOrder(
    orderId: string,
    userId?: string
  ): Promise<OrderResponse> {
    const where: any = { id: orderId };
    if (userId) {
      where.userId = userId;
    }

    const order = await prisma.order.findFirst({
      where,
      include: { items: true }
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new Error('Only pending orders can be cancelled');
    }

    // 恢复库存
    for (const item of order.items) {
      if (item.variantId) {
        await prisma.productVariant.update({
          where: { id: item.variantId },
          data: { baseStock: { increment: item.quantity } }
        });
      } else {
        await prisma.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } }
        });
      }
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED },
      include: {
        items: {
          include: {
            product: true,
            variant: true
          }
        }
      }
    });

    return this.formatOrderResponse(updatedOrder);
  }

  /**
   * 格式化订单响应
   */
  private static formatOrderResponse(order: any): OrderResponse {
    return {
      id: order.id,
      userId: order.userId,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmount: Number(order.totalAmount),
      shippingAddress: order.shippingAddress ? JSON.parse(order.shippingAddress) : null,
      items: order.items.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        productName: item.product?.name || 'Unknown',
        variantId: item.variantId,
        variantName: item.variant?.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        // Calculate totalPrice from unitPrice * quantity since it's not stored in DB
        totalPrice: Number(item.unitPrice) * item.quantity
      })),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    };
  }
}
