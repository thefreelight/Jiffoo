// @ts-nocheck
/**
 * Pricing Service
 *
 * Handles B2B pricing rules, tiered pricing, and price calculations
 */

import { prisma } from '@/config/database';
import {
  CreatePriceRuleRequest,
  UpdatePriceRuleRequest,
  PriceRuleResponse,
  PriceRuleWithRelationsResponse,
  PriceRuleListResponse,
  CalculatePriceRequest,
  PriceCalculationResult,
  TieredPricingTier,
} from './types';

export class PricingService {
  /**
   * Get all price rules with pagination and filters
   */
  static async getAllPriceRules(
    page = 1,
    limit = 10,
    options?: {
      customerGroupId?: string;
      productId?: string;
      variantId?: string;
      categoryId?: string;
      isActive?: boolean;
      search?: string;
    }
  ): Promise<PriceRuleListResponse> {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (options?.customerGroupId) {
      where.customerGroupId = options.customerGroupId;
    }
    if (options?.productId) {
      where.productId = options.productId;
    }
    if (options?.variantId) {
      where.variantId = options.variantId;
    }
    if (options?.categoryId) {
      where.categoryId = options.categoryId;
    }
    if (options?.isActive !== undefined) {
      where.isActive = options.isActive;
    }
    if (options?.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [rules, total] = await Promise.all([
      prisma.priceRule.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        include: {
          customerGroup: {
            select: { id: true, name: true },
          },
          product: {
            select: { id: true, name: true, slug: true },
          },
          variant: {
            select: { id: true, name: true },
          },
          category: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.priceRule.count({ where }),
    ]);

    return {
      items: rules as PriceRuleWithRelationsResponse[],
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get price rule by ID
   */
  static async getPriceRuleById(id: string): Promise<PriceRuleWithRelationsResponse | null> {
    const rule = await prisma.priceRule.findUnique({
      where: { id },
      include: {
        customerGroup: {
          select: { id: true, name: true },
        },
        product: {
          select: { id: true, name: true, slug: true },
        },
        variant: {
          select: { id: true, name: true },
        },
        category: {
          select: { id: true, name: true },
        },
      },
    });

    return rule as PriceRuleWithRelationsResponse | null;
  }

  /**
   * Create a new price rule
   */
  static async createPriceRule(data: CreatePriceRuleRequest): Promise<PriceRuleResponse> {
    // Validate that maxQuantity is greater than minQuantity if provided
    if (data.maxQuantity && data.maxQuantity <= data.minQuantity) {
      throw new Error('Max quantity must be greater than min quantity');
    }

    // Validate discount value based on type
    if (data.discountType === 'PERCENTAGE' && data.discountValue > 100) {
      throw new Error('Percentage discount cannot exceed 100%');
    }

    // Convert date strings to Date objects if provided
    const ruleData: any = {
      ...data,
      startDate: data.startDate ? new Date(data.startDate as any) : undefined,
      endDate: data.endDate ? new Date(data.endDate as any) : undefined,
    };

    const rule = await prisma.priceRule.create({
      data: ruleData,
    });

    return rule as PriceRuleResponse;
  }

  /**
   * Update a price rule
   */
  static async updatePriceRule(
    id: string,
    data: UpdatePriceRuleRequest
  ): Promise<PriceRuleResponse> {
    // Check if rule exists
    const existing = await prisma.priceRule.findUnique({ where: { id } });
    if (!existing) {
      throw new Error(`Price rule not found: ${id}`);
    }

    // Validate quantity range if both are being updated
    const minQuantity = data.minQuantity ?? existing.minQuantity;
    const maxQuantity = data.maxQuantity !== undefined ? data.maxQuantity : existing.maxQuantity;

    if (maxQuantity && maxQuantity <= minQuantity) {
      throw new Error('Max quantity must be greater than min quantity');
    }

    // Validate discount value based on type
    const discountType = data.discountType ?? existing.discountType;
    const discountValue = data.discountValue ?? existing.discountValue;

    if (discountType === 'PERCENTAGE' && discountValue > 100) {
      throw new Error('Percentage discount cannot exceed 100%');
    }

    // Convert date strings to Date objects if provided
    const updateData: any = { ...data };
    if (data.startDate !== undefined) {
      updateData.startDate = data.startDate ? new Date(data.startDate as any) : null;
    }
    if (data.endDate !== undefined) {
      updateData.endDate = data.endDate ? new Date(data.endDate as any) : null;
    }

    const rule = await prisma.priceRule.update({
      where: { id },
      data: updateData,
    });

    return rule as PriceRuleResponse;
  }

  /**
   * Update price rule status (isActive)
   */
  static async updatePriceRuleStatus(id: string, isActive: boolean): Promise<PriceRuleResponse> {
    const rule = await prisma.priceRule.findUnique({ where: { id } });
    if (!rule) {
      throw new Error(`Price rule not found: ${id}`);
    }

    const updated = await prisma.priceRule.update({
      where: { id },
      data: { isActive },
    });

    return updated as PriceRuleResponse;
  }

  /**
   * Delete a price rule
   */
  static async deletePriceRule(id: string): Promise<void> {
    const rule = await prisma.priceRule.findUnique({ where: { id } });
    if (!rule) {
      throw new Error(`Price rule not found: ${id}`);
    }

    await prisma.priceRule.delete({ where: { id } });
  }

  /**
   * Get active price rules
   */
  static async getActivePriceRules(
    options?: {
      customerGroupId?: string;
      productId?: string;
      variantId?: string;
      categoryId?: string;
    }
  ): Promise<PriceRuleResponse[]> {
    const where: any = { isActive: true };
    const now = new Date();

    // Add date validity check
    where.OR = [
      { startDate: null, endDate: null },
      { startDate: null, endDate: { gte: now } },
      { startDate: { lte: now }, endDate: null },
      { startDate: { lte: now }, endDate: { gte: now } },
    ];

    if (options?.customerGroupId) {
      where.customerGroupId = options.customerGroupId;
    }
    if (options?.productId) {
      where.productId = options.productId;
    }
    if (options?.variantId) {
      where.variantId = options.variantId;
    }
    if (options?.categoryId) {
      where.categoryId = options.categoryId;
    }

    const rules = await prisma.priceRule.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    return rules as PriceRuleResponse[];
  }

  /**
   * Calculate price with applicable rules
   */
  static async calculatePrice(
    request: CalculatePriceRequest
  ): Promise<PriceCalculationResult> {
    const { variantId, quantity, productId, categoryId, customerGroupId, companyId } = request;

    // Get the product variant to get base price
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!variant) {
      throw new Error(`Product variant not found: ${variantId}`);
    }

    const salePrice = Number(variant.salePrice);
    const actualProductId = productId || variant.productId;
    const actualCategoryId = categoryId || variant.product.categoryId || undefined;

    // Determine customer group ID
    let effectiveCustomerGroupId = customerGroupId;
    if (!effectiveCustomerGroupId && companyId) {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { customerGroupId: true },
      });
      effectiveCustomerGroupId = company?.customerGroupId || undefined;
    }

    // Find applicable rules
    const applicableRules = await this.findApplicableRules({
      variantId,
      productId: actualProductId,
      categoryId: actualCategoryId,
      quantity,
      customerGroupId: effectiveCustomerGroupId,
    });

    // If no rules apply, return base price
    if (applicableRules.length === 0) {
      return {
        variantId,
        quantity,
        basePrice: salePrice,
        finalPrice: salePrice,
        discount: 0,
        appliedRules: [],
        savings: 0,
        savingsPercentage: 0,
      };
    }

    // Apply the highest priority rule (they're already sorted by priority)
    const bestRule = applicableRules[0];
    const finalPrice = this.applyDiscount(salePrice, bestRule);

    const discount = salePrice - finalPrice;
    const savings = discount * quantity;
    const savingsPercentage = salePrice > 0 ? (discount / salePrice) * 100 : 0;

    return {
      variantId,
      quantity,
      basePrice: salePrice,
      finalPrice,
      discount,
      discountType: bestRule.discountType,
      discountValue: bestRule.discountValue,
      appliedRules: applicableRules.map(rule => ({
        id: rule.id,
        name: rule.name,
        discountType: rule.discountType,
        discountValue: rule.discountValue,
        priority: rule.priority,
      })),
      savings,
      savingsPercentage,
    };
  }

  /**
   * Get tiered pricing for a product variant
   */
  static async getTieredPricing(
    variantId: string,
    options?: {
      productId?: string;
      categoryId?: string;
      customerGroupId?: string;
      companyId?: string;
    }
  ): Promise<TieredPricingTier[]> {
    const { productId, categoryId, customerGroupId, companyId } = options || {};

    // Get the product variant
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!variant) {
      throw new Error(`Product variant not found: ${variantId}`);
    }

    const salePrice = Number(variant.salePrice);
    const actualProductId = productId || variant.productId;
    const actualCategoryId = categoryId || variant.product.categoryId || undefined;

    // Determine customer group ID
    let effectiveCustomerGroupId = customerGroupId;
    if (!effectiveCustomerGroupId && companyId) {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { customerGroupId: true },
      });
      effectiveCustomerGroupId = company?.customerGroupId || undefined;
    }

    // Find all applicable rules regardless of quantity
    const where: any = {
      isActive: true,
      OR: [
        // Global rules
        {
          customerGroupId: null,
          productId: null,
          variantId: null,
          categoryId: null,
        },
        // Customer group specific
        effectiveCustomerGroupId ? { customerGroupId: effectiveCustomerGroupId } : {},
        // Variant specific
        { variantId },
        // Product specific
        { productId: actualProductId },
        // Category specific
        actualCategoryId ? { categoryId: actualCategoryId } : {},
      ].filter(condition => Object.keys(condition).length > 0),
    };

    // Date validity
    const now = new Date();
    where.AND = [
      {
        OR: [
          { startDate: null },
          { startDate: { lte: now } },
        ],
      },
      {
        OR: [
          { endDate: null },
          { endDate: { gte: now } },
        ],
      },
    ];

    const rules = await prisma.priceRule.findMany({
      where,
      orderBy: [{ minQuantity: 'asc' }, { priority: 'desc' }],
    });

    // Group rules by quantity tiers
    const tiers: TieredPricingTier[] = [];
    const processedRanges = new Set<string>();

    for (const rule of rules) {
      const rangeKey = `${rule.minQuantity}-${rule.maxQuantity}`;
      if (processedRanges.has(rangeKey)) {
        continue;
      }

      const pricePerUnit = this.applyDiscount(salePrice, rule);
      const discount = salePrice - pricePerUnit;
      const totalSavings = discount * rule.minQuantity;

      tiers.push({
        minQuantity: rule.minQuantity,
        maxQuantity: rule.maxQuantity,
        pricePerUnit,
        discount,
        discountType: rule.discountType,
        totalSavings,
        ruleId: rule.id,
        ruleName: rule.name,
      });

      processedRanges.add(rangeKey);
    }

    return tiers;
  }

  /**
   * Find applicable price rules for given criteria
   */
  private static async findApplicableRules(options: {
    variantId: string;
    productId: string;
    categoryId?: string;
    quantity: number;
    customerGroupId?: string;
  }): Promise<any[]> {
    const { variantId, productId, categoryId, quantity, customerGroupId } = options;

    const where: any = {
      isActive: true,
      minQuantity: { lte: quantity },
      OR: [
        { maxQuantity: null },
        { maxQuantity: { gte: quantity } },
      ],
    };

    // Date validity
    const now = new Date();
    where.AND = [
      {
        OR: [
          { startDate: null },
          { startDate: { lte: now } },
        ],
      },
      {
        OR: [
          { endDate: null },
          { endDate: { gte: now } },
        ],
      },
    ];

    // Build scope conditions (most specific to least specific)
    const scopeConditions: any[] = [];

    // 1. Variant-specific rule
    scopeConditions.push({ variantId });

    // 2. Product-specific rule
    scopeConditions.push({ variantId: null, productId });

    // 3. Category-specific rule
    if (categoryId) {
      scopeConditions.push({ variantId: null, productId: null, categoryId });
    }

    // 4. Customer group-specific rules
    if (customerGroupId) {
      scopeConditions.push({
        variantId: null,
        productId: null,
        categoryId: null,
        customerGroupId,
      });
    }

    // 5. Global rules (no specific targeting)
    scopeConditions.push({
      variantId: null,
      productId: null,
      categoryId: null,
      customerGroupId: null,
    });

    where.OR = scopeConditions;

    const rules = await prisma.priceRule.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    return rules;
  }

  /**
   * Apply discount to sale price based on rule
   */
  private static applyDiscount(salePrice: number, rule: any): number {
    switch (rule.discountType) {
      case 'PERCENTAGE':
        return salePrice * (1 - rule.discountValue / 100);

      case 'FIXED_AMOUNT':
        return Math.max(0, salePrice - rule.discountValue);

      case 'FIXED_PRICE':
        return rule.discountValue;

      default:
        return salePrice;
    }
  }

  /**
   * Get price rules by customer group
   */
  static async getPriceRulesByCustomerGroup(customerGroupId: string): Promise<PriceRuleResponse[]> {
    const rules = await prisma.priceRule.findMany({
      where: { customerGroupId },
      orderBy: [{ priority: 'desc' }, { minQuantity: 'asc' }],
    });

    return rules as PriceRuleResponse[];
  }

  /**
   * Get price rules by product
   */
  static async getPriceRulesByProduct(productId: string): Promise<PriceRuleResponse[]> {
    const rules = await prisma.priceRule.findMany({
      where: {
        OR: [
          { productId },
          { variantId: { in: await this.getVariantIdsByProduct(productId) } },
        ],
      },
      orderBy: [{ priority: 'desc' }, { minQuantity: 'asc' }],
    });

    return rules as PriceRuleResponse[];
  }

  /**
   * Helper: Get all variant IDs for a product
   */
  private static async getVariantIdsByProduct(productId: string): Promise<string[]> {
    const variants = await prisma.productVariant.findMany({
      where: { productId },
      select: { id: true },
    });

    return variants.map(v => v.id);
  }
}
