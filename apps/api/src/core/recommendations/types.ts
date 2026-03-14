import { z } from 'zod';

// Recommendation type enums
export const RecommendationTypeEnum = {
  CUSTOMERS_ALSO_BOUGHT: 'customers-also-bought',
  FREQUENTLY_BOUGHT_TOGETHER: 'frequently-bought-together',
  PERSONALIZED: 'personalized',
} as const;

export type RecommendationType = typeof RecommendationTypeEnum[keyof typeof RecommendationTypeEnum];

export const InteractionActionEnum = {
  VIEW: 'view',
  CLICK: 'click',
  ADD_TO_CART: 'add-to-cart',
  PURCHASE: 'purchase',
} as const;

export type InteractionAction = typeof InteractionActionEnum[keyof typeof InteractionActionEnum];

export const AffinityTypeEnum = {
  CO_PURCHASE: 'co-purchase',
  CROSS_CATEGORY: 'cross-category',
  SEQUENTIAL: 'sequential',
  SIMILAR: 'similar',
} as const;

export type AffinityType = typeof AffinityTypeEnum[keyof typeof AffinityTypeEnum];

// Request schemas
export const GetRecommendationsSchema = z.object({
  productId: z.string().optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  limit: z.number().int().positive().max(50).default(10),
  excludeProductIds: z.array(z.string()).optional(),
});

export const TrackInteractionSchema = z.object({
  userId: z.string().optional(),
  productId: z.string().min(1, 'Product ID is required'),
  sessionId: z.string().min(1, 'Session ID is required'),
  recommendationType: z.enum([
    RecommendationTypeEnum.CUSTOMERS_ALSO_BOUGHT,
    RecommendationTypeEnum.FREQUENTLY_BOUGHT_TOGETHER,
    RecommendationTypeEnum.PERSONALIZED,
  ]),
  action: z.enum([
    InteractionActionEnum.VIEW,
    InteractionActionEnum.CLICK,
    InteractionActionEnum.ADD_TO_CART,
    InteractionActionEnum.PURCHASE,
  ]),
  sourceProductId: z.string().optional(),
  sourceContext: z.string().optional(),
  algorithmVariant: z.string().optional(),
});

export const CreateRecommendationConfigSchema = z.object({
  name: z.string().min(1, 'Config name is required'),
  recommendationType: z.enum([
    RecommendationTypeEnum.CUSTOMERS_ALSO_BOUGHT,
    RecommendationTypeEnum.FREQUENTLY_BOUGHT_TOGETHER,
    RecommendationTypeEnum.PERSONALIZED,
  ]),
  algorithm: z.string().min(1, 'Algorithm identifier is required'),
  isActive: z.boolean().default(true),
  trafficPercentage: z.number().min(0).max(100).default(100),
  priority: z.number().int().default(0),
  parameters: z.record(z.any()).optional(),
});

export const UpdateRecommendationConfigSchema = z.object({
  name: z.string().min(1).optional(),
  algorithm: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  trafficPercentage: z.number().min(0).max(100).optional(),
  priority: z.number().int().optional(),
  parameters: z.record(z.any()).optional(),
});

// Request types
export type GetRecommendationsRequest = z.infer<typeof GetRecommendationsSchema>;
export type TrackInteractionRequest = z.infer<typeof TrackInteractionSchema>;
export type CreateRecommendationConfigRequest = z.infer<typeof CreateRecommendationConfigSchema>;
export type UpdateRecommendationConfigRequest = z.infer<typeof UpdateRecommendationConfigSchema>;

// Response interfaces
export interface RecommendedProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  images: string;
  score: number; // Recommendation confidence score (0-1)
  reason?: string; // Why this was recommended
}

export interface RecommendationsResponse {
  recommendations: RecommendedProduct[];
  recommendationType: RecommendationType;
  algorithmVariant?: string;
  totalCount: number;
}

export interface InteractionResponse {
  id: string;
  userId?: string;
  productId: string;
  sessionId: string;
  recommendationType: RecommendationType;
  action: InteractionAction;
  sourceProductId?: string;
  sourceContext?: string;
  algorithmVariant?: string;
  createdAt: Date;
}

export interface RecommendationConfigResponse {
  id: string;
  name: string;
  recommendationType: RecommendationType;
  algorithm: string;
  isActive: boolean;
  trafficPercentage: number;
  priority: number;
  parameters?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductAffinityResponse {
  id: string;
  productAId: string;
  productBId: string;
  affinityScore: number;
  coOccurrences: number;
  confidenceScore?: number;
  affinityType: AffinityType;
  lastUpdated: Date;
}

export interface RecommendationAnalytics {
  recommendationType: RecommendationType;
  algorithmVariant?: string;
  metrics: {
    impressions: number;
    clicks: number;
    conversions: number;
    clickThroughRate: number;
    conversionRate: number;
    revenue: number;
  };
  period: {
    startDate: Date;
    endDate: Date;
  };
}

export interface AnalyticsResponse {
  overall: RecommendationAnalytics['metrics'];
  byType: RecommendationAnalytics[];
  topPerformingProducts: Array<{
    productId: string;
    productName: string;
    clicks: number;
    conversions: number;
    revenue: number;
  }>;
}
