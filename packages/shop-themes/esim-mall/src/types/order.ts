/**
 * Order Type Definitions for eSIM Mall Theme
 * Aligned with backend OrderService.formatOrderResponse
 */

export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

export type PaymentStatus =
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED';

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  variantId: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  fulfillmentStatus: string | null;
  fulfillmentData: Record<string, unknown> | null;
}

export interface OrderAddress {
  id?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city: string;
  state?: string;
  country: string;
  postalCode?: string;
  email?: string;
}

export interface Order {
  id: string;
  userId: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  currency: string;
  shippingAddress: OrderAddress | null;
  shipments: any[];
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
  cancelReason: string | null;
  cancelledAt: string | null;
}
