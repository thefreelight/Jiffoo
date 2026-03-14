import {
  createTypedCrudResponses,
  createTypedReadResponses,
  createTypedUpdateResponses,
  createPageResultSchema,
} from '@/types/common-dto';

const trendAnalysisSchema = {
  type: 'object',
  properties: {
    dailyAverage: { type: 'number' },
    weeklyAverage: { type: 'number' },
    monthlyAverage: { type: 'number' },
    growthRate: { type: 'number' },
    trend: { type: 'string', enum: ['INCREASING', 'DECREASING', 'STABLE'] },
    volatility: { type: 'number' },
    confidence: { type: 'number' },
  },
  required: ['dailyAverage', 'weeklyAverage', 'monthlyAverage', 'growthRate', 'trend', 'volatility', 'confidence'],
} as const;

const reorderPointSchema = {
  type: 'object',
  properties: {
    reorderPoint: { type: 'number' },
    safetyStock: { type: 'number' },
    averageDailyDemand: { type: 'number' },
    leadTime: { type: 'number' },
    maxDailyDemand: { type: 'number' },
    daysUntilStockout: { type: 'number', nullable: true },
    recommendedOrderQuantity: { type: 'number' },
  },
  required: [
    'reorderPoint',
    'safetyStock',
    'averageDailyDemand',
    'leadTime',
    'maxDailyDemand',
    'daysUntilStockout',
    'recommendedOrderQuantity',
  ],
} as const;

const seasonalFactorsSchema = {
  type: 'object',
  nullable: true,
  properties: {
    weeklyPattern: { type: 'array', items: { type: 'number' } },
    monthlyPattern: { type: 'array', items: { type: 'number' } },
    dayOfWeekMultipliers: { type: 'object', additionalProperties: { type: 'number' } },
    holidayImpact: { type: 'object', nullable: true, additionalProperties: { type: 'number' } },
  },
} as const;

const forecastResultSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    productId: { type: 'string' },
    variantId: { type: 'string' },
    forecastDate: { type: 'string', format: 'date-time' },
    predictedDemand: { type: 'number' },
    confidence: { type: 'number' },
    method: { type: 'string', enum: ['MOVING_AVERAGE', 'LINEAR_REGRESSION', 'SEASONAL_DECOMPOSITION'] },
    seasonalFactors: seasonalFactorsSchema,
    trendAnalysis: trendAnalysisSchema,
    reorderPoint: reorderPointSchema,
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: [
    'id',
    'productId',
    'variantId',
    'forecastDate',
    'predictedDemand',
    'confidence',
    'method',
    'seasonalFactors',
    'trendAnalysis',
    'reorderPoint',
    'createdAt',
    'updatedAt',
  ],
} as const;

const alertItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    productId: { type: 'string' },
    variantId: { type: 'string' },
    alertType: { type: 'string', enum: ['STOCKOUT_RISK', 'OVERSTOCK', 'REORDER_POINT'] },
    severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
    status: { type: 'string', enum: ['ACTIVE', 'DISMISSED', 'RESOLVED'] },
    message: { type: 'string' },
    threshold: { type: 'number', nullable: true },
    currentStock: { type: 'number' },
    recommendedOrder: { type: 'number', nullable: true },
    resolvedAt: { type: 'string', format: 'date-time', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    productName: { type: 'string', nullable: true },
    variantName: { type: 'string', nullable: true },
  },
  required: [
    'id',
    'productId',
    'variantId',
    'alertType',
    'severity',
    'status',
    'message',
    'threshold',
    'currentStock',
    'recommendedOrder',
    'resolvedAt',
    'createdAt',
    'updatedAt',
  ],
} as const;

const checkAlertsResultSchema = {
  type: 'object',
  properties: {
    alertsCreated: { type: 'number' },
    alertIds: { type: 'array', items: { type: 'string' } },
  },
  required: ['alertsCreated', 'alertIds'],
} as const;

const recomputeAllResultSchema = {
  type: 'object',
  properties: {
    totalProducts: { type: 'number' },
    totalSkus: { type: 'number' },
    processedSkus: { type: 'number' },
    forecastsGenerated: { type: 'number' },
    alertsCreated: { type: 'number' },
    failedSkus: { type: 'number' },
    errors: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          productId: { type: 'string' },
          variantId: { type: 'string' },
          skuCode: { type: 'string', nullable: true },
          message: { type: 'string' },
        },
        required: ['productId', 'variantId', 'skuCode', 'message'],
      },
    },
  },
  required: ['totalProducts', 'totalSkus', 'processedSkus', 'forecastsGenerated', 'alertsCreated', 'failedSkus', 'errors'],
} as const;

const accuracyRecordSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    forecastId: { type: 'string' },
    actualDemand: { type: 'number' },
    predictedDemand: { type: 'number' },
    mae: { type: 'number' },
    mape: { type: 'number' },
    rmse: { type: 'number' },
    accuracy: { type: 'number' },
    evaluationDate: { type: 'string', format: 'date-time' },
    createdAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'forecastId', 'actualDemand', 'predictedDemand', 'mae', 'mape', 'rmse', 'accuracy', 'evaluationDate', 'createdAt'],
} as const;

const accuracyMetricsSchema = {
  type: 'object',
  properties: {
    avgAccuracy: { type: 'number' },
    avgMAPE: { type: 'number' },
    avgMAE: { type: 'number' },
    avgRMSE: { type: 'number' },
    totalForecasts: { type: 'number' },
    accuracyTrend: { type: 'string', enum: ['IMPROVING', 'DECLINING', 'STABLE'] },
    period: {
      type: 'object',
      properties: {
        startDate: { type: 'string', format: 'date-time' },
        endDate: { type: 'string', format: 'date-time' },
      },
      required: ['startDate', 'endDate'],
    },
  },
  required: ['avgAccuracy', 'avgMAPE', 'avgMAE', 'avgRMSE', 'totalForecasts', 'accuracyTrend', 'period'],
} as const;

const inventoryDashboardSchema = {
  type: 'object',
  properties: {
    alerts: createPageResultSchema(alertItemSchema),
    context: {
      type: 'object',
      properties: {
        productId: { type: 'string', nullable: true },
        variantId: { type: 'string', nullable: true },
      },
      required: ['productId', 'variantId'],
    },
    accuracy: {
      ...accuracyMetricsSchema,
      nullable: true,
    },
    latestForecast: {
      ...forecastResultSchema,
      nullable: true,
    },
  },
  required: ['alerts', 'context', 'accuracy', 'latestForecast'],
} as const;

const inventoryStatsSchema = {
  type: 'object',
  properties: {
    metrics: {
      type: 'object',
      properties: {
        totalAlerts: { type: 'number' },
        stockoutRisks: { type: 'number' },
        overstockItems: { type: 'number' },
        avgAccuracy: { type: 'number' },
        totalAlertsTrend: { type: 'number' },
        stockoutRisksTrend: { type: 'number' },
        overstockItemsTrend: { type: 'number' },
        avgAccuracyTrend: { type: 'number' },
      },
      required: [
        'totalAlerts',
        'stockoutRisks',
        'overstockItems',
        'avgAccuracy',
        'totalAlertsTrend',
        'stockoutRisksTrend',
        'overstockItemsTrend',
        'avgAccuracyTrend',
      ],
    },
  },
  required: ['metrics'],
} as const;

export const forecastingSchemas = {
  getDashboard: {
    response: createTypedReadResponses(inventoryDashboardSchema),
  },
  getStats: {
    response: createTypedReadResponses(inventoryStatsSchema),
  },
  getForecast: {
    response: createTypedReadResponses(forecastResultSchema),
  },
  generateForecast: {
    response: createTypedCrudResponses(forecastResultSchema),
  },
  listForecasts: {
    response: createTypedReadResponses(createPageResultSchema(forecastResultSchema)),
  },
  listAlerts: {
    response: createTypedReadResponses(createPageResultSchema(alertItemSchema)),
  },
  getAlert: {
    response: createTypedReadResponses(alertItemSchema),
  },
  checkAlerts: {
    response: createTypedCrudResponses(checkAlertsResultSchema),
  },
  recomputeAll: {
    response: createTypedCrudResponses(recomputeAllResultSchema),
  },
  dismissAlert: {
    response: createTypedUpdateResponses(alertItemSchema),
  },
  resolveAlert: {
    response: createTypedUpdateResponses(alertItemSchema),
  },
  updateAlertStatus: {
    response: createTypedUpdateResponses(alertItemSchema),
  },
  getAccuracyMetrics: {
    response: createTypedReadResponses(accuracyMetricsSchema),
  },
  recordAccuracy: {
    response: createTypedCrudResponses(accuracyRecordSchema),
  },
} as const;
