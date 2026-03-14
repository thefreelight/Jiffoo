// @ts-nocheck
/**
 * Inventory Forecasting Algorithms
 *
 * Sales trend analysis, seasonal prediction, and reorder point calculation
 */

import { prisma } from '@/config/database';
import { InventoryService } from '@/core/inventory/service';
import { TrendAnalysis, SeasonalFactors, ReorderPoint } from './types';

// ============================================================================
// Type Definitions
// ============================================================================

interface SalesDataPoint {
  date: Date;
  quantity: number;
  revenue: number;
}

interface HistoricalSalesData {
  dailySales: SalesDataPoint[];
  totalQuantity: number;
  totalRevenue: number;
  startDate: Date;
  endDate: Date;
}

// ============================================================================
// Sales Data Fetching
// ============================================================================

/**
 * Fetch historical sales data for a product/variant
 */
export async function fetchHistoricalSales(
  productId: string,
  variantId: string,
  historicalDays: number = 90
): Promise<HistoricalSalesData> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - historicalDays);

  // Build where clause
  const where: any = {
    productId,
    order: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      // Only include paid orders
      paymentStatus: 'PAID',
    },
  };

  where.variantId = variantId;

  // Fetch order items
  const orderItems = await prisma.orderItem.findMany({
    where,
    select: {
      quantity: true,
      unitPrice: true,
      order: {
        select: {
          createdAt: true,
        },
      },
    },
    orderBy: {
      order: {
        createdAt: 'asc',
      },
    },
  });

  // Group by date
  const salesByDate = new Map<string, { quantity: number; revenue: number }>();

  for (const item of orderItems) {
    const dateKey = item.order.createdAt.toISOString().split('T')[0];
    const existing = salesByDate.get(dateKey) || { quantity: 0, revenue: 0 };

    salesByDate.set(dateKey, {
      quantity: existing.quantity + item.quantity,
      revenue: existing.revenue + (item.quantity * item.unitPrice),
    });
  }

  // Fill missing dates with zero sales
  const dailySales: SalesDataPoint[] = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dateKey = currentDate.toISOString().split('T')[0];
    const sales = salesByDate.get(dateKey) || { quantity: 0, revenue: 0 };

    dailySales.push({
      date: new Date(currentDate),
      quantity: sales.quantity,
      revenue: sales.revenue,
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  const totalQuantity = dailySales.reduce((sum, day) => sum + day.quantity, 0);
  const totalRevenue = dailySales.reduce((sum, day) => sum + day.revenue, 0);

  return {
    dailySales,
    totalQuantity,
    totalRevenue,
    startDate,
    endDate,
  };
}

// ============================================================================
// Statistical Helper Functions
// ============================================================================

/**
 * Calculate mean (average) of an array of numbers
 */
function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = calculateMean(values);
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = calculateMean(squaredDiffs);
  return Math.sqrt(variance);
}

/**
 * Calculate linear regression (y = mx + b)
 * Returns slope (m) and intercept (b)
 */
function calculateLinearRegression(
  xValues: number[],
  yValues: number[]
): { slope: number; intercept: number; rSquared: number } {
  const n = xValues.length;

  if (n === 0 || n !== yValues.length) {
    return { slope: 0, intercept: 0, rSquared: 0 };
  }

  const xMean = calculateMean(xValues);
  const yMean = calculateMean(yValues);

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    const xDiff = xValues[i] - xMean;
    const yDiff = yValues[i] - yMean;
    numerator += xDiff * yDiff;
    denominator += xDiff * xDiff;
  }

  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = yMean - slope * xMean;

  // Calculate R-squared
  let ssRes = 0; // Sum of squares of residuals
  let ssTot = 0; // Total sum of squares

  for (let i = 0; i < n; i++) {
    const predicted = slope * xValues[i] + intercept;
    ssRes += Math.pow(yValues[i] - predicted, 2);
    ssTot += Math.pow(yValues[i] - yMean, 2);
  }

  const rSquared = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);

  return { slope, intercept, rSquared };
}

/**
 * Calculate moving average
 */
function calculateMovingAverage(values: number[], windowSize: number): number[] {
  const result: number[] = [];

  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = values.slice(start, i + 1);
    result.push(calculateMean(window));
  }

  return result;
}

// ============================================================================
// Trend Analysis Algorithm
// ============================================================================

/**
 * Analyze sales trends using moving averages and linear regression
 */
