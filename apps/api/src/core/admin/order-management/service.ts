/**
 * Admin Order Service
 * Handles order management operations including shipping, refunds, and cancellations
 */

import { prisma } from '@/config/database';
import { OrderPaymentStatus as PrismaOrderPaymentStatus, OrderStatus as PrismaOrderStatus, Prisma } from '@prisma/client';
import { systemSettingsService } from '../system-settings/service';
import { CacheService } from '@/core/cache/service';
import { getTodayAndYesterdayRangeUtc } from '@/utils/timezone';
import { ExternalOrderService } from '@/core/external-orders/service';
import { OrderStatus, OrderStatusType, PaymentStatus } from '@/core/order/types';
import { recordOrderStatusHistory } from '@/core/order/status-history';
import { InventoryService } from '@/core/inventory/service';

const isUniqueConstraintError = (error: unknown): error is Prisma.PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

function calculateTrendPercent(current: number, previous: number): number {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

export class AdminOrderService {
  static async getOrderStats() {
    const [currency, timezone] = await Promise.all([
      systemSettingsService.getShopCurrency(),
      systemSettingsService.getTimezone(),
    ]);
    const { startOfTodayUtc, startOfYesterdayUtc } = getTodayAndYesterdayRangeUtc(timezone);

    const [
      totalOrders, 
      paidRevenue, 
      paidOrders, 
      shippedOrders, 
      refundedOrders,
      todayTotalOrders, 
      yesterdayTotalOrders, 
      todayPaidOrders, 
      yesterdayPaidOrders, 
      todayShippedOrders, 
      yesterdayShippedOrders,
      todayRefundedOrders,
      yesterdayRefundedOrders,
      todayRevenue, 
      yesterdayRevenue
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: {
          paymentStatus: 'PAID',
          status: { notIn: ['CANCELLED', 'REFUNDED'] },
        },
      }),
      prisma.order.count({ where: { paymentStatus: 'PAID' } }),
      prisma.order.count({ where: { status: 'SHIPPED' } }),
      prisma.order.count({ where: { status: 'REFUNDED' } }),
      prisma.order.count({ where: { createdAt: { gte: startOfTodayUtc } } }),
      prisma.order.count({ where: { createdAt: { gte: startOfYesterdayUtc, lt: startOfTodayUtc } } }),
      prisma.order.count({ where: { paymentStatus: 'PAID', createdAt: { gte: startOfTodayUtc } } }),
      prisma.order.count({ where: { paymentStatus: 'PAID', createdAt: { gte: startOfYesterdayUtc, lt: startOfTodayUtc } } }),
      prisma.order.count({ where: { status: 'SHIPPED', createdAt: { gte: startOfTodayUtc } } }),
      prisma.order.count({ where: { status: 'SHIPPED', createdAt: { gte: startOfYesterdayUtc, lt: startOfTodayUtc } } }),
      prisma.order.count({ where: { status: 'REFUNDED', createdAt: { gte: startOfTodayUtc } } }),
      prisma.order.count({ where: { status: 'REFUNDED', createdAt: { gte: startOfYesterdayUtc, lt: startOfTodayUtc } } }),
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: {
          paymentStatus: 'PAID',
          status: { notIn: ['CANCELLED', 'REFUNDED'] },
          createdAt: { gte: startOfTodayUtc },
        },
      }),
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: {
          paymentStatus: 'PAID',
          status: { notIn: ['CANCELLED', 'REFUNDED'] },
          createdAt: { gte: startOfYesterdayUtc, lt: startOfTodayUtc },
        },
      }),
    ]);

    return {
      metrics: {
        totalOrders,
        paidOrders,
        shippedOrders,
        refundedOrders,
        totalRevenue: Number(paidRevenue._sum.totalAmount || 0),
        currency,
        totalOrdersTrend: calculateTrendPercent(todayTotalOrders, yesterdayTotalOrders),
        paidOrdersTrend: calculateTrendPercent(todayPaidOrders, yesterdayPaidOrders),
        shippedOrdersTrend: calculateTrendPercent(todayShippedOrders, yesterdayShippedOrders),
        refundedOrdersTrend: calculateTrendPercent(todayRefundedOrders, yesterdayRefundedOrders),
        totalRevenueTrend: calculateTrendPercent(
          Number(todayRevenue._sum.totalAmount || 0),
          Number(yesterdayRevenue._sum.totalAmount || 0)
        ),
      }
    };
  }

  /**
   * Get orders list - flattened response for UI display
   * Returns: { items: [...], pagination: {...} }
   */
  static async getOrders(page = 1, limit = 10, status?: string, search?: string, storeId?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    const searchText = search?.trim();

    if (status) {
      where.status = status;
    }

    if (searchText) {
      where.OR = [
        {
          id: {
            contains: searchText,
            mode: 'insensitive',
          },
        },
        {
          user: {
            email: {
              contains: searchText,
              mode: 'insensitive',
            },
          },
        },
        {
          user: {
            username: {
              contains: searchText,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

    if (storeId) {
      where.storeId = storeId;
    }

    // Try cache
    const cached = await CacheService.getOrderList(page, limit, { status, search: searchText || undefined, storeId });
    if (cached) return cached;

    // Fetch currency once for all items (same store = same currency, cached)
    const currency = await systemSettingsService.getShopCurrency();

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          totalAmount: true,
          createdAt: true,
          userId: true,
          user: {
            select: {
              id: true,
              email: true,
              username: true
            }
          },
          _count: {
            select: { items: true }
          }
        }
      }),
      prisma.order.count({ where })
    ]);

    const result = {
      items: orders.map(order => ({
        id: order.id,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalAmount: Number(order.totalAmount),
        currency,
        createdAt: order.createdAt.toISOString(),
        itemsCount: order._count.items,
        customer: {
          id: order.user?.id || null,
          email: order.user?.email || null,
          username: order.user?.username || null
        }
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    };

    // Save to cache (30s TTL for admin orders)
    await CacheService.setOrderList(page, limit, result, { status, search: searchText || undefined }, 30);

    return result;
  }

  /**
   * Get order by ID - projected detail response for editing/viewing
   */
  static async getOrderById(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        expiresAt: true,
        lastPaymentAttemptAt: true,
        paymentAttempts: true,
        lastPaymentMethod: true,
        cancelReason: true,
        cancelledAt: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            username: true
          }
        },
        shippingAddress: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            addressLine1: true,
            addressLine2: true,
            city: true,
            state: true,
            postalCode: true,
            country: true
          }
        },
        items: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            fulfillmentStatus: true,
            product: {
              select: {
                id: true,
                name: true
              }
            },
            variant: {
              select: {
                id: true,
                skuCode: true,
                name: true
              }
            }
          }
        },
        shipments: {
          select: {
            id: true,
            carrier: true,
            trackingNumber: true,
            status: true,
            shippedAt: true,
            deliveredAt: true
          }
        }
      }
    });

    if (!order) {
      return null;
    }

    const shippingAddr = order.shippingAddress ? {
      recipientName: `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`.trim(),
      phone: order.shippingAddress.phone,
      street: order.shippingAddress.addressLine1,
      street2: order.shippingAddress.addressLine2,
      city: order.shippingAddress.city,
      state: order.shippingAddress.state,
      zipCode: order.shippingAddress.postalCode,
      country: order.shippingAddress.country
    } : null;

    return {
      id: order.id,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmount: Number(order.totalAmount),
      currency: await systemSettingsService.getShopCurrency(),
      notes: null,
      paymentMethod: order.lastPaymentMethod,
      paymentAttempts: order.paymentAttempts,
      lastPaymentAttemptAt: order.lastPaymentAttemptAt ? order.lastPaymentAttemptAt.toISOString() : null,
      expiresAt: order.expiresAt ? order.expiresAt.toISOString() : null,
      cancelReason: order.cancelReason,
      cancelledAt: order.cancelledAt ? order.cancelledAt.toISOString() : null,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      customer: {
        id: order.user?.id || null,
        email: order.user?.email || null,
        username: order.user?.username || null
      },
      shippingAddress: shippingAddr,
      items: order.items.map(item => ({
        id: item.id,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.unitPrice) * item.quantity,
        productId: item.product?.id || null,
        productName: item.product?.name || null,
        variantId: item.variant?.id || null,
        skuCode: item.variant?.skuCode || null,
        variantName: item.variant?.name || null,
        fulfillmentStatus: item.fulfillmentStatus
      })),
      shipments: order.shipments.map(s => ({
        id: s.id,
        carrier: s.carrier || '',
        trackingNumber: s.trackingNumber || '',
        status: s.status,
        shippedAt: s.shippedAt ? s.shippedAt.toISOString() : null,
        deliveredAt: s.deliveredAt ? s.deliveredAt.toISOString() : null
      }))
    };
  }

  static async updateOrderStatus(orderId: string, status: OrderStatusType) {
    const existing = await prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true, paymentStatus: true },
    });

    if (!existing) {
      throw new Error('Order not found');
    }

    await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status }
      });

      await recordOrderStatusHistory(tx, {
        orderId: updated.id,
        fromStatus: existing.status as PrismaOrderStatus,
        toStatus: updated.status as PrismaOrderStatus,
        fromPaymentStatus: existing.paymentStatus as PrismaOrderPaymentStatus,
        toPaymentStatus: updated.paymentStatus as PrismaOrderPaymentStatus,
        reason: 'admin_update_status',
        actorType: 'admin',
      });
    });

    // Invalidate list cache
    await CacheService.incrementOrderVersion();

    return this.getOrderById(orderId);
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

    await prisma.$transaction(async (tx) => {
      // Create shipment record
      await tx.shipment.create({
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
        }
      });

      // Update order status to SHIPPED
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.SHIPPED }
      });

      await recordOrderStatusHistory(tx, {
        orderId: updated.id,
        fromStatus: order.status as PrismaOrderStatus,
        toStatus: updated.status as PrismaOrderStatus,
        fromPaymentStatus: order.paymentStatus as PrismaOrderPaymentStatus,
        toPaymentStatus: updated.paymentStatus as PrismaOrderPaymentStatus,
        reason: 'admin_ship_order',
        actorType: 'admin',
      });
    });

    // Invalidate list cache
    await CacheService.incrementOrderVersion();

    return this.getOrderById(orderId);
  }

  /**
   * Refund order
   */
  static async refundOrder(orderId: string, data: {
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
        items: true,
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

    const refundAmount = Number(order.totalAmount);

    // Check if refund already exists
    const existingRefund = await prisma.refund.findUnique({
      where: { idempotencyKey: data.idempotencyKey },
    });

    if (existingRefund) {
      return this.getOrderById(orderId);
    }

    await ExternalOrderService.requestRefundForOrder(orderId);

    try {
      await prisma.$transaction(async (tx) => {
        const refund = await tx.refund.create({
          data: {
            paymentId: payment.id,
            orderId,
            amount: refundAmount,
            currency: payment.currency,
            status: 'COMPLETED',
            reason: data.reason,
            provider: payment.paymentMethod.toUpperCase(),
            idempotencyKey: data.idempotencyKey,
          },
        });

        await tx.refundLedger.create({
          data: {
            refundId: refund.id,
            paymentId: payment.id,
            orderId,
            eventType: 'SUCCEEDED',
            amount: refundAmount,
            currency: payment.currency,
            provider: payment.paymentMethod,
            idempotencyKey: data.idempotencyKey,
          },
        });

        await tx.paymentLedger.create({
          data: {
            paymentId: payment.id,
            orderId,
            eventType: 'REFUNDED',
            amount: refundAmount,
            currency: payment.currency,
            provider: payment.paymentMethod,
            providerEventId: `refund:${refund.id}`,
            idempotencyKey: data.idempotencyKey,
          },
        });

        const updated = await tx.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: PaymentStatus.REFUNDED,
            status: OrderStatus.REFUNDED,
          },
        });

        await recordOrderStatusHistory(tx, {
          orderId: updated.id,
          fromStatus: order.status as PrismaOrderStatus,
          toStatus: updated.status as PrismaOrderStatus,
          fromPaymentStatus: order.paymentStatus as PrismaOrderPaymentStatus,
          toPaymentStatus: updated.paymentStatus as PrismaOrderPaymentStatus,
          reason: data.reason ?? 'admin_refund',
          actorType: 'admin',
        });

        for (const item of order.items) {
          await InventoryService.incrementStock(tx, item.variantId, item.quantity);
        }
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return this.getOrderById(orderId);
      }
      throw error;
    }

    // Invalidate list cache
    await CacheService.incrementOrderVersion();

    return this.getOrderById(orderId);
  }

  /**
   * Cancel order
   */
  static async cancelOrder(orderId: string, data: {
    cancelReason: string;
  }) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
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

    await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          cancelReason: data.cancelReason,
          cancelledAt: new Date(),
        }
      });

      await recordOrderStatusHistory(tx, {
        orderId: updated.id,
        fromStatus: order.status as PrismaOrderStatus,
        toStatus: updated.status as PrismaOrderStatus,
        fromPaymentStatus: order.paymentStatus as PrismaOrderPaymentStatus,
        toPaymentStatus: updated.paymentStatus as PrismaOrderPaymentStatus,
        reason: data.cancelReason,
        actorType: 'admin',
      });

      for (const item of order.items) {
        await InventoryService.incrementStock(tx, item.variantId, item.quantity);
      }
    });

    // Invalidate list cache
    await CacheService.incrementOrderVersion();

    return this.getOrderById(orderId);
  }
}
