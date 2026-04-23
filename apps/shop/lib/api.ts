/**
 * Shop API Client - Shop Frontend API Client
 * Uses unified AuthClient from shared package for consistent API handling
 */

import {
  createShopClient,
  getShopClient,
  type ApiResponse,
  type PageResult,
  API_ENDPOINTS,
} from 'shared';

// Import types from shared/src
import type {
  RegisterRequest,
  UserProfile,
  ProductCategory,
  ProductSearchFilters,
  OrderFilters,
} from 'shared/src';

// Import DTO types - Aligned with actual backend response structure
import type {
  ShopProductListItemDTO,
  ShopProductDetailDTO,
  ProductCategoryDTO,
  CartDTO,
  CartItemDTO,
  ShopOrderListItemDTO,
  ShopOrderDetailDTO,
  AddToCartRequestDTO,
} from 'shared';

/**
 * Lazy initialize API client to avoid environment variable issues during module loading
 * Uses OAuth2 SPA standard storage (localStorage)
 */
let _apiClient: ReturnType<typeof createShopClient> | null = null;

const getApiClient = () => {
  if (!_apiClient) {
    _apiClient = createShopClient({
      storageType: 'browser', // OAuth2 SPA standard: using localStorage for tokens
      customConfig: {
        timeout: 10000,
        loginPath: '/auth/login', // Shop frontend login path
      }
    });
  }
  return _apiClient;
};

// Export Proxy for lazy initialization
export const apiClient = new Proxy({} as ReturnType<typeof createShopClient>, {
  get: (target, prop) => {
    return getApiClient()[prop as keyof ReturnType<typeof createShopClient>];
  }
});

// Auth API - Use unified AuthClient methods
export const authApi = {
  login: (email: string, password: string): Promise<ApiResponse<{
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token?: string;
  }>> => apiClient.login({ email, password }),

  register: (data: RegisterRequest): Promise<ApiResponse<{
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
  }>> => apiClient.register(data),

  logout: () => apiClient.logout(),

  getProfile: () => apiClient.getProfile(),

  refreshToken: () => apiClient.refreshAuthToken(),

  changePassword: (data: { currentPassword: string; newPassword: string }): Promise<ApiResponse<any>> =>
    apiClient.changePassword(data),

  verifyEmail: (token: string): Promise<ApiResponse<null>> =>
    apiClient.get('/auth/verify-email', { params: { token } }),

  acceptStaffInvite: async (data: { token: string; password: string }): Promise<ApiResponse<{
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token?: string;
  }>> => {
    const response = await apiClient.post('/auth/accept-staff-invite', data);
    if (response.success && response.data) {
      const authData = response.data as {
        access_token?: string;
        refresh_token?: string;
      };
      if (authData.access_token) {
        apiClient.setToken(authData.access_token);
      }
      if (authData.refresh_token) {
        (apiClient as any).setRefreshToken(authData.refresh_token);
      }
    }
    return response as ApiResponse<{
      access_token: string;
      token_type: string;
      expires_in: number;
      refresh_token?: string;
    }>;
  },
};

// Auth Gateway API REMOVED - Legacy



// Account API - User profile management
export const accountApi = {
  getProfile: () =>
    apiClient.get('/account/profile'),

  updateProfile: (data: { username?: string; avatar?: string }) =>
    apiClient.put('/account/profile', data),
};

// Products API - Use unified apiClient with DTO types
export const productsApi = {
  /**
   * Get products list with optional locale for translated data
   * @param params - Search filters including optional locale for i18n
   */
  getProducts: (params?: ProductSearchFilters): Promise<ApiResponse<PageResult<ShopProductListItemDTO>>> =>
    apiClient.get(API_ENDPOINTS.PRODUCTS.LIST, { params }),

  /**
   * Get single product by ID with optional locale and agent context
   * @param id - Product ID
   * @param locale - Optional language code for translated product data
   * @param agentId - Optional agent ID for Agent Mall context
   */
  getProduct: (id: string, locale?: string, agentId?: string): Promise<ApiResponse<ShopProductDetailDTO>> =>
    apiClient.get(API_ENDPOINTS.PRODUCTS.DETAIL.replace(':id', id), {
      params: {
        ...(locale ? { locale } : {}),
        ...(agentId ? { agentId } : {})
      }
    }),

  /**
   * Get product categories
   */
  getCategories: (params?: { page?: number; limit?: number }): Promise<ApiResponse<PageResult<ProductCategoryDTO>>> =>
    apiClient.get(API_ENDPOINTS.PRODUCTS.CATEGORIES, {
      params,
    }),

  /**
   * Search products by keyword (dedicated backend endpoint)
   */
  searchProducts: (params: {
    q: string;
    page?: number;
    limit?: number;
    locale?: string;
  }): Promise<ApiResponse<PageResult<ShopProductListItemDTO>>> =>
    apiClient.get(API_ENDPOINTS.PRODUCTS.SEARCH, { params }),
};