export async function analyzeSalesTrend(
  productId: string,
  variantId: string,
  historicalDays: number = 90
): Promise<TrendAnalysis> {
  // Fetch historical sales data
  const salesData = await fetchHistoricalSales(productId, variantId, historicalDays);
  const { dailySales } = salesData;

  // Extract quantities
  const quantities = dailySales.map(day => day.quantity);

  // Calculate basic averages
  const dailyAverage = calculateMean(quantities);

  // Weekly average (last 7 days moving average)
  const last7Days = quantities.slice(-7);
  const weeklyAverage = calculateMean(last7Days);

  // Monthly average (last 30 days moving average)
  const last30Days = quantities.slice(-30);
  const monthlyAverage = calculateMean(last30Days);

  // Calculate volatility (standard deviation)
  const volatility = calculateStdDev(quantities);

  // Linear regression for trend detection
  const xValues = quantities.map((_, index) => index);
  const regression = calculateLinearRegression(xValues, quantities);

  // Calculate growth rate (percentage)
  // Growth rate = (slope / dailyAverage) * 100
  const growthRate = dailyAverage === 0 ? 0 : (regression.slope / dailyAverage) * 100;

  // Determine trend direction
  let trend: 'INCREASING' | 'DECREASING' | 'STABLE' = 'STABLE';
  const growthThreshold = 0.5; // 0.5% threshold for stability

  if (Math.abs(growthRate) > growthThreshold) {
    trend = growthRate > 0 ? 'INCREASING' : 'DECREASING';
  }

  // Calculate confidence score (0-1)
  // Higher R-squared means better fit, lower volatility means more predictable
  const volatilityScore = dailyAverage === 0 ? 0 : Math.max(0, 1 - (volatility / dailyAverage));
  const rSquaredScore = Math.max(0, regression.rSquared);
  const confidence = (volatilityScore * 0.6) + (rSquaredScore * 0.4);

  return {
    dailyAverage,
    weeklyAverage,
    monthlyAverage,
    growthRate,
    trend,
    volatility,
    confidence: Math.max(0, Math.min(1, confidence)), // Clamp to [0, 1]
  };
}

// ============================================================================
// Seasonal Pattern Detection
// ============================================================================

/**
 * Detect seasonal patterns in sales data
 */
export async function detectSeasonalPatterns(
  productId: string,
  variantId: string,
  historicalDays: number = 90
): Promise<SeasonalFactors | null> {
  // Fetch historical sales data
  const salesData = await fetchHistoricalSales(productId, variantId, historicalDays);
  const { dailySales } = salesData;

  // Need at least 4 weeks of data for seasonal analysis
  if (dailySales.length < 28) {
    return null;
  }

  // Group by day of week (0 = Sunday, 6 = Saturday)
  const dayOfWeekSales = Array(7).fill(0).map(() => ({ total: 0, count: 0 }));

  for (const day of dailySales) {
    const dayOfWeek = day.date.getDay();
    dayOfWeekSales[dayOfWeek].total += day.quantity;
    dayOfWeekSales[dayOfWeek].count += 1;
  }

  // Calculate average for each day of week
  const weeklyAverages = dayOfWeekSales.map(day =>
    day.count === 0 ? 0 : day.total / day.count
  );

  const overallAverage = calculateMean(weeklyAverages);

  // Calculate multipliers (normalized to overall average)
  // weeklyPattern: [Monday, Tuesday, ..., Sunday]
  const weeklyPattern = [
    weeklyAverages[1], // Monday
    weeklyAverages[2], // Tuesday
    weeklyAverages[3], // Wednesday
    weeklyAverages[4], // Thursday
    weeklyAverages[5], // Friday
    weeklyAverages[6], // Saturday
    weeklyAverages[0], // Sunday
  ].map(avg => overallAverage === 0 ? 1 : avg / overallAverage);

  // Group by month
  const monthSales = Array(12).fill(0).map(() => ({ total: 0, count: 0 }));

  for (const day of dailySales) {
    const month = day.date.getMonth();
    monthSales[month].total += day.quantity;
    monthSales[month].count += 1;
  }

  // Calculate monthly pattern (only if we have data for multiple months)
  const monthlyPattern = monthSales.map(month =>
    month.count === 0 ? 1 : month.total / month.count
  );

  // Normalize monthly pattern
  const monthlyAverage = calculateMean(monthlyPattern.filter(m => m > 0));
  const normalizedMonthlyPattern = monthlyPattern.map(m =>
    m === 0 || monthlyAverage === 0 ? 1 : m / monthlyAverage
  );

  // Build day of week multipliers object
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const dayOfWeekMultipliers: Record<string, number> = {};

  dayNames.forEach((name, index) => {
    dayOfWeekMultipliers[name] = weeklyPattern[index];
  });

  return {
    weeklyPattern,
    monthlyPattern: normalizedMonthlyPattern,
    dayOfWeekMultipliers,
    holidayImpact: {}, // Holiday detection would require additional data
  };
}

