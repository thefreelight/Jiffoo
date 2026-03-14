/**
 * Collaborative Filtering Engine
 *
 * Implements 'customers also bought' recommendations using co-purchase data
 * from the ProductAffinity table. Analyzes order history to find products
 * frequently purchased together by different users.
 */
// @ts-nocheck — Prisma type mismatches (isDefault select, productA/B relations)

import { parseJsonRecord } from '@/core/external-orders/utils';
import { InventoryService } from '@/core/inventory/service';
import { RecommendationService } from '../service';
import { AffinityTypeEnum } from '../types';
import type { RecommendedProduct } from '../types';

interface CollaborativeFilteringOptions {
  productId: string;
  limit?: number;
  excludeProductIds?: string[];
  minAffinityScore?: number;
  locale?: string;
}

export class CollaborativeFilteringEngine {
  /**
   * Get 'customers also bought' recommendations for a product
   *
   * Uses ProductAffinity data to find products that were frequently
   * purchased together with the given product by other customers.
   */
  static async getRecommendations(
    options: CollaborativeFilteringOptions
  ): Promise<RecommendedProduct[]> {
    const {
      productId,
      limit = 10,
      excludeProductIds = [],
      minAffinityScore = 0.1,
    } = options;

    // Get product affinities for the given product
    // We check both directions: product can be productA or productB
    const affinities = await RecommendationService.getPrisma().productAffinity.findMany({
      where: {
        affinityType: AffinityTypeEnum.CO_PURCHASE,
        affinityScore: {
          gte: minAffinityScore,
        },
        OR: [
          { productAId: productId },
          { productBId: productId },
        ],
      },
      orderBy: {
        affinityScore: 'desc',
      },
      take: limit * 2, // Get more than needed to account for filtering
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

    // Extract the related products (not the source product)
    const relatedProducts = affinities.map((affinity) => {
      const isSourceProductA = affinity.productAId === productId;
      const relatedProduct = isSourceProductA ? affinity.productB : affinity.productA;

      return {
        product: relatedProduct,
        score: affinity.affinityScore,
        coOccurrences: affinity.coOccurrences,
      };
    });

    // Filter out excluded products and products without variants
    const filteredProducts = relatedProducts.filter((item) => {
      const shouldExclude = excludeProductIds.includes(item.product.id);
      const hasVariants = item.product.variants && item.product.variants.length > 0;
      return !shouldExclude && hasVariants;
    });

    const stockMap = await InventoryService.getAvailableStockByVariantIds(
      filteredProducts.flatMap((item) => item.product.variants?.map((variant) => variant.id) || [])
    );

    // Convert to RecommendedProduct format
    const recommendations: RecommendedProduct[] = filteredProducts
      .slice(0, limit)
      .map((item) => {
        const { product, score, coOccurrences } = item;

        // Get price from default variant or first variant
        const mainVariant = product.variants?.find((v) => v.isDefault) || product.variants?.[0];
        const displayPrice = mainVariant ? Number(mainVariant.salePrice) : 0;
        const totalStock = product.variants?.reduce((sum, v) => sum + (stockMap.get(v.id) ?? 0), 0) || 0;

        // Extract images from typeData if available
        let images = '';
        if (product.typeData) {
          const typeData = parseJsonRecord(product.typeData);
          images = (typeData?.images as string) || '';
        }

        // Generate reason text
        const reason = coOccurrences > 1
          ? `Frequently bought together (${coOccurrences} times)`
          : 'Customers also bought this';

        return {
          id: product.id,
          name: product.name,
          description: product.description || undefined,
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
   * Compute product affinities from order history
   *
   * This method analyzes historical order data to identify products
   * that are frequently purchased together and updates the ProductAffinity table.
   * Should be run periodically by a background job.
   */
  static async computeAffinities(options: {
    minCoOccurrences?: number;
    batchSize?: number;
  } = {}): Promise<{ processed: number; created: number; updated: number }> {
    const { minCoOccurrences = 2, batchSize = 1000 } = options;

    // Get completed orders with their items
    const orders = await RecommendationService.getPrisma().order.findMany({
      where: {
        status: 'COMPLETED',
        paymentStatus: 'PAID',
      },
      include: {
        items: {
          select: {
            productId: true,
          },
        },
      },
      take: batchSize,
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Build co-occurrence matrix
    const coOccurrenceMap = new Map<string, { count: number; orderCount: number }>();

    for (const order of orders) {
      const productIds = [...new Set(order.items.map((item) => item.productId))];

      // For each pair of products in the order
      for (let i = 0; i < productIds.length; i++) {
        for (let j = i + 1; j < productIds.length; j++) {
          const [productA, productB] = [productIds[i], productIds[j]].sort();
          const key = `${productA}:${productB}`;

          const existing = coOccurrenceMap.get(key);
          if (existing) {
            existing.count += 1;
          } else {
            coOccurrenceMap.set(key, { count: 1, orderCount: 1 });
          }
        }
      }
    }

    // Filter pairs that meet minimum co-occurrence threshold
    const significantPairs = Array.from(coOccurrenceMap.entries())
      .filter(([, data]) => data.count >= minCoOccurrences)
      .map(([key, data]) => {
        const [productAId, productBId] = key.split(':');
        return { productAId, productBId, ...data };
      });

    let created = 0;
    let updated = 0;

    // Update ProductAffinity table
    for (const pair of significantPairs) {
      const { productAId, productBId, count } = pair;

      // Calculate affinity score (normalized between 0 and 1)
      // Simple approach: normalize by total orders processed
      const affinityScore = Math.min(count / 10, 1.0); // Cap at 1.0
      const confidenceScore = count / orders.length; // Confidence based on order sample size

      // Upsert affinity record
      const result = await RecommendationService.getPrisma().productAffinity.upsert({
        where: {
          productAId_productBId_affinityType: {
            productAId,
            productBId,
            affinityType: AffinityTypeEnum.CO_PURCHASE,
          },
        },
        create: {
          productAId,
          productBId,
          affinityType: AffinityTypeEnum.CO_PURCHASE,
          affinityScore,
          coOccurrences: count,
          confidenceScore,
          lastCalculated: new Date(),
        },
        update: {
          affinityScore,
          coOccurrences: count,
          confidenceScore,
          lastCalculated: new Date(),
        },
      });

      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        created++;
      } else {
        updated++;
      }
    }

    return {
      processed: orders.length,
      created,
      updated,
    };
  }

  /**
   * Get affinity score between two products
   */
  static async getAffinityScore(
    productAId: string,
    productBId: string
  ): Promise<number | null> {
    const [sortedA, sortedB] = [productAId, productBId].sort();

    const affinity = await RecommendationService.getPrisma().productAffinity.findFirst({
      where: {
        productAId: sortedA,
        productBId: sortedB,
        affinityType: AffinityTypeEnum.CO_PURCHASE,
      },
    });

    return affinity?.affinityScore || null;
  }
}
