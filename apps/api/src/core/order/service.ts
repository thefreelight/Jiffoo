/**
 * Order Service
 *
 * Simplified version, removed multi-tenant and agent related logic.
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
import { getOrderHooks } from './hooks';

export class OrderService {
  /**
   * Create order
   */
  static async createOrder(
    userId: string,
    data: CreateOrderRequest
  ): Promise<OrderResponse> {
    // Verify products and calculate total amount
    let totalAmount = 0;
    const orderItems: Array<{
      productId: string;
      variantId: string;
      quantity: number;
      unitPrice: number;
    }> = [];

    if (!data.items || data.items.length === 0) {
      throw new Error('Order must contain at least one item');
    }

    for (const item of data.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { variants: true }
      });

      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      // In the new schema, variantId is mandatory for OrderItem
      const variantId = item.variantId || product.variants.find(v => v.isDefault)?.id || product.variants[0]?.id;

      if (!variantId) {
        throw new Error(`No variants available for product: ${product.name}`);
      }

      const variant = product.variants.find(v => v.id === variantId);
      if (!variant) {
        throw new Error(`Variant not found: ${variantId}`);
      }

      const unitPrice = Number(variant.basePrice);
      const stock = variant.baseStock;

      if (stock < item.quantity) {
        throw new Error(`Insufficient stock for variant ${variant.name} of product: ${product.name}`);
      }

      totalAmount += unitPrice * item.quantity;
      orderItems.push({
        productId: item.productId,
        variantId,
        quantity: item.quantity,
        unitPrice
      });
    }

    // Create order with nested structures
    const order = await prisma.order.create({
      data: {
        user: { connect: { id: userId } },
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        totalAmount,
        // Create order address relation
        shippingAddress: data.shippingAddress ? {
          create: {
            firstName: (data.shippingAddress as any).firstName || 'Default',
            lastName: (data.shippingAddress as any).lastName || 'Default',
            phone: (data.shippingAddress as any).phone || '0000000000',
            addressLine1: (data.shippingAddress as any).addressLine1 || 'N/A',
            city: (data.shippingAddress as any).city || 'Default',
            state: (data.shippingAddress as any).state || 'Default',
            country: (data.shippingAddress as any).country || 'Default',
            postalCode: (data.shippingAddress as any).postalCode || '000000'
          }
        } : undefined,
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
        shippingAddress: true,
        items: {
          include: {
            product: true,
            variant: true
          }
        }
      }
    });

    // Phase 2: Emit order.created event via Outbox
    try {
      const { OutboxService } = await import('@/infra/outbox');
      await OutboxService.emit(prisma, 'order.created', order.id, {
        id: order.id,
        userId: order.userId,
        totalAmount: order.totalAmount,
        currency: 'USD',
        items: order.items.map((item: any) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        }))
      });
    } catch (err) {
      console.error('Failed to emit order.created event:', err);
    }

    // Deduct stock
    for (const item of orderItems) {
      await prisma.productVariant.update({
        where: { id: item.variantId },
        data: { baseStock: { decrement: item.quantity } }
      });
    }

    return this.formatOrderResponse(order);
  }

  /**
   * Get user orders
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
          shippingAddress: true,
          shipments: {
            include: { items: true }
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
   * Get order details
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
        shippingAddress: true,
        shipments: {
          include: { items: true }
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

    return this.formatOrderResponse(order);
  }

  /**
   * Update order status
   */
  static async updateOrderStatus(
    orderId: string,
    status: OrderStatusType
  ): Promise<OrderResponse> {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status },
      include: {
        shippingAddress: true,
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
   * Cancel order
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

    // Restore stock
    for (const item of order.items) {
      await prisma.productVariant.update({
        where: { id: item.variantId },
        data: { baseStock: { increment: item.quantity } }
      });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED },
      include: {
        shippingAddress: true,
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
   * Complete order
   * Called when payment is completed, triggers license generation and commission processing
   */
  static async completeOrder(orderId: string): Promise<OrderResponse> {
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status === OrderStatus.COMPLETED) {
      throw new Error('Order is already completed');
    }

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.COMPLETED,
        paymentStatus: PaymentStatus.PAID
      },
      include: {
        shippingAddress: true,
        items: {
          include: {
            product: true,
            variant: true
          }
        }
      }
    });

    // Trigger order completion hooks
    const orderHooks = getOrderHooks();
    if (orderHooks) {
      // Execute hooks asynchronously, do not block response
      orderHooks.onOrderCompleted(orderId).catch(err => {
        console.error('Order completion hooks failed:', err);
      });
    }

    return this.formatOrderResponse(updatedOrder);
  }

  /**
   * Refund order
   * Audits the refund by creating a Refund record
   */
  static async refundOrder(orderId: string): Promise<OrderResponse> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          where: { status: 'SUCCEEDED' },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.paymentStatus === PaymentStatus.REFUNDED) {
      throw new Error('Order is already refunded');
    }

    const successfulPayment = order.payments[0];

    // Transaction for order update and refund record creation
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // 1. Create Refund record if a successful payment exists
      if (successfulPayment) {
        await tx.refund.create({
          data: {
            orderId: order.id,
            paymentId: successfulPayment.id,
            amount: order.totalAmount,
            status: 'COMPLETED',
            reason: 'Full refund requested by admin',
            provider: successfulPayment.paymentMethod.toUpperCase(),
            idempotencyKey: `ref_${order.id}_full`
          }
        });
      }

      // 2. Update order status
      return tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.REFUNDED,
          paymentStatus: PaymentStatus.REFUNDED
        },
        include: {
          shippingAddress: true,
          items: {
            include: {
              product: true,
              variant: true
            }
          }
        }
      });
    });

    // Trigger order refund hooks
    const orderHooks = getOrderHooks();
    if (orderHooks) {
      // Execute hooks asynchronously, do not block response
      orderHooks.onOrderRefunded(orderId).catch(err => {
        console.error('Order refund hooks failed:', err);
      });
    }

    // Restore stock
    for (const item of updatedOrder.items) {
      // All items now have variantId
      await prisma.productVariant.update({
        where: { id: item.variantId },
        data: { baseStock: { increment: item.quantity } }
      });
    }

    return this.formatOrderResponse(updatedOrder);
  }

  /**
   * Format order response
   */
  private static formatOrderResponse(order: any): OrderResponse {
    return {
      id: order.id,
      userId: order.userId,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmount: Number(order.totalAmount),
      shippingAddress: order.shippingAddress || null,
      shipments: order.shipments || [],
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