// ============================================================================
// Reorder Point Calculation
// ============================================================================

/**
 * Calculate reorder point and safety stock
 * Formula: reorderPoint = (avgDailyDemand * leadTime) + safetyStock
 * SafetyStock = Z-score * sqrt(leadTime) * demandStdDev
 */
export async function calculateReorderPoint(
  productId: string,
  variantId: string,
  leadTimeDays: number = 14,
  safetyStockDays: number = 7,
  serviceLevel: number = 0.95 // 95% service level (Z-score ≈ 1.65)
): Promise<ReorderPoint> {
  // Fetch historical sales data
  const salesData = await fetchHistoricalSales(productId, variantId, 90);
  const { dailySales } = salesData;

  const quantities = dailySales.map(day => day.quantity);

  // Calculate demand statistics
  const averageDailyDemand = calculateMean(quantities);
  const demandStdDev = calculateStdDev(quantities);
  const maxDailyDemand = Math.max(...quantities);

  // Z-score for service level
  // 95% = 1.65, 99% = 2.33
  const zScore = serviceLevel >= 0.99 ? 2.33 : serviceLevel >= 0.95 ? 1.65 : 1.28;

  // Calculate safety stock
  // SafetyStock = Z * sqrt(leadTime) * stdDev
  const safetyStock = Math.ceil(
    zScore * Math.sqrt(leadTimeDays) * demandStdDev
  );

  // Calculate reorder point
  const reorderPoint = Math.ceil(
    (averageDailyDemand * leadTimeDays) + safetyStock
  );

  // Get current stock from warehouse inventory (single source of truth)
  const stockMap = await InventoryService.getAvailableStockByVariantIds([variantId]);
  const currentStock = stockMap.get(variantId) ?? 0;

  // Calculate days until stockout
  let daysUntilStockout: number | null = null;

  if (averageDailyDemand > 0) {
    const remainingDays = currentStock / averageDailyDemand;
    daysUntilStockout = remainingDays > 0 ? Math.floor(remainingDays) : 0;
  }

  // Recommended order quantity (Economic Order Quantity approximation)
  // For simplicity: order enough to cover leadTime + safetyStockDays
  const recommendedOrderQuantity = Math.ceil(
    averageDailyDemand * (leadTimeDays + safetyStockDays)
  );

  return {
    reorderPoint,
    safetyStock,
    averageDailyDemand,
    leadTime: leadTimeDays,
    maxDailyDemand,
    daysUntilStockout,
    recommendedOrderQuantity,
  };
}

// ============================================================================
// Demand Forecasting (Combined Algorithm)
// ============================================================================

/**
 * Predict future demand using trend analysis and seasonal factors
 */
export async function forecastDemand(
  productId: string,
  variantId: string,
  forecastDays: number = 30,
  historicalDays: number = 90
): Promise<number> {
  // Get trend analysis
  const trendAnalysis = await analyzeSalesTrend(productId, variantId, historicalDays);

  // Get seasonal factors
  const seasonalFactors = await detectSeasonalPatterns(productId, variantId, historicalDays);

  // Base forecast on daily average
  let predictedDemand = trendAnalysis.dailyAverage * forecastDays;

  // Apply growth rate
  if (trendAnalysis.trend !== 'STABLE') {
    const growthMultiplier = 1 + (trendAnalysis.growthRate / 100);
    // Apply growth over forecast period (compound growth)
    predictedDemand *= Math.pow(growthMultiplier, forecastDays / 30);
  }

  // Apply seasonal adjustment (if available)
  if (seasonalFactors) {
    // Calculate average seasonal multiplier for the forecast period
    const today = new Date();
    let seasonalSum = 0;

    for (let i = 0; i < forecastDays; i++) {
      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + i);
      const dayOfWeek = futureDate.getDay();

      // Map Sunday (0) to index 6, Monday (1) to index 0, etc.
      const weeklyIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      seasonalSum += seasonalFactors.weeklyPattern[weeklyIndex];
    }

    const avgSeasonalMultiplier = seasonalSum / forecastDays;
    predictedDemand *= avgSeasonalMultiplier;
  }

  return Math.max(0, Math.round(predictedDemand));
}
