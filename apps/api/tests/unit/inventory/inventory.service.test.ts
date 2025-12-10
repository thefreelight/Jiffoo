/**
 * Inventory Service Unit Tests
 *
 * Tests for inventory management: stock checking, reservations, confirmations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma client - define inside vi.mock factory to avoid hoisting issues
vi.mock('@/config/database', () => ({
  prisma: {
    product: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    productVariant: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    inventoryReservation: {
      aggregate: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

// Import after mocking
import { InventoryService } from '@/core/inventory/service';
import { prisma } from '@/config/database';

// Get typed mock reference
const mockPrisma = prisma as any;

describe('InventoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAvailableStock', () => {
    it('should return 0 if product not found', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);

      const stock = await InventoryService.getAvailableStock('prod-1', 1);

      expect(stock).toBe(0);
      expect(mockPrisma.product.findFirst).toHaveBeenCalledWith({
        where: { id: 'prod-1', tenantId: 1 },
      });
    });

    it('should return product stock minus reservations', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({ id: 'prod-1', stock: 100 });
      mockPrisma.inventoryReservation.aggregate.mockResolvedValue({
        _sum: { quantity: 20 },
      });

      const stock = await InventoryService.getAvailableStock('prod-1', 1);

      expect(stock).toBe(80);
    });

    it('should return full stock if no reservations', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({ id: 'prod-1', stock: 50 });
      mockPrisma.inventoryReservation.aggregate.mockResolvedValue({
        _sum: { quantity: null },
      });

      const stock = await InventoryService.getAvailableStock('prod-1', 1);

      expect(stock).toBe(50);
    });

    it('should return 0 if reservations exceed stock', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({ id: 'prod-1', stock: 10 });
      mockPrisma.inventoryReservation.aggregate.mockResolvedValue({
        _sum: { quantity: 15 },
      });

      const stock = await InventoryService.getAvailableStock('prod-1', 1);

      expect(stock).toBe(0); // Math.max(0, -5) = 0
    });
  });

  describe('getVariantAvailableStock', () => {
    it('should return 0 if variant not found', async () => {
      mockPrisma.productVariant.findFirst.mockResolvedValue(null);

      const stock = await InventoryService.getVariantAvailableStock('var-1', 1);

      expect(stock).toBe(0);
    });

    it('should return variant stock minus reservations', async () => {
      mockPrisma.productVariant.findFirst.mockResolvedValue({ id: 'var-1', baseStock: 50 });
      mockPrisma.inventoryReservation.aggregate.mockResolvedValue({
        _sum: { quantity: 10 },
      });

      const stock = await InventoryService.getVariantAvailableStock('var-1', 1);

      expect(stock).toBe(40);
    });
  });

  describe('checkStockAvailability', () => {
    it('should return available=true when all items have sufficient stock', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({ id: 'prod-1', stock: 100 });
      mockPrisma.inventoryReservation.aggregate.mockResolvedValue({
        _sum: { quantity: null },
      });

      const result = await InventoryService.checkStockAvailability(
        [{ productId: 'prod-1', quantity: 5 }],
        1
      );

      expect(result.available).toBe(true);
      expect(result.insufficientItems).toHaveLength(0);
    });

    it('should return available=false with insufficient items', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({ id: 'prod-1', stock: 3 });
      mockPrisma.inventoryReservation.aggregate.mockResolvedValue({
        _sum: { quantity: null },
      });

      const result = await InventoryService.checkStockAvailability(
        [{ productId: 'prod-1', quantity: 5 }],
        1
      );

      expect(result.available).toBe(false);
      expect(result.insufficientItems).toHaveLength(1);
      expect(result.insufficientItems[0]).toEqual({
        productId: 'prod-1',
        requested: 5,
        available: 3,
      });
    });

    it('should check multiple items correctly', async () => {
      mockPrisma.product.findFirst
        .mockResolvedValueOnce({ id: 'prod-1', stock: 100 })
        .mockResolvedValueOnce({ id: 'prod-2', stock: 2 });
      mockPrisma.inventoryReservation.aggregate.mockResolvedValue({
        _sum: { quantity: null },
      });

      const result = await InventoryService.checkStockAvailability(
        [
          { productId: 'prod-1', quantity: 5 },
          { productId: 'prod-2', quantity: 10 },
        ],
        1
      );

      expect(result.available).toBe(false);
      expect(result.insufficientItems).toHaveLength(1);
      expect(result.insufficientItems[0].productId).toBe('prod-2');
    });
  });

  describe('createReservations', () => {
    it('should create product-level reservations', async () => {
      mockPrisma.inventoryReservation.createMany.mockResolvedValue({ count: 2 });

      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      await InventoryService.createReservations(
        'order-1',
        [
          { productId: 'prod-1', quantity: 2 },
          { productId: 'prod-2', quantity: 3 },
        ],
        1,
        expiresAt
      );

      expect(mockPrisma.inventoryReservation.createMany).toHaveBeenCalledWith({
        data: [
          {
            orderId: 'order-1',
            productId: 'prod-1',
            variantId: null,
            quantity: 2,
            tenantId: 1,
            expiresAt,
            status: 'ACTIVE',
          },
          {
            orderId: 'order-1',
            productId: 'prod-2',
            variantId: null,
            quantity: 3,
            tenantId: 1,
            expiresAt,
            status: 'ACTIVE',
          },
        ],
      });
    });
  });

  describe('createVariantReservations', () => {
    it('should create variant-level reservations', async () => {
      mockPrisma.inventoryReservation.createMany.mockResolvedValue({ count: 1 });

      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      await InventoryService.createVariantReservations(
        'order-1',
        [{ productId: 'prod-1', variantId: 'var-1', quantity: 5 }],
        1,
        expiresAt
      );

      expect(mockPrisma.inventoryReservation.createMany).toHaveBeenCalledWith({
        data: [
          {
            orderId: 'order-1',
            productId: 'prod-1',
            variantId: 'var-1',
            quantity: 5,
            tenantId: 1,
            expiresAt,
            status: 'ACTIVE',
          },
        ],
      });
    });
  });

  describe('confirmReservations', () => {
    it('should confirm product-level reservations and decrement stock', async () => {
      mockPrisma.inventoryReservation.findMany.mockResolvedValue([
        { id: 'res-1', orderId: 'order-1', productId: 'prod-1', variantId: null, quantity: 5, tenantId: 1 },
      ]);
      mockPrisma.product.update.mockResolvedValue({});
      mockPrisma.inventoryReservation.update.mockResolvedValue({});

      await InventoryService.confirmReservations('order-1');

      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1', tenantId: 1 },
        data: { stock: { decrement: 5 } },
      });
      expect(mockPrisma.inventoryReservation.update).toHaveBeenCalledWith({
        where: { id: 'res-1' },
        data: { status: 'CONFIRMED' },
      });
    });

    it('should confirm variant-level reservations and decrement variant stock', async () => {
      mockPrisma.inventoryReservation.findMany.mockResolvedValue([
        { id: 'res-2', orderId: 'order-1', productId: 'prod-1', variantId: 'var-1', quantity: 3, tenantId: 1 },
      ]);
      mockPrisma.productVariant.update.mockResolvedValue({});
      mockPrisma.inventoryReservation.update.mockResolvedValue({});

      await InventoryService.confirmReservations('order-1');

      expect(mockPrisma.productVariant.update).toHaveBeenCalledWith({
        where: { id: 'var-1' },
        data: { baseStock: { decrement: 3 } },
      });
    });
  });

  describe('releaseReservations', () => {
    it('should release all active reservations for an order', async () => {
      mockPrisma.inventoryReservation.updateMany.mockResolvedValue({ count: 2 });

      await InventoryService.releaseReservations('order-1');

      expect(mockPrisma.inventoryReservation.updateMany).toHaveBeenCalledWith({
        where: { orderId: 'order-1', status: 'ACTIVE' },
        data: { status: 'RELEASED' },
      });
    });
  });

  describe('releaseExpiredReservations', () => {
    it('should release expired reservations and return count', async () => {
      mockPrisma.inventoryReservation.updateMany.mockResolvedValue({ count: 5 });

      const count = await InventoryService.releaseExpiredReservations();

      expect(count).toBe(5);
      expect(mockPrisma.inventoryReservation.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'ACTIVE',
          expiresAt: { lt: expect.any(Date) },
        },
        data: { status: 'RELEASED' },
      });
    });
  });
});

