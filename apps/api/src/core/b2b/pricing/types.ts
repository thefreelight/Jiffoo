import { z } from 'zod';

/**
 * Pricing Types and Validation Schemas
 */

// Enum for discount types
export const DiscountTypeEnum = z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FIXED_PRICE']);
export type DiscountType = z.infer<typeof DiscountTypeEnum>;

// Create PriceRule schema
export const CreatePriceRuleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),

  // Rule scope
  customerGroupId: z.string().optional(),
  productId: z.string().optional(),
  variantId: z.string().optional(),
  categoryId: z.string().optional(),

  // Quantity-based pricing
  minQuantity: z.number().int().min(1).default(1),
  maxQuantity: z.number().int().positive().optional(),

  // Discount configuration
  discountType: DiscountTypeEnum.default('PERCENTAGE'),
  discountValue: z.number().min(0, 'Discount value must be non-negative'),

  // Rule priority and scheduling
  priority: z.number().int().default(0),
  startDate: z.string().datetime().optional().or(z.date().optional()),
  endDate: z.string().datetime().optional().or(z.date().optional()),
  isActive: z.boolean().default(true),
});

export type CreatePriceRuleRequest = z.infer<typeof CreatePriceRuleSchema>;

// Update PriceRule schema
export const UpdatePriceRuleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),

  // Rule scope
  customerGroupId: z.string().nullable().optional(),
  productId: z.string().nullable().optional(),
  variantId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),

  // Quantity-based pricing
  minQuantity: z.number().int().min(1).optional(),
  maxQuantity: z.number().int().positive().nullable().optional(),

  // Discount configuration
  discountType: DiscountTypeEnum.optional(),
  discountValue: z.number().min(0).optional(),

  // Rule priority and scheduling
  priority: z.number().int().optional(),
  startDate: z.string().datetime().nullable().optional().or(z.date().nullable().optional()),
  endDate: z.string().datetime().nullable().optional().or(z.date().nullable().optional()),
  isActive: z.boolean().optional(),
});

export type UpdatePriceRuleRequest = z.infer<typeof UpdatePriceRuleSchema>;

// Update PriceRule status schema
export const UpdatePriceRuleStatusSchema = z.object({
  isActive: z.boolean(),
});

export type UpdatePriceRuleStatusRequest = z.infer<typeof UpdatePriceRuleStatusSchema>;

// Calculate price schema
export const CalculatePriceSchema = z.object({
  productId: z.string().optional(),
  variantId: z.string(),
  categoryId: z.string().optional(),
  quantity: z.number().int().min(1),
  customerGroupId: z.string().optional(),
  companyId: z.string().optional(),
});

export type CalculatePriceRequest = z.infer<typeof CalculatePriceSchema>;

// PriceRule response type
export interface PriceRuleResponse {
  id: string;
  name: string;
  description?: string | null;

  // Rule scope
  customerGroupId?: string | null;
  productId?: string | null;
  variantId?: string | null;
  categoryId?: string | null;

  // Quantity-based pricing
  minQuantity: number;
  maxQuantity?: number | null;

  // Discount configuration
  discountType: string;
  discountValue: number;

  // Rule priority and scheduling
  priority: number;
  startDate?: Date | null;
  endDate?: Date | null;
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

// PriceRule with relations
export interface PriceRuleWithRelationsResponse extends PriceRuleResponse {
  customerGroup?: {
    id: string;
    name: string;
  } | null;
  product?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  variant?: {
    id: string;
    name: string;
  } | null;
  category?: {
    id: string;
    name: string;
  } | null;
}

// Price calculation result
export interface PriceCalculationResult {
  variantId: string;
  quantity: number;
  basePrice: number;
  finalPrice: number;
  discount: number;
  discountType?: string;
  discountValue?: number;
  appliedRules: {
    id: string;
    name: string;
    discountType: string;
    discountValue: number;
    priority: number;
  }[];
  savings: number;
  savingsPercentage: number;
}

// Tiered pricing for display
export interface TieredPricingTier {
  minQuantity: number;
  maxQuantity?: number | null;
  pricePerUnit: number;
  discount: number;
  discountType: string;
  totalSavings: number;
  ruleId: string;
  ruleName: string;
}

// Paginated PriceRule list
export interface PriceRuleListResponse {
  items: PriceRuleWithRelationsResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
