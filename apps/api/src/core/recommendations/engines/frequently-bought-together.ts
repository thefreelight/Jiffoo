/**
 * Frequently Bought Together Engine
 *
 * Implements 'frequently bought together' recommendations by analyzing products
 * within the same orders. Useful for cart/checkout suggestions to increase
 * average order value by suggesting complementary products.
 */
// @ts-nocheck — Prisma type mismatches (isDefault select, productA/B relations)

import { parseJsonRecord } from '@/core/external-orders/utils';
import { InventoryService } from '@/core/inventory/service';
import { RecommendationService } from '../service';
import { AffinityTypeEnum } from '../types';
import type { RecommendedProduct } from '../types';

interface FrequentlyBoughtTogetherOptions {
  productIds: string[]; // Items currently in cart/order
  limit?: number;
  excludeProductIds?: string[];
  minAffinityScore?: number;
  locale?: string;
}

export class FrequentlyBoughtTogetherEngine {
  /**
   * Get frequently bought together recommendations
   *
   * Given a set of product IDs (e.g., items in cart), find products that
   * are frequently purchased together with those items in the same order.
   */
  static async getRecommendations(
    options: FrequentlyBoughtTogetherOptions
  ): Promise<RecommendedProduct[]> {
    const {
      productIds,
      limit = 5,
      excludeProductIds = [],
      minAffinityScore = 0.15,
    } = options;

    if (!productIds || productIds.length === 0) {
      return [];
    }

    // Get affinities for all products in the cart
    // We look for products that have strong affinity with ANY cart item
    const affinities = await RecommendationService.getPrisma().productAffinity.findMany({
      where: {
        affinityType: AffinityTypeEnum.CO_PURCHASE,
        affinityScore: {
          gte: minAffinityScore,
        },
        OR: [
          { productAId: { in: productIds } },
          { productBId: { in: productIds } },
        ],
      },
      orderBy: {
        affinityScore: 'desc',
      },
      take: limit * 3, // Get more than needed to account for filtering
      include: {
        productA: {
          include: {
            variants: {
              where: { isActive: true },
              select: {
                id: true,
                name: true,
                salePrice: true,
                isDefault: true,
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
                isDefault: true,
              },
            },
          },
        },
      },
    });

    // Extract related products (not the ones already in cart)
    const candidateMap = new Map<string, {
      product: any;
      maxScore: number;
      totalOccurrences: number;
      matchCount: number;
    }>();

    for (const affinity of affinities) {
      const isSourceProductA = productIds.includes(affinity.productAId);
      const relatedProduct = isSourceProductA ? affinity.productB : affinity.productA;
      const relatedProductId = relatedProduct.id;

      // Skip if already in cart or excluded
      if (productIds.includes(relatedProductId) || excludeProductIds.includes(relatedProductId)) {
        continue;
      }

      const existing = candidateMap.get(relatedProductId);
      if (existing) {
        // Product appears with multiple cart items - increase score
        existing.maxScore = Math.max(existing.maxScore, affinity.affinityScore);
        existing.totalOccurrences += affinity.coOccurrences;
        existing.matchCount += 1;
      } else {
        candidateMap.set(relatedProductId, {
          product: relatedProduct,
          maxScore: affinity.affinityScore,
          totalOccurrences: affinity.coOccurrences,
          matchCount: 1,
        });
      }
    }

    // Convert to array and calculate composite score
    const candidates = Array.from(candidateMap.values()).map((item) => {
      // Composite score: favor products that match multiple cart items
      const compositeScore = item.maxScore * (1 + (item.matchCount - 1) * 0.1);
      return {
        ...item,
        compositeScore: Math.min(compositeScore, 1.0), // Cap at 1.0
      };
    });

    // Sort by composite score and filter products without variants
    const validCandidates = candidates
      .filter((item) => item.product.variants && item.product.variants.length > 0)
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .slice(0, limit);

    const stockMap = await InventoryService.getAvailableStockByVariantIds(
      validCandidates.flatMap((item) => item.product.variants?.map((variant: any) => variant.id) || [])
    );

    // Convert to RecommendedProduct format
    const recommendations: RecommendedProduct[] = validCandidates.map((item) => {
      const { product, compositeScore, totalOccurrences, matchCount } = item;

      // Get price from default variant or first variant
      const mainVariant = product.variants?.find((v: any) => v.isDefault) || product.variants?.[0];
      const displayPrice = mainVariant ? Number(mainVariant.salePrice) : 0;
      const totalStock = product.variants?.reduce((sum: number, v: any) => sum + (stockMap.get(v.id) ?? 0), 0) || 0;

      // Extract images from typeData if available
      let images = '';
      if (product.typeData) {
        const typeData = parseJsonRecord(product.typeData);
        images = (typeData?.images as string) || '';
      }

      // Generate reason text
      let reason = 'Often bought together';
      if (matchCount > 1) {
        reason = `Pairs well with ${matchCount} items in your cart`;
      } else if (totalOccurrences > 5) {
        reason = `Frequently purchased together (${totalOccurrences} times)`;
      }

      return {
        id: product.id,
        name: product.name,
        description: product.description || undefined,
        price: displayPrice,
        stock: totalStock,
        images,
        score: compositeScore,
        reason,
      };
    });

    return recommendations;
  }

