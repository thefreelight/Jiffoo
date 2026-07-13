/**
 * Cart Store for Yevbi Theme
 *
 * Real implementation using Core API.
 * All cart operations call the actual Cart API endpoints.
 */

import { useState, useEffect, useCallback } from 'react';
import { cartApi, type Cart, type CartItem } from '../lib/api';

interface CartState {
  cart: Cart | null;
  isLoading: boolean;
  error: string | null;
  isCartOpen: boolean;
  // Actions
  fetchCart: () => Promise<void>;
  addToCart: (productId: string, quantity?: number, variantId?: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  toggleCart: () => void;
  openCart: () => void;
  closeCart: () => void;
}

// Empty cart for initial state and unauthenticated users
const emptyCart: Cart = {
  id: '',
  userId: '',
  items: [],
  itemCount: 0,
  subtotal: 0,
  tax: 0,
  shipping: 0,
  discount: 0,
  total: 0,
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/**
 * Cart Store Hook
 *
 * Manages cart state and provides methods to interact with Cart API.
 */
export function useCartStore(): CartState {
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);

  /**
   * Fetch cart from API
   */
  const fetchCart = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const cartData = await cartApi.getCart();
      setCart(cartData);
    } catch (err) {
      console.error('Failed to fetch cart:', err);
      // If user is not authenticated, use empty cart
      setCart(emptyCart);
      // Only set error for actual API failures, not auth issues
      if (err instanceof Error && !err.message.includes('401') && !err.message.includes('Unauthorized')) {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Add item to cart
   */
  const addToCart = useCallback(async (productId: string, quantity: number = 1, variantId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const updatedCart = await cartApi.addToCart(productId, quantity, variantId);
      setCart(updatedCart);
      // Optionally open cart drawer after adding
      setIsCartOpen(true);
    } catch (err) {
      console.error('Failed to add to cart:', err);
      setError(err instanceof Error ? err.message : 'Failed to add item to cart');
      throw err; // Re-throw so caller can handle
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Update cart item quantity
   */
  const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
    if (quantity < 1) {
      return removeItem(itemId);
    }

    setIsLoading(true);
    setError(null);
    try {
      const updatedCart = await cartApi.updateCartItem(itemId, quantity);
      setCart(updatedCart);
    } catch (err) {
      console.error('Failed to update cart item:', err);
      setError(err instanceof Error ? err.message : 'Failed to update item');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Remove item from cart
   */
  const removeItem = useCallback(async (itemId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const updatedCart = await cartApi.removeFromCart(itemId);
      setCart(updatedCart);
    } catch (err) {
      console.error('Failed to remove cart item:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove item');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Clear entire cart
   */
  const clearCart = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const updatedCart = await cartApi.clearCart();
      setCart(updatedCart);
    } catch (err) {
      console.error('Failed to clear cart:', err);
      setError(err instanceof Error ? err.message : 'Failed to clear cart');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Toggle cart drawer
   */
  const toggleCart = useCallback(() => {
    setIsCartOpen((prev) => !prev);
  }, []);

  /**
   * Open cart drawer
   */
  const openCart = useCallback(() => {
    setIsCartOpen(true);
  }, []);

  /**
   * Close cart drawer
   */
  const closeCart = useCallback(() => {
    setIsCartOpen(false);
  }, []);

  // Fetch cart on mount
  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  return {
    cart: cart || emptyCart,
    isLoading,
    error,
    isCartOpen,
    fetchCart,
    addToCart,
    updateQuantity,
    removeItem,
    clearCart,
    toggleCart,
    openCart,
    closeCart,
  };
}

/**
 * Cart Context (optional - for app-wide cart state)
 *
 * If you need to share cart state across components without prop drilling,
 * you can create a React Context:
 *
 * ```tsx
 * import { createContext, useContext, ReactNode } from 'react';
 *
 * const CartContext = createContext<CartState | null>(null);
 *
 * export function CartProvider({ children }: { children: ReactNode }) {
 *   const cartState = useCartStore();
 *   return (
 *     <CartContext.Provider value={cartState}>
 *       {children}
 *     </CartContext.Provider>
 *   );
 * }
 *
 * export function useCart() {
 *   const context = useContext(CartContext);
 *   if (!context) {
 *     throw new Error('useCart must be used within CartProvider');
 *   }
 *   return context;
 * }
 * ```
 */

export type { Cart, CartItem };
