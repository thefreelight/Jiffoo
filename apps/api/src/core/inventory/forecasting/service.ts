// @ts-nocheck
/**
 * Inventory Forecasting Service
 *
 * Handles forecast generation, alert management, and accuracy tracking
 */

import { prisma } from '@/config/database';
import { InventoryService } from '@/core/inventory/service';
import {
  analyzeSalesTrend,
  detectSeasonalPatterns,
  calculateReorderPoint,
  forecastDemand,
} from './algorithms';
import {
  ForecastResult,
  ForecastMethod,
  ForecastMethodType,
  AlertResponse,
  AlertTypeType,
  AlertSeverityType,
  AlertStatusType,
} from './types';

const prismaDb = prisma as any;

function calculateTrendPercent(current: number, previous: number): number {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }

  return Number((((current - previous) / previous) * 100).toFixed(2));
}

export class ForecastingService {
  static async recomputeAllActiveSkus(options: {
    forecastDays?: number;
    historicalDays?: number;
    productIds?: string[];
  } = {}) {
    const forecastDays = options.forecastDays || 30;
    const historicalDays = options.historicalDays || 90;

    const products = await prismaDb.product.findMany({
      where: {
        ...(options.productIds?.length ? { id: { in: options.productIds } } : {}),
        variants: {
          some: {
            isActive: true,
          }
        }
      },
      select: {
        id: true,
        name: true,
        variants: {
          where: {
            isActive: true,
          },
          select: {
            id: true,
            skuCode: true,
          },
        },
      },
    });

    const totalProducts = products.length;
    const totalSkus = products.reduce((sum: number, product: any) => sum + product.variants.length, 0);

    let processedSkus = 0;
    let forecastsGenerated = 0;
    let alertsCreated = 0;
    let failedSkus = 0;
    const errors: Array<{
      productId: string;
      variantId: string;
      skuCode: string | null;
      message: string;
    }> = [];

    for (const product of products) {
      for (const variant of product.variants) {
        try {
          await this.generateForecast(product.id, variant.id, forecastDays, historicalDays);
          forecastsGenerated += 1;

          const alertIds = await this.checkAndCreateAlerts(product.id, variant.id);
          alertsCreated += alertIds.length;
          processedSkus += 1;
        } catch (error: any) {
          failedSkus += 1;
          errors.push({
            productId: product.id,
            variantId: variant.id,
            skuCode: variant.skuCode || null,
            message: error?.message || 'Unknown error',
          });
        }
      }
    }

    return {
      totalProducts,
      totalSkus,
      processedSkus,
      forecastsGenerated,
      alertsCreated,
      failedSkus,
      errors,
    };
  }

  static async getInventoryStats() {
    const now = new Date();
    const startOfTodayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startOfYesterdayUtc = new Date(startOfTodayUtc);
    startOfYesterdayUtc.setUTCDate(startOfYesterdayUtc.getUTCDate() - 1);

    const activeAlertWhere: Record<string, unknown> = { status: 'ACTIVE' };

    const [totalAlerts, stockoutRisks, overstockItems, todayTotalAlerts, yesterdayTotalAlerts, todayStockoutRisks, yesterdayStockoutRisks, todayOverstockItems, yesterdayOverstockItems, avgAccuracy, todayAccuracy, yesterdayAccuracy] = await Promise.all([
      prismaDb.reorderAlert.count({ where: activeAlertWhere }),
      prismaDb.reorderAlert.count({
        where: {
          ...activeAlertWhere,
          alertType: 'STOCKOUT_RISK',
          severity: 'HIGH',
        },
      }),
      prismaDb.reorderAlert.count({
        where: {
          ...activeAlertWhere,
          alertType: 'OVERSTOCK',
        },
      }),
      prismaDb.reorderAlert.count({
        where: {
          ...activeAlertWhere,
          createdAt: { gte: startOfTodayUtc },
        },
      }),
      prismaDb.reorderAlert.count({
        where: {
          ...activeAlertWhere,
          createdAt: { gte: startOfYesterdayUtc, lt: startOfTodayUtc },
        },
      }),
      prismaDb.reorderAlert.count({
        where: {
          ...activeAlertWhere,
          alertType: 'STOCKOUT_RISK',
          severity: 'HIGH',
          createdAt: { gte: startOfTodayUtc },
        },
      }),
      prismaDb.reorderAlert.count({
        where: {
          ...activeAlertWhere,
          alertType: 'STOCKOUT_RISK',
          severity: 'HIGH',
          createdAt: { gte: startOfYesterdayUtc, lt: startOfTodayUtc },
        },
      }),
      prismaDb.reorderAlert.count({
        where: {
          ...activeAlertWhere,
          alertType: 'OVERSTOCK',
          createdAt: { gte: startOfTodayUtc },
        },
      }),
      prismaDb.reorderAlert.count({
        where: {
          ...activeAlertWhere,
          alertType: 'OVERSTOCK',
          createdAt: { gte: startOfYesterdayUtc, lt: startOfTodayUtc },
        },
      }),
      this.getGlobalAvgAccuracy(),
      this.getGlobalAvgAccuracy(startOfTodayUtc, now),
      this.getGlobalAvgAccuracy(startOfYesterdayUtc, startOfTodayUtc),
    ]);

    return {
      metrics: {
        totalAlerts,
        stockoutRisks,
        overstockItems,
        avgAccuracy,
        totalAlertsTrend: calculateTrendPercent(todayTotalAlerts, yesterdayTotalAlerts),
        stockoutRisksTrend: calculateTrendPercent(todayStockoutRisks, yesterdayStockoutRisks),
        overstockItemsTrend: calculateTrendPercent(todayOverstockItems, yesterdayOverstockItems),
        avgAccuracyTrend: calculateTrendPercent(todayAccuracy, yesterdayAccuracy),
      }
    };
  }

