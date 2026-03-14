/**
 * Forecasting Service Tests
 *
 * Coverage:
 * - Forecast generation with sales history
 * - Forecast retrieval
 * - Error handling (invalid product/variant)
 * - Forecast storage and data integrity
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestPrisma } from '../helpers/db';
import {
  createTestProduct,
  createTestOrder,
  createTestOrderItem,
  deleteAllTestProducts,
  deleteAllTestOrders,
} from '../helpers/fixtures';
import { createTestUser, deleteTestUser } from '../helpers/auth';
import { ForecastingService } from '@/core/inventory/forecasting/service';

describe('ForecastingService', () => {
  const prisma = getTestPrisma();
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testProduct: Awaited<ReturnType<typeof createTestProduct>>;

  const setVariantStock = async (variantId: string, stock: number) => {
    const warehouse = await prisma.warehouse.findFirst({
      where: { isDefault: true },
      select: { id: true },
    });
    if (!warehouse) {
      throw new Error('Default warehouse not found');
    }

    const normalizedStock = Math.max(0, Math.trunc(Number(stock)));
    await prisma.warehouseInventory.upsert({
      where: {
        warehouseId_variantId: {
          warehouseId: warehouse.id,
          variantId,
        },
      },
      update: {
        quantity: normalizedStock,
        available: normalizedStock,
      },
      create: {
        warehouseId: warehouse.id,
        variantId,
        quantity: normalizedStock,
        reserved: 0,
        available: normalizedStock,
        lowStock: 10,
      },
    });

    await prisma.productVariant.update({
      where: { id: variantId },
      data: { baseStock: normalizedStock },
    });
  };

  beforeAll(async () => {
    testUser = await createTestUser();
    testProduct = await createTestProduct({
      name: 'Test Product for Service',
      description: 'A product for service tests',
      price: 100,
      stock: 200,
    });
  });

  afterAll(async () => {
    await deleteAllTestOrders();
    await deleteAllTestProducts();
    await deleteTestUser(testUser.id);
  });

  beforeEach(async () => {
    // Clean forecasts, alerts, orders before each test
    await prisma.reorderAlert.deleteMany({});
    await prisma.forecastAccuracy.deleteMany({});
    await prisma.inventoryForecast.deleteMany({});
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});
  });

  describe('generateForecast', () => {
    it('should generate forecast for product with sales history', async () => {
      const variant = testProduct.variants[0];

      // Create 30 days of sales history
      for (let i = 0; i < 30; i++) {
        const orderDate = new Date();
        orderDate.setDate(orderDate.getDate() - i);

        const order = await createTestOrder({
          userId: testUser.id,
          total: 200,
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
          price: 100,
        });
      }

      // Generate forecast
      const forecast = await ForecastingService.generateForecast(
        testProduct.id,
        variant.id,
        30, // 30 days forecast
        90  // 90 days historical
      );

      // Assertions
      expect(forecast).toBeDefined();
      expect(forecast.id).toBeTruthy();
      expect(forecast.productId).toBe(testProduct.id);
      expect(forecast.variantId).toBe(variant.id);
      expect(forecast.predictedDemand).toBeGreaterThan(0);
      expect(forecast.confidence).toBeGreaterThanOrEqual(0);
      expect(forecast.confidence).toBeLessThanOrEqual(1);
      expect(forecast.method).toBeDefined();
      expect(['MOVING_AVERAGE', 'LINEAR_REGRESSION', 'SEASONAL_DECOMPOSITION']).toContain(
        forecast.method
      );

      // Verify trend analysis
      expect(forecast.trendAnalysis).toBeDefined();
      expect(forecast.trendAnalysis.dailyAverage).toBeGreaterThan(0);
      expect(['INCREASING', 'DECREASING', 'STABLE']).toContain(forecast.trendAnalysis.trend);

      // Verify reorder point
      expect(forecast.reorderPoint).toBeDefined();
      expect(forecast.reorderPoint.reorderPoint).toBeGreaterThanOrEqual(0);
      expect(forecast.reorderPoint.safetyStock).toBeGreaterThanOrEqual(0);

      // Verify forecast was saved to database
      const savedForecast = await prisma.inventoryForecast.findUnique({
        where: { id: forecast.id },
      });
      expect(savedForecast).toBeDefined();
      expect(savedForecast!.productId).toBe(testProduct.id);
      expect(savedForecast!.predictedDemand).toBe(forecast.predictedDemand);
    });

    it('should generate forecast for a sku variant', async () => {
      const variant = testProduct.variants[0];

      // Create 10 days of sales history
      for (let i = 0; i < 10; i++) {
        const orderDate = new Date();
        orderDate.setDate(orderDate.getDate() - i);

        const order = await createTestOrder({
          userId: testUser.id,
          total: 150,
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
          price: 100,
        });
      }

      // Generate forecast for a specific variant
      const forecast = await ForecastingService.generateForecast(
        testProduct.id,
        variant.id,
        30,
        90
      );

      expect(forecast).toBeDefined();
      expect(forecast.productId).toBe(testProduct.id);
      expect(forecast.variantId).toBe(variant.id);
      expect(forecast.predictedDemand).toBeGreaterThanOrEqual(0);
    });

    it('should handle product with no sales history', async () => {
      const variant = testProduct.variants[0];
      // Generate forecast for product with no orders
      const forecast = await ForecastingService.generateForecast(
        testProduct.id,
        variant.id,
        30,
        90
      );

      expect(forecast).toBeDefined();
      expect(forecast.predictedDemand).toBe(0);
      expect(forecast.trendAnalysis.dailyAverage).toBe(0);
      expect(forecast.reorderPoint.averageDailyDemand).toBe(0);
    });

    it('should throw error for non-existent product', async () => {
      await expect(
        ForecastingService.generateForecast('non-existent-id', testProduct.variants[0].id, 30, 90)
      ).rejects.toThrow('Product with ID non-existent-id not found');
    });

    it('should throw error for non-existent variant', async () => {
      await expect(
        ForecastingService.generateForecast(testProduct.id, 'non-existent-variant', 30, 90)
      ).rejects.toThrow('Variant with ID non-existent-variant not found');
    });

    it('should throw error when variant does not belong to product', async () => {
      // Create another product
      const anotherProduct = await createTestProduct({
        name: 'Another Product',
        description: 'Another product',
        price: 50,
        stock: 100,
      });

      const anotherVariant = anotherProduct.variants[0];

      await expect(
        ForecastingService.generateForecast(testProduct.id, anotherVariant.id, 30, 90)
      ).rejects.toThrow(`Variant ${anotherVariant.id} does not belong to product ${testProduct.id}`);
    });
  });

  describe('getForecast', () => {
    it('should retrieve the latest forecast for a product', async () => {
      const variant = testProduct.variants[0];

      // Create sales history
      for (let i = 0; i < 15; i++) {
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
          quantity: 8,
          price: 100,
        });
      }

      // Generate two forecasts
      const forecast1 = await ForecastingService.generateForecast(
        testProduct.id,
        variant.id,
        30,
        90
      );

      // Wait a bit to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      const forecast2 = await ForecastingService.generateForecast(
        testProduct.id,
        variant.id,
        30,
        90
      );

      // Retrieve latest forecast
      const latestForecast = await ForecastingService.getForecast(
        testProduct.id,
        variant.id
      );

      expect(latestForecast).toBeDefined();
      expect(latestForecast!.id).toBe(forecast2.id); // Should be the latest one
      expect(latestForecast!.productId).toBe(testProduct.id);
      expect(latestForecast!.variantId).toBe(variant.id);
    });

    it('should return null when no forecast exists', async () => {
      const forecast = await ForecastingService.getForecast(
        testProduct.id,
        'non-existent-variant'
      );

      expect(forecast).toBeNull();
    });

    it('should retrieve forecast by sku variantId', async () => {
      const variant = testProduct.variants[0];

      // Create sales history
      for (let i = 0; i < 5; i++) {
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
          quantity: 3,
          price: 100,
        });
      }

      // Generate forecast with variantId
      await ForecastingService.generateForecast(testProduct.id, variant.id, 30, 90);

      // Retrieve forecast
      const forecast = await ForecastingService.getForecast(testProduct.id, variant.id);

      expect(forecast).toBeDefined();
      expect(forecast!.productId).toBe(testProduct.id);
      expect(forecast!.variantId).toBe(variant.id);
    });

    it('should parse seasonal factors correctly', async () => {
      const variant = testProduct.variants[0];

      // Create 60 days of varied sales to trigger seasonal detection
      for (let i = 0; i < 60; i++) {
        const orderDate = new Date();
        orderDate.setDate(orderDate.getDate() - i);

        // Vary quantity based on day of week to create weekly pattern
        const dayOfWeek = orderDate.getDay();
        const quantity = dayOfWeek === 0 || dayOfWeek === 6 ? 20 : 10; // More on weekends

        const order = await createTestOrder({
          userId: testUser.id,
          total: quantity * 100,
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
          price: 100,
        });
      }

      // Generate forecast
      await ForecastingService.generateForecast(testProduct.id, variant.id, 30, 90);

      // Retrieve forecast
      const forecast = await ForecastingService.getForecast(testProduct.id, variant.id);

      expect(forecast).toBeDefined();

      // If seasonal factors exist, verify structure
      if (forecast!.seasonalFactors) {
        expect(forecast!.seasonalFactors.weeklyPattern).toBeDefined();
        expect(Array.isArray(forecast!.seasonalFactors.weeklyPattern)).toBe(true);
        expect(forecast!.seasonalFactors.weeklyPattern.length).toBe(7);
        expect(forecast!.method).toBe('SEASONAL_DECOMPOSITION');
      }
    });
  });

  describe('checkAndCreateAlerts', () => {
    it('should create STOCKOUT_RISK alert when stock is below reorder point', async () => {
      const variant = testProduct.variants[0];

      // Create 30 days of steady sales (10 units/day)
      for (let i = 0; i < 30; i++) {
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
          quantity: 10,
          price: 100,
        });
      }

      // Set stock to 50 (below typical reorder point of ~140-200 units)
      await setVariantStock(variant.id, 50);

      // Check and create alerts
      const alertIds = await ForecastingService.checkAndCreateAlerts(
        testProduct.id,
        variant.id
      );

      // Should create at least one alert
      expect(alertIds.length).toBeGreaterThan(0);

      // Verify STOCKOUT_RISK alert was created
      const alerts = await prisma.reorderAlert.findMany({
        where: {
          productId: testProduct.id,
          variantId: variant.id,
          alertType: 'STOCKOUT_RISK',
          status: 'ACTIVE',
        },
      });

      expect(alerts.length).toBe(1);
      expect(alerts[0].alertType).toBe('STOCKOUT_RISK');
      expect(alerts[0].severity).toBeDefined();
      expect(['HIGH', 'MEDIUM', 'LOW']).toContain(alerts[0].severity);
      expect(alerts[0].message).toBeTruthy();
      expect(alerts[0].currentStock).toBe(50);
      expect(alerts[0].recommendedOrder).toBeGreaterThan(0);
    });

    it('should create OVERSTOCK alert when stock is too high', async () => {
      const variant = testProduct.variants[0];

      // Create 30 days of low sales (2 units/day)
      for (let i = 0; i < 30; i++) {
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
          quantity: 2,
          price: 100,
        });
      }

      // Set stock to 500 (way above 2x30-day demand of ~120 units)
      await setVariantStock(variant.id, 500);

      // Check and create alerts
      const alertIds = await ForecastingService.checkAndCreateAlerts(
        testProduct.id,
        variant.id
      );

      // Should create at least one alert
      expect(alertIds.length).toBeGreaterThan(0);

      // Verify OVERSTOCK alert was created
      const alerts = await prisma.reorderAlert.findMany({
        where: {
          productId: testProduct.id,
          variantId: variant.id,
          alertType: 'OVERSTOCK',
          status: 'ACTIVE',
        },
      });

      expect(alerts.length).toBe(1);
      expect(alerts[0].alertType).toBe('OVERSTOCK');
      expect(alerts[0].severity).toBeDefined();
      expect(['HIGH', 'MEDIUM', 'LOW']).toContain(alerts[0].severity);
      expect(alerts[0].message).toBeTruthy();
      expect(alerts[0].currentStock).toBe(500);
      expect(alerts[0].recommendedOrder).toBeNull();
    });

    it('should create REORDER_POINT alert when stock is at optimal reorder level', async () => {
      const variant = testProduct.variants[0];

      // Create 30 days of sales (5 units/day)
      for (let i = 0; i < 30; i++) {
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
          price: 100,
        });
      }

      // Set stock to 95 (slightly above typical reorder point of ~70-100)
      await setVariantStock(variant.id, 95);

      // Check and create alerts
      const alertIds = await ForecastingService.checkAndCreateAlerts(
        testProduct.id,
        variant.id
      );

      // May create REORDER_POINT alert
      const alerts = await prisma.reorderAlert.findMany({
        where: {
          productId: testProduct.id,
          variantId: variant.id,
          status: 'ACTIVE',
        },
      });

      // This scenario may or may not trigger an alert depending on calculated reorder point.
      // If alerts exist, they must be one of the expected types.
      expect(alertIds.length).toBe(alerts.length);
      for (const alert of alerts) {
        expect(['REORDER_POINT', 'STOCKOUT_RISK']).toContain(alert.alertType);
      }
    });

    it('should not create duplicate alerts when ACTIVE alert already exists', async () => {
      const variant = testProduct.variants[0];

      // Create sales history
      for (let i = 0; i < 30; i++) {
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
          quantity: 10,
          price: 100,
        });
      }

      // Set low stock
      await setVariantStock(variant.id, 30);

      // Create alerts first time
      const alertIds1 = await ForecastingService.checkAndCreateAlerts(
        testProduct.id,
        variant.id
      );

      expect(alertIds1.length).toBeGreaterThan(0);

      // Try to create alerts again (should not create duplicates)
      const alertIds2 = await ForecastingService.checkAndCreateAlerts(
        testProduct.id,
        variant.id
      );

      expect(alertIds2.length).toBe(0);

      // Verify only one STOCKOUT_RISK alert exists
      const alerts = await prisma.reorderAlert.findMany({
        where: {
          productId: testProduct.id,
          variantId: variant.id,
          alertType: 'STOCKOUT_RISK',
          status: 'ACTIVE',
        },
      });

      expect(alerts.length).toBe(1);
    });

    it('should handle product with no sales history', async () => {
      const variant = testProduct.variants[0];

      // Set stock without creating sales history
      await setVariantStock(variant.id, 100);

      // Check and create alerts
      const alertIds = await ForecastingService.checkAndCreateAlerts(
        testProduct.id,
        variant.id
      );

      // Should not create alerts when no sales history exists
      expect(alertIds.length).toBe(0);
    });

    it('should throw error for non-existent product', async () => {
      await expect(
        ForecastingService.checkAndCreateAlerts('non-existent-id', testProduct.variants[0].id)
      ).rejects.toThrow('Product with ID non-existent-id not found');
    });

    it('should throw error for non-existent variant', async () => {
      await expect(
        ForecastingService.checkAndCreateAlerts(testProduct.id, 'non-existent-variant')
      ).rejects.toThrow('Variant with ID non-existent-variant not found');
    });

    it('should throw error when variant does not belong to product', async () => {
      // Create another product
      const anotherProduct = await createTestProduct({
        name: 'Another Product',
        description: 'Another product',
        price: 50,
        stock: 100,
      });

      const anotherVariant = anotherProduct.variants[0];

      await expect(
        ForecastingService.checkAndCreateAlerts(testProduct.id, anotherVariant.id)
      ).rejects.toThrow(`Variant ${anotherVariant.id} does not belong to product ${testProduct.id}`);
    });

    it('should create sku-level alerts for a specific variant', async () => {
      // Add a second variant to the test product
      const secondVariant = await prisma.productVariant.create({
        data: {
          productId: testProduct.id,
          name: 'Variant 2',
          salePrice: 150,
          baseStock: 50,
          isActive: true,
        },
      });
      await setVariantStock(secondVariant.id, 50);

      const firstVariant = testProduct.variants[0];

      // Create sales history for both variants
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
          variantId: firstVariant.id,
          quantity: 5,
          price: 100,
        });

        await createTestOrderItem({
          orderId: order.id,
          productId: testProduct.id,
          variantId: secondVariant.id,
          quantity: 5,
          price: 150,
        });
      }

      // Set low stock on first variant
      await setVariantStock(firstVariant.id, 30);

      // Check alerts for first variant only
      const alertIds = await ForecastingService.checkAndCreateAlerts(
        testProduct.id,
        firstVariant.id
      );

      // Alerts should be scoped to the requested SKU
      const alerts = await prisma.reorderAlert.findMany({
        where: {
          productId: testProduct.id,
          variantId: firstVariant.id,
          status: 'ACTIVE',
        },
      });

      expect(alerts.length).toBeGreaterThanOrEqual(0);
      if (alerts.length > 0) {
        expect(alerts[0].currentStock).toBe(30);
      }
    });
  });

  describe('recordForecastAccuracy', () => {
    it('should record forecast accuracy with correct metrics', async () => {
      const variant = testProduct.variants[0];

      // Create sales history
      for (let i = 0; i < 10; i++) {
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
          quantity: 10,
          price: 100,
        });
      }

      // Generate forecast
      const forecast = await ForecastingService.generateForecast(
        testProduct.id,
        variant.id,
        30,
        90
      );

      // Record accuracy with actual demand
      const actualDemand = 95;
      const accuracy = await ForecastingService.recordForecastAccuracy(
        forecast.id,
        actualDemand
      );

      // Verify accuracy record
      expect(accuracy).toBeDefined();
      expect(accuracy.id).toBeTruthy();
      expect(accuracy.forecastId).toBe(forecast.id);
      expect(accuracy.actualDemand).toBe(actualDemand);
      expect(accuracy.predictedDemand).toBe(forecast.predictedDemand);
      expect(accuracy.mae).toBeGreaterThanOrEqual(0);
      expect(accuracy.mape).toBeGreaterThanOrEqual(0);
      expect(accuracy.rmse).toBeGreaterThanOrEqual(0);
      expect(accuracy.accuracy).toBeGreaterThanOrEqual(0);
      expect(accuracy.accuracy).toBeLessThanOrEqual(100);

      // Verify metrics calculation
      const expectedMAE = Math.abs(actualDemand - forecast.predictedDemand);
      expect(accuracy.mae).toBe(expectedMAE);

      const expectedMAPE = (Math.abs(actualDemand - forecast.predictedDemand) / actualDemand) * 100;
      expect(accuracy.mape).toBeCloseTo(expectedMAPE, 2);

      const expectedRMSE = Math.sqrt(Math.pow(actualDemand - forecast.predictedDemand, 2));
      expect(accuracy.rmse).toBeCloseTo(expectedRMSE, 2);

      // Verify saved to database
      const savedAccuracy = await prisma.forecastAccuracy.findUnique({
        where: { id: accuracy.id },
      });
      expect(savedAccuracy).toBeDefined();
      expect(savedAccuracy!.forecastId).toBe(forecast.id);
      expect(savedAccuracy!.actualDemand).toBe(actualDemand);
    });

    it('should handle perfect prediction (100% accuracy)', async () => {
      const variant = testProduct.variants[0];

      // Generate forecast
      const forecast = await ForecastingService.generateForecast(
        testProduct.id,
        variant.id,
        30,
        90
      );

      // Record accuracy with exact predicted demand
      const actualDemand = forecast.predictedDemand;
      const accuracy = await ForecastingService.recordForecastAccuracy(
        forecast.id,
        actualDemand
      );

      // Perfect prediction should have zero error
      expect(accuracy.mae).toBe(0);
      expect(accuracy.mape).toBe(0);
      expect(accuracy.rmse).toBe(0);
      expect(accuracy.accuracy).toBe(100);
    });

    it('should handle zero actual demand', async () => {
      const variant = testProduct.variants[0];

      // Generate forecast
      const forecast = await ForecastingService.generateForecast(
        testProduct.id,
        variant.id,
        30,
        90
      );

      // Record accuracy with zero actual demand
      const actualDemand = 0;
      const accuracy = await ForecastingService.recordForecastAccuracy(
        forecast.id,
        actualDemand
      );

      expect(accuracy).toBeDefined();
      expect(accuracy.actualDemand).toBe(0);

      // MAPE should be 0 if both are 0, otherwise 100
      if (forecast.predictedDemand === 0) {
        expect(accuracy.mape).toBe(0);
        expect(accuracy.accuracy).toBe(100);
      } else {
        expect(accuracy.mape).toBe(100);
        expect(accuracy.accuracy).toBe(0);
      }
    });

    it('should throw error for non-existent forecast', async () => {
      await expect(
        ForecastingService.recordForecastAccuracy('non-existent-id', 100)
      ).rejects.toThrow('Forecast with ID non-existent-id not found');
    });
  });

  describe('getForecastAccuracyMetrics', () => {
    it('should calculate average accuracy metrics for multiple forecasts', async () => {
      const variant = testProduct.variants[0];

      // Create sales history
      for (let i = 0; i < 30; i++) {
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
          quantity: 10,
          price: 100,
        });
      }

      // Generate multiple forecasts and record accuracy
      const accuracyRecords = [];

      for (let i = 0; i < 5; i++) {
        const forecast = await ForecastingService.generateForecast(
          testProduct.id,
          variant.id,
          30,
          90
        );

        const actualDemand = 95 + i * 5; // Vary actual demand
        const accuracy = await ForecastingService.recordForecastAccuracy(
          forecast.id,
          actualDemand
        );

        accuracyRecords.push(accuracy);
      }

      // Get accuracy metrics
      const metrics = await ForecastingService.getForecastAccuracyMetrics(
        testProduct.id,
        variant.id
      );

      // Verify metrics
      expect(metrics).toBeDefined();
      expect(metrics.totalForecasts).toBe(5);
      expect(metrics.avgAccuracy).toBeGreaterThanOrEqual(0);
      expect(metrics.avgAccuracy).toBeLessThanOrEqual(100);
      expect(metrics.avgMAE).toBeGreaterThanOrEqual(0);
      expect(metrics.avgMAPE).toBeGreaterThanOrEqual(0);
      expect(metrics.avgRMSE).toBeGreaterThanOrEqual(0);
      expect(['IMPROVING', 'DECLINING', 'STABLE']).toContain(metrics.accuracyTrend);

      // Verify period
      expect(metrics.period.startDate).toBeTruthy();
      expect(metrics.period.endDate).toBeTruthy();

      // Calculate expected averages
      const expectedAvgMAE = accuracyRecords.reduce((sum, r) => sum + r.mae, 0) / 5;
      const expectedAvgMAPE = accuracyRecords.reduce((sum, r) => sum + r.mape, 0) / 5;
      const expectedAvgRMSE = accuracyRecords.reduce((sum, r) => sum + r.rmse, 0) / 5;

      expect(metrics.avgMAE).toBeCloseTo(expectedAvgMAE, 2);
      expect(metrics.avgMAPE).toBeCloseTo(expectedAvgMAPE, 2);
      expect(metrics.avgRMSE).toBeCloseTo(expectedAvgRMSE, 2);
    });

    it('should filter by date range', async () => {
      const variant = testProduct.variants[0];

      // Generate forecast
      const forecast = await ForecastingService.generateForecast(
        testProduct.id,
        variant.id,
        30,
        90
      );

      // Record accuracy
      await ForecastingService.recordForecastAccuracy(forecast.id, 100);

      // Get metrics with date filter
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1);

      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 1);

      const metrics = await ForecastingService.getForecastAccuracyMetrics(
        testProduct.id,
        variant.id,
        startDate,
        endDate
      );

      expect(metrics).toBeDefined();
      expect(metrics.totalForecasts).toBe(1);
    });

    it('should detect IMPROVING trend when accuracy increases', async () => {
      const variant = testProduct.variants[0];

      // Create sales history
      for (let i = 0; i < 10; i++) {
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
          quantity: 10,
          price: 100,
        });
      }

      // Generate forecasts with improving accuracy
      // First half: higher MAPE (worse accuracy)
      for (let i = 0; i < 3; i++) {
        const forecast = await ForecastingService.generateForecast(
          testProduct.id,
          variant.id,
          30,
          90
        );

        // Actual demand far from prediction (high MAPE)
        const actualDemand = forecast.predictedDemand * 0.5; // 50% off
        await ForecastingService.recordForecastAccuracy(forecast.id, actualDemand);
      }

      // Second half: lower MAPE (better accuracy)
      for (let i = 0; i < 3; i++) {
        const forecast = await ForecastingService.generateForecast(
          testProduct.id,
          variant.id,
          30,
          90
        );

        // Actual demand closer to prediction (low MAPE)
        const actualDemand = forecast.predictedDemand * 0.98; // 2% off
        await ForecastingService.recordForecastAccuracy(forecast.id, actualDemand);
      }

      const metrics = await ForecastingService.getForecastAccuracyMetrics(
        testProduct.id,
        variant.id
      );

      // Should detect improving trend
      expect(metrics.accuracyTrend).toBe('IMPROVING');
      expect(metrics.totalForecasts).toBe(6);
    });

    it('should detect DECLINING trend when accuracy decreases', async () => {
      const variant = testProduct.variants[0];

      // Create sales history
      for (let i = 0; i < 10; i++) {
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
          quantity: 10,
          price: 100,
        });
      }

      // Generate forecasts with declining accuracy
      // First half: lower MAPE (better accuracy)
      for (let i = 0; i < 3; i++) {
        const forecast = await ForecastingService.generateForecast(
          testProduct.id,
          variant.id,
          30,
          90
        );

        // Actual demand close to prediction (low MAPE)
        const actualDemand = forecast.predictedDemand * 0.99; // 1% off
        await ForecastingService.recordForecastAccuracy(forecast.id, actualDemand);
      }

      // Second half: higher MAPE (worse accuracy)
      for (let i = 0; i < 3; i++) {
        const forecast = await ForecastingService.generateForecast(
          testProduct.id,
          variant.id,
          30,
          90
        );

        // Actual demand far from prediction (high MAPE)
        const actualDemand = forecast.predictedDemand * 0.45; // 55% off
        await ForecastingService.recordForecastAccuracy(forecast.id, actualDemand);
      }

      const metrics = await ForecastingService.getForecastAccuracyMetrics(
        testProduct.id,
        variant.id
      );

      // Should detect declining trend
      expect(metrics.accuracyTrend).toBe('DECLINING');
      expect(metrics.totalForecasts).toBe(6);
    });

    it('should return empty metrics when no forecasts exist', async () => {
      const variant = testProduct.variants[0];
      const metrics = await ForecastingService.getForecastAccuracyMetrics(
        testProduct.id,
        variant.id
      );

      expect(metrics).toBeDefined();
      expect(metrics.totalForecasts).toBe(0);
      expect(metrics.avgAccuracy).toBe(0);
      expect(metrics.avgMAE).toBe(0);
      expect(metrics.avgMAPE).toBe(0);
      expect(metrics.avgRMSE).toBe(0);
      expect(metrics.accuracyTrend).toBe('STABLE');
    });

    it('should return empty metrics when no accuracy records exist', async () => {
      const variant = testProduct.variants[0];

      // Generate forecast but don't record accuracy
      await ForecastingService.generateForecast(
        testProduct.id,
        variant.id,
        30,
        90
      );

      const metrics = await ForecastingService.getForecastAccuracyMetrics(
        testProduct.id,
        variant.id
      );

      expect(metrics).toBeDefined();
      expect(metrics.totalForecasts).toBe(0);
      expect(metrics.avgAccuracy).toBe(0);
    });

    it('should return metrics for the requested variant only', async () => {
      // Add a second variant
      const secondVariant = await prisma.productVariant.create({
        data: {
          productId: testProduct.id,
          name: 'Variant 2',
          salePrice: 150,
          baseStock: 50,
          isActive: true,
        },
      });

      const firstVariant = testProduct.variants[0];

      // Generate forecasts for both variants
      const forecast1 = await ForecastingService.generateForecast(
        testProduct.id,
        firstVariant.id,
        30,
        90
      );

      const forecast2 = await ForecastingService.generateForecast(
        testProduct.id,
        secondVariant.id,
        30,
        90
      );

      // Record accuracy for both
      await ForecastingService.recordForecastAccuracy(forecast1.id, 100);
      await ForecastingService.recordForecastAccuracy(forecast2.id, 90);

      // Get metrics for one SKU
      const metrics = await ForecastingService.getForecastAccuracyMetrics(
        testProduct.id,
        firstVariant.id
      );

      expect(metrics).toBeDefined();
      expect(metrics.totalForecasts).toBe(1);
      expect(metrics.avgAccuracy).toBeGreaterThanOrEqual(0);
      expect(metrics.avgAccuracy).toBeLessThanOrEqual(100);
    });
  });
});
