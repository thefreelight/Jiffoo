import { z } from 'zod';

/**
 * Quote Status Enum
 */
export const QuoteStatusEnum = z.enum([
  'DRAFT',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'CONVERTED'
]);

export type QuoteStatus = z.infer<typeof QuoteStatusEnum>;

/**
 * Quote Item Schema (for nested creation)
 */
export const QuoteItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().min(1, 'Variant ID is required'),
  quantity: z.number().int().positive('Quantity must be positive'),
  unitPrice: z.number().nonnegative('Unit price must be non-negative').optional(),
  discount: z.number().nonnegative('Discount must be non-negative').default(0),
  taxRate: z.number().min(0).max(100, 'Tax rate must be between 0 and 100').default(0),
  notes: z.string().optional(),
  skuSnapshot: z.string().optional(),
  customization: z.string().optional() // JSON string
});

/**
 * Create Quote Schema
 */
export const CreateQuoteSchema = z.object({
  companyId: z.string().min(1, 'Company ID is required'),
  userId: z.string().min(1, 'User ID is required').optional(), // Optional, can be inferred from auth
  items: z.array(QuoteItemSchema).min(1, 'At least one item is required'),

  // Validity period
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),

  // Additional information
  notes: z.string().optional(),
  customerNotes: z.string().optional(),
  termsConditions: z.string().optional(),

  // Contact information
  contactName: z.string().optional(),
  contactEmail: z.string().email('Invalid email').optional(),
  contactPhone: z.string().optional(),

  // Shipping address
  shippingAddress1: z.string().optional(),
  shippingAddress2: z.string().optional(),
  shippingCity: z.string().optional(),
  shippingState: z.string().optional(),
  shippingCountry: z.string().optional(),
  shippingPostalCode: z.string().optional()
});

/**
 * Update Quote Schema
 */
export const UpdateQuoteSchema = z.object({
  status: QuoteStatusEnum.optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  notes: z.string().optional(),
  customerNotes: z.string().optional(),
  termsConditions: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email('Invalid email').optional(),
  contactPhone: z.string().optional(),
  shippingAddress1: z.string().optional(),
  shippingAddress2: z.string().optional(),
  shippingCity: z.string().optional(),
  shippingState: z.string().optional(),
  shippingCountry: z.string().optional(),
  shippingPostalCode: z.string().optional(),
  subtotal: z.number().nonnegative().optional(),
  taxAmount: z.number().nonnegative().optional(),
  discountAmount: z.number().nonnegative().optional(),
  shippingAmount: z.number().nonnegative().optional(),
  totalAmount: z.number().nonnegative().optional()
});

/**
 * Approve Quote Schema
 */
export const ApproveQuoteSchema = z.object({
  approvedBy: z.string().min(1, 'Approver ID is required'),
  validUntil: z.string().datetime().optional(), // Can extend validity
  notes: z.string().optional() // Admin notes about approval
});

/**
 * Reject Quote Schema
 */
export const RejectQuoteSchema = z.object({
  rejectedBy: z.string().min(1, 'Rejector ID is required'),
  rejectionReason: z.string().min(1, 'Rejection reason is required')
});

/**
 * TypeScript Types
 */
export type CreateQuoteRequest = z.infer<typeof CreateQuoteSchema>;
export type UpdateQuoteRequest = z.infer<typeof UpdateQuoteSchema>;
export type ApproveQuoteRequest = z.infer<typeof ApproveQuoteSchema>;
export type RejectQuoteRequest = z.infer<typeof RejectQuoteSchema>;
export type QuoteItemRequest = z.infer<typeof QuoteItemSchema>;

/**
 * Response Types
 */
export interface QuoteItemResponse {
  id: string;
  quoteId: string;
  productId: string;
  variantId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  total: number;
  notes?: string;
  skuSnapshot?: string;
  customization?: string;
  createdAt: Date;
  updatedAt: Date;
  product?: {
    id: string;
    name: string;
    slug: string;
  };
  variant?: {
    id: string;
    name: string;
    sku: string;
  };
}

export interface QuoteResponse {
  id: string;
  quoteNumber: string;
  companyId: string;
  userId: string;
  status: QuoteStatus;
  validFrom: Date;
  validUntil?: Date;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  shippingAmount: number;
  totalAmount: number;
  notes?: string;
  customerNotes?: string;
  termsConditions?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  shippingAddress1?: string;
  shippingAddress2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingCountry?: string;
  shippingPostalCode?: string;
  approvedBy?: string;
  approvedAt?: Date;
  rejectedBy?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
  convertedToOrderId?: string;
  convertedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  items?: QuoteItemResponse[];
  company?: {
    id: string;
    name: string;
    email: string;
  };
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface QuoteListResponse {
  quotes: QuoteResponse[];
  total: number;
  page: number;
  limit: number;
}
