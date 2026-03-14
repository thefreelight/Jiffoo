// @ts-nocheck
/**
 * Recommendation Service
 *
 * Orchestrates recommendation engines and provides unified API for
 * product recommendations, interaction tracking, and analytics.
 */

import { prisma } from '@/config/database';
import { LoggerService } from '@/core/logger/unified-logger';
import { isMissingDatabaseObjectError } from '@/utils/prisma-errors';
import { CollaborativeFilteringEngine } from './engines/collaborative-filtering';
import { FrequentlyBoughtTogetherEngine } from './engines/frequently-bought-together';
import { PersonalizedRecommendationEngine } from './engines/personalized';
import {
  RecommendationTypeEnum,
  InteractionActionEnum,
  type GetRecommendationsRequest,
  type TrackInteractionRequest,
  type CreateRecommendationConfigRequest,
  type UpdateRecommendationConfigRequest,
  type RecommendationsResponse,
  type InteractionResponse,
  type RecommendationConfigResponse,
  type AnalyticsResponse,
} from './types';

const RECOMMENDATION_INFRA_TABLES = [
  'recommendation_configs',
  'recommendation_interactions',
  'product_affinities',
];
const loggedRecommendationFallbacks = new Set<string>();

export class RecommendationService {
  /**
   * Helper to get prisma client with safety check
   */
  private static getPrisma() {
    if (!prisma) {
      console.error('[RecommendationService] prisma client is UNDEFINED!');
      throw new Error('Database client not initialized');
    }
    return prisma;
  }

  private static isRecommendationInfraMissing(error: unknown): boolean {
    return isMissingDatabaseObjectError(error, RECOMMENDATION_INFRA_TABLES);
  }

  private static logRecommendationFallback(
    context: string,
    error: unknown,
    details?: Record<string, unknown>
  ): void {
    if (loggedRecommendationFallbacks.has(context)) {
      return;
    }
    loggedRecommendationFallbacks.add(context);

    LoggerService.log('warn', 'Recommendation infrastructure unavailable; returning fallback result', {
      context,
      ...(details || {}),
      error: error instanceof Error ? error.message : String(error),
    });
  }

  private static createEmptyResponse(
    recommendationType: typeof RecommendationTypeEnum[keyof typeof RecommendationTypeEnum]
  ): RecommendationsResponse {
    return {
      recommendations: [],
      recommendationType,
      totalCount: 0,
    };
  }

  /**
   * Get 'customers also bought' recommendations for a product
   */
  static async getCustomersAlsoBought(
    productId: string,
    options: {
      limit?: number;
      excludeProductIds?: string[];
      locale?: string;
    } = {}
  ): Promise<RecommendationsResponse> {
    const { limit = 10, excludeProductIds = [], locale } = options;

    try {
      // Get active A/B test config for this recommendation type
      const config = await RecommendationService.getActiveConfig(RecommendationTypeEnum.CUSTOMERS_ALSO_BOUGHT);

      // Get recommendations from collaborative filtering engine
      const recommendations = await CollaborativeFilteringEngine.getRecommendations({
        productId,
        limit,
        excludeProductIds,
        locale,
      });

      return {
        recommendations,
        recommendationType: RecommendationTypeEnum.CUSTOMERS_ALSO_BOUGHT,
        algorithmVariant: config?.algorithm,
        totalCount: recommendations.length,
      };
    } catch (error) {
      if (RecommendationService.isRecommendationInfraMissing(error)) {
        RecommendationService.logRecommendationFallback(
          'RecommendationService.getCustomersAlsoBought',
          error,
          { productId }
        );
        return RecommendationService.createEmptyResponse(RecommendationTypeEnum.CUSTOMERS_ALSO_BOUGHT);
      }

      throw error;
    }
  }

  /**
   * Get frequently bought together recommendations
   * Based on products currently in cart or being viewed together
   */
  static async getFrequentlyBoughtTogether(
    productIds: string[],
    options: {
      limit?: number;
      excludeProductIds?: string[];
      locale?: string;
    } = {}
  ): Promise<RecommendationsResponse> {
    const { limit = 5, excludeProductIds = [], locale } = options;

    try {
      // Get active A/B test config
      const config = await RecommendationService.getActiveConfig(
        RecommendationTypeEnum.FREQUENTLY_BOUGHT_TOGETHER
      );

      // Get recommendations from frequently bought together engine
      const recommendations = await FrequentlyBoughtTogetherEngine.getRecommendations({
        productIds,
        limit,
        excludeProductIds,
        locale,
      });

      return {
        recommendations,
        recommendationType: RecommendationTypeEnum.FREQUENTLY_BOUGHT_TOGETHER,
        algorithmVariant: config?.algorithm,
        totalCount: recommendations.length,
      };
    } catch (error) {
      if (RecommendationService.isRecommendationInfraMissing(error)) {
        RecommendationService.logRecommendationFallback(
          'RecommendationService.getFrequentlyBoughtTogether',
          error,
          { productIds }
        );
        return RecommendationService.createEmptyResponse(
          RecommendationTypeEnum.FREQUENTLY_BOUGHT_TOGETHER
        );
      }

      throw error;
    }
  }

