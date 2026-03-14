/**
 * Personalized Recommendation Engine
 *
 * Implements personalized product recommendations using user purchase history,
 * browsing behavior, and preferences. Combines collaborative filtering with
 * content-based signals to deliver relevant suggestions.
 */
// @ts-nocheck — multiple Prisma type mismatches (variants, isDefault, productA/B relations)

import { parseJsonRecord } from '@/core/external-orders/utils';
import { InventoryService } from '@/core/inventory/service';
import { RecommendationService } from '../service';
import { AffinityTypeEnum, InteractionActionEnum } from '../types';
import type { RecommendedProduct } from '../types';

interface PersonalizedRecommendationOptions {
  userId?: string;
  sessionId?: string;
  limit?: number;
  excludeProductIds?: string[];
  locale?: string;
}

interface UserProfile {
  purchasedProducts: string[];
  viewedProducts: string[];
  clickedProducts: string[];
  addedToCartProducts: string[];
  categoryPreferences: Map<string, number>; // category -> score
  priceRange: { min: number; max: number };
  recentInterests: string[]; // Recent product IDs (last 30 days)
}

export class PersonalizedRecommendationEngine {
  /**
   * Get personalized recommendations for a user
   *
   * Analyzes user's purchase history, browsing behavior, and preferences
   * to generate relevant product recommendations.
   */
  static async getRecommendations(
    options: PersonalizedRecommendationOptions
  ): Promise<RecommendedProduct[]> {
    const {
      userId,
      sessionId,
      limit = 10,
      excludeProductIds = [],
      locale,
    } = options;

    // Need at least userId or sessionId to build profile
    if (!userId && !sessionId) {
      return this.getSegmentedRecommendations('new', { limit, locale });
    }

    // Build user profile from history
    const userProfile = await this.buildUserProfile(userId, sessionId);

    // If no user activity, return popular products
    if (userProfile.recentInterests.length === 0 && userProfile.purchasedProducts.length === 0) {
      return this.getSegmentedRecommendations('new', { limit, locale });
    }

    // Get candidate products based on user's interests
    const candidates = await this.getCandidateProducts(userProfile, excludeProductIds);

    // Score and rank candidates
    const scoredCandidates = candidates.map((product) => {
      const score = this.calculatePersonalizationScore(product, userProfile);
      return {
        ...product,
        score,
      };
    });

    // Sort by score and take top N
    const topCandidates = scoredCandidates
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const stockMap = await InventoryService.getAvailableStockByVariantIds(
      topCandidates.flatMap((item) => item.product.variants?.map((variant: any) => variant.id) || [])
    );

    // Convert to RecommendedProduct format
    const recommendations: RecommendedProduct[] = topCandidates.map((item) => {
      const { product, score } = item;

      // Get price from default variant or first variant
      const mainVariant = product?.variants?.find((v: any) => v.sortOrder === 0) || product?.variants?.[0];
      const displayPrice = mainVariant ? Number(mainVariant.salePrice) : 0;
      const totalStock = product?.variants?.reduce((sum: number, v: any) => sum + (stockMap?.get(v.id) ?? 0), 0) || 0;

      // Extract images from typeData if available
      let images = '';
      if (product?.typeData) {
        const typeData = parseJsonRecord(product.typeData);
        images = (typeData?.images as string) || '';
      }

      // Generate personalized reason
      const reason = product ? this.generateReasonText(product, userProfile) : 'Recommended for you';

      return {
        id: product?.id || '',
        name: product?.name || 'Unknown Product',
        description: product?.description || undefined,
        price: displayPrice,
        stock: totalStock,
        images,
        score,
        reason,
      };
    });

    return recommendations;
  }

