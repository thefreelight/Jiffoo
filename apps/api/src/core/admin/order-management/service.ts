import { ApiError, knownPrismaOperation } from '@/utils/api-errors';
/**
 * Admin Order Service
 * Handles order management operations including shipping, refunds, and cancellations
 */

import { prisma } from '@/config/database';
import { OrderStatus as PrismaOrderStatus, type Prisma } from '@prisma/client';
import { systemSettingsService } from '@/core/settings/service';
import { CacheService } from '@/core/cache/service';
import { getTodayAndYesterdayRangeUtc } from '@/utils/timezone';
import { OrderStatus, PaymentStatus, canRefundOrder, closedOrderStatuses, restocksInventoryOnRefund } from '@/core/order/policy';
import { AuditService } from '@/core/audit/service';
import { OrderService } from '@/core/order/service';
import { InventoryService } from '@/core/inventory/service';
import { emitEvent } from '@/infra/events/emit';
import { recordPaymentNotCharged, recordPaymentSucceeded } from '@/core/payment/reconciliation';
import { PaymentService } from '@/core/payment/service';
import { lockOrder, lockPayment } from '@/core/shared/locks';
import { callContract } from '@/core/extensions/runtime/plugin-runtime';
import { PLUGIN_CONTRACT_VERSIONS } from '@jiffoo/shared';
import { orderWhere, orderSort, type OrderFilter, type OrderSort } from './list-query';

function codedError(code: import('@/utils/api-errors').ErrorCode, _message: string): ApiError {
  return new ApiError(code);
}

