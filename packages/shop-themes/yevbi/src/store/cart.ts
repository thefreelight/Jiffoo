/**
 * Simplified cart store for yevbi theme
 * Extended interface to match yevbi component expectations
 */

interface CartItem {
    id: string;
    productId: string;
    name: string;
    productName: string;
    variantName?: string;
    price: number;
    quantity: number;
    maxQuantity: number;
    image?: string;
    productImage?: string;
}

interface Cart {
    items: CartItem[];
    total: number;
    subtotal: number;
    tax: number;
    shipping: number;
    itemCount: number;
}

interface CartState {
    cart: Cart;
    isLoading: boolean;
    addItem: (item: Partial<CartItem>) => void;
    addToCart: (item: { productId: string; quantity: number; variant?: string }) => void;
    removeItem: (id: string) => void;
    updateQuantity: (id: string, quantity: number) => void;
    clearCart: () => void;
    toggleCart: () => void;
}

const emptyCart: Cart = {
    items: [],
    total: 0,
    subtotal: 0,
    tax: 0,
    shipping: 0,
    itemCount: 0,
};

export function useCartStore(): CartState {
    return {
        cart: emptyCart,
        isLoading: false,
        addItem: () => { },
        addToCart: () => { },
        removeItem: () => { },
        updateQuantity: () => { },
        clearCart: () => { },
        toggleCart: () => { },
    };
}
