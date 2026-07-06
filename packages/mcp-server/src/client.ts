/**
 * Jiffoo API Client
 *
 * Lightweight HTTP client for the Jiffoo Core API.
 * Used by MCP tools to interact with the e-commerce backend.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApiClientOptions {
  /** Base URL of the Jiffoo API (e.g. http://localhost:3001/api/v1) */
  baseUrl: string;
  /** Bearer token for authentication */
  token?: string;
  /** Request timeout in milliseconds (default: 15000) */
  timeoutMs?: number;
}

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  images?: string[];
  stock: number;
  requiresShipping?: boolean;
  variants?: Array<{
    id: string;
    name: string;
    skuCode?: string;
    salePrice: number;
    baseStock: number;
    isActive: boolean;
  }>;
  typeData?: Record<string, unknown>;
}

export interface ProductListResult {
  items: Product[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  productCount: number;
}

export interface CategoryListResult {
  items: Category[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

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
  total: number;
  itemCount: number;
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  discountAmount: number;
  status: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: number;
  items?: Array<{
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    total: number;
    fulfillmentStatus?: string;
    fulfillmentData?: Record<string, unknown>;
  }>;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class JiffooApiClient {
  private baseUrl: string;
  private token?: string;
  private timeoutMs: number;

  constructor(options: ApiClientOptions) {
    // Normalize base URL — remove trailing slash
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.token = options.token;
    this.timeoutMs = options.timeoutMs ?? 15000;
  }

  // -------------------------------------------------------------------------
  // Internal request helper
  // -------------------------------------------------------------------------

  private async request<T>(
    method: string,
    path: string,
    options?: {
      query?: Record<string, string | number | boolean | undefined>;
      body?: unknown;
    },
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    if (options?.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const response = await fetch(url.toString(), {
        method,
        headers,
        body: options?.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const error = errorBody?.error || {};
        throw new JiffooApiError(
          error.message || `API request failed: ${response.status} ${response.statusText}`,
          response.status,
          error.code || 'API_ERROR',
        );
      }

      const json = await response.json();
      // Jiffoo API wraps responses in { success, data, ... }
      // Return the data field if present, otherwise the whole body
      return (json.data !== undefined ? json.data : json) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  // -------------------------------------------------------------------------
  // Product Tools
  // -------------------------------------------------------------------------

  /**
   * Search products by keyword, category, or price range.
   */
  async searchProducts(params: {
    q?: string;
    page?: number;
    limit?: number;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
    sortBy?: 'price' | 'name' | 'createdAt' | 'stock';
    sortOrder?: 'asc' | 'desc';
    locale?: string;
  }): Promise<ProductListResult> {
    return this.request<ProductListResult>('GET', '/products/search', {
      query: params,
    });
  }

  /**
   * Get detailed information about a specific product, including variants.
   */
  async getProduct(productId: string, locale?: string): Promise<Product> {
    return this.request<Product>('GET', `/products/${productId}`, {
      query: { locale },
    });
  }

  /**
   * Get all product categories.
   */
  async getCategories(page?: number, limit?: number): Promise<CategoryListResult> {
    return this.request<CategoryListResult>('GET', '/products/categories', {
      query: { page, limit },
    });
  }

  // -------------------------------------------------------------------------
  // Cart Tools
  // -------------------------------------------------------------------------

  /**
   * Get the current user's shopping cart.
   */
  async getCart(): Promise<Cart> {
    return this.request<Cart>('GET', '/cart');
  }

  /**
   * Add a product variant to the cart.
   */
  async addToCart(params: {
    productId: string;
    variantId?: string;
    quantity?: number;
    fulfillmentData?: Record<string, unknown>;
  }): Promise<Cart> {
    return this.request<Cart>('POST', '/cart/items', {
      body: params,
    });
  }

  /**
   * Remove an item from the cart.
   */
  async removeFromCart(itemId: string): Promise<Cart> {
    return this.request<Cart>('DELETE', `/cart/items/${itemId}`);
  }

  /**
   * Update cart item quantity.
   */
  async updateCartItem(itemId: string, quantity: number): Promise<Cart> {
    return this.request<Cart>('PUT', `/cart/items/${itemId}`, {
      body: { quantity },
    });
  }

  // -------------------------------------------------------------------------
  // Checkout Tools
  // -------------------------------------------------------------------------

  /**
   * Create an order from the cart.
   * Returns the order with a payment URL if a payment provider is configured.
   */
  async createOrder(params: {
    shippingAddress?: {
      fullName: string;
      address1: string;
      address2?: string;
      city: string;
      state?: string;
      country: string;
      postalCode: string;
      phone?: string;
    };
    billingAddress?: {
      fullName: string;
      address1: string;
      city: string;
      country: string;
      postalCode: string;
    };
    customerEmail?: string;
    discountCodes?: string[];
  }): Promise<Order> {
    return this.request<Order>('POST', '/orders', {
      body: params,
    });
  }

  /**
   * Create a payment session for an order.
   * Returns a hosted payment URL (e.g. Stripe Checkout).
   */
  async createPaymentSession(params: {
    orderId: string;
    provider?: string;
  }): Promise<{
    orderId: string;
    paymentUrl: string;
    provider: string;
  }> {
    return this.request('POST', '/payments/create-session', {
      body: params,
    });
  }
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class JiffooApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'JiffooApiError';
  }
}
