import { z } from 'zod';

// Order Item
export const OrderItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().min(1, 'Variant ID is required'),
  quantity: z.number().int().positive('Quantity must be positive'),
  fulfillmentData: z.record(z.unknown()).optional(),
});

export const DEFAULT_COUNTRIES_REQUIRE_STATE_POSTAL = ['US', 'CA', 'AU', 'CN', 'GB'] as const;

export function normalizeCountryCode(country: string): string {
  const value = country.trim().toUpperCase();
  if (value === 'UK') return 'GB';
  return value;
}

export function countryRequiresStatePostal(
  country: string,
  countriesRequireStatePostal: readonly string[] = DEFAULT_COUNTRIES_REQUIRE_STATE_POSTAL
): boolean {
  const code = normalizeCountryCode(country);
  return countriesRequireStatePostal.includes(code);
}

// Shipping Address
export const ShippingAddressSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  phone: z.string().trim().min(1, 'Phone number is required'),
  addressLine1: z.string().trim().min(1, 'Address line 1 is required'),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().min(1, 'City is required'),
  state: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  country: z.string().trim().min(1, 'Country is required'),
  email: z.string().trim().email('Valid email is required').optional(),
});

// Create Order Request
export const CreateOrderSchema = z.object({
  items: z.array(OrderItemSchema).min(1, 'Order must have at least one item'),
  shippingAddress: ShippingAddressSchema.optional(),
  customerEmail: z.string().email('Valid email is required').optional(),
  currency: z.string().optional().default('USD'),
  discountCodes: z.array(z.string()).optional(),
  paymentTermId: z.string().optional(), // B2B payment terms
});

// Order Status Enum
export const OrderStatus = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',  // Order completed
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED'     // Refunded
} as const;

export type OrderStatusType = typeof OrderStatus[keyof typeof OrderStatus];

// Payment Status Enum
export const PaymentStatus = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED'
} as const;

export type PaymentStatusType = typeof PaymentStatus[keyof typeof PaymentStatus];

export const OrderItemFulfillmentStatus = {
  pending: 'pending',
  processing: 'processing',
  shipped: 'shipped',
  delivered: 'delivered',
  failed: 'failed',
} as const;

export type OrderItemFulfillmentStatusType =
  typeof OrderItemFulfillmentStatus[keyof typeof OrderItemFulfillmentStatus];

export const ShipmentStatus = {
  PENDING: 'PENDING',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

export type ShipmentStatusType = typeof ShipmentStatus[keyof typeof ShipmentStatus];

// TypeScript Type Inferenece
export type OrderItemRequest = z.infer<typeof OrderItemSchema>;
export type ShippingAddressRequest = z.infer<typeof ShippingAddressSchema>;
export type CreateOrderRequest = z.infer<typeof CreateOrderSchema>;


// Shipping Address Response
export interface ShippingAddressResponse {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  email?: string;
}

// Shipment Response
export interface ShipmentResponse {
  id: string;
  trackingNumber?: string | null;
  carrier?: string | null;
  status: ShipmentStatusType;
  items: Array<{ id: string; orderItemId: string; quantity: number }>;
}

// Order Response Interface
export interface OrderResponse {
  id: string;
  userId: string;
  status: OrderStatusType;
  paymentStatus: PaymentStatusType;
  subtotalAmount?: number;
  totalAmount: number;
  currency: string;
  shippingAddress: ShippingAddressResponse | null;
  items: OrderItemResponse[];
  shipments?: ShipmentResponse[];
  discountAmount?: number;
  appliedDiscounts?: AppliedDiscountInfo[];
  createdAt: string;
  updatedAt: string;
  cancelReason?: string | null;
  cancelledAt?: string | null;
  paymentTermId?: string | null; // B2B payment term
  paymentDueDate?: string | null; // B2B payment due date
}

// Applied Discount Info for Order Response
export interface AppliedDiscountInfo {
  id: string;
  code: string;
  discountAmount: number;
}

// Order Item Response Interface
export interface OrderItemResponse {
  id: string;
  productId: string;
  productName: string;
  variantId: string;
  variantName?: string;
  variantAttributes?: Record<string, unknown> | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  /**
   * Fulfillment status for this order item.
   * Stored in DB as OrderItem.fulfillmentStatus.
   */
  fulfillmentStatus?: OrderItemFulfillmentStatusType;
  /**
   * Fulfillment data for this order item (e.g., digital delivery payload).
   * Stored in DB as JSON (OrderItem.fulfillmentData).
   */
  fulfillmentData?: Record<string, unknown> | null;
  currency: string;
}

// Paginated Order List Response (PageResult format)
export interface OrderListResponse {
  items: OrderResponse[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