// Cart API - Use unified apiClient with DTO types
export const cartApi = {
  getCart: (): Promise<ApiResponse<CartDTO>> =>
    apiClient.get(API_ENDPOINTS.CART.GET),

  addToCart: (productId: string, quantity: number, variantId: string): Promise<ApiResponse<CartDTO>> =>
    apiClient.post(API_ENDPOINTS.CART.ADD, { productId, quantity, variantId }),

  batchAddToCart: (items: Array<{ productId: string; quantity: number; variantId?: string }>): Promise<ApiResponse<CartDTO>> =>
    apiClient.post(API_ENDPOINTS.CART.BATCH, { items }),

  updateCartItem: (itemId: string, quantity: number): Promise<ApiResponse<CartDTO>> =>
    apiClient.put(API_ENDPOINTS.CART.UPDATE.replace(':id', itemId), { quantity }),

  removeFromCart: (itemId: string): Promise<ApiResponse<CartDTO>> =>
    apiClient.delete(API_ENDPOINTS.CART.REMOVE.replace(':id', itemId)),

  clearCart: (): Promise<ApiResponse<CartDTO>> =>
    apiClient.delete(API_ENDPOINTS.CART.CLEAR),

  applyDiscount: (code: string): Promise<ApiResponse<CartDTO>> =>
    apiClient.post('/cart/apply-discount', { code }),

  removeDiscount: (code: string): Promise<ApiResponse<CartDTO>> =>
    apiClient.delete(`/cart/discount/${code}`),
};

// Orders API - Use unified apiClient with DTO types
export const ordersApi = {
  getOrders: (params?: OrderFilters): Promise<ApiResponse<PageResult<ShopOrderListItemDTO>>> =>
    apiClient.get(API_ENDPOINTS.ORDERS.LIST, { params }),

  getOrder: (id: string): Promise<ApiResponse<ShopOrderDetailDTO>> =>
    apiClient.get(API_ENDPOINTS.ORDERS.DETAIL.replace(':id', id)),

  /**
   * Create order
   */
  createOrder: (data: {
    items: Array<{
      productId: string;
      quantity: number;
      variantId: string;
    }>;
    shippingAddress?: {
      firstName: string;
      lastName: string;
      phone: string;
      addressLine1: string;
      city: string;
      state: string;
      country: string;
      postalCode: string;
    };
    customerEmail?: string;
    discountCodes?: string[];  // Optional discount codes to apply to order
  }): Promise<ApiResponse<ShopOrderDetailDTO>> =>
    apiClient.post(API_ENDPOINTS.ORDERS.CREATE, data),

  // Retry payment removed (Alpha)

  // Cancel order
  cancelOrder: (orderId: string, cancelReason: string): Promise<ApiResponse<void>> =>
    apiClient.post(`/orders/${orderId}/cancel`, { cancelReason }),
};

// Store Context API - For store identification
export const storeContextApi = {
  getContext: (): Promise<ApiResponse<{
    storeId: string;
    storeName: string;
    domain: string | null;
    logo: string | null;
    theme: Record<string, unknown> | null;
    settings: Record<string, unknown> | null;
    status: string;
    currency: string;
    /** Default locale for the store. Default: 'zh-Hant' */
    defaultLocale: string;
    /** Supported locales for this store. Default: ['en', 'zh-Hant'] */
    supportedLocales: string[];
    checkout?: {
      countriesRequireStatePostal?: string[];
    };
  }>> => apiClient.get('/store/context'),
};

// Payment Gateway API - Unified payment interface
export const paymentApi = {
  getAvailableMethods: (): Promise<ApiResponse<Array<{
    pluginSlug: string;
    name: string;
    displayName: string;
    icon: string;
    supportedCurrencies: string[];
    clientConfig?: {
      publishableKey?: string;
    } | null;
  }>>> => apiClient.get('/payments/available-methods'),

  /**
   * Create payment session
   * Uses unified payment gateway, routes to the corresponding payment plugin
   */
  createSession: (data: {
    paymentMethod: string;
    orderId: string;
    successUrl?: string;
    cancelUrl?: string;
  }): Promise<ApiResponse<{
    sessionId: string;
    url: string;
    expiresAt?: string;
  }>> => apiClient.post('/payments/create-session', data),

  verifySession: (sessionId: string): Promise<ApiResponse<{
    sessionId: string;
    orderId?: string;
    status: string;
    paidAt?: string;
    paymentMethod?: string;
  }>> => apiClient.get(`/payments/verify/${sessionId}`),
  /**
   * Create Stripe Payment Intent directly
   */
  createIntent: async (data: { orderId: string; }): Promise<ApiResponse<{
    clientSecret: string;
    paymentIntentId: string;
  }>> => {
    const response = await apiClient.post('/payments/create-intent', data) as ApiResponse<{
      clientSecret: string;
      paymentIntentId: string;
    }> & {
      clientSecret?: string;
      paymentIntentId?: string;
    };

    if (
      response?.success &&
      !response.data &&
      typeof response.clientSecret === 'string' &&
      response.clientSecret.length > 0
    ) {
      return {
        ...response,
        data: {
          clientSecret: response.clientSecret,
          paymentIntentId: response.paymentIntentId || '',
        },
      };
    }

    return response;
  },
};

// Themes API
export const themesApi = {
  /**
   * Get active theme (Public)
   */
  getActiveTheme: (): Promise<ApiResponse<any>> =>
    apiClient.get('/themes/active'),
};

// Export convenience functions
export const getShopApiClient = () => getShopClient();

// Export default apiClient instance
export default apiClient;
