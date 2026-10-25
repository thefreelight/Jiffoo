import { ApiError } from '@/utils/api-errors';
/**
 * Order Service
 *
 * Manages order creation and cancellation. Handles inventory management, payment status tracking,
 * and integrates with notification and event systems.
 *
 * Features:
 * - Product validation and stock management
 * - Order state machine (PENDING -> PROCESSING -> SHIPPED -> DELIVERED)
 * - Payment status tracking (PENDING -> PAID/REFUNDED)
 * - Event emission via Transactional Outbox pattern
 */

import { prisma } from '@/config/database';
import { purchaseReturnTarget } from '@/core/plugin-pages/service';
import { Prisma, OrderStatus as PrismaOrderStatus, OrderPaymentStatus as PrismaOrderPaymentStatus } from '@prisma/client';
import {
  CreateOrderRequest,
  OrderResponse,
  OrderListResponse,
  OrderStatus,
  PaymentStatus,
  OrderStatusType,
  PaymentStatusType,
  OrderCreationResult,
  OrderProjection,
  OrderPaidPayload,
} from './types';
import { recordOrderStatusHistory, type OrderStatusHistoryWriter } from './status-history';
import { assertOrderTransition } from './transition';
import { lockOrder } from '@/core/shared/locks';
import { PaymentService } from '@/core/payment/service';

import { systemSettingsService } from '@/core/settings/service';
import { LoggerService } from '@/core/logger/unified-logger';
import { InventoryService } from '@/core/inventory/service';
import { emitEvent, type EventTransaction } from '@/infra/events/emit';
import { AuthIdentityService, type AuthIdentityReadTx } from '@/core/auth/identity-service';
import { readCatalogSnapshot, snapshotProductName, isOrderItemCatalogRestriction } from './catalog-snapshot';
import { parseJsonRecord, runOrderPlacement } from '@/core/order/pipeline';

export { parseJsonRecord };

type JsonRecord = Record<string, unknown>;

/**
 * Transaction surface required by the order module. Both the plain Prisma
 * client and a transaction client satisfy it, so the caller passes its own
 * transaction client straight through.
 */
export type OrderWriteTx = {
  order: {
    findUnique(args: any): Promise<any>;
    findFirst(args: any): Promise<any>;
    findMany(args: any): Promise<any>;
    update(args: any): Promise<any>;
    updateMany(args: any): Promise<{ count: number }>;
  };
  shipment: {
    create(args: any): Promise<any>;
  };
  $queryRaw: (...args: any[]) => Promise<any>;
};

/**
 * The transaction surface of the order state machine.
 *
 * Every transition writes the status history of the order, so the transition
 * operations need the status-history writer next to the order rows.
 */
export type OrderTransitionTx = OrderWriteTx & OrderStatusHistoryWriter;

/** Read surface of the order module used by the public projections. */
export type OrderReadTx = {
  order: {
    findUnique(args: any): Promise<any>;
  };
};

/**
 * Read surface of the recipient projection.
 *
 * The recipient carries the address of the account behind the order, so the
 * projection also reads the `users` table through the auth identity
 * projection.
 */
export type OrderRecipientReadTx = OrderReadTx & AuthIdentityReadTx;

/** Parse a JSON value into an object, falling back to an empty object. */
function parseJsonObject(value: unknown): JsonRecord {
  return parseJsonRecord(value) ?? {};
}

const shipmentItemSelect = {
  id: true,
  shipmentId: true,
  orderItemId: true,
  quantity: true,
  createdAt: true,
} as const;

const shipmentSelect = {
  id: true,
  carrier: true,
  trackingNumber: true,
  status: true,
  shippedAt: true,
  deliveredAt: true,
  metadata: true,
  items: {
    select: shipmentItemSelect,
  },
} as const;

export class OrderService {
  /** Public predicate for the order-item catalog restriction (foreign key guard). */
  static isOrderItemCatalogRestriction(error: unknown): boolean {
    return isOrderItemCatalogRestriction(error);
  }