  /**
   * Get personalized recommendations for a user
   * Based on purchase history, browsing behavior, and preferences
   */
  static async getPersonalizedRecommendations(
    options: {
      userId?: string;
      sessionId?: string;
      limit?: number;
      excludeProductIds?: string[];
      locale?: string;
    }
  ): Promise<RecommendationsResponse> {
    const { userId, sessionId, limit = 10, excludeProductIds = [], locale } = options;

    console.log('[RecommendationService] getPersonalizedRecommendations called with:', { userId, sessionId, limit });

    try {
      // Get active A/B test config
      console.log('[RecommendationService] Calling getActiveConfig...');
      const config = await RecommendationService.getActiveConfig(RecommendationTypeEnum.PERSONALIZED);
      console.log('[RecommendationService] Active config:', config);

      // Get recommendations from personalized engine
      console.log('[RecommendationService] Calling PersonalizedRecommendationEngine.getRecommendations...');
      const recommendations = await PersonalizedRecommendationEngine.getRecommendations({
        userId,
        sessionId,
        limit,
        excludeProductIds,
        locale,
      });
      console.log('[RecommendationService] Recommendations count:', recommendations.length);

      return {
        recommendations,
        recommendationType: RecommendationTypeEnum.PERSONALIZED,
        algorithmVariant: config?.algorithm,
        totalCount: recommendations.length,
      };
    } catch (error: any) {
      if (RecommendationService.isRecommendationInfraMissing(error)) {
        RecommendationService.logRecommendationFallback(
          'RecommendationService.getPersonalizedRecommendations',
          error,
          { userId, sessionId }
        );
        return RecommendationService.createEmptyResponse(RecommendationTypeEnum.PERSONALIZED);
      }

      console.error('[RecommendationService] Error in getPersonalizedRecommendations:', error);
      throw error;
    }
  }

  /**
   * Get homepage recommendations for a user
   */
  static async getHomepageRecommendations(
    userId: string,
    options: {
      limit?: number;
      locale?: string;
    } = {}
  ): Promise<RecommendationsResponse> {
    try {
      const recommendations = await PersonalizedRecommendationEngine.getRecommendations({
        userId,
        limit: options.limit || 8,
        locale: options.locale,
      });

      return {
        recommendations,
        recommendationType: RecommendationTypeEnum.PERSONALIZED,
        totalCount: recommendations.length,
      };
    } catch (error) {
      if (RecommendationService.isRecommendationInfraMissing(error)) {
        RecommendationService.logRecommendationFallback(
          'RecommendationService.getHomepageRecommendations',
          error,
          { userId }
        );
        return RecommendationService.createEmptyResponse(RecommendationTypeEnum.PERSONALIZED);
      }

      throw error;
    }
  }

  /**
   * Get email recommendations for a user
   */
  static async getEmailRecommendations(
    userId: string,
    options: {
      limit?: number;
      locale?: string;
    } = {}
  ): Promise<RecommendationsResponse> {
    const recommendations = await PersonalizedRecommendationEngine.getEmailRecommendations(
      userId,
      options
    );

    return {
      recommendations,
      recommendationType: RecommendationTypeEnum.PERSONALIZED,
      totalCount: recommendations.length,
    };
  }

  /**
   * Track user interaction with recommendations
   */
  static async trackInteraction(
    data: TrackInteractionRequest
  ): Promise<InteractionResponse> {
    const {
      userId,
      productId,
      sessionId,
      recommendationType,
      action,
      sourceProductId,
      sourceContext,
      algorithmVariant,
    } = data;

    // Create interaction record
    const interaction = await prisma.recommendationInteraction.create({
      data: {
        userId,
        productId,
        sessionId,
        recommendationType,
        action,
        sourceProductId,
        sourceContext,
        algorithmVariant,
      },
    });

    return {
      id: interaction.id,
      userId: interaction.userId || undefined,
      productId: interaction.productId,
      sessionId: interaction.sessionId,
      recommendationType: interaction.recommendationType as typeof RecommendationTypeEnum[keyof typeof RecommendationTypeEnum],
      action: interaction.action as typeof InteractionActionEnum[keyof typeof InteractionActionEnum],
      sourceProductId: interaction.sourceProductId || undefined,
      sourceContext: interaction.sourceContext || undefined,
      algorithmVariant: interaction.algorithmVariant || undefined,
      createdAt: interaction.createdAt,
    };
  }