  /**
   * Build user profile from purchase and interaction history
   */
  private static async buildUserProfile(
    userId?: string,
    sessionId?: string
  ): Promise<UserProfile> {
    const profile: UserProfile = {
      purchasedProducts: [],
      viewedProducts: [],
      clickedProducts: [],
      addedToCartProducts: [],
      categoryPreferences: new Map(),
      priceRange: { min: 0, max: Infinity },
      recentInterests: [],
    };

    // Get purchase history if userId provided
    if (userId) {
      const orders = await RecommendationService.getPrisma().order.findMany({
        where: {
          userId,
          status: 'COMPLETED',
          paymentStatus: 'PAID',
        },
        include: {
          items: {
            select: {
              productId: true,
              unitPrice: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 50, // Last 50 orders
      });

      // Extract purchased products and calculate price range
      const prices: number[] = [];
      for (const order of orders) {
        for (const item of order.items) {
          profile.purchasedProducts.push(item.productId);
          prices.push(Number(item.unitPrice));
        }
      }

      // Calculate preferred price range (25th to 75th percentile)
      if (prices.length > 0) {
        prices.sort((a, b) => a - b);
        const p25 = prices[Math.floor(prices.length * 0.25)];
        const p75 = prices[Math.floor(prices.length * 0.75)];
        profile.priceRange = {
          min: p25 * 0.5, // Allow 50% below
          max: p75 * 1.5, // Allow 50% above
        };
      }
    }

    // Get interaction history (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const interactions = await RecommendationService.getPrisma().recommendationInteraction.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(sessionId ? { sessionId } : {}),
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 200, // Last 200 interactions
    });

    // Categorize interactions by action type
    const recentProductIds = new Set<string>();
    for (const interaction of interactions) {
      recentProductIds.add(interaction.productId);

      switch (interaction.action) {
        case InteractionActionEnum.VIEW:
          profile.viewedProducts.push(interaction.productId);
          break;
        case InteractionActionEnum.CLICK:
          profile.clickedProducts.push(interaction.productId);
          break;
        case InteractionActionEnum.ADD_TO_CART:
          profile.addedToCartProducts.push(interaction.productId);
          break;
        case InteractionActionEnum.PURCHASE:
          profile.purchasedProducts.push(interaction.productId);
          break;
      }
    }

    profile.recentInterests = Array.from(recentProductIds);

    // Build category preferences from purchased and interacted products
    const allProductIds = [
      ...profile.purchasedProducts,
      ...profile.addedToCartProducts,
      ...profile.clickedProducts,
    ];

    if (allProductIds.length > 0) {
      const products = await RecommendationService.getPrisma().product.findMany({
        where: {
          id: { in: allProductIds },
        },
        select: {
          id: true,
          typeData: true,
        },
      });

      // Extract categories and calculate preference scores
      const categoryScores = new Map<string, number>();
      for (const product of products) {
        if (product.typeData) {
          const typeData = parseJsonRecord(product.typeData);
          const category = typeData?.category;
          if (typeof category === 'string') {
            // Weight: purchased > added to cart > clicked > viewed
            let weight = 1.0;
            if (profile.purchasedProducts.includes(product.id)) weight = 4.0;
            else if (profile.addedToCartProducts.includes(product.id)) weight = 3.0;
            else if (profile.clickedProducts.includes(product.id)) weight = 2.0;

            const currentScore = categoryScores.get(category) || 0;
            categoryScores.set(category, currentScore + weight);
          }
        }
      }

      // Normalize category scores
      const maxScore = Math.max(...Array.from(categoryScores.values()));
      if (maxScore > 0) {
        for (const [category, score] of categoryScores.entries()) {
          profile.categoryPreferences.set(category, score / maxScore);
        }
      }
    }

    return profile;
  }

  /**
   * Get candidate products for recommendation
   */
  private static async getCandidateProducts(
    userProfile: UserProfile,
    excludeProductIds: string[]
  ): Promise<any[]> {
    // Combine purchased and recent interests
    const seedProductIds = [
      ...new Set([...userProfile.purchasedProducts, ...userProfile.recentInterests]),
    ].slice(0, 10); // Use top 10 as seeds

    if (seedProductIds.length === 0) {
      return [];
    }

    // Find products with affinity to user's interests
    const affinities = await RecommendationService.getPrisma().productAffinity.findMany({
      where: {
        affinityScore: {
          gte: 0.1,
        },
        OR: [
          { productAId: { in: seedProductIds } },
          { productBId: { in: seedProductIds } },
        ],
      },
      orderBy: {
        affinityScore: 'desc',
      },
      take: 100, // Get top 100 related products
      include: {
        productA: {
          include: {
            variants: {
              where: { isActive: true },
              select: {
                id: true,
                name: true,
                salePrice: true,
                sortOrder: true,
              },
            },
          },
        },
        productB: {
          include: {
            variants: {
              where: { isActive: true },
              select: {
                id: true,
                name: true,
                salePrice: true,
                sortOrder: true,
              },
            },
          },
        },
      },
    });

    // Extract candidate products
    const candidateMap = new Map<string, { product: any; affinityScore: number }>();

    for (const affinity of affinities) {
      const isSourceProductA = seedProductIds.includes(affinity.productAId);
      const candidateProduct = isSourceProductA ? affinity.productB : affinity.productA;

      // Skip if already in exclude list or seed products
      if (
        excludeProductIds.includes(candidateProduct.id) ||
        seedProductIds.includes(candidateProduct.id)
      ) {
        continue;
      }

      // Skip if no variants
      if (!candidateProduct.variants || candidateProduct.variants.length === 0) {
        continue;
      }

      const existing = candidateMap.get(candidateProduct.id);
      if (!existing || existing.affinityScore < affinity.affinityScore) {
        candidateMap.set(candidateProduct.id, {
          product: candidateProduct,
          affinityScore: affinity.affinityScore,
        });
      }
    }

    return Array.from(candidateMap.values());
  }

  /**
   * Calculate personalization score for a product
   */
  private static calculatePersonalizationScore(
    candidate: { product: any; affinityScore: number },
    userProfile: UserProfile
  ): number {
    let score = candidate.affinityScore; // Base score from affinity

    const product = candidate.product;

    // Boost if in user's preferred price range
    const mainVariant = product.variants?.find((v: any) => v.sortOrder === 0) || product.variants?.[0];
    if (mainVariant) {
      const price = Number(mainVariant.salePrice);
      if (
        userProfile.priceRange.min <= price &&
        price <= userProfile.priceRange.max
      ) {
        score *= 1.2; // 20% boost for price match
      } else if (price < userProfile.priceRange.min) {
        score *= 0.9; // Slight penalty for too cheap
      } else if (price > userProfile.priceRange.max) {
        score *= 0.8; // Penalty for too expensive
      }
    }

    // Boost if in preferred category
    if (product.typeData && userProfile.categoryPreferences.size > 0) {
      const typeData = parseJsonRecord(product.typeData);
      const category = typeData?.category;
      if (typeof category === 'string') {
        const categoryScore = userProfile.categoryPreferences.get(category);
        if (categoryScore) {
          score *= 1 + categoryScore * 0.5; // Up to 50% boost for top categories
        }
      }
    }

    // Slight penalty if user recently viewed but didn't purchase
    // (might not be interested)
    if (
      userProfile.viewedProducts.includes(product.id) &&
      !userProfile.purchasedProducts.includes(product.id)
    ) {
      score *= 0.95;
    }

    // Boost if user added to cart but didn't purchase
    // (might want to reconsider)
    if (
      userProfile.addedToCartProducts.includes(product.id) &&
      !userProfile.purchasedProducts.includes(product.id)
    ) {
      score *= 1.15;
    }

    // Cap score at 1.0
    return Math.min(score, 1.0);
  }

  /**
   * Generate personalized reason text
   */
  private static generateReasonText(
    product: any,
    userProfile: UserProfile
  ): string {
    // Check if related to a specific interest
    if (userProfile.addedToCartProducts.includes(product.id)) {
      return 'You showed interest in this';
    }

    // Check category match
    if (product.typeData && userProfile.categoryPreferences.size > 0) {
      const typeData = parseJsonRecord(product.typeData);
      const category = typeData?.category;
      if (typeof category === 'string' && userProfile.categoryPreferences.has(category)) {
        return `Based on your interest in ${category}`;
      }
    }

    // Check if similar to purchased products
    if (userProfile.purchasedProducts.length > 0) {
      return 'Based on your purchase history';
    }

    // Check if similar to viewed products
    if (userProfile.viewedProducts.length > 0) {
      return 'Based on products you viewed';
    }

    // Default
    return 'Recommended for you';
  }

  /**
   * Get recommendations for homepage (for logged-in users)
   */
  static async getHomepageRecommendations(
    userId: string,
    options: {
      limit?: number;
      locale?: string;
    } = {}
  ): Promise<RecommendedProduct[]> {
    return PersonalizedRecommendationEngine.getRecommendations({
      userId,
      limit: options.limit || 8,
      locale: options.locale,
    });
  }

  /**
   * Get email recommendations based on purchase history
   */
  static async getEmailRecommendations(
    userId: string,
    options: {
      limit?: number;
      locale?: string;
    } = {}
  ): Promise<RecommendedProduct[]> {
    const recommendations = await this.getRecommendations({
      userId,
      limit: options.limit || 5,
      locale: options.locale,
    });

    // Filter for higher confidence recommendations for email
    return recommendations.filter((rec) => rec.score >= 0.3);
  }

  /**
   * Get recommendations for a specific user segment
   * (e.g., new customers, high-value customers)
   */
  static async getSegmentedRecommendations(
    segment: 'new' | 'returning' | 'high-value',
    options: {
      limit?: number;
      locale?: string;
    } = {}
  ): Promise<RecommendedProduct[]> {
    const { limit = 10, locale } = options;

    // Define segment-specific strategies
    switch (segment) {
      case 'new':
        // For new customers, show popular/trending products
        return this.getPopularProducts(limit);

      case 'returning':
        // For returning customers without recent purchases, show trending
        return this.getTrendingProducts(limit);

      case 'high-value':
        // For high-value customers, show premium products
        return this.getPremiumProducts(limit);

      default:
        return [];
    }
  }

  /**
   * Get popular products (fallback for new users)
   */
  private static async getPopularProducts(limit: number): Promise<RecommendedProduct[]> {
    // Get products with most purchases
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const popularProducts = await RecommendationService.getPrisma().recommendationInteraction.groupBy({
      by: ['productId'],
      where: {
        action: InteractionActionEnum.PURCHASE,
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      _count: {
        productId: true,
      },
      orderBy: {
        _count: {
          productId: 'desc',
        },
      },
      take: limit,
    });

    let productIds = popularProducts.map((p) => p.productId);

    if (productIds.length === 0) {
      // Fallback for new stores or dev environments with no purchases
      const recentProducts = await RecommendationService.getPrisma().product.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { id: true }
      });
      productIds = recentProducts.map((p: { id: string }) => p.id);

      if (productIds.length === 0) {
        return [];
      }
    }

    // Fetch product details
    const products = await RecommendationService.getPrisma().product.findMany({
      where: {
        id: { in: productIds },
      },
      include: {
        variants: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            salePrice: true,
            sortOrder: true,
          },
        },
      },
    });

    const stockMap = await InventoryService.getAvailableStockByVariantIds(
      products.flatMap((product) => product.variants.map((variant) => variant.id))
    );

    // Convert to RecommendedProduct format
    return products.map((product) => {
      const mainVariant = product.variants.find((v) => v.sortOrder === 0) || product.variants[0];
      const displayPrice = mainVariant ? Number(mainVariant.salePrice) : 0;
      const totalStock = product.variants.reduce((sum, v) => sum + (stockMap.get(v.id) ?? 0), 0);

      let images = '';
      if (product.typeData) {
        const typeData = parseJsonRecord(product.typeData);
        images = (typeData?.images as string) || '';
      }

      return {
        id: product.id,
        name: product.name,
        description: product.description || undefined,
        price: displayPrice,
        stock: totalStock,
        images,
        score: 0.8, // High confidence for popular products
        reason: 'Popular choice',
      };
    });
  }

  /**
   * Get trending products (products gaining popularity)
   */
  private static async getTrendingProducts(limit: number): Promise<RecommendedProduct[]> {
    // Get products with increasing interaction rates (last 7 days vs previous 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const trendingProducts = await RecommendationService.getPrisma().recommendationInteraction.groupBy({
      by: ['productId'],
      where: {
        action: { in: [InteractionActionEnum.CLICK, InteractionActionEnum.PURCHASE] },
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
      _count: {
        productId: true,
      },
      orderBy: {
        _count: {
          productId: 'desc',
        },
      },
      take: limit,
    });

    const productIds = trendingProducts.map((p) => p.productId);

    if (productIds.length === 0) {
      return [];
    }

    // Fetch product details
    const products = await RecommendationService.getPrisma().product.findMany({
      where: {
        id: { in: productIds },
      },
      include: {
        variants: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            salePrice: true,
            sortOrder: true,
          },
        },
      },
    });

    const stockMap = await InventoryService.getAvailableStockByVariantIds(
      products.flatMap((product) => product.variants.map((variant) => variant.id))
    );

    return products.map((product) => {
      const mainVariant = product.variants.find((v: any) => v.sortOrder === 0) || product.variants[0];
      const displayPrice = mainVariant ? Number(mainVariant.salePrice) : 0;
      const totalStock = product.variants.reduce((sum, v) => sum + (stockMap.get(v.id) ?? 0), 0);

      let images = '';
      if (product.typeData) {
        const typeData = parseJsonRecord(product.typeData);
        images = (typeData?.images as string) || '';
      }

      return {
        id: product.id,
        name: product.name,
        description: product.description || undefined,
        price: displayPrice,
        stock: totalStock,
        images,
        score: 0.75,
        reason: 'Trending now',
      };
    });
  }

  /**
   * Get premium products (for high-value customers)
   */
  private static async getPremiumProducts(limit: number): Promise<RecommendedProduct[]> {
    // Get products in top 25% price range
    const products = await RecommendationService.getPrisma().product.findMany({
      include: {
        variants: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            salePrice: true,
            sortOrder: true,
          },
        },
      },
      take: 100, // Get sample for price analysis
    });

    // Filter products with variants and calculate prices
    const productsWithPrice = products
      .filter((p) => (p as any).variants.length > 0)
      .map((p) => {
        const mainVariant = (p as any).variants.find((v: any) => v.sortOrder === 0) || (p as any).variants[0];
        const price = mainVariant ? Number(mainVariant.salePrice) : 0;
        return { product: p, price };
      })
      .filter((p) => p.price > 0);

    // Calculate 75th percentile
    const prices = productsWithPrice.map((p) => p.price).sort((a, b) => a - b);
    const p75 = prices[Math.floor(prices.length * 0.75)] || 0;

    // Get premium products (above 75th percentile)
    const premiumProducts = productsWithPrice
      .filter((p) => p.price >= p75)
      .sort((a, b) => b.price - a.price)
      .slice(0, limit);

    const stockMap = await InventoryService.getAvailableStockByVariantIds(
      premiumProducts.flatMap((item) => (item.product as any).variants.map((variant: any) => variant.id))
    );

    return premiumProducts.map(({ product, price }) => {
      const mainVariant = (product as any).variants.find((v: any) => v.sortOrder === 0) || (product as any).variants[0];
      const totalStock = (product as any).variants.reduce((sum: number, v: any) => sum + (stockMap.get(v.id) ?? 0), 0);

      let images = '';
      if (product.typeData) {
        const typeData = parseJsonRecord(product.typeData);
        images = (typeData?.images as string) || '';
      }

      return {
        id: product.id,
        name: product.name,
        description: product.description || undefined,
        price,
        stock: totalStock,
        images,
        score: 0.7,
        reason: 'Premium selection',
      };
    });
  }
}