  /**
   * Create a new order for a user
   *
   * Validates product availability, calculates total amount, deducts stock,
   * and emits an order.created event via the Outbox pattern.
   *
   * The placement itself is the order placement pipeline: the stages of the
   * pipeline validate the request, price it, write the order and emit the
   * order.created event.
   *
   * @param userId User ID creating the order
   * @param data Order creation request containing items and shipping address
   * @returns Promise resolving to the created order response
   * @throws Error if order contains no items
   * @throws Error if product is not found
   * @throws Error if no variants are available for a product
   * @throws Error if variant is not found
   * @throws Error if insufficient stock for any item
   */
  static async createOrder(
    userId: string,
    data: CreateOrderRequest
  ): Promise<OrderCreationResult> {
    const placement = await runOrderPlacement(userId, data);
    return {
      order: this.formatOrderResponse(placement.order, placement.currency, placement.locale),
      replayed: placement.replayed,
    };
  }

  /**
   * Get paginated list of orders for a specific user
   *
   * Retrieves orders with full details including items, shipping address,
   * and shipments. Results can be filtered by order status.
   *
   * @param userId User ID to retrieve orders for
   * @param page Page number for pagination (default: 1)
   * @param limit Number of orders per page (default: 10)
   * @param status Optional order status filter
   * @returns Promise resolving to paginated order list response
   */
  static async getUserOrders(
    userId: string,
    page = 1,
    limit = 10,
    status?: OrderStatusType
  ): Promise<OrderListResponse> {
    const skip = (page - 1) * limit;
    const where: Prisma.OrderWhereInput = { userId };

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
            select: shipmentSelect
          },
          items: true
        }
      }),
      prisma.order.count({ where })
    ]);

    const currency = await systemSettingsService.getShopCurrency();
    const locale = await this.readAccountLocale(userId);
    return {
      items: orders.map(order => this.formatOrderResponse(order, currency, locale)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get detailed information for a specific order
   *
   * Retrieves full order details including items, product information,
   * shipping address, and shipments. Optionally filters by user ID
   * for authorization purposes.
   *
   * @param orderId Order ID to retrieve
   * @param userId Optional user ID to restrict access to user's own orders
   * @returns Promise resolving to order response or null if not found
   */
  static async getOrderById(
    orderId: string,
    userId?: string
  ): Promise<OrderResponse | null> {
    const where: Prisma.OrderWhereInput = { OR: [{ id: orderId }, { orderNumber: orderId }] };
    if (userId) {
      where.userId = userId;
    }

    const order = await prisma.order.findFirst({
      where,
      include: {
        shippingAddress: true,
        shipments: {
          select: shipmentSelect
        },
        items: true
      }
    });

    if (!order) {
      return null;
    }

    const currency = await systemSettingsService.getShopCurrency();
    const locale = await this.readAccountLocale(order.userId);
    const summary = await PaymentService.getOrderPaymentSummary(order.id);
    const payment = summary.payment;
    const response = this.formatOrderResponse(order, currency, locale);
    if (userId) response.pluginReturnTarget = await purchaseReturnTarget(order.id, userId);
    const action = payment?.actionJson as Prisma.JsonValue | undefined | null;
    response.paymentInstructions = order.paymentStatus === PaymentStatus.PENDING &&
      order.status !== OrderStatus.CANCELLED && action && typeof action === 'object' &&
      !Array.isArray(action) && action.type === 'instructions' && typeof action.text === 'string'
      ? action.text : null;
    response.paymentSessionId = payment?.sessionId ?? null;
    response.paymentId = payment?.id ?? null;
    response.paymentAttemptState = payment?.status ?? null;
    response.refundRequired = summary.refundRequired;
    return response;
  }

  /**
   * Cancel a pending order and restore inventory stock
   *
   * Only orders with PENDING status can be cancelled. Stock for all
   * order items is restored to product variants.
   *
   * @param orderId Order ID to cancel
   * @param userId User ID requesting cancellation (for authorization)
   * @param cancelReason Reason for order cancellation
   * @returns Promise resolving to cancelled order response
   * @throws Error if order is not found
   * @throws Error if order status is not PENDING
   */
  static async cancelOrder(
    orderId: string,
    userId: string,
    cancelReason: string
  ): Promise<OrderResponse> {
    const where: Prisma.OrderWhereInput = { id: orderId };
    if (userId) {
      where.userId = userId;
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      await lockOrder(tx, orderId);
      const order = await tx.order.findFirst({ where, include: { items: true } });
      if (!order) throw new ApiError('NOT_FOUND');
      assertOrderTransition(order.status, OrderStatus.CANCELLED, order.paymentStatus);
      for (const item of order.items) {
        await InventoryService.incrementStock(tx, item.variantId, item.quantity, {
          type: 'return',
          reason: 'order_cancelled',
          referenceId: order.id,
          userId: userId || undefined,
          metadata: { orderNumber: order.orderNumber },
        });
      }
      await PaymentService.cancelPendingForOrder(tx, orderId);

      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          cancelReason,
          cancelledAt: new Date()
        },
        include: {
          shippingAddress: true,
          items: true
        }
      });
      await emitEvent(tx, 'order.cancelled', 1, updated.id, {
        id: updated.id, orderNumber: updated.orderNumber, orderId: updated.id, userId: updated.userId, reason: cancelReason,
      });

      await recordOrderStatusHistory(tx, {
        orderId: updated.id,
        fromStatus: order.status as PrismaOrderStatus,
        toStatus: updated.status as PrismaOrderStatus,
        fromPaymentStatus: order.paymentStatus as PrismaOrderPaymentStatus,
        toPaymentStatus: updated.paymentStatus as PrismaOrderPaymentStatus,
        reason: cancelReason,
        actorType: 'user',
        actorId: userId,
      });

      return updated;
    });

    const currency = await systemSettingsService.getShopCurrency();
    const locale = await this.readAccountLocale(updatedOrder.userId);
    return this.formatOrderResponse(updatedOrder, currency, locale);
  }

  static async cancelExpiredUnpaidOrders(limit = 100): Promise<number> {
    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM public.orders WHERE status = 'PENDING' AND "paymentStatus" = 'PENDING'
          AND "unpaidExpiresAt" < clock_timestamp() AT TIME ZONE 'UTC'
        ORDER BY "unpaidExpiresAt", id LIMIT ${limit} FOR UPDATE SKIP LOCKED
      `;
      const expiredOrders = await tx.order.findMany({ where: { id: { in: locked.map(row => row.id) } }, include: { items: true } });
      let cancelled = 0;
      for (const order of expiredOrders) {
        assertOrderTransition(order.status, OrderStatus.CANCELLED, order.paymentStatus);
        const result = await tx.order.updateMany({
          where: { id: order.id, status: OrderStatus.PENDING, paymentStatus: PaymentStatus.PENDING, unpaidExpiresAt: { lt: new Date() } },
          data: { status: OrderStatus.CANCELLED, cancelReason: 'unpaid timeout', cancelledAt: new Date() },
        });
        if (result.count === 0) continue;
        for (const item of order.items) await InventoryService.incrementStock(tx, item.variantId, item.quantity, {
          type: 'return',
          reason: 'order_cancelled_unpaid',
          referenceId: order.id,
          metadata: { orderNumber: order.orderNumber },
        });
        await PaymentService.cancelPendingForOrder(tx, order.id);
        await recordOrderStatusHistory(tx, {
          orderId: order.id,
          fromStatus: order.status as PrismaOrderStatus,
          toStatus: PrismaOrderStatus.CANCELLED,
          fromPaymentStatus: order.paymentStatus as PrismaOrderPaymentStatus,
          toPaymentStatus: order.paymentStatus as PrismaOrderPaymentStatus,
          reason: 'unpaid timeout',
          actorType: 'system',
        });
        await emitEvent(tx, 'order.cancelled', 1, order.id, {
          id: order.id,
          orderNumber: order.orderNumber,
          orderId: order.id,
          userId: order.userId,
          reason: 'unpaid timeout',
        });
        cancelled += 1;
      }
      return cancelled;
    }, { timeout: 60_000 });
  }

  /**
   * Apply a successful capture to the order.
   *
   * The order module owns the order state machine: it evaluates the outcome
   * against the (locked) order row, applies the transition, writes the status
   * history and returns the decision so the payment module can record the
   * matching payment ledger entry.
   */
  static async applyPaymentSucceeded(tx: OrderTransitionTx, input: {
    orderId: string;
    reason?: string;
    actorType: string;
    actorId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{
    status: OrderStatusType;
    paymentStatus: PaymentStatusType;
    changed: boolean;
    refundRequired: boolean;
    refundReason: string | null;
  }> {
    const order = await tx.order.findUnique({ where: { id: input.orderId } });
    if (!order) throw new ApiError('NOT_FOUND');
    const firstPaid = order.status === OrderStatus.PENDING
      && order.paymentStatus !== PaymentStatus.PAID
      && order.paymentStatus !== PaymentStatus.REFUNDED;
    if (firstPaid) assertOrderTransition(order.status, OrderStatus.PROCESSING, order.paymentStatus);
    const refundRequired = !firstPaid;
    const refundReason = refundRequired
      ? order.status === OrderStatus.CANCELLED ? 'cancelled_order_payment' : 'additional_successful_payment'
      : null;

    let status = order.status as OrderStatusType;
    let paymentStatus = order.paymentStatus as PaymentStatusType;
    let changed = false;
    if (firstPaid) {
      const updated = await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.PROCESSING, paymentStatus: PaymentStatus.PAID },
      });
      status = updated.status as OrderStatusType;
      paymentStatus = updated.paymentStatus as PaymentStatusType;
      changed = true;
    } else if (order.status === OrderStatus.CANCELLED && order.paymentStatus !== PaymentStatus.REFUNDED) {
      const updated = await tx.order.update({
        where: { id: order.id },
        data: { paymentStatus: PaymentStatus.PAID },
      });
      status = updated.status as OrderStatusType;
      paymentStatus = updated.paymentStatus as PaymentStatusType;
      changed = true;
    }

    await recordOrderStatusHistory(tx, {
      orderId: order.id,
      fromStatus: order.status as PrismaOrderStatus,
      toStatus: status as PrismaOrderStatus,
      fromPaymentStatus: order.paymentStatus as PrismaOrderPaymentStatus,
      toPaymentStatus: paymentStatus as PrismaOrderPaymentStatus,
      reason: refundRequired
        ? order.status === OrderStatus.CANCELLED
          ? 'refund_required_after_cancelled_order_payment'
          : 'refund_required_after_additional_payment'
        : input.reason || 'payment_succeeded',
      actorType: input.actorType,
      actorId: input.actorId,
      metadata: { ...input.metadata, refundRequired },
    });

    return { status, paymentStatus, changed, refundRequired, refundReason };
  }

  /**
   * Apply a failed capture to the order. The order status itself is unchanged,
   * only the payment status moves to FAILED when the order is not paid or
   * refunded yet.
   */
  static async applyPaymentFailed(tx: OrderTransitionTx, input: {
    orderId: string;
    actorType: string;
    actorId?: string;
  }): Promise<{ status: OrderStatusType; paymentStatus: PaymentStatusType; changed: boolean }> {
    const order = await tx.order.findUnique({ where: { id: input.orderId } });
    if (!order) throw new ApiError('NOT_FOUND');
    if (order.paymentStatus === PaymentStatus.PAID || order.paymentStatus === PaymentStatus.REFUNDED) {
      return {
        status: order.status as OrderStatusType,
        paymentStatus: order.paymentStatus as PaymentStatusType,
        changed: false,
      };
    }
    const updated = await tx.order.update({
      where: { id: order.id },
      data: { paymentStatus: PaymentStatus.FAILED },
    });
    await recordOrderStatusHistory(tx, {
      orderId: order.id,
      fromStatus: order.status as PrismaOrderStatus,
      toStatus: updated.status as PrismaOrderStatus,
      fromPaymentStatus: order.paymentStatus as PrismaOrderPaymentStatus,
      toPaymentStatus: updated.paymentStatus as PrismaOrderPaymentStatus,
      reason: 'payment_failed',
      actorType: input.actorType,
      actorId: input.actorId,
    });
    return {
      status: updated.status as OrderStatusType,
      paymentStatus: updated.paymentStatus as PaymentStatusType,
      changed: true,
    };
  }

  /** Record a payment attempt on the order. */
  static async recordPaymentAttempt(tx: OrderWriteTx, input: {
    orderId: string;
    attemptNumber: number;
    at: Date;
    method: string;
  }): Promise<void> {
    await tx.order.update({
      where: { id: input.orderId },
      data: {
        paymentAttempts: input.attemptNumber,
        lastPaymentAttemptAt: input.at,
        lastPaymentMethod: input.method,
      },
    });
  }

  /**
   * Order side of a refund: the order becomes refunded and the status history
   * records the refund.
   */
  static async markRefunded(tx: OrderTransitionTx, input: {
    orderId: string;
    reason?: string;
    actorId: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ status: OrderStatusType; paymentStatus: PaymentStatusType }> {
    const order = await tx.order.findUnique({ where: { id: input.orderId } });
    if (!order) throw new ApiError('NOT_FOUND');
    if (order.paymentStatus !== PaymentStatus.PAID) throw new ApiError('INVALID_ORDER_TRANSITION');
    assertOrderTransition(order.status, OrderStatus.REFUNDED, order.paymentStatus);
    const updated = await tx.order.update({
      where: { id: order.id },
      data: { paymentStatus: PaymentStatus.REFUNDED, status: OrderStatus.REFUNDED },
    });
    await recordOrderStatusHistory(tx, {
      orderId: updated.id,
      fromStatus: order.status as PrismaOrderStatus,
      toStatus: updated.status as PrismaOrderStatus,
      fromPaymentStatus: order.paymentStatus as PrismaOrderPaymentStatus,
      toPaymentStatus: updated.paymentStatus as PrismaOrderPaymentStatus,
      reason: input.reason ?? 'admin_refund',
      actorType: 'admin',
      actorId: input.actorId,
      metadata: input.metadata,
    });
    return {
      status: updated.status as OrderStatusType,
      paymentStatus: updated.paymentStatus as PaymentStatusType,
    };
  }

  /**
   * Ship the order: create the shipment with its items, move the order to
   * SHIPPED, write the status history and emit order.fulfilled.
   */
  static async shipOrder(tx: OrderTransitionTx, input: {
    orderId: string;
    carrier: string;
    trackingNumber: string;
    items?: Array<{ orderItemId: string; quantity: number }>;
  }): Promise<void> {
    await lockOrder(tx, input.orderId);
    const order = await tx.order.findUnique({ where: { id: input.orderId }, include: { items: true } });
    if (!order) throw new ApiError('NOT_FOUND');
    assertOrderTransition(order.status, OrderStatus.SHIPPED, order.paymentStatus);

    const shipment = await tx.shipment.create({
      data: {
        orderId: input.orderId,
        carrier: input.carrier,
        trackingNumber: input.trackingNumber,
        status: 'SHIPPED',
        shippedAt: new Date(),
        items: input.items ? {
          create: input.items.map(item => ({
            orderItemId: item.orderItemId,
            quantity: item.quantity,
          })),
        } : undefined,
      },
      include: { items: true },
    });

    const updated = await tx.order.update({
      where: { id: input.orderId },
      data: { status: OrderStatus.SHIPPED },
    });
    await emitEvent(tx as unknown as EventTransaction, 'order.fulfilled', 1, input.orderId, {
      id: updated.id, orderNumber: updated.orderNumber, userId: updated.userId, status: 'SHIPPED',
      subtotalAmount: Number(updated.subtotalAmount), shippingAmount: Number(updated.shippingAmount),
      taxAmount: Number(updated.taxAmount), totalAmount: Number(updated.totalAmount), currency: updated.currency,
      items: order.items.map((item: any) => ({
        id: item.id, productId: item.productId, variantId: item.variantId,
        quantity: item.quantity, unitPrice: Number(item.unitPrice),
        fulfillmentData: item.fulfillmentData && typeof item.fulfillmentData === 'object' && !Array.isArray(item.fulfillmentData)
          ? item.fulfillmentData as Record<string, string | number | boolean | null> : null,
      })),
      shipment: {
        id: shipment.id, carrier: shipment.carrier, trackingNumber: shipment.trackingNumber,
        shippedAt: shipment.shippedAt?.toISOString() ?? null,
        items: shipment.items.map(({ orderItemId, quantity }: any) => ({ orderItemId, quantity })),
      },
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
  }

  /** Deliver the order: move it to DELIVERED and write the status history. */
  static async deliverOrder(tx: OrderTransitionTx, input: { orderId: string }): Promise<void> {
    await lockOrder(tx, input.orderId);
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      select: { status: true, paymentStatus: true },
    });
    if (!order) throw new ApiError('NOT_FOUND');
    assertOrderTransition(order.status, OrderStatus.DELIVERED, order.paymentStatus);
    const updated = await tx.order.update({
      where: { id: input.orderId },
      data: { status: OrderStatus.DELIVERED },
    });
    await recordOrderStatusHistory(tx, {
      orderId: input.orderId,
      fromStatus: order.status as PrismaOrderStatus,
      toStatus: updated.status as PrismaOrderStatus,
      fromPaymentStatus: order.paymentStatus as PrismaOrderPaymentStatus,
      toPaymentStatus: updated.paymentStatus as PrismaOrderPaymentStatus,
      reason: 'admin_deliver_order',
      actorType: 'admin',
    });
  }

  /**
   * Cancel the order on behalf of an administrator: move it to CANCELLED,
   * write the status history and emit order.cancelled.
   */
  static async cancelOrderByAdmin(tx: OrderTransitionTx, input: {
    orderId: string;
    cancelReason: string;
  }): Promise<void> {
    const order = await tx.order.findUnique({ where: { id: input.orderId }, include: { items: true } });
    if (!order) throw new ApiError('NOT_FOUND');
    assertOrderTransition(order.status, OrderStatus.CANCELLED, order.paymentStatus);
    const updated = await tx.order.update({
      where: { id: input.orderId },
      data: {
        status: OrderStatus.CANCELLED,
        cancelReason: input.cancelReason,
        cancelledAt: new Date(),
      },
    });
    await emitEvent(tx as unknown as EventTransaction, 'order.cancelled', 1, updated.id, {
      id: updated.id,
      orderNumber: updated.orderNumber,
      orderId: updated.id,
      userId: updated.userId,
      reason: input.cancelReason,
    });
    await recordOrderStatusHistory(tx, {
      orderId: updated.id,
      fromStatus: order.status as PrismaOrderStatus,
      toStatus: updated.status as PrismaOrderStatus,
      fromPaymentStatus: order.paymentStatus as PrismaOrderPaymentStatus,
      toPaymentStatus: updated.paymentStatus as PrismaOrderPaymentStatus,
      reason: input.cancelReason,
      actorType: 'admin',
    });
  }

  /**
   * Read-only projection of an order. Other modules consume the order through
   * this projection instead of reading the order table themselves.
   */
  static async getOrderProjection(tx: OrderReadTx, orderId: string): Promise<OrderProjection | null> {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) return null;
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      customerEmail: order.customerEmail ?? null,
      status: order.status as OrderStatusType,
      paymentStatus: order.paymentStatus as PaymentStatusType,
      totalAmount: Number(order.totalAmount),
      currency: order.currency,
      subtotalAmount: Number(order.subtotalAmount),
      shippingAmount: Number(order.shippingAmount),
      taxAmount: Number(order.taxAmount),
      items: order.items.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        fulfillmentData: item.fulfillmentData ?? null,
        catalogSnapshot: item.catalogSnapshot,
      })),
    };
  }

  /**
   * The locale of the account behind an order.
   *
   * The `users` table belongs to the auth module, so the order module reads
   * the account through the auth identity projection instead of the table.
   */
  private static async readAccountLocale(userId: string): Promise<string | null> {
    const identity = await AuthIdentityService.readProfile(prisma, userId);
    return identity?.locale ?? null;
  }

  /**
   * The recipient of an order notification: the order's own contact address
   * and the address of the customer account behind it.
   *
   * The `users` table belongs to the auth module, so the notifications module
   * consumes this projection instead of reading the user row itself.
   */
  static async getOrderRecipient(tx: OrderRecipientReadTx, orderId: string): Promise<{
    userId: string;
    orderNumber: string;
    customerEmail: string | null;
    accountEmail: string | null;
  } | null> {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) return null;
    const identity = await AuthIdentityService.readProfile(tx, order.userId);
    return {
      userId: order.userId,
      orderNumber: order.orderNumber,
      customerEmail: order.customerEmail ?? null,
      accountEmail: identity?.email ?? null,
    };
  }

  /**
   * The order body of the order.paid event payload. The order module owns the
   * catalog snapshot, so it also owns the payload that carries it.
   */
  static async getOrderPaidPayload(tx: OrderReadTx, orderId: string): Promise<OrderPaidPayload | null> {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) return null;
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      customerEmail: order.customerEmail ?? null,
      totalAmount: Number(order.totalAmount),
      currency: order.currency,
      items: order.items.map((item: any) => {
        const snapshot = readCatalogSnapshot(item.catalogSnapshot);
        return {
          id: item.id,
          productId: item.productId,
          variantId: item.variantId,
          productName: snapshot.productName,
          variantName: snapshot.variantName,
          skuCode: snapshot.skuCode ?? undefined,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          fulfillmentData: parseJsonObject(item.fulfillmentData),
          productTypeData: parseJsonObject(snapshot.productTypeData),
        };
      }),
    };
  }

  /**
   * Display fields of the catalog snapshot captured with an order item. The
   * snapshot belongs to the order module, so other modules read it through the
   * order service.
   */
  static catalogSnapshotView(catalogSnapshot: unknown, locale?: string | null): {
    productName: string;
    productImages: string[];
    variantName: string;
    skuCode: string | null;
    variantAttributes: JsonRecord | null;
  } {
    const snapshot = readCatalogSnapshot(catalogSnapshot as Prisma.JsonValue);
    return {
      productName: snapshotProductName(snapshot, locale),
      productImages: snapshot.productImages,
      variantName: snapshot.variantName,
      skuCode: snapshot.skuCode,
      variantAttributes: parseJsonRecord(snapshot.variantAttributes),
    };
  }

  /**
   * Format raw order data into standardized OrderResponse
   *
   * Transforms Prisma order entity with includes into a consistent
   * response format with calculated fields and proper type conversions.
   *
   * @param order Raw order object from Prisma with includes
   * @param currency Currency code for the order
   * @param locale Locale of the account behind the order, read through the
   *   auth identity projection
   * @returns Formatted order response object
   */
  private static formatOrderResponse(order: any, currency: string, locale: string | null): OrderResponse {
    return {
      orderNumber: order.orderNumber,
      id: order.id,
      userId: order.userId,
      status: order.status as OrderStatusType,
      paymentStatus: order.paymentStatus,
      subtotalAmount: Number(order.subtotalAmount || 0),
      shippingAmount: Number(order.shippingAmount || 0),
      shippingMethod: order.shippingMethod || null,
      taxAmount: Number(order.taxAmount || 0),
      taxInclusive: order.taxInclusive,
      totalAmount: Number(order.totalAmount),
      paymentMethod: order.paymentMethod,
      unpaidExpiresAt: order.unpaidExpiresAt ? order.unpaidExpiresAt.toISOString() : null,
      currency: currency,
      shippingAddress: order.shippingAddress || null,
      shipments: (order.shipments || []).map((shipment) => {
        const metadata = shipment.metadata && typeof shipment.metadata === 'object' && !Array.isArray(shipment.metadata)
          ? shipment.metadata as Record<string, unknown>
          : {};
        return {
          id: shipment.id,
          carrier: shipment.carrier,
          trackingNumber: shipment.trackingNumber,
          status: shipment.status,
          shippedAt: shipment.shippedAt,
          deliveredAt: shipment.deliveredAt,
          trackingUrl: typeof metadata.trackingUrl === 'string' ? metadata.trackingUrl : null,
          estimatedDeliveryAt: typeof metadata.estimatedDeliveryAt === 'string' ? metadata.estimatedDeliveryAt : null,
          lastCheckedAt: typeof metadata.lastCheckedAt === 'string' ? metadata.lastCheckedAt : null,
          events: Array.isArray(metadata.events) ? metadata.events : [],
          items: shipment.items,
        };
      }) as OrderResponse['shipments'],
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: snapshotProductName(readCatalogSnapshot(item.catalogSnapshot), locale),
        productImages: readCatalogSnapshot(item.catalogSnapshot).productImages,
        variantId: item.variantId,
        variantName: readCatalogSnapshot(item.catalogSnapshot).variantName,
        variantAttributes: parseJsonRecord(readCatalogSnapshot(item.catalogSnapshot).variantAttributes),
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        taxAmount: Number(item.taxAmount || 0),
        totalPrice: Number(item.lineTotal),
        fulfillmentData: parseJsonRecord(item.fulfillmentData),
        currency
      })),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      cancelReason: order.cancelReason || null,
      cancelledAt: order.cancelledAt ? order.cancelledAt.toISOString() : null
    };
  }
}
