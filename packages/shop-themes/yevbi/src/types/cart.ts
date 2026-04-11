/**
 * Cart Type Definitions for Yevbi Theme
 * Aligned with backend CartService response
 */

export interface CartItem {
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
  subtotal: number;
}

export interface Cart {
  id: string;
  userId: string;
  items: CartItem[];
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
