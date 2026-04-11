/**
 * API client for the embedded eSIM Mall storefront theme.
 *
 * All API calls go through the platform API gateway endpoints.
 */

/**
 * Lightweight API client (replaces @jiffoo/theme-api-sdk for embedded mode).
 */
interface ThemeApiClient {
  request<T>(endpoint: string, opts?: { method?: string; headers?: HeadersInit; body?: BodyInit | null }): Promise<T>;
}

function createThemeApiClient(config: { baseUrl: string; apiPrefix: string; credentials: RequestCredentials; token: () => string | null }): ThemeApiClient {
  return {
    async request<T>(endpoint: string, opts: { method?: string; headers?: HeadersInit; body?: BodyInit | null } = {}): Promise<T> {
      const url = `${config.baseUrl}${config.apiPrefix}${endpoint}`;
      const token = config.token();
      const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers as Record<string, string> || {}) };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(url, { method: opts.method || 'GET', headers, body: opts.body, credentials: config.credentials });
      if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`);
      const json = await res.json();
      return (json.data !== undefined ? json.data : json) as T;
    },
  };
}

// Product types aligned with Core API
export interface Product {
  id: string;
  name: string;
  description?: string;
  images: string[];
  price: number;
  stock: number;
  variants?: ProductVariant[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  skuCode: string | null;
  basePrice: number;
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
  /** Fulfillment status (written by plugins) */
  fulfillmentStatus?: string;
  /** Fulfillment data (written by plugins, e.g., eSIM QR code, tracking number) */
  fulfillmentData?: Record<string, unknown> | null;
}

export interface OrderAddress {
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phone?: string;
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
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase() as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  return themeApi.request<T>(endpoint, {
    method,
    headers: options.headers,
    body: options.body as BodyInit | null | undefined,
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
    return fetchApi<Category[]>('/products/categories');
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
    variantId?: string
  ): Promise<Cart> => {
    return fetchApi<Cart>('/cart/items', {
      method: 'POST',
      body: JSON.stringify({ productId, quantity, variantId }),
    });
  },

  /**
   * Update cart item quantity
   */
  updateCartItem: async (itemId: string, quantity: number): Promise<Cart> => {
    return fetchApi<Cart>(`/cart/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity }),
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
      body: JSON.stringify(data),
    });
  },

  /**
   * Cancel order
   */
  cancelOrder: async (id: string, cancelReason: string): Promise<Order> => {
    return fetchApi<Order>(`/orders/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ cancelReason }),
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

export const paymentApi = {
  /**
   * Create payment session
   */
  createSession: async (data: CreatePaymentSessionData): Promise<PaymentSession> => {
    return fetchApi<PaymentSession>('/payments/create-session', {
      method: 'POST',
      body: JSON.stringify(data),
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
    const result = await fetchApi<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) });
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
    const result = await fetchApi<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) });
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
      body: JSON.stringify(data),
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