function calculateTrendPercent(current: number, previous: number): number {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

// Match unresolved attempts accepted by the existing manual payment-review operation.
export function paymentReviewWhere(): Prisma.PaymentWhereInput {
  return { status: 'REQUIRES_REVIEW', reviewResolution: null };
}

export class AdminOrderService {
  static async resolvePaymentReview(orderId: string, paymentId: string, actorId: string, outcome: 'PAID' | 'NOT_CHARGED', reference: string) {
    reference = reference?.trim();
    if (!reference) throw new ApiError('PAYMENT_REFERENCE_REQUIRED');
    await prisma.$transaction(async tx => {
      await lockOrder(tx, orderId);
      await lockPayment(tx, paymentId);
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment || payment.orderId !== orderId) throw new ApiError('NOT_FOUND');
      const paidResolution = await tx.adminAuditEvent.findFirst({ where: {
        targetType: 'payment', targetId: paymentId, action: 'PAYMENT_REVIEW_CONFIRMED_PAID',
      } });
      if (payment.reviewResolution || paidResolution || payment.status !== 'REQUIRES_REVIEW') {
        const summary = paidResolution?.summary as { reference?: string } | undefined;
        if ((outcome === 'NOT_CHARGED' && payment.reviewResolution === 'NOT_CHARGED' && payment.reviewReference === reference)
          || (outcome === 'PAID' && paidResolution && summary?.reference === reference)) return;
        throw new ApiError('PAYMENT_REVIEW_ALREADY_RESOLVED');
      }
      if (outcome === 'PAID') {
        const changed = await recordPaymentSucceeded({ paymentId, providerPaymentId: reference,
          providerEventId: `review:${paymentId}`, actorType: 'admin', actorId, manualReference: reference,
          reason: 'admin_review_confirmed_paid', reviewConfirmation: true,
        }, tx);
        if (!changed) throw new ApiError('PAYMENT_REVIEW_ALREADY_RESOLVED');
      } else {
        await recordPaymentNotCharged({ paymentId, actorId, reference }, tx);
      }
      await AuditService.write(tx, { actorId,
        action: outcome === 'PAID' ? 'PAYMENT_REVIEW_CONFIRMED_PAID' : 'PAYMENT_REVIEW_CLOSED_NOT_CHARGED',
        targetType: 'payment', targetId: paymentId, summary: { paymentId, orderId, reference, outcome },
      });
    });
    await CacheService.incrementOrderVersion();
    return this.getOrderById(orderId);
  }

  static async getOrderStats() {
    const [statusGroups, paymentReviewCount] = await Promise.all([
      prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.order.count({ where: { payments: { some: paymentReviewWhere() } } }),
    ]);
    const statusCounts = Object.fromEntries(Object.values(PrismaOrderStatus).map(status => [status, 0]));
    for (const group of statusGroups) statusCounts[group.status] = group._count._all;
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
          paymentStatus: PaymentStatus.PAID,
          status: { notIn: closedOrderStatuses() },
        },
      }),
      prisma.order.count({ where: { paymentStatus: PaymentStatus.PAID } }),
      prisma.order.count({ where: { status: OrderStatus.SHIPPED } }),
      prisma.order.count({ where: { status: OrderStatus.REFUNDED } }),
      prisma.order.count({ where: { createdAt: { gte: startOfTodayUtc } } }),
      prisma.order.count({ where: { createdAt: { gte: startOfYesterdayUtc, lt: startOfTodayUtc } } }),
      prisma.order.count({ where: { paymentStatus: PaymentStatus.PAID, createdAt: { gte: startOfTodayUtc } } }),
      prisma.order.count({ where: { paymentStatus: PaymentStatus.PAID, createdAt: { gte: startOfYesterdayUtc, lt: startOfTodayUtc } } }),
      prisma.order.count({ where: { status: OrderStatus.SHIPPED, createdAt: { gte: startOfTodayUtc } } }),
      prisma.order.count({ where: { status: OrderStatus.SHIPPED, createdAt: { gte: startOfYesterdayUtc, lt: startOfTodayUtc } } }),
      prisma.order.count({ where: { status: OrderStatus.REFUNDED, createdAt: { gte: startOfTodayUtc } } }),
      prisma.order.count({ where: { status: OrderStatus.REFUNDED, createdAt: { gte: startOfYesterdayUtc, lt: startOfTodayUtc } } }),
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: {
          paymentStatus: PaymentStatus.PAID,
          status: { notIn: closedOrderStatuses() },
          createdAt: { gte: startOfTodayUtc },
        },
      }),
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: {
          paymentStatus: PaymentStatus.PAID,
          status: { notIn: closedOrderStatuses() },
          createdAt: { gte: startOfYesterdayUtc, lt: startOfTodayUtc },
        },
      }),
    ]);

    return {
      statusCounts,
      paymentReviewCount,
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
  static async getOrders(page = 1, limit = 20, status?: string, search?: string, paymentStatus?: 'PAID' | 'UNPAID' | 'REFUNDED', paymentReview?: 'required', options: OrderSort & Pick<OrderFilter, 'createdFrom' | 'createdTo' | 'customerId'> = {}) {
    const skip = (page - 1) * limit;
    const where = orderWhere({ status, search, paymentStatus, paymentReview, ...options });
    const searchText = search?.trim();


    // Try cache
    const filters = { status, search: searchText || undefined, paymentStatus: paymentStatus ?? null, paymentReview: paymentReview ?? null, ...options };
    // The cache version is captured once, before the query, and the entry is
    // stored under that same version. A write that commits while the query
    // runs bumps the version, so the stored entry lands under the old key,
    // which no reader asks for any more, instead of poisoning the new key
    // with the pre-write list.
    const cacheVersion = await CacheService.getOrderVersion();
    const cached = await CacheService.getOrderList(page, limit, filters, cacheVersion);
    if (cached) return cached;

    // Fetch currency once for all items (same store = same currency, cached)
    const currency = await systemSettingsService.getShopCurrency();

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: orderSort(options),
        select: {
          id: true,
          orderNumber: true,
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
          },
          items: { select: { quantity: true } },
          payments: { where: paymentReviewWhere(), select: { id: true }, take: 1 },
        }
      }),
      prisma.order.count({ where })
    ]);

    const result = {
      items: orders.map(order => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalAmount: Number(order.totalAmount),
        currency,
        createdAt: order.createdAt.toISOString(),
        itemsCount: order._count.items,
        itemQuantitySum: order.items.reduce((sum, item) => sum + item.quantity, 0),
        requiresPaymentReview: order.payments.length > 0,
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
    await CacheService.setOrderList(page, limit, result, filters, 30, cacheVersion);

    return result;
  }

  static async getOrderNeighbors(orderId: string, filter: OrderFilter & OrderSort = {}) {
    const where = orderWhere(filter);
    const anchor = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, createdAt: true, totalAmount: true } });
    if (!anchor) throw new ApiError('NOT_FOUND');
    const field = filter.sortBy ?? 'createdAt', direction = filter.sortOrder ?? 'desc';
    const side = (before: boolean): Prisma.OrderWhereInput => {
      const comparison = before === (direction === 'asc') ? 'lt' : 'gt';
      return { OR: [{ [field]: { [comparison]: anchor[field] } }, { [field]: anchor[field], id: { [comparison]: anchor.id } }] };
    };
    // Range comparisons and LIMIT 1 keep neighbour lookup in the database.
    const [total, matched, preceding, previous, next] = await prisma.$transaction([
      prisma.order.count({ where }),
      prisma.order.count({ where: { AND: [where, { id: orderId }] } }),
      prisma.order.count({ where: { AND: [where, side(true)] } }),
      prisma.order.findFirst({ where: { AND: [where, side(true)] }, orderBy: orderSort({ sortBy: field, sortOrder: direction === 'asc' ? 'desc' : 'asc' }), select: { id: true } }),
      prisma.order.findFirst({ where: { AND: [where, side(false)] }, orderBy: orderSort({ sortBy: field, sortOrder: direction }), select: { id: true } }),
    ], { isolationLevel: 'RepeatableRead' });
    return { position: matched ? preceding + 1 : null, total, previousId: previous?.id ?? null, nextId: next?.id ?? null };
  }

  /**
   * Get order by ID - projected detail response for editing/viewing
   */
  static async getOrderById(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        subtotalAmount: true,
        shippingAmount: true,
        taxAmount: true,
        taxInclusive: true,
        customerEmail: true,
        statusHistory: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: { createdAt: true, fromStatus: true, toStatus: true, fromPaymentStatus: true, toPaymentStatus: true, actorType: true },
        },
        expiresAt: true,
        lastPaymentAttemptAt: true,
        paymentAttempts: true,
        lastPaymentMethod: true,
        paymentMethod: true,
        cancelReason: true,
        cancelledAt: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            locale: true
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
            lineTotal: true,
            catalogSnapshot: true,
            productId: true,
            variantId: true,
            fulfillmentStatus: true,
          }
        },
        shipments: {
          select: {
            id: true,
            carrier: true,
            trackingNumber: true,
            status: true,
            shippedAt: true,
            deliveredAt: true,
            fulfillmentId: true,
            fulfillmentStatus: true
          }
        }
      }
    });

    if (!order) {
      return null;
    }

    // The detail reads are independent of each other, so they run concurrently
    // instead of one after the other.
    const [
      customerOrderCount,
      customerOrderNumber,
      latestPayment,
      refundRequiredPayments,
      refundablePaymentCount,
      paymentReviews,
      currency,
    ] = await Promise.all([
      prisma.order.count({ where: { userId: order.user!.id } }),
      prisma.order.count({ where: { userId: order.user!.id, OR: [
        { createdAt: { lt: order.createdAt } }, { createdAt: order.createdAt, id: { lte: order.id } },
      ] } }),
      prisma.payment.findFirst({ where: { orderId }, orderBy: { attemptNumber: 'desc' }, select: { status: true } }),
      prisma.paymentLedger.findMany({
        where: { orderId, eventType: 'SUCCEEDED', refundRequired: true },
        include: { refunds: { where: { status: 'COMPLETED' }, select: { reference: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.paymentLedger.count({ where: { orderId, eventType: 'SUCCEEDED', refundRequired: false, refunds: { none: { status: 'COMPLETED' } } } }),
      prisma.payment.findMany({ where: { orderId }, orderBy: { attemptNumber: 'asc' } }),
      systemSettingsService.getShopCurrency(),
    ]);
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

    // The plugin contract call stays outside any transaction.
    const canRecordManualPayment = !['UNKNOWN', 'REQUIRES_REVIEW'].includes(latestPayment?.status || '') && (order.status === OrderStatus.PENDING || order.status === OrderStatus.CANCELLED) && order.paymentStatus !== PaymentStatus.PAID && order.paymentMethod
      ? await callContract(order.paymentMethod, 'payment', PLUGIN_CONTRACT_VERSIONS.payment, 'describe', {
        storeCurrency: currency,
      }).then((description: { requiresManualConfirmation: boolean }) => description.requiresManualConfirmation).catch(() => false)
      : false;

    const refundResolutions = refundRequiredPayments.map(row => ({
      paymentId: row.paymentId, providerPaymentId: row.providerPaymentId!, amount: Number(row.amount), currency: row.currency,
      status: row.refunds.length ? 'resolved' as const : 'pending' as const,
      reference: row.refunds[0]?.reference ?? null,
    }));
    const refundRequired = refundResolutions.some(row => row.status === 'pending');
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customerOrderNumber,
      customerOrderCount,
      status: order.status,
      paymentStatus: order.paymentStatus,
      refundRequired,
      refundResolutions,
      canRefundOrder: refundablePaymentCount > 0,
      paymentAttemptState: latestPayment?.status ?? null,
      paymentReviews: paymentReviews.map(payment => ({
        paymentId: payment.id, attemptNumber: payment.attemptNumber, status: payment.status, amount: Number(payment.amount), currency: payment.currency,
        failureReason: payment.failureReason, reviewResolution: payment.reviewResolution,
        reviewResolvedAt: payment.reviewResolvedAt?.toISOString() ?? null,
        reviewResolvedBy: payment.reviewResolvedBy, reviewReference: payment.reviewReference,
      })),
      totalAmount: Number(order.totalAmount),
      amounts: { subtotal: Number(order.subtotalAmount), shipping: Number(order.shippingAmount), tax: Number(order.taxAmount), taxInclusive: order.taxInclusive, total: Number(order.totalAmount) },
      timeline: order.statusHistory.map(row => ({ at: row.createdAt.toISOString(), fromStatus: row.fromStatus, toStatus: row.toStatus,
        fromPaymentStatus: row.fromPaymentStatus, toPaymentStatus: row.toPaymentStatus, actorType: row.actorType })),
      currency,
      notes: null,
      paymentMethod: order.paymentMethod,
      canRecordManualPayment,
      paymentAttempts: order.paymentAttempts,
      lastPaymentAttemptAt: order.lastPaymentAttemptAt ? order.lastPaymentAttemptAt.toISOString() : null,
      expiresAt: order.expiresAt ? order.expiresAt.toISOString() : null,
      cancelReason: order.cancelReason,
      cancelledAt: order.cancelledAt ? order.cancelledAt.toISOString() : null,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      customer: {
        id: order.user?.id || null,
        email: order.user?.email || order.customerEmail || null,
        username: order.user?.username || null
      },
      shippingAddress: shippingAddr,
      items: order.items.map(item => {
        const snapshot = OrderService.catalogSnapshotView(item.catalogSnapshot, order.user?.locale);
        return {
          id: item.id,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.lineTotal),
          productId: item.productId,
          productName: snapshot.productName,
          productImages: snapshot.productImages,
          variantId: item.variantId,
          skuCode: snapshot.skuCode,
          variantName: snapshot.variantName,
          fulfillmentStatus: item.fulfillmentStatus
        };
      }),
      shipments: order.shipments.map(s => ({
        id: s.id,
        carrier: s.carrier || '',
        trackingNumber: s.trackingNumber || '',
        status: s.status,
        shippedAt: s.shippedAt ? s.shippedAt.toISOString() : null,
        deliveredAt: s.deliveredAt ? s.deliveredAt.toISOString() : null,
        fulfillmentId: s.fulfillmentId ?? null,
        fulfillmentStatus: s.fulfillmentStatus ?? null
      }))
    };
  }

  static async recordManualPayment(orderId: string, actorId: string, reference: string) {
    reference = reference?.trim();
    if (!reference) throw new ApiError('PAYMENT_REFERENCE_REQUIRED');
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, paymentStatus: true, paymentMethod: true },
    });
    if (!order) {
      throw new ApiError('NOT_FOUND');
    }
    const recorded = await prisma.paymentLedger.findFirst({ where: { orderId, eventType: 'SUCCEEDED', actorType: 'admin', manualReference: reference } });
    if (recorded) return this.getOrderById(orderId);

    if (!order.paymentMethod) {
      throw codedError('MANUAL_CONFIRMATION_NOT_SUPPORTED', 'Manual confirmation is not supported for this order.');
    }
    const installation = await prisma.pluginInstallation.findUnique({
      where: { pluginSlug_instanceKey: { pluginSlug: order.paymentMethod, instanceKey: 'default' } },
      include: { plugin: { select: { deletedAt: true } } },
    });
    if (installation && (!installation.enabled || installation.deletedAt || installation.plugin.deletedAt)) {
      throw codedError('PAYMENT_PROVIDER_DISABLED', 'Payment provider is disabled; manual confirmation is unavailable.');
    }
    const description = await callContract(order.paymentMethod, 'payment', PLUGIN_CONTRACT_VERSIONS.payment, 'describe', {
      storeCurrency: await systemSettingsService.getShopCurrency(),
    }) as { requiresManualConfirmation: boolean };
    if (!description.requiresManualConfirmation) {
      throw codedError('MANUAL_CONFIRMATION_NOT_SUPPORTED', 'Manual confirmation is not supported for this order.');
    }

    const payment = await prisma.payment.findFirst({
      where: {
        orderId,
        paymentMethod: order.paymentMethod,
        status: { in: ['PENDING','CANCELLED','FAILED','EXPIRED'] },
        sessionId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) {
      if (await prisma.payment.findFirst({ where: { orderId, status: 'CREATING' } })) throw new ApiError('PAYMENT_ATTEMPT_OPEN');
      throw new ApiError('VALIDATION_ERROR');
    }

    await knownPrismaOperation(() => recordPaymentSucceeded({
      paymentId: payment.id,
      providerEventId: `manual:${payment.id}`,
      providerPaymentId: `manual:${reference}`,
      reason: 'manual_payment_recorded',
      actorType: 'admin',
      actorId,
      manualReference: reference,
    }), { notFound: 'NOT_FOUND' });

    await CacheService.incrementOrderVersion();
    return this.getOrderById(orderId);
  }

  /**
   * Ship order - create shipment record with tracking info
   *
   * The fulfilment of the order is asked from the order module before the
   * transaction opens, so the provider never holds a transaction open and a
   * failing provider never blocks the shipment.
   */
  static async shipOrder(orderId: string, data: {
    carrier: string;
    trackingNumber: string;
    items?: Array<{ orderItemId: string; quantity: number }>;
  }) {
    const fulfillment = await OrderService.requestFulfilment(orderId);
    await prisma.$transaction(async (tx) => {
      await OrderService.shipOrder(tx, {
        orderId,
        carrier: data.carrier,
        trackingNumber: data.trackingNumber,
        items: data.items,
        fulfillment,
      });
    });

    // Invalidate list cache
    await CacheService.incrementOrderVersion();

    return this.getOrderById(orderId);
  }

  static async deliverOrder(orderId: string) {
    await prisma.$transaction(async (tx) => {
      await OrderService.deliverOrder(tx, { orderId });
    });
    await CacheService.incrementOrderVersion();
    return this.getOrderById(orderId);
  }

  /**
   * Refund order
   */
  static async refundOrder(orderId: string, data: {
    reason?: string;
    idempotencyKey: string;
    reference: string;
    actorId: string;
  }) {
    const reference = data.reference?.trim();
    if (!reference) throw new ApiError('PAYMENT_REFERENCE_REQUIRED');
    await prisma.$transaction(async (tx) => {
      await lockOrder(tx, orderId);
      const order = await OrderService.getOrderProjection(tx, orderId);
      if (!order) throw new ApiError('NOT_FOUND');
      if (!canRefundOrder(order.status, order.paymentStatus, { allowAlreadyRefunded: true })) throw new ApiError('INVALID_ORDER_TRANSITION');
      const payment = await tx.payment.findFirst({
        where: { orderId, ledger: { some: { eventType: 'SUCCEEDED', refundRequired: false } } },
        orderBy: { createdAt: 'asc' },
      });
      if (!payment) throw new ApiError('VALIDATION_ERROR');
      await lockPayment(tx, payment.id);
      const refund = await PaymentService.refundOrder(tx, {
        orderId,
        paymentId: payment.id,
        amount: String(order.totalAmount),
        currency: payment.currency,
        provider: payment.paymentMethod,
        reason: data.reason,
        reference,
        idempotencyKey: data.idempotencyKey,
      });
      if (!refund.created) return;

      await emitEvent(tx, 'order.refunded', 1, order.id, {
        id: order.id,
        orderNumber: order.orderNumber,
        orderId: order.id,
        refundId: refund.refundId,
        userId: order.userId,
        paymentId: payment.id,
        amount: order.totalAmount,
        currency: payment.currency,
        fullyRefunded: true,
        reason: data.reason ?? undefined,
        items: order.items.map((item) => ({ orderItemId: item.id, quantity: item.quantity })),
      });

      await OrderService.markRefunded(tx, {
        orderId,
        reason: data.reason,
        actorId: data.actorId,
        metadata: { refundId: refund.refundId },
      });

      if (restocksInventoryOnRefund(order.status)) {
        for (const item of order.items) {
          await knownPrismaOperation(() => InventoryService.incrementStock(tx, item.variantId, item.quantity, {
            type: 'return',
            reason: 'order_refunded',
            referenceId: order.id,
            userId: data.actorId,
            metadata: { orderNumber: order.orderNumber, refundId: refund.refundId },
          }), { notFound: 'NOT_FOUND' });
        }
      }
    });

    // Invalidate list cache
    await CacheService.incrementOrderVersion();

    return this.getOrderById(orderId);
  }

  /**
   * Cancel order
   */
  static async resolveRefundRequiredPayment(orderId: string, data: {
    paymentId: string; providerPaymentId: string; reference: string; idempotencyKey: string; actorId: string;
  }) {
    const reference = data.reference?.trim();
    if (!reference) throw new ApiError('PAYMENT_REFERENCE_REQUIRED');
    await prisma.$transaction(async tx => {
      await lockOrder(tx, orderId);
      const order = await OrderService.getOrderProjection(tx, orderId);
      if (!order) throw new ApiError('NOT_FOUND');
      await lockPayment(tx, data.paymentId);
      await PaymentService.resolveRefundRequiredPayment(tx, {
        orderId,
        paymentId: data.paymentId,
        providerPaymentId: data.providerPaymentId,
        reference,
        idempotencyKey: data.idempotencyKey,
        actorId: data.actorId,
      });
    });
    await CacheService.incrementOrderVersion();
    return this.getOrderById(orderId);
  }

  static async cancelOrder(orderId: string, data: {
    cancelReason: string;
  }) {
    await prisma.$transaction(async (tx) => {
      await lockOrder(tx, orderId);
      const order = await OrderService.getOrderProjection(tx, orderId);
      if (!order) throw new ApiError('NOT_FOUND');
      await PaymentService.cancelPendingForOrder(tx, orderId);
      await OrderService.cancelOrderByAdmin(tx, { orderId, cancelReason: data.cancelReason });

      for (const item of order.items) {
        await knownPrismaOperation(() => InventoryService.incrementStock(tx, item.variantId, item.quantity, {
          type: 'return',
          reason: 'order_cancelled',
          referenceId: order.id,
          metadata: { orderNumber: order.orderNumber },
        }), { notFound: 'NOT_FOUND' });
      }
    });

    // Invalidate list cache
    await CacheService.incrementOrderVersion();

    return this.getOrderById(orderId);
  }
}
