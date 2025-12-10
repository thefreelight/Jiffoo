/**
 * Admin Order Service (单商户版本)
 */

import { prisma } from '@/config/database';

export class AdminOrderService {
  static async getOrders(page = 1, limit = 10, status?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};

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
          user: {
            select: {
              id: true,
              email: true,
              username: true
            }
          },
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
      orders: orders.map(order => ({
        ...order,
        totalAmount: Number(order.totalAmount),
        shippingAddress: order.shippingAddress ? JSON.parse(order.shippingAddress as string) : null
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async getOrderById(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true
          }
        },
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

    return {
      ...order,
      totalAmount: Number(order.totalAmount),
      shippingAddress: order.shippingAddress ? JSON.parse(order.shippingAddress as string) : null
    };
  }

  static async updateOrderStatus(orderId: string, status: string) {
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

    return {
      ...order,
      totalAmount: Number(order.totalAmount),
      shippingAddress: order.shippingAddress ? JSON.parse(order.shippingAddress as string) : null
    };
  }

  static async getOrderStats() {
    const [total, pending, processing, shipped, delivered, cancelled] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.order.count({ where: { status: 'PROCESSING' } }),
      prisma.order.count({ where: { status: 'SHIPPED' } }),
      prisma.order.count({ where: { status: 'DELIVERED' } }),
      prisma.order.count({ where: { status: 'CANCELLED' } })
    ]);

    return {
      total,
      pending,
      processing,
      shipped,
      delivered,
      cancelled
    };
  }
}
