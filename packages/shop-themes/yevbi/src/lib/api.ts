/**
 * API client for the embedded Yevbi storefront theme.
 *
 * All API calls go through the platform API gateway endpoints.
 */

import { createThemeApiClient } from '@jiffoo/theme-api-sdk';

// Product types aligned with Core API
export interface Product {
  id: string;
  name: string;
  description?: string;
  images: string[];
  price: number;
  originalPrice?: number;
  stock: number;
  inventory?: {
    available?: number;
    isInStock?: boolean;
  };
  typeData?: Record<string, unknown> | null;
  variants?: ProductVariant[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  skuCode: string | null;
  salePrice: number;
  baseStock: number;
  isActive: boolean;
  attributes: Record<string, unknown>;
}

export interface ProductListResponse {
  items: Product[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Cart types aligned with Core API (CartService response)
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

// Category type
export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parentId?: string | null;
  productCount?: number;
}

// Order types
export interface Order {
  id: string;
  orderNumber?: string;
  userId?: string;
  status: string;
  paymentStatus?: string;
  totalAmount: number;
  currency: string;
  itemsCount?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface OrderDetail extends Order {
  items: OrderItem[];
  shippingAddress?: OrderAddress;
  billingAddress?: OrderAddress;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productImage?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  variantName?: string;
  variantAttributes?: Record<string, unknown> | null;
  /** Fulfillment status (written by plugins) */
  fulfillmentStatus?: string;
  /** Fulfillment data (written by plugins, e.g., eSIM QR code, tracking number) */
  fulfillmentData?: Record<string, unknown> | null;
}

export interface OrderAddress {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phone?: string;
  email?: string;
}

const themeApi = createThemeApiClient({
  baseUrl: '',
  apiPrefix: '/api',
  credentials: 'include',
  token: () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('auth_token') || getCookie('auth_token');
  },
});

/**
 * Generic fetch wrapper with error handling
 */
async function fetchApi<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    headers?: HeadersInit;
    body?: unknown;
  } = {}
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase() as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  return themeApi.request<T>(endpoint, {
    method,
    headers: options.headers,
    body: options.body,
  });
}

/**
 * Helper to get cookie value
 */
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}

// ============================================
// Products API
// ============================================

export interface ProductFilters {
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const productsApi = {
  /**
   * Get products list with pagination and filters
   */
  getProducts: async (
    page: number = 1,
    limit: number = 12,
    filters: ProductFilters = {},
    locale: string = 'en'
  ): Promise<ProductListResponse> => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      locale,
    });

    if (filters.search) params.append('search', filters.search);
    if (filters.category) params.append('category', filters.category);
    if (filters.minPrice !== undefined) params.append('minPrice', filters.minPrice.toString());
    if (filters.maxPrice !== undefined) params.append('maxPrice', filters.maxPrice.toString());
    if (filters.inStock !== undefined) params.append('inStock', filters.inStock.toString());
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

    return fetchApi<ProductListResponse>(`/products?${params.toString()}`);
  },

  /**
   * Get single product by ID
   */
  getProduct: async (id: string, locale: string = 'en'): Promise<Product> => {
    return fetchApi<Product>(`/products/${id}?locale=${locale}`);
  },

  /**
   * Get product categories
   */
  getCategories: async (): Promise<Category[]> => {
    const response = await fetchApi<unknown>('/products/categories');
    const normalize = (items: Category[]) =>
      items.filter((item) => {
        const normalizedName = String(item?.name || '').trim().toLowerCase();
        const normalizedSlug = String(item?.slug || '').trim().toLowerCase();
        return normalizedName !== 'all' && normalizedSlug !== 'all';
      });
    if (Array.isArray(response)) {
      return normalize(response as Category[]);
    }
    if (response && typeof response === 'object' && Array.isArray((response as { items?: unknown }).items)) {
      return normalize((response as { items: Category[] }).items);
    }
    return [];
  },

  /**
   * Search products
   */
  search: async (query: string, limit: number = 10): Promise<Product[]> => {
    const params = new URLSearchParams({
      search: query,
      limit: limit.toString(),
    });
    const result = await fetchApi<ProductListResponse>(`/products?${params.toString()}`);
    return result.items;
  },
};

// ============================================
// Cart API
// ============================================

