import { z } from 'zod';

// Discount Type Enum
export const DiscountType = {
  PERCENTAGE: 'PERCENTAGE',
  FIXED_AMOUNT: 'FIXED_AMOUNT',
  BUY_X_GET_Y: 'BUY_X_GET_Y',
  FREE_SHIPPING: 'FREE_SHIPPING',
} as const;

export type DiscountTypeType = typeof DiscountType[keyof typeof DiscountType];

// Create Discount Request Schema
export const CreateDiscountSchema = z.object({
  code: z.string().min(1, 'Discount code is required').toUpperCase(),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'BUY_X_GET_Y', 'FREE_SHIPPING'], {
    errorMap: () => ({ message: 'Invalid discount type' }),
  }),
  value: z.number().positive('Value must be positive'),
  minAmount: z.number().positive('Minimum amount must be positive').optional(),
  maxUses: z.number().int().positive('Max uses must be a positive integer').optional(),
  startDate: z.string().datetime('Invalid start date').optional(),
  endDate: z.string().datetime('Invalid end date').optional(),
  isActive: z.boolean().default(true),
  stackable: z.boolean().default(false),
  description: z.string().optional(),
  productIds: z.array(z.string()).optional(), // For product-specific discounts
  customerGroups: z.array(z.string()).optional(), // For customer group restrictions
}).refine(
  (data) => {
    if (data.type === 'PERCENTAGE' && data.value > 100) {
      return false;
    }
    return true;
  },
  {
    message: 'Percentage discount value cannot exceed 100',
    path: ['value'],
  }
).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) < new Date(data.endDate);
    }
    return true;
  },
  {
    message: 'End date must be after start date',
    path: ['endDate'],
  }
);

// Update Discount Request Schema
export const UpdateDiscountSchema = z.object({
  code: z.string().min(1, 'Discount code is required').toUpperCase().optional(),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'BUY_X_GET_Y', 'FREE_SHIPPING']).optional(),
  value: z.number().positive('Value must be positive').optional(),
  minAmount: z.number().positive('Minimum amount must be positive').optional().nullable(),
  maxUses: z.number().int().positive('Max uses must be a positive integer').optional().nullable(),
  startDate: z.string().datetime('Invalid start date').optional().nullable(),
  endDate: z.string().datetime('Invalid end date').optional().nullable(),
  isActive: z.boolean().optional(),
  stackable: z.boolean().optional(),
  description: z.string().optional().nullable(),
  productIds: z.array(z.string()).optional(),
  customerGroups: z.array(z.string()).optional(),
}).refine(
  (data) => {
    if (data.type === 'PERCENTAGE' && data.value && data.value > 100) {
      return false;
    }
    return true;
  },
  {
    message: 'Percentage discount value cannot exceed 100',
    path: ['value'],
  }
).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) < new Date(data.endDate);
    }
    return true;
  },
  {
    message: 'End date must be after start date',
    path: ['endDate'],
  }
);

// Validate Discount Code Request Schema
export const ValidateDiscountSchema = z.object({
  code: z.string().min(1, 'Discount code is required'),
  userId: z.string().optional(),
  cartTotal: z.number().positive('Cart total must be positive').optional(),
  productIds: z.array(z.string()).optional(),
});

// TypeScript Type Inference
export type CreateDiscountRequest = z.infer<typeof CreateDiscountSchema>;
export type UpdateDiscountRequest = z.infer<typeof UpdateDiscountSchema>;
export type ValidateDiscountRequest = z.infer<typeof ValidateDiscountSchema>;

// Discount Response Interface
export interface DiscountResponse {
  id: string;
  code: string;
  type: DiscountTypeType;
  value: number;
  minAmount: number | null;
  maxUses: number | null;
  usedCount: number;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  stackable: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  products?: ProductDiscountResponse[];
  customerGroups?: CustomerGroupDiscountResponse[];
}

// Product Discount Response Interface
export interface ProductDiscountResponse {
  id: string;
  productId: string;
  productName?: string;
}

// Customer Group Discount Response Interface
export interface CustomerGroupDiscountResponse {
  id: string;
  customerGroup: string;
}

// Discount Usage Response Interface
export interface DiscountUsageResponse {
  id: string;
  discountId: string;
  userId: string;
  orderId: string;
  discountAmount: number;
  createdAt: string;
}

// Discount Validation Result Interface
export interface DiscountValidationResult {
  isValid: boolean;
  discount?: DiscountResponse;
  errors?: string[];
}

// Applied Discount Interface (for cart/order calculations)
export interface AppliedDiscount {
  id: string;
  code: string;
  type: DiscountTypeType;
  value: number;
  discountAmount: number;
}

// Paginated Discount List Response (PageResult format)
export interface DiscountListResponse {
  items: DiscountResponse[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
