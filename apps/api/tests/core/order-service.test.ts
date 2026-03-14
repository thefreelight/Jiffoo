/**
 * OrderService Unit Tests
 *
 * Coverage:
 * - createOrder: success path, empty items error, insufficient stock error
 * - cancelOrder: success (restores stock), order not found, non-pending order
 * - completeOrder: success (updates status, sends push, fires hooks), order not found, already completed
 * - refundOrder: success (creates refund, restores stock, fires hooks), order not found, already refunded
 * - getUserOrders: pagination with status filter
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks - declared before the service import so vi.mock hoisting works
// ---------------------------------------------------------------------------

vi.mock('@/config/database', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    product: { findMany: vi.fn() },
    order: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    store: { findFirst: vi.fn() },
    refund: { create: vi.fn(), findUnique: vi.fn() },
    refundLedger: { create: vi.fn() },
    paymentLedger: { create: vi.fn() },
    externalProductLink: { findFirst: vi.fn() },
    externalVariantLink: { findFirst: vi.fn() },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
  },
}));

vi.mock('@/core/admin/system-settings/service', () => ({
  systemSettingsService: {
    getShopCurrency: vi.fn().mockResolvedValue('USD'),
    getCheckoutCountriesRequireStatePostal: vi.fn().mockResolvedValue(['US', 'CA']),
  },
}));

vi.mock('@/core/order/hooks', () => ({
  getOrderHooks: vi.fn().mockReturnValue({
    onOrderCompleted: vi.fn().mockResolvedValue(undefined),
    onOrderRefunded: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/core/order/status-history', () => ({
  recordOrderStatusHistory: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/core/notification/push-notification.service', () => ({
  PushNotificationService: {
    sendOrderStatusUpdate: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/core/logger/unified-logger', () => ({
  LoggerService: {
    logError: vi.fn(),
    logSystem: vi.fn(),
  },
}));

vi.mock('@/infra/outbox', () => ({
  OutboxService: {
    emit: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/core/inventory/service', () => ({
  InventoryService: {
    getAvailableStockByVariantIds: vi.fn(),
    decrementStock: vi.fn().mockResolvedValue(undefined),
    incrementStock: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/core/warehouse/service', () => ({
  WarehouseService: {
    getDefaultWarehouse: vi.fn().mockResolvedValue({ id: 'wh-1' }),
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { OrderService } from '@/core/order/service';
import { prisma } from '@/config/database';
import { getOrderHooks } from '@/core/order/hooks';
import { PushNotificationService } from '@/core/notification/push-notification.service';
import { InventoryService } from '@/core/inventory/service';

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockPrisma = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> };
  product: { findMany: ReturnType<typeof vi.fn> };
  order: {
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  store: { findFirst: ReturnType<typeof vi.fn> };
  refund: { create: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };
  refundLedger: { create: ReturnType<typeof vi.fn> };
  paymentLedger: { create: ReturnType<typeof vi.fn> };
  externalProductLink: { findFirst: ReturnType<typeof vi.fn> };
  externalVariantLink: { findFirst: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

const mockGetOrderHooks = getOrderHooks as ReturnType<typeof vi.fn>;
const mockPushNotification = PushNotificationService as {
  sendOrderStatusUpdate: ReturnType<typeof vi.fn>;
};
const mockInventory = InventoryService as unknown as {
  getAvailableStockByVariantIds: ReturnType<typeof vi.fn>;
  decrementStock: ReturnType<typeof vi.fn>;
  incrementStock: ReturnType<typeof vi.fn>;
};

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2025-06-01T12:00:00Z');

const TEST_USER = { email: 'buyer@example.com' };

const TEST_STORE = { id: 'store-1', createdAt: new Date('2025-01-01') };

const TEST_PRODUCT = {
  id: 'prod-1',
  name: 'Widget',
  requiresShipping: false,
  isActive: true,
  variants: [
    { id: 'var-1', name: 'Default', salePrice: 25, isActive: true },
  ],
};

const makeCreatedOrder = (overrides: Record<string, unknown> = {}) => ({
  id: 'order-1',
  userId: 'user-1',
  status: 'PENDING',
  paymentStatus: 'PENDING',
  subtotalAmount: 50,
  totalAmount: 50,
  shippingAddress: null,
  cancelReason: null,
  cancelledAt: null,
  createdAt: NOW,
  updatedAt: NOW,
  items: [
    {
      id: 'item-1',
      productId: 'prod-1',
      variantId: 'var-1',
      quantity: 2,
      unitPrice: 25,
      product: { name: 'Widget' },
      variant: { name: 'Default' },
    },
  ],
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OrderService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Re-apply default mock returns that are needed across most tests
    mockPrisma.store.findFirst.mockResolvedValue(TEST_STORE);
    mockPrisma.externalProductLink.findFirst.mockResolvedValue(null);
    mockPrisma.externalVariantLink.findFirst.mockResolvedValue(null);
    mockPrisma.refund.findUnique.mockResolvedValue(null);
    mockPrisma.refundLedger.create.mockResolvedValue({});
    mockPrisma.paymentLedger.create.mockResolvedValue({});
    mockInventory.getAvailableStockByVariantIds.mockResolvedValue(new Map([['var-1', 10]]));
    (mockPrisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      (fn: (tx: unknown) => unknown) => fn(mockPrisma)
    );
  });

  // -----------------------------------------------------------------------
  // createOrder
  // -----------------------------------------------------------------------

  describe('createOrder', () => {
    const orderData = {
      items: [{ productId: 'prod-1', variantId: 'var-1', quantity: 2 }],
    };

    it('should validate products, calculate total, create order, emit event, and deduct stock', async () => {
      const createdOrder = makeCreatedOrder();

      mockPrisma.user.findUnique.mockResolvedValue(TEST_USER);
      mockPrisma.product.findMany.mockResolvedValue([TEST_PRODUCT]);
      mockPrisma.order.create.mockResolvedValue(createdOrder);
      mockInventory.getAvailableStockByVariantIds.mockResolvedValue(new Map([['var-1', 10]]));

      const result = await OrderService.createOrder('user-1', orderData);

      // Verified user exists
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { email: true },
      });

      // Batch-fetched products
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['prod-1'] } },
        include: { variants: true },
      });

      // Created order with correct total (25 * 2 = 50)
      expect(mockPrisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotalAmount: 50,
            totalAmount: 50,
            status: 'PENDING',
            paymentStatus: 'PENDING',
          }),
        })
      );

      // Deducted stock
      expect(mockInventory.decrementStock).toHaveBeenCalledWith(
        mockPrisma,
        'var-1',
        2
      );

      // Returns formatted response
      expect(result).toMatchObject({
        id: 'order-1',
        userId: 'user-1',
        totalAmount: 50,
        currency: 'USD',
        status: 'PENDING',
      });
    });

    it('should throw when order has no items', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(TEST_USER);

      await expect(
        OrderService.createOrder('user-1', { items: [] })
      ).rejects.toThrow('Order must contain at least one item');

      expect(mockPrisma.order.create).not.toHaveBeenCalled();
    });

    it('should throw when a variant has insufficient stock', async () => {
      const lowStockProduct = {
        ...TEST_PRODUCT,
        variants: [
          { id: 'var-1', name: 'Default', salePrice: 25, isActive: true },
        ],
      };

      mockPrisma.user.findUnique.mockResolvedValue(TEST_USER);
      mockPrisma.product.findMany.mockResolvedValue([lowStockProduct]);
      mockInventory.getAvailableStockByVariantIds.mockResolvedValue(new Map([['var-1', 1]]));

      await expect(
        OrderService.createOrder('user-1', {
          items: [{ productId: 'prod-1', variantId: 'var-1', quantity: 5 }],
        })
      ).rejects.toThrow('Insufficient stock for variant Default of product: Widget');

      expect(mockPrisma.order.create).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // cancelOrder
  // -----------------------------------------------------------------------

  describe('cancelOrder', () => {
    it('should restore stock, update status to CANCELLED, and send push notification', async () => {
      const pendingOrder = makeCreatedOrder({ status: 'PENDING' });
      const cancelledOrder = makeCreatedOrder({
        status: 'CANCELLED',
        cancelReason: 'Changed mind',
        cancelledAt: NOW,
      });

      mockPrisma.order.findFirst.mockResolvedValue(pendingOrder);
      mockPrisma.order.update.mockResolvedValue(cancelledOrder);

      const result = await OrderService.cancelOrder('order-1', 'user-1', 'Changed mind');

      // Restored stock (increment)
      expect(mockInventory.incrementStock).toHaveBeenCalledWith(
        mockPrisma,
        'var-1',
        2
      );

      // Updated order to CANCELLED
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-1' },
          data: expect.objectContaining({
            status: 'CANCELLED',
            cancelReason: 'Changed mind',
          }),
        })
      );

      // Push notification sent
      expect(mockPushNotification.sendOrderStatusUpdate).toHaveBeenCalledWith(
        'user-1',
        'order-1',
        'CANCELLED'
      );

      expect(result.status).toBe('CANCELLED');
    });

    it('should throw when order is not found', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);

      await expect(
        OrderService.cancelOrder('nonexistent', 'user-1', 'reason')
      ).rejects.toThrow('Order not found');
    });

    it('should throw when order status is not PENDING', async () => {
      const shippedOrder = makeCreatedOrder({ status: 'SHIPPED' });
      mockPrisma.order.findFirst.mockResolvedValue(shippedOrder);

      await expect(
        OrderService.cancelOrder('order-1', 'user-1', 'reason')
      ).rejects.toThrow('Only pending orders can be cancelled');

      expect(mockPrisma.order.update).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // completeOrder
  // -----------------------------------------------------------------------

  describe('completeOrder', () => {
    it('should update status to COMPLETED/PAID, send push notification, and fire hooks', async () => {
      const pendingOrder = makeCreatedOrder({ status: 'PENDING' });
      const completedOrder = makeCreatedOrder({
        status: 'COMPLETED',
        paymentStatus: 'PAID',
      });

      mockPrisma.order.findUnique.mockResolvedValue(pendingOrder);
      mockPrisma.order.update.mockResolvedValue(completedOrder);

      const mockHooks = {
        onOrderCompleted: vi.fn().mockResolvedValue(undefined),
        onOrderRefunded: vi.fn().mockResolvedValue(undefined),
      };
      mockGetOrderHooks.mockReturnValue(mockHooks);

      const result = await OrderService.completeOrder('order-1');

      // Updated to COMPLETED + PAID
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-1' },
          data: { status: 'COMPLETED', paymentStatus: 'PAID' },
        })
      );

      // Push notification for PAID
      expect(mockPushNotification.sendOrderStatusUpdate).toHaveBeenCalledWith(
        'user-1',
        'order-1',
        'PAID'
      );

      // Hooks fired
      expect(mockHooks.onOrderCompleted).toHaveBeenCalledWith('order-1');

      expect(result.status).toBe('COMPLETED');
      expect(result.paymentStatus).toBe('PAID');
    });

    it('should throw when order is not found', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(OrderService.completeOrder('nonexistent')).rejects.toThrow(
        'Order not found'
      );

      expect(mockPrisma.order.update).not.toHaveBeenCalled();
    });

    it('should throw when order is already completed', async () => {
      const completedOrder = makeCreatedOrder({ status: 'COMPLETED' });
      mockPrisma.order.findUnique.mockResolvedValue(completedOrder);

      await expect(OrderService.completeOrder('order-1')).rejects.toThrow(
        'Order is already completed'
      );

      expect(mockPrisma.order.update).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // refundOrder
  // -----------------------------------------------------------------------

  describe('refundOrder', () => {
    it('should create refund record, restore stock, update status, and fire hooks', async () => {
      const paidOrder = {
        ...makeCreatedOrder({ status: 'COMPLETED', paymentStatus: 'PAID', totalAmount: 50 }),
        payments: [
          { id: 'pay-1', status: 'SUCCEEDED', paymentMethod: 'stripe', createdAt: NOW },
        ],
      };
      const refundedOrder = makeCreatedOrder({
        status: 'REFUNDED',
        paymentStatus: 'REFUNDED',
      });

      mockPrisma.order.findUnique.mockResolvedValue(paidOrder);
      mockPrisma.refund.create.mockResolvedValue({});
      mockPrisma.order.update.mockResolvedValue(refundedOrder);

      const mockHooks = {
        onOrderCompleted: vi.fn().mockResolvedValue(undefined),
        onOrderRefunded: vi.fn().mockResolvedValue(undefined),
      };
      mockGetOrderHooks.mockReturnValue(mockHooks);

      const result = await OrderService.refundOrder('order-1');

      // Refund record created inside transaction
      expect(mockPrisma.refund.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: 'order-1',
          paymentId: 'pay-1',
          amount: 50,
          status: 'COMPLETED',
          reason: 'Full refund requested by admin',
          provider: 'STRIPE',
          idempotencyKey: 'ref_order-1_full',
        }),
      });

      // Order updated to REFUNDED
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-1' },
          data: { status: 'REFUNDED', paymentStatus: 'REFUNDED' },
        })
      );

      // Stock restored
      expect(mockInventory.incrementStock).toHaveBeenCalledWith(
        mockPrisma,
        'var-1',
        2
      );

      // Push notification sent
      expect(mockPushNotification.sendOrderStatusUpdate).toHaveBeenCalledWith(
        'user-1',
        'order-1',
        'REFUNDED'
      );

      // Refund hooks fired
      expect(mockHooks.onOrderRefunded).toHaveBeenCalledWith('order-1');

      expect(result.status).toBe('REFUNDED');
    });

    it('should throw when order is not found', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(OrderService.refundOrder('nonexistent')).rejects.toThrow(
        'Order not found'
      );
    });

    it('should throw when order is already refunded', async () => {
      const refundedOrder = {
        ...makeCreatedOrder({ paymentStatus: 'REFUNDED' }),
        payments: [],
      };
      mockPrisma.order.findUnique.mockResolvedValue(refundedOrder);

      await expect(OrderService.refundOrder('order-1')).rejects.toThrow(
        'Order is already refunded'
      );

      expect(mockPrisma.order.update).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // getUserOrders
  // -----------------------------------------------------------------------

  describe('getUserOrders', () => {
    it('should return paginated orders with status filter', async () => {
      const orders = [makeCreatedOrder()];

      mockPrisma.order.findMany.mockResolvedValue(orders);
      mockPrisma.order.count.mockResolvedValue(1);

      const result = await OrderService.getUserOrders('user-1', 1, 10, 'PENDING');

      // Applied correct where clause with status filter
      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', status: 'PENDING' },
          skip: 0,
          take: 10,
          orderBy: { createdAt: 'desc' },
        })
      );

      expect(mockPrisma.order.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: 'PENDING' },
      });

      expect(result).toMatchObject({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('order-1');
      expect(result.items[0].currency).toBe('USD');
    });
  });
});
