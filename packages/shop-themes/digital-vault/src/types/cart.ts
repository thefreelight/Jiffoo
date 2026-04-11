export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  price: number;
  quantity: number;
  variantId: string;
  variantName?: string;
  requiresShipping: boolean;
  maxQuantity: number;
  subtotal: number;
  [key: string]: unknown;
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
