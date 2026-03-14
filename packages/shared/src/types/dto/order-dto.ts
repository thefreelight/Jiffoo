/**
 * Order DTO Types
 * Strictly aligned with actual backend response structure (OrderService.formatOrderResponse)
 *
 * Backend returns the SAME shape for list / detail / create / cancel.
 * ShopOrderListItemDTO is kept as a lighter alias for list rendering;
 * ShopOrderDetailDTO is the full response type.
 */

// ============================================================================
// Order Item DTO  (backend: OrderItemResponse)
// ============================================================================

export interface OrderItemDTO {
  id: string;
  productId: string;
  productName: string;
  variantId: string;
  variantName?: string;
  variantAttributes?: Record<string, unknown> | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number; // unitPrice * quantity (computed by backend)
  fulfillmentStatus: string | null;
  fulfillmentData: Record<string, unknown> | null;
}

// ============================================================================
// Shop Order List Item DTO  (GET /api/orders — paginated list)
// ============================================================================

export interface ShopOrderListItemDTO {
  id: string;
  userId: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  currency: string;
  shippingAddress: OrderAddressDTO | null;
  shipments: any[];
  items: OrderItemDTO[];
  createdAt: string;
  updatedAt: string;
  cancelReason: string | null;
  cancelledAt: string | null;
}

// ============================================================================
// Shop Order Detail DTO  (GET /api/orders/:id — single order)
// Backend returns exactly the same shape as list items.
// ============================================================================

export type ShopOrderDetailDTO = ShopOrderListItemDTO;

// ============================================================================
// Admin Order DTOs
// ============================================================================

// Admin order list item DTO (flattened customer info)
export interface AdminOrderListItemDTO {
  id: string;
  status: string;
  paymentStatus?: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
  itemsCount?: number;
  customer: {
    id: string | null;
    email: string | null;
    username: string | null;
  };
}

// Admin order item DTO
export interface AdminOrderItemDTO {
  id: string;
  productId: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  productName: string | null;
  variantId: string | null;
  skuCode: string | null;
  variantName: string | null;
  fulfillmentStatus?: string;
  fulfillmentData?: Record<string, unknown> | null;
  product?: {
    id: string;
    name: string;
    images: string | null;
    category?: string;
  };
}

// Admin order detail DTO
export interface AdminOrderDetailDTO {
  id: string;
  userId: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  currency: string;
  customerEmail?: string;
  shippingAddress: OrderAddressDTO | null;
  createdAt: string;
  updatedAt: string;
  notes?: string | null;
  paymentMethod?: string | null;
  paymentAttempts?: number;
  lastPaymentAttemptAt?: string | null;
  expiresAt?: string | null;
  cancelReason?: string | null;
  cancelledAt?: string | null;
  stripePaymentIntentId?: string | null;
  payments?: Array<{
    id: string;
    paymentIntentId?: string | null;
    status: string;
  }>;
  customer?: {
    id: string | null;
    email: string | null;
    username: string | null;
  };
  shipments?: Array<{
    id: string;
    carrier: string;
    trackingNumber: string;
    status: string;
    shippedAt?: string | null;
    deliveredAt?: string | null;
  }>;
  items: AdminOrderItemDTO[];
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

// ============================================================================
// Order Address DTO  (backend: OrderAddress model)
// ============================================================================

export interface OrderAddressDTO {
  id?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  recipientName?: string;
  phone?: string;
  street?: string;
  street2?: string;
  address?: string;
  addressLine1?: string;
  addressLine2?: string;
  city: string;
  state?: string;
  country: string;
  postalCode?: string;
  zipCode?: string;
  email?: string;
  isDefault?: boolean;
}

// ============================================================================
// Status Enums (union types matching backend constants)
// ============================================================================

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
