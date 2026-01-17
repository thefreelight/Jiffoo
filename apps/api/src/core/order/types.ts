import { z } from 'zod';

// Order Item
export const OrderItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().min(1, 'Variant ID is required'),
  quantity: z.number().int().positive('Quantity must be positive'),
});

// Shipping Address
export const ShippingAddressSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().min(1, 'Country is required'),
});

// Create Order Request
export const CreateOrderSchema = z.object({
  items: z.array(OrderItemSchema).min(1, 'Order must have at least one item'),
  shippingAddress: ShippingAddressSchema.optional(),
  customerEmail: z.string().email('Valid email is required').optional(),
});

// Order Status Enum
export const OrderStatus = {
  PENDING: 'PENDING',
  PAID: 'PAID',
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

// TypeScript Type Inferenece
export type OrderItemRequest = z.infer<typeof OrderItemSchema>;
export type ShippingAddressRequest = z.infer<typeof ShippingAddressSchema>;
export type CreateOrderRequest = z.infer<typeof CreateOrderSchema>;


// Order Response Interface
export interface OrderResponse {
  id: string;
  userId: string;
  status: OrderStatusType;
  paymentStatus: string;
  totalAmount: number;
  shippingAddress: any;
  items: OrderItemResponse[];
  shipments?: any[];
  createdAt: Date;
  updatedAt: Date;
}

// Order Item Response Interface
export interface OrderItemResponse {
  id: string;
  productId: string;
  productName: string;
  variantId: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

// Paginated Order List Response
export interface OrderListResponse {
  data: OrderResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
