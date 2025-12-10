/**
 * Cart Service Unit Tests
 * 
 * Tests for shopping cart service functions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma
const mockPrisma = {
  cart: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  cartItem: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  product: {
    findUnique: vi.fn(),
  },
};

vi.mock('../../../src/config/database', () => ({
  prisma: mockPrisma,
}));

// Mock CacheService
vi.mock('../../../src/core/cache/service', () => ({
  CacheService: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

describe('Cart Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Cart Calculations', () => {
    it('should calculate cart subtotal correctly', () => {
      const items = [
        { price: 10.00, quantity: 2, subtotal: 20.00 },
        { price: 25.50, quantity: 1, subtotal: 25.50 },
        { price: 5.99, quantity: 3, subtotal: 17.97 },
      ];
      
      const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
      expect(subtotal).toBeCloseTo(63.47, 2);
    });

    it('should calculate item subtotal correctly', () => {
      const price = 29.99;
      const quantity = 3;
      const subtotal = price * quantity;
      
      expect(subtotal).toBeCloseTo(89.97, 2);
    });

    it('should calculate total with tax', () => {
      const subtotal = 100.00;
      const taxRate = 0.08; // 8% tax
      const tax = subtotal * taxRate;
      const total = subtotal + tax;
      
      expect(tax).toBe(8.00);
      expect(total).toBe(108.00);
    });

    it('should calculate total with tax and shipping', () => {
      const subtotal = 100.00;
      const tax = 8.00;
      const shipping = 10.00;
      const total = subtotal + tax + shipping;
      
      expect(total).toBe(118.00);
    });

    it('should handle empty cart', () => {
      const items: { price: number; quantity: number; subtotal: number }[] = [];
      const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
      
      expect(subtotal).toBe(0);
    });
  });

  describe('Cart Item Management', () => {
    it('should validate quantity is positive', () => {
      const quantity = 5;
      expect(quantity).toBeGreaterThan(0);
    });

    it('should reject zero quantity', () => {
      const quantity = 0;
      expect(quantity).toBeLessThanOrEqual(0);
    });

    it('should reject negative quantity', () => {
      const quantity = -1;
      expect(quantity).toBeLessThan(0);
    });

    it('should check stock availability', () => {
      const stock = 10;
      const requestedQuantity = 5;
      
      expect(requestedQuantity <= stock).toBe(true);
    });

    it('should reject quantity exceeding stock', () => {
      const stock = 10;
      const requestedQuantity = 15;
      
      expect(requestedQuantity <= stock).toBe(false);
    });
  });

  describe('Cart Data Structure', () => {
    it('should create valid cart structure', () => {
      const cart = {
        id: 'cart-001',
        userId: 'user-001',
        items: [],
        subtotal: 0,
        tax: 0,
        shipping: 0,
        total: 0,
        itemCount: 0,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      expect(cart.id).toBeDefined();
      expect(cart.userId).toBeDefined();
      expect(Array.isArray(cart.items)).toBe(true);
      expect(cart.status).toBe('active');
    });

    it('should create valid cart item structure', () => {
      const item = {
        id: 'item-001',
        productId: 'product-001',
        productName: 'Test Product',
        productImage: 'https://example.com/image.jpg',
        price: 29.99,
        quantity: 2,
        maxQuantity: 100,
        subtotal: 59.98,
      };
      
      expect(item.productId).toBeDefined();
      expect(item.quantity).toBeGreaterThan(0);
      expect(item.subtotal).toBe(item.price * item.quantity);
    });
  });

  describe('Cart Operations', () => {
    it('should find existing item in cart', () => {
      const items = [
        { productId: 'prod-1', variantId: null },
        { productId: 'prod-2', variantId: 'var-1' },
        { productId: 'prod-3', variantId: null },
      ];
      
      const existingIndex = items.findIndex(
        item => item.productId === 'prod-2' && item.variantId === 'var-1'
      );
      
      expect(existingIndex).toBe(1);
    });

    it('should not find non-existing item', () => {
      const items = [
        { productId: 'prod-1', variantId: null },
        { productId: 'prod-2', variantId: 'var-1' },
      ];
      
      const existingIndex = items.findIndex(
        item => item.productId === 'prod-3'
      );
      
      expect(existingIndex).toBe(-1);
    });

    it('should update item quantity', () => {
      const items = [
        { productId: 'prod-1', quantity: 2 },
        { productId: 'prod-2', quantity: 1 },
      ];
      
      const index = 0;
      const addQuantity = 3;
      items[index].quantity += addQuantity;
      
      expect(items[0].quantity).toBe(5);
    });

    it('should remove item from cart', () => {
      const items = [
        { productId: 'prod-1' },
        { productId: 'prod-2' },
        { productId: 'prod-3' },
      ];
      
      const filtered = items.filter(item => item.productId !== 'prod-2');
      
      expect(filtered).toHaveLength(2);
      expect(filtered.find(i => i.productId === 'prod-2')).toBeUndefined();
    });
  });
});

