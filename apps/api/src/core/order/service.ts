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
import { createOrderNotification } from '@/core/notifications/service';
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
import { recordOrderStatusHistory } from './status-history';
import { assertOrderTransition } from './transition';

import { systemSettingsService } from '../admin/system-settings/service';
import { LoggerService } from '@/core/logger/unified-logger';
import { InventoryService } from '@/core/inventory/service';
import { emitEvent } from '@/infra/events/emit';
import { CheckoutService } from '@/core/checkout/service';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { callContract, ContractCallError } from '@/core/admin/extension-installer/plugin-runtime';
import { decimalToMinor, minorToDecimal } from '@/core/payment/minor-units';
import { currentLinePrice } from './current-pricing';

type JsonRecord = Record<string, unknown>;

export function parseJsonRecord(value: unknown): JsonRecord | null {
  if (!value) return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as JsonRecord;
  }
  if (typeof value !== 'string') return null;

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as JsonRecord;
    }
  } catch {
    return null;
  }

  return null;
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
    const currency = await systemSettingsService.getShopCurrency();

    // Verify products and calculate total amount
    let totalAmount = 0;
    const orderItems: Array<{
      productId: string;
      variantId: string;
      quantity: number;
      unitPrice: number;
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

    const stockMap = await InventoryService.getAvailableStockByVariantIds(
      [...requestedQuantityByVariant.keys()]
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

      if (product.requiresShipping) {
        requiresOrderShipping = true;
      }

      const unitPrice = currentLinePrice(variant, currency).unitPrice;
      const requestedQuantity = requestedQuantityByVariant.get(variantId) ?? item.quantity;
      const stock = stockMap.get(variantId) ?? 0;

      if (stock < requestedQuantity) {
        throw new Error(`Insufficient stock for variant ${variant.name} of product: ${product.name}`);
      }

      totalAmount += unitPrice * item.quantity;
      orderItems.push({
        productId: item.productId,
        variantId,
        quantity: item.quantity,
        unitPrice,
      });
    }

    if (requiresOrderShipping && !data.shippingAddress) {
      throw new Error('Shipping address is required for shippable items');
    }

    if (normalizedShippingAddress) {
      await this.validateShippingAddress(normalizedShippingAddress);
    }

    // Unified currency from settings
    if (!normalizedShippingAddress) throw new Error('Shipping address is required');
    const quote = await CheckoutService.quoteItems(currency, orderItems.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      unitPriceMinor: decimalToMinor(item.unitPrice, currency),
    })), {
      shippingAddress: {
        country: normalizedShippingAddress.country,
        state: normalizedShippingAddress.state,
        city: normalizedShippingAddress.city,
        postalCode: normalizedShippingAddress.postalCode,
        addressLine1: normalizedShippingAddress.addressLine1,
        addressLine2: normalizedShippingAddress.addressLine2,
      },
      shippingOptionId: data.shippingOptionId,
    }, true);
    const selectedShipping = quote.shippingOptions.find((option) => option.id === data.shippingOptionId);
    if (!selectedShipping) {
      const error = new Error('SHIPPING_METHOD_UNAVAILABLE') as Error & { statusCode?: number; code?: string };
      error.statusCode = 409; error.code = 'SHIPPING_METHOD_UNAVAILABLE'; throw error;
    }
    const payment = quote.paymentMethods.find((method) => method.providerSlug === data.paymentMethod);
    if (!payment) {
      const error = new Error('PAYMENT_METHOD_UNAVAILABLE') as Error & { statusCode?: number; code?: string };
      error.statusCode = 409; error.code = 'PAYMENT_METHOD_UNAVAILABLE'; throw error;
    }
    let description: { unpaidTimeoutMinutes: number; supportedCurrencies: string[] };
    try {
      description = await callContract(data.paymentMethod, 'payment', 1, 'describe', { storeCurrency: currency }) as { unpaidTimeoutMinutes: number; supportedCurrencies: string[] };
    } catch (error) {
      if (error instanceof ContractCallError) {
        const unavailable = new Error('PAYMENT_METHOD_UNAVAILABLE') as Error & { statusCode: number; code: string };
        unavailable.statusCode = 409; unavailable.code = 'PAYMENT_METHOD_UNAVAILABLE'; throw unavailable;
      }
      throw error;
    }
    if (!description.supportedCurrencies.includes(currency)) throw new Error('PAYMENT_METHOD_UNAVAILABLE');
    const taxProvider = await PluginManagementService.resolveSingleProvider('tax');
    const taxLines = orderItems.map((item, index) => ({ lineId: String(index), productId: item.productId, variantId: item.variantId, quantity: item.quantity, amountMinor: decimalToMinor(item.unitPrice * item.quantity, currency) }));
    const shippingMinor = selectedShipping.amountMinor;
    const tax = taxProvider
      ? await callContract(taxProvider.pluginSlug, 'tax', 1, 'calculate', { currency, lines: taxLines, shippingAmountMinor: shippingMinor, address: { country: normalizedShippingAddress.country, region: normalizedShippingAddress.state, city: normalizedShippingAddress.city, postalCode: normalizedShippingAddress.postalCode, line1: normalizedShippingAddress.addressLine1, line2: normalizedShippingAddress.addressLine2 } }) as { pricesIncludeTax: boolean; lines: Array<{ lineId: string; taxMinor: number }>; totalTaxMinor: number }
      : { pricesIncludeTax: false, lines: taxLines.map((line) => ({ lineId: line.lineId, taxMinor: 0 })), totalTaxMinor: 0 };
    const subtotalAmount = totalAmount;
    const shippingAmount = Number(minorToDecimal(shippingMinor, currency));
    const taxAmount = Number(minorToDecimal(tax.totalTaxMinor, currency));
    totalAmount = subtotalAmount + shippingAmount + (tax.pricesIncludeTax ? 0 : taxAmount);
    if (decimalToMinor(data.expectedTotal, currency) !==
      decimalToMinor(subtotalAmount, currency) + shippingMinor + (tax.pricesIncludeTax ? 0 : tax.totalTaxMinor)) {
      const error = new Error('QUOTE_CHANGED') as Error & { statusCode?: number; code?: string };
      error.statusCode = 409; error.code = 'QUOTE_CHANGED'; throw error;
    }
    const unpaidExpiresAt = new Date(Date.now() + description.unpaidTimeoutMinutes * 60_000);

    // Create order + deduct stock atomically
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          user: { connect: { id: userId } },
          customerEmail: data.customerEmail?.trim() || user.email,
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          subtotalAmount,
          shippingAmount,
          shippingMethod: { providerSlug: selectedShipping.providerSlug, optionId: data.shippingOptionId.split(':').slice(1).join(':'), label: selectedShipping.label, amountMinor: shippingMinor },
          taxAmount,
          taxInclusive: tax.pricesIncludeTax,
          totalAmount,
          paymentMethod: data.paymentMethod,
          unpaidExpiresAt,
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
            create: orderItems.map((item, index) => ({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              taxAmount: Number(minorToDecimal(tax.lines.find((line) => line.lineId === String(index))?.taxMinor ?? 0, currency)),
            }))
          },
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

      for (const item of orderItems) {
        await InventoryService.decrementStock(tx, item.variantId, item.quantity);
      }
      const cart = await tx.cart.findUnique({ where: { userId }, include: { items: true } });
      if (cart) {
        for (const line of cart.items) {
          const purchased = orderItems
            .filter((item) => item.productId === line.productId && item.variantId === line.variantId)
            .reduce((total, item) => total + item.quantity, 0);
          if (!purchased) continue;
          if (line.quantity <= purchased) {
            await tx.cartItem.delete({ where: { id: line.id } });
          } else {
            await tx.cartItem.update({ where: { id: line.id }, data: { quantity: { decrement: purchased } } });
          }
        }
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

        await emitEvent(tx, 'order.created', 1, created.id, {
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
    const payment = await prisma.payment.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      select: { sessionId: true, actionJson: true },
    });
    const response = this.formatOrderResponse(order, currency);
    const action = payment?.actionJson;
    response.paymentInstructions = order.paymentStatus === PaymentStatus.PENDING &&
      order.status !== OrderStatus.CANCELLED && action && typeof action === 'object' &&
      !Array.isArray(action) && action.type === 'instructions' && typeof action.text === 'string'
      ? action.text : null;
    response.paymentSessionId = payment?.sessionId ?? null;
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

    const order = await prisma.order.findFirst({
      where,
      include: { items: true }
    });

    if (!order) {
      throw new Error('Order not found');
    }

    assertOrderTransition(order.status, OrderStatus.CANCELLED, order.paymentStatus);

    const updatedOrder = await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await InventoryService.incrementStock(tx, item.variantId, item.quantity);
      }
      await tx.payment.updateMany({
        where: { orderId, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });

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
      await createOrderNotification(tx, 'cancelled', orderId, { reason: cancelReason });

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
    return this.formatOrderResponse(updatedOrder, currency);
  }

  static async cancelExpiredUnpaidOrders(limit = 100): Promise<number> {
    return prisma.$transaction(async (tx) => {
      const lock = await tx.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_xact_lock(918201) AS locked`;
      if (!lock[0]?.locked) return 0;
      const expiredOrders = await tx.order.findMany({
        where: {
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          unpaidExpiresAt: { lt: new Date() },
        },
        orderBy: { unpaidExpiresAt: 'asc' },
        take: limit,
        include: { items: true },
      });
      let cancelled = 0;
      for (const order of expiredOrders) {
        assertOrderTransition(order.status, OrderStatus.CANCELLED, order.paymentStatus);
        const result = await tx.order.updateMany({
          where: { id: order.id, status: OrderStatus.PENDING, paymentStatus: PaymentStatus.PENDING, unpaidExpiresAt: { lt: new Date() } },
          data: { status: OrderStatus.CANCELLED, cancelReason: 'unpaid timeout', cancelledAt: new Date() },
        });
        if (result.count === 0) continue;
        for (const item of order.items) await InventoryService.incrementStock(tx, item.variantId, item.quantity);
        await tx.payment.updateMany({ where: { orderId: order.id, status: 'PENDING' }, data: { status: 'CANCELLED' } });
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
          orderId: order.id,
          userId: order.userId,
          reason: 'unpaid timeout',
        });
        await createOrderNotification(tx, 'cancelled', order.id, { reason: 'Cancelled for non-payment' });
        cancelled += 1;
      }
      return cancelled;
    }, { timeout: 60_000 });
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
        productName: item.product?.name || 'Unknown',
        variantId: item.variantId,
        variantName: item.variant?.name,
        variantAttributes: parseJsonRecord(item.variant?.attributes),
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        taxAmount: Number(item.taxAmount || 0),
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
