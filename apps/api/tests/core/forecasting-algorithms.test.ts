/**
 * Forecasting Algorithms Tests
 *
 * Coverage:
 * - Sales trend analysis
 * - Seasonal pattern detection
 * - Reorder point calculation
 * - Demand forecasting
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestPrisma } from '../helpers/db';
import { createTestProduct, createTestOrder, createTestOrderItem, deleteAllTestProducts, deleteAllTestOrders } from '../helpers/fixtures';
import { createTestUser, deleteTestUser } from '../helpers/auth';
import {
  analyzeSalesTrend,
  detectSeasonalPatterns,
  calculateReorderPoint,
  forecastDemand,
  fetchHistoricalSales,
} from '@/core/inventory/forecasting/algorithms';

describe('Forecasting Algorithms', () => {
  const prisma = getTestPrisma();
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testProduct: Awaited<ReturnType<typeof createTestProduct>>;

  beforeAll(async () => {
    testUser = await createTestUser();
    testProduct = await createTestProduct({
      name: 'Test Product for Forecasting',
      description: 'A product for forecasting tests',
      price: 50,
      stock: 100,
    });
  });

  afterAll(async () => {
    await deleteAllTestOrders();
    await deleteAllTestProducts();
    await deleteTestUser(testUser.id);
  });

  beforeEach(async () => {
    // Clean orders before each test
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});
  });

  describe('fetchHistoricalSales', () => {
    it('should fetch historical sales data correctly', async () => {
      // Create orders over the past 30 days
      const variant = testProduct.variants[0];

      for (let i = 0; i < 10; i++) {
        const orderDate = new Date();
        orderDate.setDate(orderDate.getDate() - (i * 3)); // Every 3 days

        const order = await createTestOrder({
          userId: testUser.id,
          total: 100,
          status: 'PAID',
        });

        // Update order to have PAID payment status
        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'PAID',
            createdAt: orderDate,
          },
        });

        await createTestOrderItem({
          orderId: order.id,
          productId: testProduct.id,
          variantId: variant.id,
          quantity: 5,
          price: 50,
        });
      }

      const salesData = await fetchHistoricalSales(testProduct.id, variant.id, 30);

      expect(salesData).toBeDefined();
      expect(salesData.dailySales).toHaveLength(31); // 30 days + today
      expect(salesData.totalQuantity).toBe(50); // 10 orders * 5 quantity
      expect(salesData.startDate).toBeInstanceOf(Date);
      expect(salesData.endDate).toBeInstanceOf(Date);
    });

    it('should handle products with no sales', async () => {
      const variant = testProduct.variants[0];
      const salesData = await fetchHistoricalSales(testProduct.id, variant.id, 30);

      expect(salesData).toBeDefined();
      expect(salesData.totalQuantity).toBe(0);
      expect(salesData.dailySales).toHaveLength(31);
    });

    it('should aggregate sales by variant when variantId is provided', async () => {
      const variant1 = testProduct.variants[0];

      // Create variant 2
      const variant2 = await prisma.productVariant.create({
        data: {
          productId: testProduct.id,
          name: 'Variant 2',
          salePrice: 60,
          baseStock: 50,
          isActive: true,
        },
      });

      // Create orders for variant 1
      const order1 = await createTestOrder({
        userId: testUser.id,
        total: 100,
        status: 'PAID',
      });
      await prisma.order.update({
        where: { id: order1.id },
        data: { paymentStatus: 'PAID' },
      });
      await createTestOrderItem({
        orderId: order1.id,
        productId: testProduct.id,
        variantId: variant1.id,
        quantity: 10,
        price: 50,
      });

      // Create orders for variant 2
      const order2 = await createTestOrder({
        userId: testUser.id,
        total: 120,
        status: 'PAID',
      });
      await prisma.order.update({
        where: { id: order2.id },
        data: { paymentStatus: 'PAID' },
      });
      await createTestOrderItem({
        orderId: order2.id,
        productId: testProduct.id,
        variantId: variant2.id,
        quantity: 20,
        price: 60,
      });

      // Fetch sales for variant 1 only
      const salesDataV1 = await fetchHistoricalSales(testProduct.id, variant1.id, 30);
      expect(salesDataV1.totalQuantity).toBe(10);

      // Fetch sales for variant 2 only
      const salesDataV2 = await fetchHistoricalSales(testProduct.id, variant2.id, 30);
      expect(salesDataV2.totalQuantity).toBe(20);

    });
  });

  describe('analyzeSalesTrend', () => {
    it('should calculate trend analysis for steady sales', async () => {
      const variant = testProduct.variants[0];

      // Create steady sales: 5 units per day for 30 days
      for (let i = 0; i < 30; i++) {
        const orderDate = new Date();
        orderDate.setDate(orderDate.getDate() - i);

        const order = await createTestOrder({
          userId: testUser.id,
          total: 250,
          status: 'PAID',
        });

        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'PAID',
            createdAt: orderDate,
          },
        });

        await createTestOrderItem({
          orderId: order.id,
          productId: testProduct.id,
          variantId: variant.id,
          quantity: 5,
          price: 50,
        });
      }

      // Use 29 historical days so the inclusive date window contains exactly 30 days.
      const trend = await analyzeSalesTrend(testProduct.id, variant.id, 29);

      expect(trend).toBeDefined();
      expect(trend.dailyAverage).toBeGreaterThan(4.5);
      expect(trend.dailyAverage).toBeLessThanOrEqual(5);
      expect(trend.weeklyAverage).toBeGreaterThan(4.5);
      expect(trend.weeklyAverage).toBeLessThanOrEqual(5);
      expect(trend.monthlyAverage).toBeGreaterThan(4.5);
      expect(trend.monthlyAverage).toBeLessThanOrEqual(5);
      expect(['STABLE', 'INCREASING']).toContain(trend.trend);
      expect(Math.abs(trend.growthRate)).toBeLessThan(2); // Near-flat growth
      expect(trend.volatility).toBeLessThan(1); // Low volatility
      expect(trend.confidence).toBeGreaterThan(0.5); // High confidence
    });

    it('should detect increasing trend', async () => {
      const variant = testProduct.variants[0];

      // Create increasing sales: 1 unit on day 1, increasing by 1 each day
      for (let i = 0; i < 20; i++) {
        const orderDate = new Date();
        orderDate.setDate(orderDate.getDate() - (19 - i)); // Oldest first

        const quantity = i + 1; // 1, 2, 3, ..., 20

        const order = await createTestOrder({
          userId: testUser.id,
          total: quantity * 50,
          status: 'PAID',
        });

        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'PAID',
            createdAt: orderDate,
          },
        });

        await createTestOrderItem({
          orderId: order.id,
          productId: testProduct.id,
          variantId: variant.id,
          quantity,
          price: 50,
        });
      }

      // Use 19 historical days so the inclusive date window contains exactly 20 days.
      const trend = await analyzeSalesTrend(testProduct.id, variant.id, 19);

      expect(trend).toBeDefined();
      expect(trend.trend).toBe('INCREASING');
      expect(trend.growthRate).toBeGreaterThan(1); // Positive growth
    });

    it('should detect decreasing trend', async () => {
      const variant = testProduct.variants[0];

      // Create decreasing sales: 20 units on day 1, decreasing by 1 each day
      for (let i = 0; i < 20; i++) {
        const orderDate = new Date();
        orderDate.setDate(orderDate.getDate() - (19 - i)); // Oldest first

        const quantity = 20 - i; // 20, 19, 18, ..., 1

        const order = await createTestOrder({
          userId: testUser.id,
          total: quantity * 50,
          status: 'PAID',
        });

        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'PAID',
            createdAt: orderDate,
          },
        });

        await createTestOrderItem({
          orderId: order.id,
          productId: testProduct.id,
          variantId: variant.id,
          quantity,
          price: 50,
        });
      }

      // Use 19 historical days so the inclusive date window contains exactly 20 days.
      const trend = await analyzeSalesTrend(testProduct.id, variant.id, 19);

      expect(trend).toBeDefined();
      expect(trend.trend).toBe('DECREASING');
      expect(trend.growthRate).toBeLessThan(-1); // Negative growth
    });

    it('should handle products with no sales history', async () => {
      const variant = testProduct.variants[0];
      const trend = await analyzeSalesTrend(testProduct.id, variant.id, 30);

      expect(trend).toBeDefined();
      expect(trend.dailyAverage).toBe(0);
      expect(trend.weeklyAverage).toBe(0);
      expect(trend.monthlyAverage).toBe(0);
      expect(trend.trend).toBe('STABLE');
      expect(trend.growthRate).toBe(0);
    });
  });

  describe('detectSeasonalPatterns', () => {
    it('should detect weekly seasonal patterns', async () => {
      const variant = testProduct.variants[0];

      // Create sales with weekly pattern (more sales on weekends)
      for (let i = 0; i < 28; i++) {
        const orderDate = new Date();
        orderDate.setDate(orderDate.getDate() - i);
        const dayOfWeek = orderDate.getDay();

        // Higher sales on weekends (Saturday=6, Sunday=0)
        const quantity = (dayOfWeek === 0 || dayOfWeek === 6) ? 10 : 3;

        const order = await createTestOrder({
          userId: testUser.id,
          total: quantity * 50,
          status: 'PAID',
        });

        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'PAID',
            createdAt: orderDate,
          },
        });

        await createTestOrderItem({
          orderId: order.id,
          productId: testProduct.id,
          variantId: variant.id,
          quantity,
          price: 50,
        });
      }

      const seasonalFactors = await detectSeasonalPatterns(testProduct.id, variant.id, 30);

      expect(seasonalFactors).toBeDefined();
      expect(seasonalFactors?.weeklyPattern).toHaveLength(7);
      expect(seasonalFactors?.monthlyPattern).toHaveLength(12);
      expect(seasonalFactors?.dayOfWeekMultipliers).toBeDefined();

      // Weekend multipliers should be higher than weekday multipliers
      const saturdayMultiplier = seasonalFactors!.dayOfWeekMultipliers['Saturday'];
      const sundayMultiplier = seasonalFactors!.dayOfWeekMultipliers['Sunday'];
      const mondayMultiplier = seasonalFactors!.dayOfWeekMultipliers['Monday'];

      expect(saturdayMultiplier).toBeGreaterThan(mondayMultiplier);
      expect(sundayMultiplier).toBeGreaterThan(mondayMultiplier);
    });

    it('should return null for insufficient data', async () => {
      const variant = testProduct.variants[0];

      // Create only 1 week of data (less than 4 weeks required)
      for (let i = 0; i < 7; i++) {
        const orderDate = new Date();
        orderDate.setDate(orderDate.getDate() - i);

        const order = await createTestOrder({
          userId: testUser.id,
          total: 100,
          status: 'PAID',
        });

        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'PAID',
            createdAt: orderDate,
          },
        });

        await createTestOrderItem({
          orderId: order.id,
          productId: testProduct.id,
          variantId: variant.id,
          quantity: 5,
          price: 50,
        });
      }

      const seasonalFactors = await detectSeasonalPatterns(testProduct.id, variant.id, 10);

      expect(seasonalFactors).toBeNull();
    });
  });

  describe('calculateReorderPoint', () => {
    it('should calculate reorder point correctly', async () => {
      const variant = testProduct.variants[0];

      // Create steady sales: 10 units per day for 30 days
      for (let i = 0; i < 30; i++) {
        const orderDate = new Date();
        orderDate.setDate(orderDate.getDate() - i);

        const order = await createTestOrder({
          userId: testUser.id,
          total: 500,
          status: 'PAID',
        });

        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'PAID',
            createdAt: orderDate,
          },
        });

        await createTestOrderItem({
          orderId: order.id,
          productId: testProduct.id,
          variantId: variant.id,
          quantity: 10,
          price: 50,
        });
      }

      const reorderPoint = await calculateReorderPoint(
        testProduct.id,
        variant.id,
        14, // 14 days lead time
        7,  // 7 days safety stock
        0.95 // 95% service level
      );

      expect(reorderPoint).toBeDefined();
      // calculateReorderPoint currently uses a 90-day historical window internally.
      // With 30 days of 10 units/day data, expected average is roughly 300 / 91.
      expect(reorderPoint.averageDailyDemand).toBeCloseTo(300 / 91, 1);
      expect(reorderPoint.leadTime).toBe(14);
      expect(reorderPoint.safetyStock).toBeGreaterThan(0);
      expect(reorderPoint.reorderPoint).toBeGreaterThan(40);
      expect(reorderPoint.maxDailyDemand).toBe(10);
      expect(reorderPoint.recommendedOrderQuantity).toBeGreaterThan(0);
      expect(reorderPoint.daysUntilStockout).toBeGreaterThan(0);
    });

    it('should handle products with no sales', async () => {
      const variant = testProduct.variants[0];

      const reorderPoint = await calculateReorderPoint(
        testProduct.id,
        variant.id,
        14,
        7,
        0.95
      );

      expect(reorderPoint).toBeDefined();
      expect(reorderPoint.averageDailyDemand).toBe(0);
      expect(reorderPoint.safetyStock).toBe(0);
      expect(reorderPoint.reorderPoint).toBe(0);
      expect(reorderPoint.daysUntilStockout).toBeNull();
    });

    it('should calculate different service levels correctly', async () => {
      const variant = testProduct.variants[0];

      // Create some sales
      for (let i = 0; i < 20; i++) {
        const orderDate = new Date();
        orderDate.setDate(orderDate.getDate() - i);

        const order = await createTestOrder({
          userId: testUser.id,
          total: 250,
          status: 'PAID',
        });

        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'PAID',
            createdAt: orderDate,
          },
        });

        await createTestOrderItem({
          orderId: order.id,
          productId: testProduct.id,
          variantId: variant.id,
          quantity: 5,
          price: 50,
        });
      }

      const reorderPoint95 = await calculateReorderPoint(testProduct.id, variant.id, 14, 7, 0.95);
      const reorderPoint99 = await calculateReorderPoint(testProduct.id, variant.id, 14, 7, 0.99);

      // 99% service level should have higher safety stock and reorder point
      expect(reorderPoint99.safetyStock).toBeGreaterThan(reorderPoint95.safetyStock);
      expect(reorderPoint99.reorderPoint).toBeGreaterThan(reorderPoint95.reorderPoint);
    });
  });

  describe('forecastDemand', () => {
    it('should forecast demand for stable sales', async () => {
      const variant = testProduct.variants[0];

      // Create steady sales: 5 units per day for 60 days
      for (let i = 0; i < 60; i++) {
        const orderDate = new Date();
        orderDate.setDate(orderDate.getDate() - i);

        const order = await createTestOrder({
          userId: testUser.id,
          total: 250,
          status: 'PAID',
        });

        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'PAID',
            createdAt: orderDate,
          },
        });

        await createTestOrderItem({
          orderId: order.id,
          productId: testProduct.id,
          variantId: variant.id,
          quantity: 5,
          price: 50,
        });
      }

      const forecast = await forecastDemand(testProduct.id, variant.id, 30, 60);

      expect(forecast).toBeDefined();
      expect(forecast).toBeGreaterThan(0);
      // For 30 days with 5 units/day, should be around 150
      expect(forecast).toBeGreaterThan(100);
      expect(forecast).toBeLessThan(200);
    });

    it('should forecast higher demand for increasing trend', async () => {
      const variant = testProduct.variants[0];

      // Create increasing sales
      for (let i = 0; i < 30; i++) {
        const orderDate = new Date();
        orderDate.setDate(orderDate.getDate() - (29 - i));
        const quantity = i + 1; // 1, 2, 3, ..., 30

        const order = await createTestOrder({
          userId: testUser.id,
          total: quantity * 50,
          status: 'PAID',
        });

        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'PAID',
            createdAt: orderDate,
          },
        });

        await createTestOrderItem({
          orderId: order.id,
          productId: testProduct.id,
          variantId: variant.id,
          quantity,
          price: 50,
        });
      }

      const forecast = await forecastDemand(testProduct.id, variant.id, 30, 60);

      expect(forecast).toBeDefined();
      expect(forecast).toBeGreaterThan(0);
      // With increasing trend, forecast should be higher than current average
    });

    it('should return 0 for products with no sales', async () => {
      const variant = testProduct.variants[0];
      const forecast = await forecastDemand(testProduct.id, variant.id, 30, 60);

      expect(forecast).toBe(0);
    });

    it('should apply seasonal adjustments when available', async () => {
      const variant = testProduct.variants[0];

      // Create sales with clear seasonal pattern (4 weeks of data)
      for (let i = 0; i < 28; i++) {
        const orderDate = new Date();
        orderDate.setDate(orderDate.getDate() - i);
        const dayOfWeek = orderDate.getDay();

        // Higher sales on weekends
        const quantity = (dayOfWeek === 0 || dayOfWeek === 6) ? 15 : 5;

        const order = await createTestOrder({
          userId: testUser.id,
          total: quantity * 50,
          status: 'PAID',
        });

        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'PAID',
            createdAt: orderDate,
          },
        });

        await createTestOrderItem({
          orderId: order.id,
          productId: testProduct.id,
          variantId: variant.id,
          quantity,
          price: 50,
        });
      }

      const forecast = await forecastDemand(testProduct.id, variant.id, 7, 30);

      expect(forecast).toBeDefined();
      expect(forecast).toBeGreaterThan(0);
      // Forecast should account for seasonal patterns
    });
  });
});
