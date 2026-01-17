/**
 * Admin Order Service
 * Handles order management operations including shipping, refunds, and cancellations
 */

import { prisma } from '@/config/database';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-07-30.basil', // Updated to valid version
});

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
          shippingAddress: true, // Include the relation
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
        // shippingAddress is already an object due to the include above, no need to parse
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
        shippingAddress: true, // Include the relation
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
      // shippingAddress is already an object
    };
  }

  static async updateOrderStatus(orderId: string, status: string) {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status },
      include: {
        shippingAddress: true, // Include the relation
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
      // shippingAddress is already an object
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

  /**
   * Ship order - create shipment record with tracking info
   */
  static async shipOrder(orderId: string, data: {
    carrier: string;
    trackingNumber: string;
    items?: Array<{ orderItemId: string; quantity: number }>;
  }) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
      throw new Error(`Cannot ship order with status: ${order.status}`);
    }

    // Create shipment record
    const shipment = await prisma.shipment.create({
      data: {
        orderId,
        carrier: data.carrier,
        trackingNumber: data.trackingNumber,
        status: 'SHIPPED',
        shippedAt: new Date(),
        items: data.items ? {
          create: data.items.map(item => ({
            orderItemId: item.orderItemId,
            quantity: item.quantity,
          })),
        } : undefined,
      },
      include: {
        items: true,
      },
    });

    // Update order status to SHIPPED
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: 'SHIPPED' },
      include: {
        items: true,
        shipments: true,
      },
    });

    return {
      order: updatedOrder,
      shipment,
    };
  }

  /**
   * Refund order - create refund record and process via Stripe
   */
  static async refundOrder(orderId: string, data: {
    // amount: number; // Alpha: Full refund only, amount is derived
    reason?: string;
    idempotencyKey: string;
  }) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          where: { status: 'SUCCEEDED' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.paymentStatus !== 'PAID') {
      throw new Error('Order is not paid, cannot refund');
    }

    const payment = order.payments[0];
    if (!payment) {
      throw new Error('No successful payment found for this order');
    }

    // Alpha Constraint: Full Refund Only
    // Ensure we strictly use the order total amount
    const refundAmount = Number(order.totalAmount);

    // Check if refund already exists with this idempotency key
    const existingRefund = await prisma.refund.findUnique({
      where: { idempotencyKey: data.idempotencyKey },
    });

    if (existingRefund) {
      return existingRefund;
    }

    // Validation for partial refund attempt is removed as we force full refund
    // if (data.amount > order.totalAmount) ...

    // Create refund record first (PENDING status)
    const refund = await prisma.refund.create({
      data: {
        paymentId: payment.id,
        orderId,
        amount: refundAmount,
        currency: payment.currency,
        status: 'PENDING',
        reason: data.reason,
        provider: 'stripe',
        idempotencyKey: data.idempotencyKey,
      },
    });

    try {
      // Process refund via Stripe
      if (payment.paymentIntentId) {
        // Stripe uses smallest currency unit (e.g., cents)
        const stripeRefund = await stripe.refunds.create({
          payment_intent: payment.paymentIntentId,
          amount: Math.round(refundAmount * 100),
        }, {
          idempotencyKey: data.idempotencyKey,
        });

        // Update refund with Stripe refund ID
        const updatedRefund = await prisma.refund.update({
          where: { id: refund.id },
          data: {
            providerRefundId: stripeRefund.id,
            status: stripeRefund.status === 'succeeded' ? 'SUCCEEDED' : 'PENDING',
          },
        });

        // Update order payment status if full refund (which is always true in Alpha)
        if (refundAmount >= Number(order.totalAmount)) {
          await prisma.order.update({
            where: { id: orderId },
            data: {
              paymentStatus: 'REFUNDED',
              status: 'REFUNDED',
            },
          });
        }

        return updatedRefund;
      } else {
        throw new Error('No payment intent ID found');
      }
    } catch (error: any) {
      // Update refund status to FAILED
      await prisma.refund.update({
        where: { id: refund.id },
        data: {
          status: 'FAILED',
          metadata: JSON.stringify({ error: error.message }),
        },
      });
      throw error;
    }
  }

  /**
   * Cancel order
   */
  static async cancelOrder(orderId: string, data: {
    cancelReason: string;
  }) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status === 'SHIPPED' || order.status === 'DELIVERED') {
      throw new Error(`Cannot cancel order with status: ${order.status}`);
    }

    if (order.status === 'CANCELLED') {
      throw new Error('Order is already cancelled');
    }

    // Update order status to CANCELLED
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        cancelReason: data.cancelReason,
        cancelledAt: new Date(),
      },
      include: {
        items: true,
      },
    });

    // Release inventory reservations if any
    await prisma.inventoryReservation.updateMany({
      where: {
        orderId,
        status: 'ACTIVE',
      },
      data: {
        status: 'RELEASED',
      },
    });

    return updatedOrder;
  }
}
