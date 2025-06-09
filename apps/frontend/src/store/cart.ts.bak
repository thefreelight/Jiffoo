import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { cartApi } from '@/lib/api';

export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  price: number;
  quantity: number;
  variantId?: string;
  variantName?: string;
  maxQuantity: number;
}

export interface Cart {
  items: CartItem[];
  total: number;
  itemCount: number;
  subtotal: number;
  tax: number;
  shipping: number;
}

interface CartState {
  cart: Cart;
  isLoading: boolean;
  error: string | null;
  isOpen: boolean;
}

interface CartActions {
  fetchCart: () => Promise<void>;
  addToCart: (productId: string, quantity: number, variantId?: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  toggleCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  clearError: () => void;
}

const initialCart: Cart = {
  items: [],
  total: 0,
  itemCount: 0,
  subtotal: 0,
  tax: 0,
  shipping: 0,
};

export const useCartStore = create<CartState & CartActions>()(
  persist(
    (set, get) => ({
      // State
      cart: initialCart,
      isLoading: false,
      error: null,
      isOpen: false,

      // Actions
      fetchCart: async () => {
        try {
          set({ isLoading: true, error: null });
          
          const response = await cartApi.getCart();
          
          if (response.success && response.data) {
            set({
              cart: response.data,
              isLoading: false,
              error: null,
            });
          } else {
            throw new Error(response.message || 'Failed to fetch cart');
          }
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.response?.data?.message || error.message || 'Failed to fetch cart',
          });
        }
      },

      addToCart: async (productId: string, quantity: number, variantId?: string) => {
        try {
          set({ isLoading: true, error: null });
          
          const response = await cartApi.addToCart(productId, quantity, variantId);
          
          if (response.success && response.data) {
            set({
              cart: response.data,
              isLoading: false,
              error: null,
              isOpen: true, // Open cart after adding item
            });
          } else {
            throw new Error(response.message || 'Failed to add to cart');
          }
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.response?.data?.message || error.message || 'Failed to add to cart',
          });
          throw error;
        }
      },

      updateQuantity: async (itemId: string, quantity: number) => {
        try {
          set({ isLoading: true, error: null });
          
          if (quantity <= 0) {
            await get().removeItem(itemId);
            return;
          }
          
          const response = await cartApi.updateCartItem(itemId, quantity);
          
          if (response.success && response.data) {
            set({
              cart: response.data,
              isLoading: false,
              error: null,
            });
          } else {
            throw new Error(response.message || 'Failed to update cart');
          }
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.response?.data?.message || error.message || 'Failed to update cart',
          });
          throw error;
        }
      },

      removeItem: async (itemId: string) => {
        try {
          set({ isLoading: true, error: null });
          
          const response = await cartApi.removeFromCart(itemId);
          
          if (response.success && response.data) {
            set({
              cart: response.data,
              isLoading: false,
              error: null,
            });
          } else {
            throw new Error(response.message || 'Failed to remove item');
          }
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.response?.data?.message || error.message || 'Failed to remove item',
          });
          throw error;
        }
      },

      clearCart: async () => {
        try {
          set({ isLoading: true, error: null });
          
          const response = await cartApi.clearCart();
          
          if (response.success) {
            set({
              cart: initialCart,
              isLoading: false,
              error: null,
            });
          } else {
            throw new Error(response.message || 'Failed to clear cart');
          }
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.response?.data?.message || error.message || 'Failed to clear cart',
          });
          throw error;
        }
      },

      toggleCart: () => {
        set((state) => ({ isOpen: !state.isOpen }));
      },

      openCart: () => {
        set({ isOpen: true });
      },

      closeCart: () => {
        set({ isOpen: false });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'cart-storage',
      partialize: (state) => ({
        cart: state.cart,
      }),
    }
  )
);