export const cartApi = {
  /**
   * Get current user's cart
   */
  getCart: async (): Promise<Cart> => {
    return fetchApi<Cart>('/cart');
  },

  /**
   * Add item to cart
   */
  addToCart: async (
    productId: string,
    quantity: number = 1,
    variantId?: string,
    fulfillmentData?: Record<string, unknown>
  ): Promise<Cart> => {
    return fetchApi<Cart>('/cart/items', {
      method: 'POST',
      body: { productId, quantity, variantId, fulfillmentData },
    });
  },

  /**
   * Update cart item quantity
   */
  updateCartItem: async (itemId: string, quantity: number): Promise<Cart> => {
    return fetchApi<Cart>(`/cart/items/${itemId}`, {
      method: 'PUT',
      body: { quantity },
    });
  },

  /**
   * Remove item from cart
   */
  removeFromCart: async (itemId: string): Promise<Cart> => {
    return fetchApi<Cart>(`/cart/items/${itemId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Clear entire cart
   */
  clearCart: async (): Promise<Cart> => {
    return fetchApi<Cart>('/cart', {
      method: 'DELETE',
    });
  },
};

// ============================================
// Orders API
// ============================================

export interface CreateOrderItem {
  productId: string;
  quantity: number;
  variantId?: string;
}

export interface CreateOrderData {
  items: CreateOrderItem[];
  shippingAddress?: OrderAddress;
}

export const ordersApi = {
  /**
   * Get user's orders list
   */
  getOrders: async (page: number = 1, limit: number = 10): Promise<{
    items: Order[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    return fetchApi<{
      items: Order[];
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    }>(`/orders?${params.toString()}`);
  },

  /**
   * Get single order by ID
   */
  getOrder: async (id: string): Promise<OrderDetail> => {
    return fetchApi<OrderDetail>(`/orders/${id}`);
  },

  /**
   * Create new order from cart
   */
  createOrder: async (data: CreateOrderData): Promise<Order> => {
    return fetchApi<Order>('/orders', {
      method: 'POST',
      body: data,
    });
  },

  /**
   * Cancel order
   */
  cancelOrder: async (id: string, cancelReason: string): Promise<Order> => {
    return fetchApi<Order>(`/orders/${id}/cancel`, {
      method: 'POST',
      body: { cancelReason },
    });
  },
};

// ============================================
// Payment API
// ============================================

export interface CreatePaymentSessionData {
  paymentMethod: string;
  orderId: string;
  successUrl?: string;
  cancelUrl?: string;
}

export interface PaymentSession {
  sessionId: string;
  url: string;
  expiresAt?: string;
}

export interface AvailablePaymentMethod {
  pluginSlug: string;
  name: string;
  displayName: string;
  icon: string;
  supportedCurrencies: string[];
}

export const paymentApi = {
  /**
   * Get available payment methods from installed/enabled plugins
   */
  getAvailableMethods: async (): Promise<AvailablePaymentMethod[]> => {
    return fetchApi<AvailablePaymentMethod[]>('/payments/available-methods');
  },

  /**
   * Create payment session
   */
  createSession: async (data: CreatePaymentSessionData): Promise<PaymentSession> => {
    return fetchApi<PaymentSession>('/payments/create-session', {
      method: 'POST',
      body: data,
    });
  },
};

// ============================================
// Auth API
// ============================================

export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  role: string;
  avatar?: string | null;
  createdAt?: string;
}

export interface AuthResponse {
  user: User;
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  token: string; // Compatible field
}

export const authApi = {
  /**
   * Login user
   */
  login: async (data: LoginData): Promise<AuthResponse> => {
    const result = await fetchApi<AuthResponse>('/auth/login', { method: 'POST', body: data });
    const normalizedToken = result.token || result.access_token;
    // Store token
    if (typeof window !== 'undefined' && normalizedToken) {
      localStorage.setItem('auth_token', normalizedToken);
    }
    return {
      ...result,
      token: normalizedToken,
    };
  },

  /**
   * Register new user
   */
  register: async (data: RegisterData): Promise<AuthResponse> => {
    const result = await fetchApi<AuthResponse>('/auth/register', { method: 'POST', body: data });
    const normalizedToken = result.token || result.access_token;
    // Store token
    if (typeof window !== 'undefined' && normalizedToken) {
      localStorage.setItem('auth_token', normalizedToken);
    }
    return {
      ...result,
      token: normalizedToken,
    };
  },

  /**
   * Logout user
   * Note: Core API doesn't have a logout endpoint, just clear local token
   */
  logout: (): void => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  },

  /**
   * Get current user profile
   */
  getProfile: async (): Promise<User> => {
    return fetchApi<User>('/auth/me');
  },

  /**
   * Update user profile
   */
  updateProfile: async (data: Partial<User>): Promise<User> => {
    return fetchApi<User>('/auth/me', {
      method: 'PUT',
      body: data,
    });
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated: (): boolean => {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem('auth_token') || !!getCookie('auth_token');
  },
};
