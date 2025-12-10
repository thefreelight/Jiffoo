import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { cartApi, productsApi } from '@/lib/api';
import type { Cart, CartItem } from 'shared/src/types/cart';

// Re-export types for convenience
export type { Cart, CartItem };

// 本地购物车商品接口（用于访客购物车）
interface LocalCartItem {
  productId: string;
  quantity: number;
  variantId?: string;
  // 缓存的商品信息，用于显示
  productName?: string;
  productImage?: string;
  price?: number;
}

interface CartState {
  cart: Cart;
  localCart: LocalCartItem[]; // 访客购物车（本地存储）
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
  resetCart: () => void; // 本地重置购物车（不调用API）
  toggleCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  clearError: () => void;
  // 访客购物车相关
  mergeGuestCart: () => Promise<void>; // 登录后合并访客购物车
  isLoggedIn: () => boolean; // 检查是否已登录
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

// 将本地购物车转换为显示用的 Cart 格式
const localCartToDisplayCart = (localCart: LocalCartItem[]): Cart => {
  const items: CartItem[] = localCart.map((item, index) => ({
    id: `local-${index}`, // 本地 ID
    productId: item.productId,
    productName: item.productName || 'Loading...',
    productImage: item.productImage || '',
    price: item.price || 0,
    quantity: item.quantity,
    variantId: item.variantId,
    maxQuantity: 99,
    subtotal: (item.price || 0) * item.quantity,
    isAvailable: true, // 本地购物车默认可用
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
      localCart: [], // 访客购物车
      isLoading: false,
      error: null,
      isOpen: false,

      // 检查是否已登录
      isLoggedIn: () => {
        if (typeof window === 'undefined') return false;
        return !!localStorage.getItem('auth_token');
      },

      // Actions
      fetchCart: async () => {
        const { isLoggedIn, localCart } = get();

        // 未登录时，使用本地购物车
        if (!isLoggedIn()) {
          console.debug('No auth token, using local cart');
          set({
            cart: localCartToDisplayCart(localCart),
            isLoading: false
          });
          return;
        }

        // 已登录时，从服务器获取购物车
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

        // 未登录时，添加到本地购物车
        if (!isLoggedIn()) {
          try {
            set({ isLoading: true, error: null });

            // 检查是否已存在
            const existingIndex = localCart.findIndex(
              item => item.productId === productId && item.variantId === variantId
            );

            let newLocalCart: LocalCartItem[];
            if (existingIndex >= 0) {
              // 更新数量
              newLocalCart = [...localCart];
              newLocalCart[existingIndex] = {
                ...newLocalCart[existingIndex],
                quantity: newLocalCart[existingIndex].quantity + quantity,
              };
            } else {
              // 获取商品信息（如果没有提供）
              let info = productInfo;
              if (!info) {
                try {
                  const productResponse = await productsApi.getProduct(productId);
                  if (productResponse.success && productResponse.data) {
                    const product = productResponse.data;
                    // 处理图片，可能是字符串或 ProductImage 对象
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

              // 添加新商品
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

        // 已登录时，调用 API
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

        // 未登录时，更新本地购物车
        if (!isLoggedIn()) {
          if (quantity <= 0) {
            await get().removeItem(itemId);
            return;
          }

          // itemId 格式: local-{index}
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

        // 已登录时，调用 API
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

        // 未登录时，从本地购物车删除
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

        // 已登录时，调用 API
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

        // 未登录时，清空本地购物车
        if (!isLoggedIn()) {
          set({
            localCart: [],
            cart: initialCart,
          });
          return;
        }

        // 已登录时，调用 API
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

      // 登录后合并访客购物车到用户购物车
      mergeGuestCart: async () => {
        const { localCart } = get();

        if (localCart.length === 0) {
          console.log('No local cart items to merge');
          // 直接获取用户购物车
          await get().fetchCart();
          return;
        }

        console.log('🔄 Merging guest cart:', localCart.length, 'items');

        try {
          set({ isLoading: true, error: null });

          // 逐个添加本地购物车商品到服务器
          for (const item of localCart) {
            try {
              await cartApi.addToCart(item.productId, item.quantity, item.variantId);
            } catch (e) {
              console.warn('Failed to merge cart item:', item.productId, e);
            }
          }

          // 清空本地购物车
          set({ localCart: [] });

          // 获取合并后的购物车
          await get().fetchCart();

          console.log('✅ Guest cart merged successfully');
        } catch (error: unknown) {
          set({
            isLoading: false,
            error: (error as { message?: string }).message || 'Failed to merge cart',
          });
        }
      },

      // 本地重置购物车（用于租户切换，不调用API）
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
        localCart: state.localCart, // 持久化本地购物车
      }),
    }
  )
);
