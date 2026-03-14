import { z } from 'zod';

// Alert Type Enum
export const AlertType = {
  STOCKOUT_RISK: 'STOCKOUT_RISK',
  OVERSTOCK: 'OVERSTOCK',
  REORDER_POINT: 'REORDER_POINT',
} as const;

export type AlertTypeType = typeof AlertType[keyof typeof AlertType];

// Alert Severity Enum
export const AlertSeverity = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;

export type AlertSeverityType = typeof AlertSeverity[keyof typeof AlertSeverity];

// Alert Status Enum
export const AlertStatus = {
  ACTIVE: 'ACTIVE',
  DISMISSED: 'DISMISSED',
  RESOLVED: 'RESOLVED',
} as const;

export type AlertStatusType = typeof AlertStatus[keyof typeof AlertStatus];

// Forecast Method Enum
export const ForecastMethod = {
  MOVING_AVERAGE: 'MOVING_AVERAGE',
  LINEAR_REGRESSION: 'LINEAR_REGRESSION',
  SEASONAL_DECOMPOSITION: 'SEASONAL_DECOMPOSITION',
} as const;

export type ForecastMethodType = typeof ForecastMethod[keyof typeof ForecastMethod];

// Forecast Input Schema
export const ForecastInputSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().min(1, 'Variant ID is required'),
  forecastDays: z.number().int().positive('Forecast days must be positive').default(30),
  method: z.enum(['MOVING_AVERAGE', 'LINEAR_REGRESSION', 'SEASONAL_DECOMPOSITION']).optional(),
  historicalDays: z.number().int().positive().default(90),
});

export type ForecastInput = z.infer<typeof ForecastInputSchema>;

// Alert Configuration Schema
export const AlertConfigSchema = z.object({
  stockoutRiskThreshold: z.number().min(0).max(1).default(0.7), // 70% confidence
  overstockMultiplier: z.number().positive().default(2), // 2x average demand
  safetyStockDays: z.number().int().positive().default(7), // 7 days safety stock
  leadTimeDays: z.number().int().positive().default(14), // 14 days lead time
});

export type AlertConfig = z.infer<typeof AlertConfigSchema>;

// Generate Forecast Request Schema
export const GenerateForecastSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().min(1, 'Variant ID is required'),
  days: z.number().int().positive().default(30),
});

export type GenerateForecastRequest = z.infer<typeof GenerateForecastSchema>;

// Dismiss Alert Request Schema
export const DismissAlertSchema = z.object({
  reason: z.string().optional(),
});

export type DismissAlertRequest = z.infer<typeof DismissAlertSchema>;

// Alert Filter Schema
export const AlertFilterSchema = z.object({
  productId: z.string().optional(),
  variantId: z.string().optional(),
  alertType: z.enum(['STOCKOUT_RISK', 'OVERSTOCK', 'REORDER_POINT']).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  status: z.enum(['ACTIVE', 'DISMISSED', 'RESOLVED']).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type AlertFilter = z.infer<typeof AlertFilterSchema>;

// Accuracy Filter Schema
export const AccuracyFilterSchema = z.object({
  productId: z.string().optional(),
  variantId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type AccuracyFilter = z.infer<typeof AccuracyFilterSchema>;

// Seasonal Factors Interface
export interface SeasonalFactors {
  weeklyPattern: number[]; // 7 values (Mon-Sun)
  monthlyPattern: number[]; // 12 values (Jan-Dec)
  dayOfWeekMultipliers: Record<string, number>; // e.g., {"Monday": 1.2, "Friday": 1.5}
  holidayImpact?: Record<string, number>; // e.g., {"2024-12-25": 2.5}
}

// Trend Analysis Interface
export interface TrendAnalysis {
  dailyAverage: number;
  weeklyAverage: number;
  monthlyAverage: number;
  growthRate: number; // percentage: e.g., 5.5 means 5.5% growth
  trend: 'INCREASING' | 'DECREASING' | 'STABLE';
  volatility: number; // standard deviation
  confidence: number; // 0-1 score
}

// Reorder Point Interface
export interface ReorderPoint {
  reorderPoint: number; // units
  safetyStock: number; // units
  averageDailyDemand: number; // units per day
  leadTime: number; // days
  maxDailyDemand: number; // units per day
  daysUntilStockout: number | null; // null if not applicable
  recommendedOrderQuantity: number; // units
}

// Forecast Result Interface
export interface ForecastResult {
  id: string;
  productId: string;
  variantId: string;
  forecastDate: string; // ISO date string
  predictedDemand: number;
  confidence: number; // 0-1 score
  method: ForecastMethodType;
  seasonalFactors: SeasonalFactors | null;
  trendAnalysis: TrendAnalysis;
  reorderPoint: ReorderPoint;
  createdAt: string;
  updatedAt: string;
}

// Forecast Response Interface (simplified for API)
export interface ForecastResponse {
  id: string;
  productId: string;
  productName?: string;
  variantId: string;
  variantName?: string | null;
  forecastDate: string;
  predictedDemand: number;
  confidence: number;
  currentStock: number;
  reorderPoint: number;
  daysUntilStockout: number | null;
  recommendedOrderQuantity: number;
  trend: 'INCREASING' | 'DECREASING' | 'STABLE';
  createdAt: string;
}

// Alert Response Interface
export interface AlertResponse {
  id: string;
  productId: string;
  productName?: string;
  variantId: string;
  variantName?: string | null;
  alertType: AlertTypeType;
  severity: AlertSeverityType;
  status: AlertStatusType;
  message: string;
  threshold: number | null;
  currentStock: number;
  recommendedOrder: number | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Paginated Alert List Response
export interface AlertListResponse {
  items: AlertResponse[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Forecast Accuracy Response Interface
export interface ForecastAccuracyResponse {
  id: string;
  forecastId: string;
  productId?: string;
  variantId: string;
  actualDemand: number;
  predictedDemand: number;
  mae: number; // Mean Absolute Error
  mape: number; // Mean Absolute Percentage Error
  rmse: number; // Root Mean Square Error
  accuracy: number; // 0-100 score (100 - MAPE)
  evaluationDate: string;
  createdAt: string;
}

// Accuracy Metrics Summary
export interface AccuracyMetricsSummary {
  avgAccuracy: number; // 0-100 score
  avgMAPE: number; // percentage
  avgMAE: number;
  avgRMSE: number;
  totalForecasts: number;
  accuracyTrend: 'IMPROVING' | 'DECLINING' | 'STABLE';
  period: {
    startDate: string;
    endDate: string;
  };
}

// Forecast Daily Prediction (for charts)
export interface DailyForecastPrediction {
  date: string;
  predictedDemand: number;
  confidence: number;
  lowerBound: number; // confidence interval lower
  upperBound: number; // confidence interval upper
}

// Forecast Chart Data
export interface ForecastChartData {
  productId: string;
  variantId: string;
  historicalDemand: Array<{ date: string; demand: number }>;
  predictions: DailyForecastPrediction[];
  reorderPoint: number;
  currentStock: number;
}
