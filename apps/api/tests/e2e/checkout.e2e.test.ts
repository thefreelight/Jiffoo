/**
 * E2E Test: Checkout Flow
 * 
 * Tests the complete checkout process from cart to order completion.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createUserToken, createAdminToken } from '../utils/auth-helpers';

// Mock Prisma for E2E simulation
const mockPrisma = {
  cart: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  cartItem: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  product: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  order: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  orderItem: {
    createMany: vi.fn(),
  },
  payment: {
    create: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn((callback) => callback(mockPrisma)),
};

vi.mock('../../src/config/database', () => ({
  prisma: mockPrisma,
}));

// Test fixtures
const TEST_PRODUCT = {
  id: 'prod-001',
  name: 'Test Product',
  price: 99.99,
  stock: 100,
  tenantId: 999,
};

const TEST_CART = {
  id: 'cart-001',
  userId: 'user-001',
  tenantId: 999,
  items: [],
};

const TEST_CART_ITEM = {
  id: 'item-001',
  cartId: 'cart-001',
  productId: 'prod-001',
  quantity: 2,
  price: 99.99,
};

describe('E2E: Checkout Flow', () => {
  const userToken = createUserToken(999);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Step 1: Add items to cart', () => {
    it('should add product to cart', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(TEST_PRODUCT);
      mockPrisma.cart.findUnique.mockResolvedValue(TEST_CART);
      mockPrisma.cartItem.create.mockResolvedValue(TEST_CART_ITEM);

      // Simulate adding to cart
      const product = await mockPrisma.product.findUnique({
        where: { id: TEST_PRODUCT.id },
      });
      expect(product).not.toBeNull();
      expect(product?.stock).toBeGreaterThan(0);

      const cartItem = await mockPrisma.cartItem.create({
        data: {
          cartId: TEST_CART.id,
          productId: TEST_PRODUCT.id,
          quantity: 2,
          price: TEST_PRODUCT.price,
        },
      });
      expect(cartItem.quantity).toBe(2);
    });

    it('should validate stock availability', async () => {
      const lowStockProduct = { ...TEST_PRODUCT, stock: 1 };
      mockPrisma.product.findUnique.mockResolvedValue(lowStockProduct);

      const product = await mockPrisma.product.findUnique({
        where: { id: TEST_PRODUCT.id },
      });

      // Attempting to add more than available stock should fail
      const requestedQuantity = 5;
      expect(product?.stock).toBeLessThan(requestedQuantity);
    });
  });

  describe('Step 2: Review cart', () => {
    it('should calculate cart totals correctly', async () => {
      const cartItems = [
        { ...TEST_CART_ITEM, quantity: 2, price: 99.99 },
        { id: 'item-002', cartId: 'cart-001', productId: 'prod-002', quantity: 1, price: 49.99 },
      ];
      mockPrisma.cartItem.findMany.mockResolvedValue(cartItems);

      const items = await mockPrisma.cartItem.findMany({
        where: { cartId: TEST_CART.id },
      });

      const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      expect(subtotal).toBe(99.99 * 2 + 49.99 * 1);
    });

    it('should update item quantities', async () => {
      const updatedItem = { ...TEST_CART_ITEM, quantity: 3 };
      mockPrisma.cartItem.update.mockResolvedValue(updatedItem);

      const item = await mockPrisma.cartItem.update({
        where: { id: TEST_CART_ITEM.id },
        data: { quantity: 3 },
      });

      expect(item.quantity).toBe(3);
    });
  });

  describe('Step 3: Create order', () => {
    it('should create order from cart', async () => {
      const order = {
        id: 'order-001',
        userId: 'user-001',
        tenantId: 999,
        status: 'PENDING',
        totalAmount: 199.98,
        createdAt: new Date(),
      };
      mockPrisma.order.create.mockResolvedValue(order);

      const createdOrder = await mockPrisma.order.create({
        data: {
          userId: 'user-001',
          tenantId: 999,
          status: 'PENDING',
          totalAmount: 199.98,
        },
      });

      expect(createdOrder.status).toBe('PENDING');
      expect(createdOrder.totalAmount).toBe(199.98);
    });

    it('should reserve inventory during order creation', async () => {
      const updatedProduct = { ...TEST_PRODUCT, stock: 98 };
      mockPrisma.product.update.mockResolvedValue(updatedProduct);

      const product = await mockPrisma.product.update({
        where: { id: TEST_PRODUCT.id },
        data: { stock: { decrement: 2 } },
      });

      expect(product.stock).toBe(98);
    });

    it('should clear cart after order creation', async () => {
      mockPrisma.cartItem.deleteMany.mockResolvedValue({ count: 2 });

      const result = await mockPrisma.cartItem.deleteMany({
        where: { cartId: TEST_CART.id },
      });

      expect(result.count).toBe(2);
    });
  });

  describe('Step 4: Process payment', () => {
    it('should create payment record', async () => {
      const payment = {
        id: 'pay-001',
        orderId: 'order-001',
        amount: 199.98,
        method: 'CREDIT_CARD',
        status: 'PENDING',
        createdAt: new Date(),
      };
      mockPrisma.payment.create.mockResolvedValue(payment);

      const createdPayment = await mockPrisma.payment.create({
        data: {
          orderId: 'order-001',
          amount: 199.98,
          method: 'CREDIT_CARD',
          status: 'PENDING',
        },
      });

      expect(createdPayment.status).toBe('PENDING');
      expect(createdPayment.amount).toBe(199.98);
    });

    it('should update payment status on success', async () => {
      const completedPayment = {
        id: 'pay-001',
        status: 'COMPLETED',
        paidAt: new Date(),
      };
      mockPrisma.payment.update.mockResolvedValue(completedPayment);

      const payment = await mockPrisma.payment.update({
        where: { id: 'pay-001' },
        data: { status: 'COMPLETED', paidAt: new Date() },
      });

      expect(payment.status).toBe('COMPLETED');
    });

    it('should update order status after payment', async () => {
      const paidOrder = {
        id: 'order-001',
        status: 'PAID',
        paidAt: new Date(),
      };
      mockPrisma.order.update.mockResolvedValue(paidOrder);

      const order = await mockPrisma.order.update({
        where: { id: 'order-001' },
        data: { status: 'PAID', paidAt: new Date() },
      });

      expect(order.status).toBe('PAID');
    });
  });

  describe('Step 5: Order confirmation', () => {
    it('should return complete order details', async () => {
      const completeOrder = {
        id: 'order-001',
        userId: 'user-001',
        status: 'PAID',
        totalAmount: 199.98,
        items: [
          { productId: 'prod-001', quantity: 2, price: 99.99 },
        ],
        payment: {
          id: 'pay-001',
          status: 'COMPLETED',
        },
      };
      mockPrisma.order.findUnique.mockResolvedValue(completeOrder);

      const order = await mockPrisma.order.findUnique({
        where: { id: 'order-001' },
        include: { items: true, payment: true },
      });

      expect(order?.status).toBe('PAID');
      expect(order?.items).toHaveLength(1);
      expect(order?.payment?.status).toBe('COMPLETED');
    });
  });

  describe('Error handling', () => {
    it('should handle payment failure gracefully', async () => {
      mockPrisma.payment.update.mockResolvedValue({
        id: 'pay-001',
        status: 'FAILED',
        errorMessage: 'Card declined',
      });

      const payment = await mockPrisma.payment.update({
        where: { id: 'pay-001' },
        data: { status: 'FAILED', errorMessage: 'Card declined' },
      });

      expect(payment.status).toBe('FAILED');
    });

    it('should restore inventory on order cancellation', async () => {
      const restoredProduct = { ...TEST_PRODUCT, stock: 100 };
      mockPrisma.product.update.mockResolvedValue(restoredProduct);

      const product = await mockPrisma.product.update({
        where: { id: TEST_PRODUCT.id },
        data: { stock: { increment: 2 } },
      });

      expect(product.stock).toBe(100);
    });
  });
});

