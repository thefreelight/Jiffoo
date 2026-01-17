import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { cartApi, productsApi } from '@/lib/api';
import type { Cart, CartItem } from 'shared/src/types/cart';

// Re-export types for convenience
export type { Cart, CartItem };

// Local cart item interface (used for guest cart)
interface LocalCartItem {
  productId: string;
  quantity: number;
  variantId?: string;
  // Cached product info for display
  productName?: string;
  productImage?: string;
  price?: number;
}

interface CartState {
  cart: Cart;
  localCart: LocalCartItem[]; // Guest cart (local storage)
  isLoading: boolean;
  error: string | null;
  isOpen: boolean;
}

interface CartActions {
  fetchCart: () => Promise<void>;
  addToCart: (productId: string, quantity: number, variantId?: string, productInfo?: { name: string; image: string; price: number }) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  resetCart: () => void; // Local reset of cart (no API call)
  toggleCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  clearError: () => void;
  // Guest cart related
  mergeGuestCart: () => Promise<void>; // Merge guest cart after login
  isLoggedIn: () => boolean; // Check if logged in
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

// Convert local cart to display format Cart
const localCartToDisplayCart = (localCart: LocalCartItem[]): Cart => {
  const items: CartItem[] = localCart.map((item, index) => ({
    id: `local-${index}`, // Local ID
    productId: item.productId,
    productName: item.productName || 'Loading...',
    productImage: item.productImage || '',
    price: item.price || 0,
    quantity: item.quantity,
    variantId: item.variantId,
    maxQuantity: 99,
    subtotal: (item.price || 0) * item.quantity,
    isAvailable: true, // Local cart items are available by default
  }));

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);

  return {
    items,
    total: subtotal,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal,
    tax: 0,
    shipping: 0,
    discount: 0,
    currency: 'USD',
    updatedAt: new Date().toISOString(),
  };
};

export const useCartStore = create<CartState & CartActions>()(
  persist(
    (set, get) => ({
      // State
      cart: initialCart,
      localCart: [], // Guest cart
      isLoading: false,
      error: null,
      isOpen: false,

      // Check if logged in
      isLoggedIn: () => {
        if (typeof window === 'undefined') return false;
        return !!localStorage.getItem('auth_token');
      },

      // Actions
      fetchCart: async () => {
        const { isLoggedIn, localCart } = get();

        // Use local cart when not logged in
        if (!isLoggedIn()) {
          console.debug('No auth token, using local cart');
          set({
            cart: localCartToDisplayCart(localCart),
            isLoading: false
          });
          return;
        }

        // Fetch cart from server when logged in
        try {
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

      addToCart: async (productId: string, quantity: number, variantId?: string, productInfo?: { name: string; image: string; price: number }) => {
        const { isLoggedIn, localCart } = get();

        // Add to local cart when not logged in
        if (!isLoggedIn()) {
          try {
            set({ isLoading: true, error: null });

            // Check if already exists
            const existingIndex = localCart.findIndex(
              item => item.productId === productId && item.variantId === variantId
            );

            let newLocalCart: LocalCartItem[];
            if (existingIndex >= 0) {
              // Update quantity
              newLocalCart = [...localCart];
              newLocalCart[existingIndex] = {
                ...newLocalCart[existingIndex],
                quantity: newLocalCart[existingIndex].quantity + quantity,
              };
            } else {
              // Fetch product info if not provided
              let info = productInfo;
              if (!info) {
                try {
                  const productResponse = await productsApi.getProduct(productId);
                  if (productResponse.success && productResponse.data) {
                    const product = productResponse.data;
                    // Handle image, could be string or ProductImage object
                    let imageUrl = '';
                    if (Array.isArray(product.images) && product.images.length > 0) {
                      const firstImage = product.images[0];
                      if (typeof firstImage === 'string') {
                        imageUrl = firstImage;
                      } else if (firstImage && typeof firstImage === 'object' && 'url' in firstImage) {
                        imageUrl = (firstImage as { url: string }).url;
                      }
                    }
                    info = {
                      name: product.name,
                      image: imageUrl,
                      price: product.price,
                    };
                  }
                } catch (e) {
                  console.warn('Failed to fetch product info for local cart:', e);
                }
              }

              // Add new product
              newLocalCart = [...localCart, {
                productId,
                quantity,
                variantId,
                productName: info?.name,
                productImage: info?.image,
                price: info?.price,
              }];
            }

            set({
              localCart: newLocalCart,
              cart: localCartToDisplayCart(newLocalCart),
              isLoading: false,
              error: null,
              isOpen: true,
            });

            console.log('✅ Added to local cart (guest mode):', { productId, quantity });
          } catch (error: unknown) {
            set({
              isLoading: false,
              error: (error as { message?: string }).message || 'Failed to add to cart',
            });
            throw error;
          }
          return;
        }

        // Call API when logged in
        try {
          set({ isLoading: true, error: null });
          const response = await cartApi.addToCart(productId, quantity, variantId);

          if (response.success && response.data) {
            set({
              cart: response.data as unknown as Cart,
              isLoading: false,
              error: null,
              isOpen: true,
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
        const { isLoggedIn, localCart } = get();

        // Update local cart when not logged in
        if (!isLoggedIn()) {
          if (quantity <= 0) {
            await get().removeItem(itemId);
            return;
          }

          // itemId format: local-{index}
          const index = parseInt(itemId.replace('local-', ''), 10);
          if (!isNaN(index) && index >= 0 && index < localCart.length) {
            const newLocalCart = [...localCart];
            newLocalCart[index] = { ...newLocalCart[index], quantity };
            set({
              localCart: newLocalCart,
              cart: localCartToDisplayCart(newLocalCart),
            });
          }
          return;
        }

        // Call API when logged in
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
        const { isLoggedIn, localCart } = get();

        // Remove from local cart when not logged in
        if (!isLoggedIn()) {
          const index = parseInt(itemId.replace('local-', ''), 10);
          if (!isNaN(index) && index >= 0 && index < localCart.length) {
            const newLocalCart = localCart.filter((_, i) => i !== index);
            set({
              localCart: newLocalCart,
              cart: localCartToDisplayCart(newLocalCart),
            });
          }
          return;
        }

        // Call API when logged in
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
        const { isLoggedIn } = get();

        // Clear local cart when not logged in
        if (!isLoggedIn()) {
          set({
            localCart: [],
            cart: initialCart,
          });
          return;
        }

        // Call API when logged in
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

      // Merge guest cart into user cart after login
      mergeGuestCart: async () => {
        const { localCart } = get();

        if (localCart.length === 0) {
          console.log('No local cart items to merge');
          // Fetch user cart directly
          await get().fetchCart();
          return;
        }

        console.log('🔄 Merging guest cart:', localCart.length, 'items');

        try {
          set({ isLoading: true, error: null });

          // Add guest cart items to server one by one
          for (const item of localCart) {
            try {
              await cartApi.addToCart(item.productId, item.quantity, item.variantId);
            } catch (e) {
              console.warn('Failed to merge cart item:', item.productId, e);
            }
          }

          // Clear local cart
          set({ localCart: [] });

          // Get merged cart
          await get().fetchCart();

          console.log('✅ Guest cart merged successfully');
        } catch (error: unknown) {
          set({
            isLoading: false,
            error: (error as { message?: string }).message || 'Failed to merge cart',
          });
        }
      },

      // Local reset of cart (for tenant switching, no API call)
      resetCart: () => {
        set({
          cart: initialCart,
          localCart: [],
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
        localCart: state.localCart, // Persist local cart
      }),
    }
  )
);
