// @ts-nocheck
/**
 * Order Service
 *
 * Manages order lifecycle including creation, status updates, cancellation,
 * completion, and refunds. Handles inventory management, payment status tracking,
 * and integrates with notification and event systems.
 *
 * Features:
 * - Product validation and stock management
 * - Order state machine (PENDING -> PROCESSING -> SHIPPED -> DELIVERED)
 * - Payment status tracking (PENDING -> PAID/REFUNDED)
 * - Event emission via Transactional Outbox pattern
 * - Push notification integration
 * - Order completion and refund hooks
 */

import { prisma } from '@/config/database';
import { Prisma, OrderStatus as PrismaOrderStatus, OrderPaymentStatus as PrismaOrderPaymentStatus } from '@prisma/client';
import {
  CreateOrderRequest,
  OrderResponse,
  OrderListResponse,
  OrderStatus,
  PaymentStatus,
  OrderStatusType,
  countryRequiresStatePostal,
  normalizeCountryCode,
} from './types';
import { getOrderHooks } from './hooks';
import { recordOrderStatusHistory } from './status-history';

const isUniqueConstraintError = (error: unknown): error is Prisma.PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
import { systemSettingsService } from '../admin/system-settings/service';
import { PushNotificationService } from '../notification/push-notification.service';
import { LoggerService } from '@/core/logger/unified-logger';
import { getSupplierProductProfile, resolveSupplierFulfillmentData, parseJsonRecord } from '@/core/external-orders/utils';
import { InventoryService } from '@/core/inventory/service';
import { WarehouseService } from '@/core/warehouse/service';

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
  items: {
    select: shipmentItemSelect,
  },
} as const;

export class OrderService {
  private static async ensureProductPurchasable(productId: string, variantId: string): Promise<void> {
    const [productLink, variantLink] = await Promise.all([
      prisma.externalProductLink.findFirst({
        where: {
          coreProductId: productId,
        },
        select: {
          sourceIsActive: true,
        },
      }),
      prisma.externalVariantLink.findFirst({
        where: {
          coreProductId: productId,
          coreVariantId: variantId,
        },
        select: {
          sourceIsActive: true,
        },
      }),
    ]);

    if (productLink?.sourceIsActive === false || variantLink?.sourceIsActive === false) {
      throw new Error('Product is no longer available from source');
    }
  }

  private static async validateShippingAddress(address: NonNullable<CreateOrderRequest['shippingAddress']>) {
    const requiredFields: Array<keyof NonNullable<CreateOrderRequest['shippingAddress']>> = [
      'firstName',
      'lastName',
      'phone',
      'addressLine1',
      'city',
      'country',
    ];

    for (const field of requiredFields) {
      const value = (address[field] as unknown as string | undefined)?.trim();
      if (!value) {
        throw new Error(`Shipping address field "${field}" is required`);
      }
    }

    const countriesRequireStatePostal = await systemSettingsService.getCheckoutCountriesRequireStatePostal();
    const normalizedCountries = countriesRequireStatePostal.map((code) => normalizeCountryCode(code));

    if (countryRequiresStatePostal(address.country, normalizedCountries)) {
      if (!address.state || address.state.trim().length === 0) {
        throw new Error('Shipping address field "state" is required for the selected country');
      }
      if (!address.postalCode || address.postalCode.trim().length === 0) {
        throw new Error('Shipping address field "postalCode" is required for the selected country');
      }
    }
  }

  private static normalizeShippingAddress(
    address: NonNullable<CreateOrderRequest['shippingAddress']> & {
      fullName?: string;
      phone?: string;
    }
  ): NonNullable<CreateOrderRequest['shippingAddress']> {
    const firstName = (address as any).firstName?.trim();
    const lastName = (address as any).lastName?.trim();
    const fullName = (address as any).fullName?.trim();
    const nameParts = fullName ? fullName.split(/\s+/).filter(Boolean) : [];
    const normalizedFirstName = firstName || nameParts[0] || '';
    const normalizedLastName = lastName || nameParts.slice(1).join(' ') || normalizedFirstName;

    return {
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      phone: (address as any).phone?.trim() || 'N/A',
      addressLine1: (address as any).addressLine1?.trim() || '',
      addressLine2: (address as any).addressLine2?.trim() || undefined,
      city: (address as any).city?.trim() || '',
      state: (address as any).state?.trim() || undefined,
      postalCode: (address as any).postalCode?.trim() || undefined,
      country: (address as any).country?.trim() || '',
      email: (address as any).email?.trim() || undefined,
    };
  }

