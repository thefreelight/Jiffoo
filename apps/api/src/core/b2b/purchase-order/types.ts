import { z } from 'zod';

/**
 * Purchase Order Status Enum
 */
export const PurchaseOrderStatusEnum = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'ORDERED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CANCELLED'
]);

export type PurchaseOrderStatus = z.infer<typeof PurchaseOrderStatusEnum>;

/**
 * Payment Status Enum
 */
export const PaymentStatusEnum = z.enum([
  'UNPAID',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE'
]);

export type PaymentStatus = z.infer<typeof PaymentStatusEnum>;

/**
 * Purchase Order Item Schema (for nested creation)
 */
export const PurchaseOrderItemSchema = z.object({
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
 * Create Purchase Order Schema
 */
export const CreatePurchaseOrderSchema = z.object({
  companyId: z.string().min(1, 'Company ID is required'),
  userId: z.string().min(1, 'User ID is required').optional(), // Optional, can be inferred from auth
  quoteId: z.string().optional(), // Optional reference to quote
  items: z.array(PurchaseOrderItemSchema).min(1, 'At least one item is required'),

  // Payment terms
  paymentTermId: z.string().optional(),

  // Dates
  expectedDate: z.string().datetime().optional(),

  // Additional information
  notes: z.string().optional(),
  customerNotes: z.string().optional(),
  termsConditions: z.string().optional(),
  internalRef: z.string().optional(),

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
  shippingPostalCode: z.string().optional(),

  // Billing address
  billingAddress1: z.string().optional(),
  billingAddress2: z.string().optional(),
  billingCity: z.string().optional(),
  billingState: z.string().optional(),
  billingCountry: z.string().optional(),
  billingPostalCode: z.string().optional()
});

/**
 * Update Purchase Order Schema
 */
export const UpdatePurchaseOrderSchema = z.object({
  status: PurchaseOrderStatusEnum.optional(),
  paymentStatus: PaymentStatusEnum.optional(),
  paymentTermId: z.string().optional(),
  expectedDate: z.string().datetime().optional(),
  receivedDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  customerNotes: z.string().optional(),
  termsConditions: z.string().optional(),
  internalRef: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email('Invalid email').optional(),
  contactPhone: z.string().optional(),
  shippingAddress1: z.string().optional(),
  shippingAddress2: z.string().optional(),
  shippingCity: z.string().optional(),
  shippingState: z.string().optional(),
  shippingCountry: z.string().optional(),
  shippingPostalCode: z.string().optional(),
  billingAddress1: z.string().optional(),
  billingAddress2: z.string().optional(),
  billingCity: z.string().optional(),
  billingState: z.string().optional(),
  billingCountry: z.string().optional(),
  billingPostalCode: z.string().optional(),
  trackingNumber: z.string().optional(),
  carrier: z.string().optional(),
  subtotal: z.number().nonnegative().optional(),
  taxAmount: z.number().nonnegative().optional(),
  discountAmount: z.number().nonnegative().optional(),
  shippingAmount: z.number().nonnegative().optional(),
  totalAmount: z.number().nonnegative().optional()
});

/**
 * Approve Purchase Order Schema
 */
export const ApprovePurchaseOrderSchema = z.object({
  approvedBy: z.string().min(1, 'Approver ID is required'),
  notes: z.string().optional() // Admin notes about approval
});

/**
 * Reject Purchase Order Schema
 */
export const RejectPurchaseOrderSchema = z.object({
  rejectedBy: z.string().min(1, 'Rejector ID is required'),
  rejectionReason: z.string().min(1, 'Rejection reason is required')
});

/**
 * Receive Purchase Order Items Schema
 */
export const ReceivePurchaseOrderItemSchema = z.object({
  itemId: z.string().min(1, 'Item ID is required'),
  quantityReceived: z.number().int().positive('Quantity must be positive'),
  receivedBy: z.string().min(1, 'Receiver ID is required'),
  notes: z.string().optional()
});

/**
 * TypeScript Types
 */
export type CreatePurchaseOrderRequest = z.infer<typeof CreatePurchaseOrderSchema>;
export type UpdatePurchaseOrderRequest = z.infer<typeof UpdatePurchaseOrderSchema>;
export type ApprovePurchaseOrderRequest = z.infer<typeof ApprovePurchaseOrderSchema>;
export type RejectPurchaseOrderRequest = z.infer<typeof RejectPurchaseOrderSchema>;
export type ReceivePurchaseOrderItemRequest = z.infer<typeof ReceivePurchaseOrderItemSchema>;
export type PurchaseOrderItemRequest = z.infer<typeof PurchaseOrderItemSchema>;

/**
 * Response Types
 */
export interface PurchaseOrderItemResponse {
  id: string;
  purchaseOrderId: string;
  productId: string;
  variantId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  total: number;
  quantityReceived: number;
  receivedDate?: Date;
  receivedBy?: string;
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

export interface PurchaseOrderResponse {
  id: string;
  poNumber: string;
  companyId: string;
  userId: string;
  quoteId?: string;
  status: PurchaseOrderStatus;
  paymentStatus: PaymentStatus;
  paymentTermId?: string;
  orderDate: Date;
  approvalDate?: Date;
  expectedDate?: Date;
  receivedDate?: Date;
  paymentDueDate?: Date;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  shippingAmount: number;
  totalAmount: number;
  notes?: string;
  customerNotes?: string;
  termsConditions?: string;
  internalRef?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  shippingAddress1?: string;
  shippingAddress2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingCountry?: string;
  shippingPostalCode?: string;
  billingAddress1?: string;
  billingAddress2?: string;
  billingCity?: string;
  billingState?: string;
  billingCountry?: string;
  billingPostalCode?: string;
  approvedBy?: string;
  approvedAt?: Date;
  rejectedBy?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
  trackingNumber?: string;
  carrier?: string;
  createdAt: Date;
  updatedAt: Date;
  items?: PurchaseOrderItemResponse[];
  company?: {
    id: string;
    name: string;
    email: string;
  };
  user?: {
    id: string;
    username: string;
    email: string;
  };
  paymentTerm?: {
    id: string;
    code: string;
    name: string;
    dueInDays: number;
  };
}

export interface PurchaseOrderListResponse {
  purchaseOrders: PurchaseOrderResponse[];
  total: number;
  page: number;
  limit: number;
}