  private static async getGlobalAvgAccuracy(startDate?: Date, endDate?: Date): Promise<number> {
    const where: any = {};
    if (startDate || endDate) {
      where.evaluationDate = {};
      if (startDate) where.evaluationDate.gte = startDate;
      if (endDate) where.evaluationDate.lt = endDate;
    }

    const [aggregate, records] = await Promise.all([
      prismaDb.forecastAccuracy.aggregate({
        where,
        _avg: {
          mape: true,
        },
      }),
      prismaDb.forecastAccuracy.count({ where }),
    ]);

    if (records === 0) return 0;
    const avgMape = Number(aggregate._avg?.mape || 0);
    return Math.max(0, Math.min(100, Number((100 - avgMape).toFixed(2))));
  }

  static async getInventoryDashboard(params: {
    page?: number;
    limit?: number;
    status?: 'ACTIVE' | 'DISMISSED' | 'RESOLVED';
    productId?: string;
    variantId?: string;
  } = {}) {
    const page = params.page || 1;
    const limit = params.limit || 10;

    const filters: {
      status?: string;
      productId?: string;
      variantId?: string;
    } = {};

    if (params.status) filters.status = params.status;
    if (params.productId) filters.productId = params.productId;
    if (params.variantId) filters.variantId = params.variantId;

    const alerts = await this.getAlerts(page, limit, filters);

    const contextAlert =
      alerts.items.find((item) => item.productId && item.alertType === 'STOCKOUT_RISK' && item.severity === 'HIGH') ||
      alerts.items.find((item) => item.productId) ||
      null;

    const contextProductId = params.productId || contextAlert?.productId || null;
    let contextVariantId = params.variantId || contextAlert?.variantId || null;

    if (contextProductId && !contextVariantId) {
      const defaultVariant = await prismaDb.productVariant.findFirst({
        where: {
          productId: contextProductId,
          isActive: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: { id: true },
      });
      contextVariantId = defaultVariant?.id || null;
    }

    let accuracy = null;
    let latestForecast = null;

    if (contextProductId && contextVariantId) {
      accuracy = await this.getForecastAccuracyMetrics(contextProductId, contextVariantId);
      latestForecast = await this.getForecast(contextProductId, contextVariantId);

      if (!latestForecast) {
        latestForecast = await this.generateForecast(contextProductId, contextVariantId);
      }
    }

    return {
      alerts,
      context: {
        productId: contextProductId,
        variantId: contextVariantId,
      },
      accuracy,
      latestForecast,
    };
  }

  /**
   * Generate demand forecast for a SKU
   *
   * @param productId - The product ID
   * @param variantId - The SKU ID
   * @param forecastDays - Number of days to forecast (default: 30)
   * @param historicalDays - Days of historical data to analyze (default: 90)
   * @returns ForecastResult with predictions and confidence score
   */
  static async generateForecast(
    productId: string,
    variantId: string,
    forecastDays: number = 30,
    historicalDays: number = 90
  ): Promise<ForecastResult> {
    // 1. Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true },
    });

    if (!product) {
      throw new Error(`Product with ID ${productId} not found`);
    }

