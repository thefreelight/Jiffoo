/**
 * Recommendations Service - Shop Application
 *
 * Service layer for AI-powered product recommendation operations.
 * Provides customers-also-bought, frequently-bought-together, and personalized recommendations.
 *
 * 🤖 AI-Powered Recommendations:
 * - Collaborative filtering for "customers also bought"
 * - Bundle suggestions for "frequently bought together"
 * - Personalized recommendations based on user behavior
 */

import { apiClient } from '@/lib/api';
import type { ApiResponse } from 'shared';

// Recommendation Types
export type RecommendationType = 'customers-also-bought' | 'frequently-bought-together' | 'personalized';

export type InteractionAction = 'view' | 'click' | 'add-to-cart' | 'purchase';

export interface RecommendedProduct {
  productId: string;
  name: string;
  slug: string;
  price: number;
  imageUrl?: string;
  stock: number;
  score: number;
  reason?: string;
}

export interface RecommendationsResponse {
  type: RecommendationType;
  products: RecommendedProduct[];
  totalCount: number;
  metadata?: {
    algorithmVariant?: string;
    processingTimeMs?: number;
  };
}

export interface TrackInteractionRequest {
  userId?: string;
  sessionId?: string;
  productId: string;
  action: InteractionAction;
  recommendationType?: RecommendationType;
  sourceProductId?: string;
  algorithmVariant?: string;
}

export interface AnalyticsData {
  type: RecommendationType;
  impressions: number;
  clicks: number;
  conversions: number;
  clickThroughRate: number;
  conversionRate: number;
  revenue: number;
  topProducts: Array<{
    productId: string;
    productName: string;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
  }>;
}

export interface AnalyticsResponse {
  dateRange: {
    start: string;
    end: string;
  };
  overall: {
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    totalRevenue: number;
    averageCTR: number;
    averageConversionRate: number;
  };
  byType: AnalyticsData[];
}

/**
 * RecommendationsService - High-level service for recommendation operations
 */
// Normalize API response: backend uses 'recommendations'/'recommendationType',
// but our type uses 'products'/'type'
function normalizeResponse(raw: any): RecommendationsResponse {
  return {
    type: raw.type || raw.recommendationType || 'personalized',
    products: raw.products || raw.recommendations || [],
    totalCount: raw.totalCount ?? 0,
    metadata: raw.metadata,
  };
}

export const RecommendationsService = {
  /**
   * Get "customers also bought" recommendations for a product
   * @param productId - Product ID to get recommendations for
   * @param limit - Maximum number of recommendations (default: 8)
   * @param excludeProductIds - Product IDs to exclude from recommendations
   */
  async getCustomersAlsoBought(
    productId: string,
    limit = 8,
    excludeProductIds: string[] = []
  ): Promise<RecommendationsResponse> {
    const response: ApiResponse<RecommendationsResponse> = await apiClient.get(
      '/recommendations/customers-also-bought',
      {
        params: {
          productId,
          limit,
          excludeProductIds: excludeProductIds.length > 0 ? excludeProductIds.join(',') : undefined,
        },
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch recommendations');
    }

    return normalizeResponse(response.data);
  },

  /**
   * Get frequently bought together recommendations for cart items
   * @param productIds - Array of product IDs currently in cart
   * @param limit - Maximum number of recommendations (default: 4)
   * @param excludeProductIds - Product IDs to exclude from recommendations
   */
  async getFrequentlyBoughtTogether(
    productIds: string[],
    limit = 4,
    excludeProductIds: string[] = []
  ): Promise<RecommendationsResponse> {
    const response: ApiResponse<RecommendationsResponse> = await apiClient.get(
      '/recommendations/frequently-bought-together',
      {
        params: {
          productIds: productIds.join(','),
          limit,
          excludeProductIds: excludeProductIds.length > 0 ? excludeProductIds.join(',') : undefined,
        },
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch recommendations');
    }

    return normalizeResponse(response.data);
  },

  /**
   * Get personalized recommendations for a user
   * @param userId - User ID (optional, uses session if not provided)
   * @param sessionId - Session ID for anonymous users
   * @param limit - Maximum number of recommendations (default: 8)
   * @param excludeProductIds - Product IDs to exclude from recommendations
   */
  async getPersonalizedRecommendations(
    userId?: string,
    sessionId?: string,
    limit = 8,
    excludeProductIds: string[] = []
  ): Promise<RecommendationsResponse> {
    const response: ApiResponse<RecommendationsResponse> = await apiClient.get(
      '/recommendations/personalized',
      {
        params: {
          userId,
          sessionId,
          limit,
          excludeProductIds: excludeProductIds.length > 0 ? excludeProductIds.join(',') : undefined,
        },
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch recommendations');
    }

    return normalizeResponse(response.data);
  },

  /**
   * Get homepage recommendations (optimized for homepage display)
   * @param userId - User ID (optional)
   * @param sessionId - Session ID for anonymous users
   * @param limit - Maximum number of recommendations (default: 8)
   */
  async getHomepageRecommendations(
    userId?: string,
    sessionId?: string,
    limit = 8
  ): Promise<RecommendationsResponse> {
    const response: ApiResponse<RecommendationsResponse> = await apiClient.get(
      '/recommendations/personalized',
      {
        params: {
          userId,
          sessionId,
          limit,
        },
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch recommendations');
    }

    return normalizeResponse(response.data);
  },

  /**
   * Track user interaction with recommendations
   * @param interaction - Interaction data including user, product, and action
   */
  async trackInteraction(interaction: TrackInteractionRequest): Promise<void> {
    const response: ApiResponse<{ success: boolean }> = await apiClient.post(
      '/recommendations/track-interaction',
      interaction
    );

    if (!response.success) {
      // Log error but don't throw - tracking failures shouldn't break user experience
      console.error('Failed to track recommendation interaction:', response.error?.message);
    }
  },

  /**
   * Get recommendation analytics
   * @param startDate - Start date for analytics period (ISO string)
   * @param endDate - End date for analytics period (ISO string)
   * @param type - Optional filter by recommendation type
   */
  async getAnalytics(
    startDate: string,
    endDate: string,
    type?: RecommendationType
  ): Promise<AnalyticsResponse> {
    const response: ApiResponse<AnalyticsResponse> = await apiClient.get(
      '/recommendations/analytics',
      {
        params: {
          startDate,
          endDate,
          type,
        },
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch analytics');
    }

    return response.data;
  },
};

export default RecommendationsService;
