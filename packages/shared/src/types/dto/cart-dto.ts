/**
 * Cart DTO Types
 * Strictly aligned with actual backend response structure (CartService)
 *
 * Backend Cart interface lives in apps/api/src/core/cart/service.ts.
 * The API always returns the same shape for get / add / update / remove / clear.
 */

// ============================================================================
// Cart Item DTO  (backend: CartItem)
// ============================================================================

export interface CartItemDTO {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  price: number;
  quantity: number;
  variantId: string;
  variantName?: string;
  variantAttributes?: Record<string, unknown> | null;
  requiresShipping: boolean;
  maxQuantity: number;
  subtotal: number; // price * quantity (computed by backend)
  originalPrice?: number; // original price before discount (optional)
  isAvailable?: boolean; // whether the item is currently available
  fulfillmentData?: Record<string, unknown> | null;
}

// ============================================================================
// Cart DTO  (backend: Cart)
// ============================================================================

export interface CartDTO {
  id: string;
  userId: string;
  items: CartItemDTO[];
  itemCount: number;
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Request DTOs
// ============================================================================

export interface AddToCartRequestDTO {
  productId: string;
  quantity: number;
  variantId: string;
  fulfillmentData?: Record<string, unknown>;
}

export interface UpdateCartItemRequestDTO {
  itemId: string;
  quantity: number;
}