    // 2. Verify variant exists and belongs to product
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      select: { id: true, productId: true },
    });

    if (!variant) {
      throw new Error(`Variant with ID ${variantId} not found`);
    }

    if (variant.productId !== productId) {
      throw new Error(`Variant ${variantId} does not belong to product ${productId}`);
    }

    // 3. Run forecasting algorithms
    const [trendAnalysis, seasonalFactors, reorderPoint, demandForecast] = await Promise.all([
      analyzeSalesTrend(productId, variantId, historicalDays),
      detectSeasonalPatterns(productId, variantId, historicalDays),
      calculateReorderPoint(productId, variantId, 14, 7, 95), // 14 days lead time, 7 days safety stock, 95% service level
      forecastDemand(productId, variantId, forecastDays, historicalDays),
    ]);

    // 4. Determine forecast method based on data availability
    let method: ForecastMethodType = ForecastMethod.MOVING_AVERAGE;
    if (seasonalFactors) {
      method = ForecastMethod.SEASONAL_DECOMPOSITION;
    } else if (trendAnalysis.trend !== 'STABLE') {
      method = ForecastMethod.LINEAR_REGRESSION;
    }

    // 5. Get predicted demand for the forecast period
    const predictedDemand = demandForecast;

    // 6. Calculate confidence score (0-1 scale)
    // Confidence is based on trend confidence and data consistency
    const confidence = trendAnalysis.confidence;

    // 7. Save forecast to database
    const forecastDate = new Date();
    forecastDate.setDate(forecastDate.getDate() + forecastDays);

    const savedForecast = await prismaDb.inventoryForecast.create({
      data: {
        productId,
        variantId,
        forecastDate,
        predictedDemand,
        confidence,
        seasonalFactors: seasonalFactors ? JSON.stringify(seasonalFactors) : null,
      },
    });

    // 8. Build and return ForecastResult
    const result: ForecastResult = {
      id: savedForecast.id,
      productId,
      variantId,
      forecastDate: forecastDate.toISOString(),
      predictedDemand,
      confidence,
      method,
      seasonalFactors,
      trendAnalysis,
      reorderPoint,
      createdAt: savedForecast.createdAt.toISOString(),
      updatedAt: savedForecast.updatedAt.toISOString(),
    };

    return result;
  }

  /**
   * Get the latest forecast for a product/variant
   *
   * @param productId - The product ID
   * @param variantId - Optional variant ID
   * @returns ForecastResult or null if no forecast exists
   */
  static async getForecast(
    productId: string,
    variantId: string
  ): Promise<ForecastResult | null> {
    const where: any = { productId, variantId };

    const forecast = await prismaDb.inventoryForecast.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
    });

    if (!forecast) {
      return null;
    }

    // Fetch additional data for complete ForecastResult
    const [trendAnalysis, reorderPoint] = await Promise.all([
      analyzeSalesTrend(productId, variantId),
      calculateReorderPoint(productId, variantId, 14, 7, 95),
    ]);

    // Parse seasonal factors if available
    let seasonalFactors = null;
    if (forecast.seasonalFactors) {
      try {
        seasonalFactors = JSON.parse(forecast.seasonalFactors);
      } catch (e) {
        // Invalid JSON, skip
      }
    }

    const result: ForecastResult = {
      id: forecast.id,
      productId: forecast.productId!,
      variantId: forecast.variantId!,
      forecastDate: forecast.forecastDate.toISOString(),
      predictedDemand: forecast.predictedDemand,
      confidence: forecast.confidence,
      method: seasonalFactors
        ? ForecastMethod.SEASONAL_DECOMPOSITION
        : ForecastMethod.MOVING_AVERAGE,
      seasonalFactors,
      trendAnalysis,
      reorderPoint,
      createdAt: forecast.createdAt.toISOString(),
      updatedAt: forecast.updatedAt.toISOString(),
    };

    return result;
  }

  /**
   * Check SKU inventory levels and create alerts if needed
   *
   * @param productId - The product ID to check
   * @param variantId - The SKU ID
   * @returns Array of created alert IDs
   */
  static async checkAndCreateAlerts(
    productId: string,
    variantId: string
  ): Promise<string[]> {
    // 1. Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true },
    });

    if (!product) {
      throw new Error(`Product with ID ${productId} not found`);
    }

    // 2. Verify variant exists and belongs to product
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      select: { id: true, productId: true },
    });

    if (!variant) {
      throw new Error(`Variant with ID ${variantId} not found`);
    }

    if (variant.productId !== productId) {
      throw new Error(`Variant ${variantId} does not belong to product ${productId}`);
    }

    // 3. Get current stock level
    const stockMap = await InventoryService.getAvailableStockByVariantIds([variantId]);
    const currentStock = stockMap.get(variantId) ?? 0;

    // 4. Calculate reorder point and trend analysis
    const [reorderPoint, trendAnalysis] = await Promise.all([
      calculateReorderPoint(productId, variantId, 14, 7, 95),
      analyzeSalesTrend(productId, variantId, 90),
    ]);

    const avgDailyDemand = reorderPoint.averageDailyDemand;
    const reorderThreshold = reorderPoint.reorderPoint;
    const overstockThreshold = avgDailyDemand * 30 * 2; // 2x average 30-day demand

    // 5. Check for existing ACTIVE alerts to avoid duplicates
    const whereClause: any = {
      productId,
      variantId,
      status: 'ACTIVE',
    };

    const existingAlerts = await prismaDb.reorderAlert.findMany({
      where: whereClause,
      select: { alertType: true },
    });

    const existingAlertTypes = new Set(existingAlerts.map((a) => a.alertType));
    const createdAlertIds: string[] = [];

    // 6. Check for STOCKOUT_RISK alert
    if (currentStock < reorderThreshold && !existingAlertTypes.has('STOCKOUT_RISK')) {
      const daysUntilStockout = reorderPoint.daysUntilStockout || 0;
      let severity: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
      let message = '';

      if (daysUntilStockout <= 3) {
        severity = 'HIGH';
        message = `Critical: Stock will run out in ${daysUntilStockout} days. Immediate reorder required.`;
      } else if (daysUntilStockout <= 7) {
        severity = 'MEDIUM';
        message = `Warning: Stock will run out in ${daysUntilStockout} days. Reorder soon.`;
      } else {
        severity = 'LOW';
        message = `Stock below reorder point (${Math.round(reorderThreshold)} units). Consider reordering.`;
      }

      const alert = await prismaDb.reorderAlert.create({
        data: {
          productId,
          variantId,
          alertType: 'STOCKOUT_RISK',
          severity,
          message,
          threshold: reorderThreshold,
          currentStock,
          recommendedOrder: Math.round(reorderPoint.recommendedOrderQuantity),
          status: 'ACTIVE',
        },
      });

      createdAlertIds.push(alert.id);
    }

    // 7. Check for OVERSTOCK alert
    if (
      avgDailyDemand > 0 &&
      currentStock > overstockThreshold &&
      !existingAlertTypes.has('OVERSTOCK')
    ) {
      const excessDays = Math.round(currentStock / avgDailyDemand);
      let severity: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
      let message = '';

      if (excessDays > 90) {
        severity = 'HIGH';
        message = `Excessive stock: Current inventory will last ${excessDays} days. Consider reducing orders.`;
      } else if (excessDays > 60) {
        severity = 'MEDIUM';
        message = `High stock levels: Current inventory will last ${excessDays} days.`;
      } else {
        severity = 'LOW';
        message = `Stock above optimal levels (${Math.round(overstockThreshold)} units). Monitor inventory.`;
      }

      const alert = await prismaDb.reorderAlert.create({
        data: {
          productId,
          variantId,
          alertType: 'OVERSTOCK',
          severity,
          message,
          threshold: overstockThreshold,
          currentStock,
          recommendedOrder: null,
          status: 'ACTIVE',
        },
      });

      createdAlertIds.push(alert.id);
    }

    // 8. Check for REORDER_POINT alert (optimal reorder time)
    const reorderBuffer = reorderThreshold * 1.3; // 30% buffer above reorder point
    if (
      currentStock >= reorderThreshold &&
      currentStock <= reorderBuffer &&
      !existingAlertTypes.has('REORDER_POINT') &&
      !existingAlertTypes.has('STOCKOUT_RISK')
    ) {
      const message = `Optimal time to reorder: Stock at ${currentStock} units, approaching reorder point of ${Math.round(reorderThreshold)} units.`;

      const alert = await prismaDb.reorderAlert.create({
        data: {
          productId,
          variantId,
          alertType: 'REORDER_POINT',
          severity: 'MEDIUM',
          message,
          threshold: reorderThreshold,
          currentStock,
          recommendedOrder: Math.round(reorderPoint.recommendedOrderQuantity),
          status: 'ACTIVE',
        },
      });

      createdAlertIds.push(alert.id);
    }

    return createdAlertIds;
  }

  /**
   * Record forecast accuracy by comparing predicted vs actual demand
   *
   * @param forecastId - The forecast ID to evaluate
   * @param actualDemand - The actual demand observed
   * @returns ForecastAccuracy record with metrics
   */
  static async recordForecastAccuracy(
    forecastId: string,
    actualDemand: number
  ): Promise<{
    id: string;
    forecastId: string;
    actualDemand: number;
    predictedDemand: number;
    mae: number;
    mape: number;
    rmse: number;
    accuracy: number;
    evaluationDate: string;
    createdAt: string;
  }> {
    // 1. Get the forecast record
    const forecast = await prismaDb.inventoryForecast.findUnique({
      where: { id: forecastId },
      select: {
        id: true,
        predictedDemand: true,
        productId: true,
        variantId: true,
      },
    });

    if (!forecast) {
      throw new Error(`Forecast with ID ${forecastId} not found`);
    }

    const predictedDemand = forecast.predictedDemand;

    // 2. Calculate accuracy metrics
    // Mean Absolute Error (MAE): average absolute difference
    const mae = Math.abs(actualDemand - predictedDemand);

    // Mean Absolute Percentage Error (MAPE): percentage error
    // Handle division by zero when actualDemand is 0
    const mape = actualDemand === 0
      ? (predictedDemand === 0 ? 0 : 100)
      : (Math.abs(actualDemand - predictedDemand) / actualDemand) * 100;

    // Root Mean Square Error (RMSE): square root of squared error
    const rmse = Math.sqrt(Math.pow(actualDemand - predictedDemand, 2));

    // Accuracy score: 100 - MAPE (capped at 0-100)
    const accuracy = Math.max(0, Math.min(100, 100 - mape));

    // 3. Save accuracy record to database
    const evaluationDate = new Date();
    const accuracyRecord = await prismaDb.forecastAccuracy.create({
      data: {
        forecastId,
        actualDemand,
        predictedDemand,
        mae,
        mape,
        rmse,
        evaluationDate,
      },
    });

    // 4. Return result
    return {
      id: accuracyRecord.id,
      forecastId: accuracyRecord.forecastId,
      actualDemand: accuracyRecord.actualDemand,
      predictedDemand: accuracyRecord.predictedDemand,
      mae: accuracyRecord.mae!,
      mape: accuracyRecord.mape!,
      rmse: accuracyRecord.rmse!,
      accuracy,
      evaluationDate: accuracyRecord.evaluationDate.toISOString(),
      createdAt: accuracyRecord.createdAt.toISOString(),
    };
  }

  /**
   * Get forecast accuracy metrics summary for a product/variant
   *
   * @param productId - The product ID to analyze
   * @param variantId - Optional variant ID
   * @param startDate - Optional start date for filtering
   * @param endDate - Optional end date for filtering
   * @returns Accuracy metrics summary
   */
  static async getForecastAccuracyMetrics(
    productId: string,
    variantId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    avgAccuracy: number;
    avgMAPE: number;
    avgMAE: number;
    avgRMSE: number;
    totalForecasts: number;
    accuracyTrend: 'IMPROVING' | 'DECLINING' | 'STABLE';
    period: {
      startDate: string;
      endDate: string;
    };
  }> {
    // 1. Build query filter for forecasts
    const forecastWhere: any = { productId, variantId };

    // 2. Get all forecasts for this product/variant
    const forecasts = await prismaDb.inventoryForecast.findMany({
      where: forecastWhere,
      select: { id: true },
    });

    if (forecasts.length === 0) {
      // No forecasts found, return empty metrics
      return {
        avgAccuracy: 0,
        avgMAPE: 0,
        avgMAE: 0,
        avgRMSE: 0,
        totalForecasts: 0,
        accuracyTrend: 'STABLE',
        period: {
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
        },
      };
    }

    const forecastIds = forecasts.map((f) => f.id);

    // 3. Build query filter for accuracy records
    const accuracyWhere: any = {
      forecastId: { in: forecastIds },
    };

    if (startDate || endDate) {
      accuracyWhere.evaluationDate = {};
      if (startDate) {
        accuracyWhere.evaluationDate.gte = startDate;
      }
      if (endDate) {
        accuracyWhere.evaluationDate.lte = endDate;
      }
    }

    // 4. Get accuracy records
    const accuracyRecords = await prismaDb.forecastAccuracy.findMany({
      where: accuracyWhere,
      orderBy: { evaluationDate: 'asc' },
      select: {
        mae: true,
        mape: true,
        rmse: true,
        evaluationDate: true,
      },
    });

    if (accuracyRecords.length === 0) {
      // No accuracy records found
      return {
        avgAccuracy: 0,
        avgMAPE: 0,
        avgMAE: 0,
        avgRMSE: 0,
        totalForecasts: 0,
        accuracyTrend: 'STABLE',
        period: {
          startDate: startDate?.toISOString() || new Date().toISOString(),
          endDate: endDate?.toISOString() || new Date().toISOString(),
        },
      };
    }

    // 5. Calculate average metrics
    const totalRecords = accuracyRecords.length;
    const sumMAE = accuracyRecords.reduce((sum, r) => sum + (r.mae || 0), 0);
    const sumMAPE = accuracyRecords.reduce((sum, r) => sum + (r.mape || 0), 0);
    const sumRMSE = accuracyRecords.reduce((sum, r) => sum + (r.rmse || 0), 0);

    const avgMAE = sumMAE / totalRecords;
    const avgMAPE = sumMAPE / totalRecords;
    const avgRMSE = sumRMSE / totalRecords;
    const avgAccuracy = Math.max(0, Math.min(100, 100 - avgMAPE));

    // 6. Determine accuracy trend
    // Compare first half vs second half of records
    let accuracyTrend: 'IMPROVING' | 'DECLINING' | 'STABLE' = 'STABLE';

    if (totalRecords >= 4) {
      const midpoint = Math.floor(totalRecords / 2);
      const firstHalf = accuracyRecords.slice(0, midpoint);
      const secondHalf = accuracyRecords.slice(midpoint);

      const firstHalfMAPE = firstHalf.reduce((sum, r) => sum + (r.mape || 0), 0) / firstHalf.length;
      const secondHalfMAPE = secondHalf.reduce((sum, r) => sum + (r.mape || 0), 0) / secondHalf.length;

      // Lower MAPE means better accuracy
      const improvement = firstHalfMAPE - secondHalfMAPE;

      if (improvement > 5) {
        // MAPE decreased by more than 5%, accuracy improved
        accuracyTrend = 'IMPROVING';
      } else if (improvement < -5) {
        // MAPE increased by more than 5%, accuracy declined
        accuracyTrend = 'DECLINING';
      }
    }

    // 7. Determine period
    const periodStartDate = startDate || accuracyRecords[0].evaluationDate;
    const periodEndDate = endDate || accuracyRecords[accuracyRecords.length - 1].evaluationDate;

    // 8. Return metrics summary
    return {
      avgAccuracy,
      avgMAPE,
      avgMAE,
      avgRMSE,
      totalForecasts: totalRecords,
      accuracyTrend,
      period: {
        startDate: periodStartDate.toISOString(),
        endDate: periodEndDate.toISOString(),
      },
    };
  }

  /**
   * Get multiple forecasts with pagination and filtering
   *
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 20)
   * @param productId - Optional product ID filter
   * @param variantId - Optional variant ID filter
   * @returns Paginated list of forecasts
   */
  static async getForecasts(
    page: number = 1,
    limit: number = 20,
    productId?: string,
    variantId?: string
  ): Promise<{
    items: ForecastResult[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    if (productId) {
      where.productId = productId;
    }
    if (variantId) {
      where.variantId = variantId;
    }

    // Query forecasts with pagination
    const [forecasts, total] = await Promise.all([
      prismaDb.inventoryForecast.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          productId: true,
          variantId: true,
          forecastDate: true,
          predictedDemand: true,
          confidence: true,
          seasonalFactors: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prismaDb.inventoryForecast.count({ where }),
    ]);

    // Transform forecasts to ForecastResult format
    const items = await Promise.all(
      forecasts.map(async (forecast) => {
        const [trendAnalysis, reorderPoint] = await Promise.all([
          analyzeSalesTrend(forecast.productId!, forecast.variantId!),
          calculateReorderPoint(forecast.productId!, forecast.variantId!, 14, 7, 95),
        ]);

        // Parse seasonal factors if available
        let seasonalFactors = null;
        if (forecast.seasonalFactors) {
          try {
            seasonalFactors = JSON.parse(forecast.seasonalFactors);
          } catch (e) {
            // Invalid JSON, skip
          }
        }

        const result: ForecastResult = {
          id: forecast.id,
          productId: forecast.productId!,
          variantId: forecast.variantId!,
          forecastDate: forecast.forecastDate.toISOString(),
          predictedDemand: forecast.predictedDemand,
          confidence: forecast.confidence,
          method: seasonalFactors
            ? ForecastMethod.SEASONAL_DECOMPOSITION
            : ForecastMethod.MOVING_AVERAGE,
          seasonalFactors,
          trendAnalysis,
          reorderPoint,
          createdAt: forecast.createdAt.toISOString(),
          updatedAt: forecast.updatedAt.toISOString(),
        };

        return result;
      })
    );

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single alert by ID
   *
   * @param alertId - The alert ID to retrieve
   * @returns Alert details or null if not found
   */
  static async getAlert(alertId: string): Promise<{
    id: string;
    productId: string;
    variantId: string;
    alertType: string;
    severity: string;
    status: string;
    message: string;
    threshold: number | null;
    currentStock: number;
    recommendedOrder: number | null;
    resolvedAt: string | null;
    createdAt: string;
    updatedAt: string;
  } | null> {
    const alert = await prismaDb.reorderAlert.findUnique({
      where: { id: alertId },
      select: {
        id: true,
        productId: true,
        variantId: true,
        alertType: true,
        severity: true,
        status: true,
        message: true,
        threshold: true,
        currentStock: true,
        recommendedOrder: true,
        resolvedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!alert) {
      return null;
    }

    return {
      id: alert.id,
      productId: alert.productId!,
      variantId: alert.variantId!,
      alertType: alert.alertType,
      severity: alert.severity,
      status: alert.status,
      message: alert.message,
      threshold: alert.threshold,
      currentStock: alert.currentStock,
      recommendedOrder: alert.recommendedOrder,
      resolvedAt: alert.resolvedAt?.toISOString() || null,
      createdAt: alert.createdAt.toISOString(),
      updatedAt: alert.updatedAt.toISOString(),
    };
  }

  /**
   * Get multiple alerts with pagination and filtering
   *
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 20)
   * @param filters - Optional filters (productId, variantId, alertType, severity, status)
   * @returns Paginated list of alerts
   */
  static async getAlerts(
    page: number = 1,
    limit: number = 20,
    filters: {
      productId?: string;
      variantId?: string;
      alertType?: string;
      severity?: string;
      status?: string;
    } = {}
  ): Promise<{
    items: Array<{
      id: string;
      productId: string;
      variantId: string;
      alertType: string;
      severity: string;
      status: string;
      message: string;
      threshold: number | null;
      currentStock: number;
      recommendedOrder: number | null;
      resolvedAt: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    if (filters.productId) {
      where.productId = filters.productId;
    }
    if (filters.variantId) {
      where.variantId = filters.variantId;
    }
    if (filters.alertType) {
      where.alertType = filters.alertType;
    }
    if (filters.severity) {
      where.severity = filters.severity;
    }
    if (filters.status) {
      where.status = filters.status;
    }

    // Query alerts with pagination
    const [alerts, total] = await Promise.all([
      prismaDb.reorderAlert.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          productId: true,
          variantId: true,
          alertType: true,
          severity: true,
          status: true,
          message: true,
          threshold: true,
          currentStock: true,
          recommendedOrder: true,
          resolvedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prismaDb.reorderAlert.count({ where }),
    ]);

    const productIds = Array.from(
      new Set(alerts.map((alert: any) => alert.productId).filter(Boolean))
    ) as string[];
    const variantIds = Array.from(
      new Set(alerts.map((alert: any) => alert.variantId).filter(Boolean))
    ) as string[];

    const [products, variants] = await Promise.all([
      productIds.length
        ? prismaDb.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true },
          })
        : [],
      variantIds.length
        ? prismaDb.productVariant.findMany({
            where: { id: { in: variantIds } },
            select: { id: true, name: true },
          })
        : [],
    ]);

    const productNameMap = new Map(products.map((product: any) => [product.id, product.name]));
    const variantNameMap = new Map(variants.map((variant: any) => [variant.id, variant.name]));

    // Transform alerts to response format
    const items = alerts.map((alert: any) => ({
      id: alert.id,
      productId: alert.productId!,
      productName: productNameMap.get(alert.productId) || undefined,
      variantId: alert.variantId!,
      variantName: variantNameMap.get(alert.variantId) || null,
      alertType: alert.alertType,
      severity: alert.severity,
      status: alert.status,
      message: alert.message,
      threshold: alert.threshold,
      currentStock: alert.currentStock,
      recommendedOrder: alert.recommendedOrder,
      resolvedAt: alert.resolvedAt?.toISOString() || null,
      createdAt: alert.createdAt.toISOString(),
      updatedAt: alert.updatedAt.toISOString(),
    }));

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Dismiss an alert
   * @param alertId Alert ID to dismiss
   * @param reason Optional reason for dismissing the alert
   */
  static async dismissAlert(alertId: string, reason?: string): Promise<AlertResponse> {
    // Get the alert
    const alert = await prismaDb.reorderAlert.findUnique({
      where: { id: alertId },
      select: {
        id: true,
        productId: true,
        variantId: true,
      },
    });

    if (!alert) {
      throw new Error('Alert not found');
    }

    // Update alert status to DISMISSED
    const updatedAlert = await prismaDb.reorderAlert.update({
      where: { id: alertId },
      data: {
        status: 'DISMISSED',
        // Note: dismissReason field doesn't exist in schema, using notes field if needed later
      },
    });

    const [product, variant] = await Promise.all([
      prismaDb.product.findUnique({
        where: { id: updatedAlert.productId },
        select: { name: true },
      }),
      updatedAlert.variantId
        ? prismaDb.productVariant.findUnique({
            where: { id: updatedAlert.variantId },
            select: { name: true },
          })
        : null,
    ]);

    return {
      id: updatedAlert.id,
      productId: updatedAlert.productId,
      productName: product?.name,
      variantId: updatedAlert.variantId!,
      variantName: variant?.name || null,
      alertType: updatedAlert.alertType as AlertTypeType,
      severity: updatedAlert.severity as AlertSeverityType,
      status: updatedAlert.status as AlertStatusType,
      message: updatedAlert.message,
      threshold: updatedAlert.threshold,
      currentStock: updatedAlert.currentStock,
      recommendedOrder: updatedAlert.recommendedOrder,
      resolvedAt: updatedAlert.resolvedAt?.toISOString() || null,
      createdAt: updatedAlert.createdAt.toISOString(),
      updatedAt: updatedAlert.updatedAt.toISOString(),
    };
  }

  /**
   * Resolve an alert
   * @param alertId Alert ID to resolve
   */
  static async resolveAlert(alertId: string): Promise<AlertResponse> {
    // Get the alert
    const alert = await prismaDb.reorderAlert.findUnique({
      where: { id: alertId },
      select: {
        id: true,
        productId: true,
        variantId: true,
      },
    });

    if (!alert) {
      throw new Error('Alert not found');
    }

    // Update alert status to RESOLVED
    const updatedAlert = await prismaDb.reorderAlert.update({
      where: { id: alertId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
      },
    });

    const [product, variant] = await Promise.all([
      prismaDb.product.findUnique({
        where: { id: updatedAlert.productId },
        select: { name: true },
      }),
      updatedAlert.variantId
        ? prismaDb.productVariant.findUnique({
            where: { id: updatedAlert.variantId },
            select: { name: true },
          })
        : null,
    ]);

    return {
      id: updatedAlert.id,
      productId: updatedAlert.productId,
      productName: product?.name,
      variantId: updatedAlert.variantId!,
      variantName: variant?.name || null,
      alertType: updatedAlert.alertType as AlertTypeType,
      severity: updatedAlert.severity as AlertSeverityType,
      status: updatedAlert.status as AlertStatusType,
      message: updatedAlert.message,
      threshold: updatedAlert.threshold,
      currentStock: updatedAlert.currentStock,
      recommendedOrder: updatedAlert.recommendedOrder,
      resolvedAt: updatedAlert.resolvedAt?.toISOString() || null,
      createdAt: updatedAlert.createdAt.toISOString(),
      updatedAt: updatedAlert.updatedAt.toISOString(),
    };
  }

  /**
   * Update alert status
   * @param alertId Alert ID to update
   * @param status New status
   */
  static async updateAlertStatus(alertId: string, status: AlertStatusType): Promise<AlertResponse> {
    // Get the alert
    const alert = await prismaDb.reorderAlert.findUnique({
      where: { id: alertId },
      select: {
        id: true,
        productId: true,
        variantId: true,
      },
    });

    if (!alert) {
      throw new Error('Alert not found');
    }

    // Validate status
    const validStatuses = ['ACTIVE', 'DISMISSED', 'RESOLVED'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Update alert status
    const updatedAlert = await prismaDb.reorderAlert.update({
      where: { id: alertId },
      data: {
        status,
        resolvedAt: status === 'RESOLVED' ? new Date() : null,
      },
    });

    const [product, variant] = await Promise.all([
      prismaDb.product.findUnique({
        where: { id: updatedAlert.productId },
        select: { name: true },
      }),
      updatedAlert.variantId
        ? prismaDb.productVariant.findUnique({
            where: { id: updatedAlert.variantId },
            select: { name: true },
          })
        : null,
    ]);

    return {
      id: updatedAlert.id,
      productId: updatedAlert.productId,
      productName: product?.name,
      variantId: updatedAlert.variantId!,
      variantName: variant?.name || null,
      alertType: updatedAlert.alertType as AlertTypeType,
      severity: updatedAlert.severity as AlertSeverityType,
      status: updatedAlert.status as AlertStatusType,
      message: updatedAlert.message,
      threshold: updatedAlert.threshold,
      currentStock: updatedAlert.currentStock,
      recommendedOrder: updatedAlert.recommendedOrder,
      resolvedAt: updatedAlert.resolvedAt?.toISOString() || null,
      createdAt: updatedAlert.createdAt.toISOString(),
      updatedAt: updatedAlert.updatedAt.toISOString(),
    };
  }
}
