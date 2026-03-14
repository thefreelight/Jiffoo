import { z } from 'zod';

/**
 * Payment Term Types and Validation Schemas
 *
 * Supports Net 15, Net 30, Net 60, Net 90, and Immediate payment terms
 */

// Enum for payment term codes
export const PaymentTermCodeEnum = z.enum(['IMMEDIATE', 'NET15', 'NET30', 'NET60', 'NET90']);
export type PaymentTermCode = z.infer<typeof PaymentTermCodeEnum>;

// Create payment term schema
export const CreatePaymentTermSchema = z.object({
  code: z.string().min(1, 'Payment term code is required'),
  name: z.string().min(1, 'Payment term name is required'),
  description: z.string().optional(),
  dueInDays: z.number().int().min(0).default(0), // 0 = immediate payment
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).optional().default(0),
});

// Update payment term schema (all fields optional)
export const UpdatePaymentTermSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  dueInDays: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// Update payment term status schema (for admin actions)
export const UpdatePaymentTermStatusSchema = z.object({
  isActive: z.boolean(),
});

// Calculate due date schema
export const CalculateDueDateSchema = z.object({
  paymentTermId: z.string().optional(),
  paymentTermCode: z.string().optional(),
  startDate: z.date().or(z.string().datetime()),
}).refine(
  (data) => data.paymentTermId || data.paymentTermCode,
  {
    message: 'Either paymentTermId or paymentTermCode must be provided',
  }
);

// Type exports
export type CreatePaymentTermRequest = z.infer<typeof CreatePaymentTermSchema>;
export type UpdatePaymentTermRequest = z.infer<typeof UpdatePaymentTermSchema>;
export type UpdatePaymentTermStatusRequest = z.infer<typeof UpdatePaymentTermStatusSchema>;
export type CalculateDueDateRequest = z.infer<typeof CalculateDueDateSchema>;

// Response types
export interface PaymentTermResponse {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  dueInDays: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

// Response type with purchase order count
export interface PaymentTermWithCountResponse extends PaymentTermResponse {
  _count: {
    purchaseOrders: number;
  };
}

// Due date calculation result
export interface DueDateCalculationResult {
  paymentTermId: string;
  paymentTermCode: string;
  paymentTermName: string;
  dueInDays: number;
  startDate: Date;
  dueDate: Date;
  isImmediate: boolean;
}

// Paginated payment term list
export interface PaymentTermListResponse {
  paymentTerms: PaymentTermWithCountResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
