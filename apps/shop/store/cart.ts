import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { cartApi } from '@/lib/api';
import type { Cart, CartItem } from 'shared/src/types/cart';

// Re-export types for convenience
export type { Cart, CartItem };

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
  resetCart: () => void; // 本地重置购物车（不调用API）
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
  discount: 0,
  currency: 'USD',
  updatedAt: new Date().toISOString(),
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
          // 检查是否有认证token，如果没有则直接返回
          // 这样可以避免在租户切换或退出登录时触发不必要的API调用
          if (typeof window !== 'undefined') {
            const authToken = localStorage.getItem('auth_token');
            if (!authToken) {
              console.debug('No auth token available, skipping cart fetch');
              set({ isLoading: false });
              return;
            }
          }

          set({ isLoading: true, error: null });

          const response = await cartApi.getCart();

          if (response.success && response.data) {
            set({
              cart: response.data as unknown as Cart,
              isLoading: false,
              error: null,
            });
          } else {
            throw new Error(response.message || 'Failed to fetch cart');
          }
        } catch (error: unknown) {
          set({
            isLoading: false,
            error: (error as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message || (error as { message?: string }).message || 'Failed to fetch cart',
          });
        }
      },

      addToCart: async (productId: string, quantity: number, variantId?: string) => {
        try {
          set({ isLoading: true, error: null });
          
          const response = await cartApi.addToCart(productId, quantity, variantId);
          
          if (response.success && response.data) {
            set({
              cart: response.data as unknown as Cart,
              isLoading: false,
              error: null,
              isOpen: true, // Open cart after adding item
            });
          } else {
            throw new Error(response.message || 'Failed to add to cart');
          }
        } catch (error: unknown) {
          set({
            isLoading: false,
            error: (error as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message || (error as { message?: string }).message || 'Failed to add to cart',
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
              cart: response.data as unknown as Cart,
              isLoading: false,
              error: null,
            });
          } else {
            throw new Error(response.message || 'Failed to update cart');
          }
        } catch (error: unknown) {
          set({
            isLoading: false,
            error: (error as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message || (error as { message?: string }).message || 'Failed to update cart',
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
              cart: response.data as unknown as Cart,
              isLoading: false,
              error: null,
            });
          } else {
            throw new Error(response.message || 'Failed to remove item');
          }
        } catch (error: unknown) {
          set({
            isLoading: false,
            error: (error as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message || (error as { message?: string }).message || 'Failed to remove item',
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
        } catch (error: unknown) {
          set({
            isLoading: false,
            error: (error as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message || (error as { message?: string }).message || 'Failed to clear cart',
          });
          throw error;
        }
      },

      // 本地重置购物车（用于租户切换，不调用API）
      resetCart: () => {
        set({
          cart: initialCart,
          isLoading: false,
          error: null,
          isOpen: false,
        });
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