  /**
   * Get bundle suggestions for a specific product
   *
   * Similar to getRecommendations but optimized for product detail pages
   * where you want to show "Complete the set" or "Bundle and save" suggestions.
   */
  static async getBundleSuggestions(
    productId: string,
    options: {
      limit?: number;
      minAffinityScore?: number;
    } = {}
  ): Promise<RecommendedProduct[]> {
    const { limit = 3, minAffinityScore = 0.2 } = options;

    return this.getRecommendations({
      productIds: [productId],
      limit,
      minAffinityScore,
    });
  }

  /**
   * Calculate bundle discount for a set of products
   *
   * Helper method to calculate potential bundle discounts based on
   * how frequently products are bought together.
   */
  static async calculateBundleDiscount(
    productIds: string[]
  ): Promise<{
    eligible: boolean;
    discountPercentage: number;
    reason?: string;
  }> {
    if (productIds.length < 2) {
      return { eligible: false, discountPercentage: 0 };
    }

    // Get affinities between products in the bundle
    const affinities = await RecommendationService.getPrisma().productAffinity.findMany({
      where: {
        affinityType: AffinityTypeEnum.CO_PURCHASE,
        OR: [
          {
            productAId: { in: productIds },
            productBId: { in: productIds },
          },
        ],
      },
    });

    if (affinities.length === 0) {
      return { eligible: false, discountPercentage: 0 };
    }

    // Calculate average affinity score
    const avgScore = affinities.reduce((sum, a) => sum + a.affinityScore, 0) / affinities.length;
    const avgOccurrences = affinities.reduce((sum, a) => sum + a.coOccurrences, 0) / affinities.length;

    // Discount based on how frequently they're bought together
    let discountPercentage = 0;
    let reason = '';

    if (avgScore >= 0.7 && avgOccurrences >= 10) {
      discountPercentage = 15;
      reason = 'Popular bundle - save 15%';
    } else if (avgScore >= 0.5 && avgOccurrences >= 5) {
      discountPercentage = 10;
      reason = 'Frequently bought together - save 10%';
    } else if (avgScore >= 0.3) {
      discountPercentage = 5;
      reason = 'Bundle discount - save 5%';
    }

    return {
      eligible: discountPercentage > 0,
      discountPercentage,
      reason,
    };
  }

  /**
   * Analyze cart for cross-sell opportunities
   *
   * Given current cart items, identify categories or product types
   * that are missing but frequently purchased together.
   */
  static async analyzeCartGaps(
    cartProductIds: string[]
  ): Promise<{
    suggestions: RecommendedProduct[];
    missingCategories: string[];
  }> {
    if (cartProductIds.length === 0) {
      return { suggestions: [], missingCategories: [] };
    }

    // Get recommendations
    const suggestions = await this.getRecommendations({
      productIds: cartProductIds,
      limit: 5,
      minAffinityScore: 0.2,
    });

    // Get categories of recommended products
    const recommendedProductIds = suggestions.map((s) => s.id);
    const products = await RecommendationService.getPrisma().product.findMany({
      where: {
        id: { in: recommendedProductIds },
      },
      select: {
        id: true,
        typeData: true,
      },
    });

    // Extract categories from typeData
    const missingCategories: string[] = [];
    for (const product of products) {
      if (product.typeData) {
        const typeData = parseJsonRecord(product.typeData);
        const category = typeData?.category;
        if (typeof category === 'string' && !missingCategories.includes(category)) {
          missingCategories.push(category);
        }
      }
    }

    return {
      suggestions,
      missingCategories,
    };
  }
}