  /**
   * Create a new order for a user
   *
   * Validates product availability, calculates total amount, deducts stock,
   * and emits an order.created event via the Outbox pattern.
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
  ): Promise<OrderResponse> {
    const normalizedShippingAddress = data.shippingAddress
      ? this.normalizeShippingAddress(data.shippingAddress as any)
      : undefined;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) {
      throw new Error('User not found');
    }

    // Verify products and calculate total amount
    let totalAmount = 0;
    let discountAmount = 0;
    let appliedDiscounts: Array<{ id: string; code: string; discountAmount: number }> = [];
    const orderItems: Array<{
      productId: string;
      variantId: string;
      quantity: number;
      unitPrice: number;
      fulfillmentData?: Record<string, unknown> | null;
    }> = [];
    let requiresOrderShipping = false;

    if (!data.items || data.items.length === 0) {
      throw new Error('Order must contain at least one item');
    }

    // Batch fetch all products to avoid N+1 query problem
    const productIds = data.items.map(item => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { variants: true }
    });

    // Create a map for O(1) lookup
    const productMap = new Map(products.map(p => [p.id, p]));
    const requestedQuantityByVariant = new Map<string, number>();
    for (const item of data.items) {
      if (!item.variantId) continue;
      requestedQuantityByVariant.set(
        item.variantId,
        (requestedQuantityByVariant.get(item.variantId) || 0) + item.quantity
      );
    }

    const defaultWarehouse = await WarehouseService.getDefaultWarehouse();
    const stockMap = await InventoryService.getAvailableStockByVariantIds(
      [...requestedQuantityByVariant.keys()],
      { warehouseId: defaultWarehouse.id }
    );

    for (const item of data.items) {
      const product = productMap.get(item.productId);

      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      if (!product.isActive) {
        throw new Error(`Product is not available: ${product.name}`);
      }

      const variantId = item.variantId;

      if (!variantId) {
        throw new Error(`Variant ID is required for product: ${product.name}`);
      }

      const variant = product.variants.find(v => v.id === variantId);
      if (!variant) {
        throw new Error(`Variant not found: ${variantId}`);
      }

      if (!variant.isActive) {
        throw new Error(`Variant is not available: ${variant.name}`);
      }

      await this.ensureProductPurchasable(item.productId, variantId);

      const supplierProfile = getSupplierProductProfile(product.typeData);
      const isSupplierProduct = supplierProfile.isSupplierProduct;
      const fallbackShippingAddress = normalizedShippingAddress;
      const resolvedFulfillmentData = isSupplierProduct
        ? resolveSupplierFulfillmentData(supplierProfile, item.fulfillmentData, fallbackShippingAddress)
        : null;

      if (isSupplierProduct && resolvedFulfillmentData?.shippingAddress) {
        await this.validateShippingAddress(
          resolvedFulfillmentData.shippingAddress as NonNullable<CreateOrderRequest['shippingAddress']>
        );
      }

      if (product.requiresShipping && !isSupplierProduct) {
        requiresOrderShipping = true;
      }

      const unitPrice = Number(variant.salePrice);
      const requestedQuantity = requestedQuantityByVariant.get(variantId) ?? item.quantity;
      const stock = stockMap.get(variantId) ?? 0;

      if (stock < requestedQuantity) {
        throw new Error(`Insufficient stock for variant ${variant.name} of product: ${product.name}`);
      }

      totalAmount += unitPrice * item.quantity;
      if (isSupplierProduct) {
        for (let index = 0; index < item.quantity; index += 1) {
          orderItems.push({
            productId: item.productId,
            variantId,
            quantity: 1,
            unitPrice,
            fulfillmentData: resolvedFulfillmentData ?? null,
          });
        }
      } else {
        orderItems.push({
          productId: item.productId,
          variantId,
          quantity: item.quantity,
          unitPrice,
        });
      }
    }

    if (data.discountCodes && data.discountCodes.length > 0) {
      const { DiscountEngine } = await import('@/core/discount/engine');
      const cartForDiscount = {
        id: '',
        userId,
        items: orderItems.map((item, index) => ({
          id: `preview-${index}`,
          productId: item.productId,
          productName: '',
          productImage: '',
          price: item.unitPrice,
          quantity: item.quantity,
          variantId: item.variantId,
          requiresShipping: false,
          maxQuantity: Number.MAX_SAFE_INTEGER,
          subtotal: item.unitPrice * item.quantity,
          fulfillmentData: item.fulfillmentData ?? null,
        })),
        total: totalAmount,
        itemCount: orderItems.reduce((sum, item) => sum + item.quantity, 0),
        subtotal: totalAmount,
        tax: 0,
        shipping: 0,
        discount: 0,
        discountAmount: 0,
        appliedDiscounts: [],
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const discountResult = await DiscountEngine.calculateDiscount(
        cartForDiscount,
        data.discountCodes,
        { id: userId }
      );

      discountAmount = discountResult.discountAmount;
      totalAmount = discountResult.finalTotal;
      appliedDiscounts = discountResult.appliedDiscounts.map((discount) => ({
        id: discount.id,
        code: discount.code,
        discountAmount: discount.discountAmount,
      }));
    }

    if (requiresOrderShipping && !data.shippingAddress) {
      throw new Error('Shipping address is required for shippable items');
    }

    if (normalizedShippingAddress) {
      await this.validateShippingAddress(normalizedShippingAddress);
    }

    // Lookup default store for order association
    const defaultStore = await prisma.store.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!defaultStore) {
      throw new Error('No store configured. Cannot create order.');
    }
    const storeId = defaultStore.id;

    // Unified currency from settings
    const currency = await systemSettingsService.getShopCurrency();

    // Create order + deduct stock atomically
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          user: { connect: { id: userId } },
          store: { connect: { id: storeId } },
          customerEmail: data.customerEmail?.trim() || user.email,
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          subtotalAmount: totalAmount + discountAmount,
          discountAmount,
          totalAmount,
          // Create order address relation
          shippingAddress: data.shippingAddress
            ? {
              create: {
                firstName: normalizedShippingAddress!.firstName.trim(),
                lastName: normalizedShippingAddress!.lastName.trim(),
                phone: normalizedShippingAddress!.phone?.trim(),
                addressLine1: normalizedShippingAddress!.addressLine1.trim(),
                addressLine2: normalizedShippingAddress!.addressLine2?.trim() || undefined,
                city: normalizedShippingAddress!.city.trim(),
                state: normalizedShippingAddress!.state?.trim() || '',
                country: normalizedShippingAddress!.country.trim(),
                postalCode: normalizedShippingAddress!.postalCode?.trim() || '',
                email: normalizedShippingAddress!.email?.trim() || undefined,
              }
            }
            : undefined,
          items: {
            create: orderItems.map(item => ({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              fulfillmentData: (item.fulfillmentData ?? null) as Prisma.InputJsonValue | null,
            }))
          },
          discountUsages: appliedDiscounts.length
            ? {
              create: appliedDiscounts.map((discount) => ({
                discountId: discount.id,
                userId,
                discountAmount: discount.discountAmount,
              })),
            }
            : undefined,
        },
        include: {
          shippingAddress: true,
          discountUsages: {
            include: {
              discount: {
                select: {
                  id: true,
                  code: true,
                },
              },
            },
          },
          items: {
            include: {
              product: true,
              variant: true
            }
          }
        }
      });

      for (const item of orderItems) {
        await InventoryService.decrementStock(tx, item.variantId, item.quantity);
      }

      for (const discount of appliedDiscounts) {
        await tx.discount.update({
          where: { id: discount.id },
          data: {
            usedCount: { increment: 1 },
          },
        });
      }

      await recordOrderStatusHistory(tx, {
        orderId: created.id,
        fromStatus: null,
        toStatus: created.status as PrismaOrderStatus,
        fromPaymentStatus: null,
        toPaymentStatus: created.paymentStatus as PrismaOrderPaymentStatus,
        actorType: 'user',
        actorId: userId,
        reason: 'order_created',
      });

      // Emit order.created event via Outbox (best-effort)
      try {
        const { OutboxService } = await import('@/infra/outbox');
        await OutboxService.emit(tx, 'order.created', created.id, {
          id: created.id,
          userId: created.userId,
          totalAmount: Number(created.totalAmount),
          currency,
          items: created.items.map((item: any) => ({
            id: item.id,
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            fulfillmentData: parseJsonRecord(item.fulfillmentData),
          }))
        });
      } catch (err) {
        LoggerService.logError(err instanceof Error ? err : new Error(String(err)), { context: 'order.created event emission' });
      }

      return created;
    });

    return this.formatOrderResponse(order, currency);
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

    const currency = await systemSettingsService.getShopCurrency();
    return {
      items: orders.map(order => this.formatOrderResponse(order, currency)),
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
    const where: Prisma.OrderWhereInput = { id: orderId };
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

    const currency = await systemSettingsService.getShopCurrency();
    return this.formatOrderResponse(order, currency);
  }

  /**
   * Update the status of an order
   *
   * Changes order status and sends a push notification to the user
   * informing them of the status change.
   *
   * Valid status transitions:
   * - PENDING -> PROCESSING | CANCELLED
   * - PROCESSING -> SHIPPED | CANCELLED
   * - SHIPPED -> DELIVERED | REFUNDED
   * - DELIVERED -> REFUNDED
   *
   * @param orderId Order ID to update
   * @param status New order status
   * @returns Promise resolving to updated order response
   */
  static async updateOrderStatus(
    orderId: string,
    status: OrderStatusType
  ): Promise<OrderResponse> {
    const existing = await prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true, paymentStatus: true, userId: true },
    });

    if (!existing) {
      throw new Error('Order not found');
    }

    const order = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
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

      await recordOrderStatusHistory(tx, {
        orderId: updated.id,
        fromStatus: existing.status as PrismaOrderStatus,
        toStatus: updated.status as PrismaOrderStatus,
        fromPaymentStatus: existing.paymentStatus as PrismaOrderPaymentStatus,
        toPaymentStatus: updated.paymentStatus as PrismaOrderPaymentStatus,
        reason: 'order_status_update',
        actorType: 'admin',
      });

      return updated;
    });

    // Send push notification for status update
    try {
      await PushNotificationService.sendOrderStatusUpdate(
        order.userId,
        order.id,
        status
      );
    } catch (err) {
      LoggerService.logError(err instanceof Error ? err : new Error(String(err)), { context: 'order status push notification' });
    }

    const currency = await systemSettingsService.getShopCurrency();
    return this.formatOrderResponse(order, currency);
  }

  /**
   * Cancel a pending order and restore inventory stock
   *
   * Only orders with PENDING status can be cancelled. Stock for all
   * order items is restored to product variants. A push notification
   * is sent to the user.
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

    const updatedOrder = await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await InventoryService.incrementStock(tx, item.variantId, item.quantity);
      }

      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          cancelReason,
          cancelledAt: new Date()
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

    // Send push notification for cancellation
    try {
      await PushNotificationService.sendOrderStatusUpdate(
        updatedOrder.userId,
        updatedOrder.id,
        OrderStatus.CANCELLED
      );
    } catch (err) {
      LoggerService.logError(err instanceof Error ? err : new Error(String(err)), { context: 'order cancellation push notification' });
    }

    const currency = await systemSettingsService.getShopCurrency();
    return this.formatOrderResponse(updatedOrder, currency);
  }

  /**
   * Mark an order as completed after successful payment
   *
   * Updates order status to COMPLETED and payment status to PAID.
   * Sends a push notification to the user and triggers order completion
   * hooks asynchronously for downstream processing.
   *
   * @param orderId Order ID to complete
   * @returns Promise resolving to completed order response
   * @throws Error if order is not found
   * @throws Error if order is already completed
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

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
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

      await recordOrderStatusHistory(tx, {
        orderId: updated.id,
        fromStatus: order.status as PrismaOrderStatus,
        toStatus: updated.status as PrismaOrderStatus,
        fromPaymentStatus: order.paymentStatus as PrismaOrderPaymentStatus,
        toPaymentStatus: updated.paymentStatus as PrismaOrderPaymentStatus,
        reason: 'order_completed',
        actorType: 'system',
      });

      return updated;
    });

    // Send push notification for payment confirmation
    try {
      await PushNotificationService.sendOrderStatusUpdate(
        updatedOrder.userId,
        updatedOrder.id,
        PaymentStatus.PAID
      );
    } catch (err) {
      LoggerService.logError(err instanceof Error ? err : new Error(String(err)), { context: 'order completion push notification' });
    }

    // Trigger order completion hooks
    const orderHooks = getOrderHooks();
    if (orderHooks) {
      // Execute hooks asynchronously, do not block response
      orderHooks.onOrderCompleted(orderId).catch(err => {
        LoggerService.logError(err instanceof Error ? err : new Error(String(err)), { context: 'order completion hooks' });
      });
    }

    const currency = await systemSettingsService.getShopCurrency();
    return this.formatOrderResponse(updatedOrder, currency);
  }

  /**
   * Process a full refund for an order
   *
   * Creates a Refund record for audit purposes, updates order status to
   * REFUNDED, restores stock for all items, and triggers refund hooks.
   * A push notification is sent to the user.
   *
   * The refund is processed in a transaction to ensure atomicity between
   * refund record creation and order status update.
   *
   * @param orderId Order ID to refund
   * @returns Promise resolving to refunded order response
   * @throws Error if order is not found
   * @throws Error if order is already refunded
   */
  static async refundOrder(orderId: string): Promise<OrderResponse> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          where: { status: 'SUCCEEDED' },
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        items: true,
      }
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.paymentStatus === PaymentStatus.REFUNDED) {
      throw new Error('Order is already refunded');
    }

    const successfulPayment = order.payments[0];
    const idempotencyKey = `ref_${order.id}_full`;

    if (successfulPayment) {
      const existingRefund = await prisma.refund.findUnique({
        where: { idempotencyKey },
      });
      if (existingRefund) {
        const currency = await systemSettingsService.getShopCurrency();
        const existingOrder = await prisma.order.findUnique({
          where: { id: orderId },
          include: {
            shippingAddress: true,
            items: {
              include: {
                product: true,
                variant: true,
              },
            },
          },
        });
        if (!existingOrder) {
          throw new Error('Order not found');
        }
        return this.formatOrderResponse(existingOrder, currency);
      }
    }

    // Transaction for order update and refund record creation
    let updatedOrder: Prisma.OrderGetPayload<{
      include: { shippingAddress: true; items: { include: { product: true; variant: true } } };
    }>;

    try {
      updatedOrder = await prisma.$transaction(async (tx) => {
        // 1. Create Refund record if a successful payment exists
        if (successfulPayment) {
          const refund = await tx.refund.create({
            data: {
              orderId: order.id,
              paymentId: successfulPayment.id,
              amount: Number(order.totalAmount),
              currency: successfulPayment.currency,
              status: 'COMPLETED',
              reason: 'Full refund requested by admin',
              provider: successfulPayment.paymentMethod.toUpperCase(),
              idempotencyKey,
            }
          });

          await tx.refundLedger.create({
            data: {
              refundId: refund.id,
              paymentId: successfulPayment.id,
              orderId: order.id,
              eventType: 'SUCCEEDED',
              amount: refund.amount,
              currency: refund.currency,
              provider: refund.provider ?? successfulPayment.paymentMethod,
              idempotencyKey,
            },
          });

          await tx.paymentLedger.create({
            data: {
              paymentId: successfulPayment.id,
              orderId: order.id,
              eventType: 'REFUNDED',
              amount: refund.amount,
              currency: refund.currency,
              provider: successfulPayment.paymentMethod,
              providerEventId: `refund:${refund.id}`,
              idempotencyKey,
            },
          });
        }

        // 2. Update order status
        const updated = await tx.order.update({
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

        await recordOrderStatusHistory(tx, {
          orderId: updated.id,
          fromStatus: order.status as PrismaOrderStatus,
          toStatus: updated.status as PrismaOrderStatus,
          fromPaymentStatus: order.paymentStatus as PrismaOrderPaymentStatus,
          toPaymentStatus: updated.paymentStatus as PrismaOrderPaymentStatus,
          reason: 'order_refunded',
          actorType: 'admin',
        });

        for (const item of order.items) {
          await InventoryService.incrementStock(tx, item.variantId, item.quantity);
        }

        return updated;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const currency = await systemSettingsService.getShopCurrency();
        const existingOrder = await prisma.order.findUnique({
          where: { id: orderId },
          include: {
            shippingAddress: true,
            items: {
              include: {
                product: true,
                variant: true,
              },
            },
          },
        });
        if (!existingOrder) {
          throw new Error('Order not found');
        }
        return this.formatOrderResponse(existingOrder, currency);
      }
      throw error;
    }

    // Send push notification for refund
    try {
      await PushNotificationService.sendOrderStatusUpdate(
        updatedOrder.userId,
        updatedOrder.id,
        OrderStatus.REFUNDED
      );
    } catch (err) {
      LoggerService.logError(err instanceof Error ? err : new Error(String(err)), { context: 'order refund push notification' });
    }

    // Trigger order refund hooks
    const orderHooks = getOrderHooks();
    if (orderHooks) {
      // Execute hooks asynchronously, do not block response
      orderHooks.onOrderRefunded(orderId).catch(err => {
        LoggerService.logError(err instanceof Error ? err : new Error(String(err)), { context: 'order refund hooks' });
      });
    }

    const currency = await systemSettingsService.getShopCurrency();
    return this.formatOrderResponse(updatedOrder, currency);
  }

  /**
   * Format raw order data into standardized OrderResponse
   *
   * Transforms Prisma order entity with includes into a consistent
   * response format with calculated fields and proper type conversions.
   *
   * @param order Raw order object from Prisma with includes
   * @param currency Currency code for the order
   * @returns Formatted order response object
   */
  private static formatOrderResponse(order: any, currency: string): OrderResponse {
    return {
      id: order.id,
      userId: order.userId,
      status: order.status as OrderStatusType,
      paymentStatus: order.paymentStatus,
      subtotalAmount: Number(order.subtotalAmount || 0),
      totalAmount: Number(order.totalAmount),
      discountAmount: Number(order.discountAmount || 0),
      appliedDiscounts: Array.isArray(order.discountUsages)
        ? order.discountUsages.map((usage: any) => ({
          id: usage.discountId,
          code: usage.discount?.code || '',
          discountAmount: Number(usage.discountAmount),
        }))
        : [],
      currency: currency,
      shippingAddress: order.shippingAddress || null,
      shipments: (order.shipments || []) as OrderResponse['shipments'],
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.product?.name || 'Unknown',
        variantId: item.variantId,
        variantName: item.variant?.name,
        variantAttributes: parseJsonRecord(item.variant?.attributes),
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        // Calculate totalPrice from unitPrice * quantity since it's not stored in DB
        totalPrice: Number(item.unitPrice) * item.quantity,
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