  /**
   * Compute product affinities from order history
   * Should be called by background jobs periodically
   */
  static async computeAffinities(options: {
    minCoOccurrences?: number;
    batchSize?: number;
  } = {}): Promise<{ processed: number; created: number; updated: number }> {
    return CollaborativeFilteringEngine.computeAffinities(options);
  }

  /**
   * Get recommendation analytics
   */
  static async getAnalytics(
    startDate: Date,
    endDate: Date
  ): Promise<AnalyticsResponse> {
    // Get all interactions in date range
    const interactions = await prisma.recommendationInteraction.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Calculate overall metrics
    const impressions = interactions.filter(
      (i) => i.action === InteractionActionEnum.VIEW
    ).length;
    const clicks = interactions.filter(
      (i) => i.action === InteractionActionEnum.CLICK
    ).length;
    const conversions = interactions.filter(
      (i) => i.action === InteractionActionEnum.PURCHASE
    ).length;
    const clickThroughRate = impressions > 0 ? clicks / impressions : 0;
    const conversionRate = clicks > 0 ? conversions / clicks : 0;

    // Calculate revenue from purchases
    const purchaseInteractions = interactions.filter(
      (i) => i.action === InteractionActionEnum.PURCHASE
    );
    const productIds = purchaseInteractions.map((i) => i.productId);

    let revenue = 0;
    if (productIds.length > 0) {
      // Get order items for these products in the date range
      const orderItems = await prisma.orderItem.findMany({
        where: {
          productId: { in: productIds },
          order: {
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
            status: 'COMPLETED',
            paymentStatus: 'PAID',
          },
        },
        select: {
          unitPrice: true,
          quantity: true,
        },
      });

      revenue = orderItems.reduce(
        (sum, item) => sum + Number(item.unitPrice) * item.quantity,
        0
      );
    }

    // Calculate metrics by recommendation type
    const byTypeMap = new Map<
      string,
      {
        impressions: number;
        clicks: number;
        conversions: number;
        revenue: number;
        algorithmVariant?: string;
      }
    >();

    for (const interaction of interactions) {
      const key = interaction.recommendationType;
      const existing = byTypeMap.get(key) || {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        revenue: 0,
      };

      if (interaction.action === InteractionActionEnum.VIEW) {
        existing.impressions += 1;
      } else if (interaction.action === InteractionActionEnum.CLICK) {
        existing.clicks += 1;
      } else if (interaction.action === InteractionActionEnum.PURCHASE) {
        existing.conversions += 1;
      }

      byTypeMap.set(key, existing);
    }

    const byType = Array.from(byTypeMap.entries()).map(([type, metrics]) => ({
      recommendationType: type as typeof RecommendationTypeEnum[keyof typeof RecommendationTypeEnum],
      algorithmVariant: metrics.algorithmVariant,
      metrics: {
        ...metrics,
        clickThroughRate:
          metrics.impressions > 0 ? metrics.clicks / metrics.impressions : 0,
        conversionRate: metrics.clicks > 0 ? metrics.conversions / metrics.clicks : 0,
      },
      period: {
        startDate,
        endDate,
      },
    }));

    // Get top performing products
    const productPerformance = new Map<
      string,
      { clicks: number; conversions: number; revenue: number }
    >();

    for (const interaction of interactions) {
      if (
        interaction.action === InteractionActionEnum.CLICK ||
        interaction.action === InteractionActionEnum.PURCHASE
      ) {
        const productId = interaction.productId;
        const existing = productPerformance.get(productId) || {
          clicks: 0,
          conversions: 0,
          revenue: 0,
        };

        if (interaction.action === InteractionActionEnum.CLICK) {
          existing.clicks += 1;
        } else if (interaction.action === InteractionActionEnum.PURCHASE) {
          existing.conversions += 1;
        }

        productPerformance.set(productId, existing);
      }
    }

    const topPerformingProducts = Array.from(productPerformance.entries())
      .map(([productId, performance]) => {
        const interaction = interactions.find((i) => i.productId === productId);
        return {
          productId,
          productName: interaction?.product?.name || 'Unknown',
          ...performance,
        };
      })
      .sort((a, b) => b.conversions - a.conversions)
      .slice(0, 10);

    return {
      overall: {
        impressions,
        clicks,
        conversions,
        clickThroughRate,
        conversionRate,
        revenue,
      },
      byType,
      topPerformingProducts,
    };
  }

  /**
   * Create A/B testing configuration
   */
  static async createConfig(
    data: CreateRecommendationConfigRequest
  ): Promise<RecommendationConfigResponse> {
    const config = await prisma.recommendationConfig.create({
      data: {
        name: data.name,
        recommendationType: data.recommendationType,
        algorithm: data.algorithm,
        isActive: data.isActive ?? true,
        trafficPercentage: data.trafficPercentage ?? 100,
        priority: data.priority ?? 0,
        parameters: data.parameters ? JSON.stringify(data.parameters) : null,
      },
    });

    return {
      id: config.id,
      name: config.name,
      recommendationType: config.recommendationType as typeof RecommendationTypeEnum[keyof typeof RecommendationTypeEnum],
      algorithm: config.algorithm,
      isActive: config.isActive,
      trafficPercentage: config.trafficPercentage,
      priority: config.priority,
      parameters: config.parameters ? JSON.parse(config.parameters) : undefined,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  /**
   * Update A/B testing configuration
   */
  static async updateConfig(
    configId: string,
    data: UpdateRecommendationConfigRequest
  ): Promise<RecommendationConfigResponse> {
    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.algorithm !== undefined) updateData.algorithm = data.algorithm;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.trafficPercentage !== undefined)
      updateData.trafficPercentage = data.trafficPercentage;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.parameters !== undefined)
      updateData.parameters = JSON.stringify(data.parameters);

    const config = await prisma.recommendationConfig.update({
      where: { id: configId },
      data: updateData,
    });

    return {
      id: config.id,
      name: config.name,
      recommendationType: config.recommendationType as typeof RecommendationTypeEnum[keyof typeof RecommendationTypeEnum],
      algorithm: config.algorithm,
      isActive: config.isActive,
      trafficPercentage: config.trafficPercentage,
      priority: config.priority,
      parameters: config.parameters ? JSON.parse(config.parameters) : undefined,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  /**
   * Get all recommendation configurations
   */
  static async getConfigs(
    recommendationType?: string
  ): Promise<RecommendationConfigResponse[]> {
    const configs = await prisma.recommendationConfig.findMany({
      where: recommendationType ? { recommendationType } : undefined,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    return configs.map((config) => ({
      id: config.id,
      name: config.name,
      recommendationType: config.recommendationType as typeof RecommendationTypeEnum[keyof typeof RecommendationTypeEnum],
      algorithm: config.algorithm,
      isActive: config.isActive,
      trafficPercentage: config.trafficPercentage,
      priority: config.priority,
      parameters: config.parameters ? JSON.parse(config.parameters) : undefined,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    }));
  }

  /**
   * Delete a recommendation configuration
   */
  static async deleteConfig(configId: string): Promise<void> {
    await prisma.recommendationConfig.delete({
      where: { id: configId },
    });
  }

  /**
   * Get active configuration for a recommendation type
   * Used for A/B testing - returns the highest priority active config
   */
  private static async getActiveConfig(
    recommendationType: string
  ): Promise<RecommendationConfigResponse | null> {
    let config;
    try {
      config = await RecommendationService.getPrisma().recommendationConfig.findFirst({
        where: {
          recommendationType,
          isActive: true,
        },
        orderBy: {
          priority: 'desc',
        },
      });
    } catch (error) {
      if (isMissingDatabaseObjectError(error, ['recommendation_configs'])) {
        RecommendationService.logRecommendationFallback(
          'RecommendationService.getActiveConfig',
          error,
          { recommendationType }
        );
        return null;
      }

      throw error;
    }

    if (!config) {
      return null;
    }

    return {
      id: config.id,
      name: config.name,
      recommendationType: config.recommendationType as typeof RecommendationTypeEnum[keyof typeof RecommendationTypeEnum],
      algorithm: config.algorithm,
      isActive: config.isActive,
      trafficPercentage: config.trafficPercentage,
      priority: config.priority,
      parameters: config.parameters ? JSON.parse(config.parameters) : undefined,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  /**
   * Export user recommendation data (GDPR compliance)
   */
  static async exportUserData(userId: string): Promise<{
    interactions: any[];
    metadata: {
      totalInteractions: number;
      dateRange: { earliest: Date | null; latest: Date | null };
    };
  }> {
    const interactions = await prisma.recommendationInteraction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const earliest =
      interactions.length > 0
        ? interactions[interactions.length - 1].createdAt
        : null;
    const latest = interactions.length > 0 ? interactions[0].createdAt : null;

    return {
      interactions: interactions.map((i) => ({
        id: i.id,
        productId: i.productId,
        productName: i.product?.name,
        recommendationType: i.recommendationType,
        action: i.action,
        sourceProductId: i.sourceProductId,
        sourceContext: i.sourceContext,
        createdAt: i.createdAt,
      })),
      metadata: {
        totalInteractions: interactions.length,
        dateRange: { earliest, latest },
      },
    };
  }

  /**
   * Delete user recommendation data (GDPR right to be forgotten)
   */
  static async deleteUserData(userId: string): Promise<{ deleted: number }> {
    const result = await prisma.recommendationInteraction.deleteMany({
      where: { userId },
    });

    return {
      deleted: result.count,
    };
  }
}
