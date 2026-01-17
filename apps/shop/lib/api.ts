/**
 * Shop API Client - Shop Frontend API Client
 * Uses unified AuthClient from shared package for consistent API handling
 */

import {
  createShopClient,
  getShopClient,
  type ApiResponse,
  type PaginatedResponse,
  API_ENDPOINTS,
} from 'shared';

// Import types from shared/src
import type {
  RegisterRequest,
  UserProfile,
  Product,
  ProductCategory,
  ProductSearchFilters,
  Cart,
  CartItem,
  Order,
  OrderFilters,
} from 'shared/src';

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

  // Email verification APIs
  sendRegistrationCode: (email: string): Promise<ApiResponse<any>> =>
    apiClient.post('/auth/send-registration-code', { email }),

  resendVerificationCode: (email: string): Promise<ApiResponse<any>> =>
    apiClient.post('/auth/resend-verification-code', { email }),

  verifyEmail: (email: string, code: string): Promise<ApiResponse<any>> =>
    apiClient.post('/auth/verify-email', { email, code }),
};

// Auth Gateway API - Get available authentication methods
export const authGatewayApi = {
  /**
   * Get available authentication methods
   * Only returns methods that are installed and have sufficient quota
   */
  getAvailableMethods: (): Promise<ApiResponse<Array<{
    pluginSlug: string;
    name: string;
    displayName: string;
    icon: string;
    type: 'oauth' | 'email' | 'sms' | 'passwordless';
    capabilities: {
      supportsRegistration: boolean;
      supportsLogin: boolean;
      supportsPasswordReset: boolean;
      requiresVerification: boolean;
    };
  }>>> => apiClient.get('/auth-gateway/available-methods'),
};

// Google OAuth API - Call plugin endpoints directly
export const googleOAuthApi = {
  /**
   * Generate Google OAuth authorization URL
   * @param state - Optional custom state data
   * @param scope - Optional OAuth scope list
   * @param returnUrl - URL to return to after OAuth completion
   */
  generateAuthUrl: (state?: string, scope?: string[], returnUrl?: string): Promise<ApiResponse<{ authUrl: string }>> =>
    apiClient.post('/plugins/google/api/auth/url', { state, scope, returnUrl }),

  /**
   * Shop frontend OAuth login
   * @param code - Authorization code returned by Google
   * @param state - OAuth state parameter
   * @param redirectUrl - Must match redirect_uri used when generating auth URL
   */
  oauthLogin: (code: string, state?: string, redirectUrl?: string): Promise<ApiResponse<{
    success: boolean;
    isNewUser: boolean;
    token: string;
    user: {
      id: string;
      email: string;
      username: string;
      role: string;
    };
  }>> => apiClient.post('/plugins/google/api/oauth/login', { code, state, redirectUrl }),
};

// Account API - User profile management
export const accountApi = {
  getProfile: () =>
    apiClient.get('/account/profile'),

  updateProfile: (data: Partial<UserProfile>) =>
    apiClient.put('/account/profile', data),
};

// Products API - Use unified apiClient
export const productsApi = {
  /**
   * Get products list with optional locale for translated data
   * @param params - Search filters including optional locale for i18n
   */
  getProducts: (params?: ProductSearchFilters): Promise<ApiResponse<PaginatedResponse<Product>>> =>
    apiClient.get(API_ENDPOINTS.PRODUCTS.LIST, { params }),

  /**
   * Get single product by ID with optional locale
   * @param id - Product ID
   * @param locale - Optional language code for translated product data
   */
  getProduct: (id: string, locale?: string): Promise<ApiResponse<Product>> =>
    apiClient.get(API_ENDPOINTS.PRODUCTS.DETAIL.replace(':id', id), {
      params: { ...(locale ? { locale } : {}) }
    }),

  /**
   * Get product categories
   */
  getCategories: (locale?: string): Promise<ApiResponse<ProductCategory[]>> =>
    apiClient.get(API_ENDPOINTS.PRODUCTS.CATEGORIES, {
      params: locale ? { locale } : undefined
    }),
};

// Cart API - Use unified apiClient
export const cartApi = {
  getCart: (): Promise<ApiResponse<Cart>> =>
    apiClient.get(API_ENDPOINTS.CART.GET),

  addToCart: (productId: string, quantity: number, variantId?: string): Promise<ApiResponse<CartItem>> =>
    apiClient.post(API_ENDPOINTS.CART.ADD, { productId, quantity, variantId }),

  updateCartItem: (itemId: string, quantity: number): Promise<ApiResponse<CartItem>> =>
    apiClient.put(API_ENDPOINTS.CART.UPDATE.replace(':id', itemId), { quantity }),

  removeFromCart: (itemId: string): Promise<ApiResponse<void>> =>
    apiClient.delete(API_ENDPOINTS.CART.REMOVE.replace(':id', itemId)),

  clearCart: (): Promise<ApiResponse<void>> =>
    apiClient.delete(API_ENDPOINTS.CART.CLEAR),
};

// Orders API - Use unified apiClient
export const ordersApi = {
  getOrders: (params?: OrderFilters): Promise<ApiResponse<PaginatedResponse<Order>>> =>
    apiClient.get(API_ENDPOINTS.ORDERS.LIST, { params }),

  getOrder: (id: string): Promise<ApiResponse<Order>> =>
    apiClient.get(API_ENDPOINTS.ORDERS.DETAIL.replace(':id', id)),

  /**
   * Create order
   */
  createOrder: (data: {
    items: Array<{
      productId: string;
      quantity: number;
      variantId?: string;
    }>;
    shippingAddress: {
      firstName: string;
      lastName: string;
      address: string;
      city: string;
      postalCode: string;
      country: string;
    };
    customerEmail: string;
  }): Promise<ApiResponse<Order>> =>
    apiClient.post(API_ENDPOINTS.ORDERS.CREATE, data),

  // Retry payment for an order
  retryPayment: (orderId: string, paymentMethod: string): Promise<ApiResponse<{
    sessionId: string;
    url: string;
    expiresAt: string;
  }>> =>
    apiClient.post(`/orders/${orderId}/retry-payment`, { paymentMethod }),

  // Cancel order
  cancelOrder: (orderId: string, reason?: string): Promise<ApiResponse<void>> =>
    apiClient.post(`/orders/${orderId}/cancel`, { reason }),
};

// Mall Context API - For store identification
export const mallContextApi = {
  getContext: (params: {
    domain?: string;
    slug?: string;
  }): Promise<ApiResponse<{
    storeId: string;
    storeName: string;
    domain: string | null;
    logo: string | null;
    theme: Record<string, unknown> | null;
    settings: Record<string, unknown> | null;
    status: string;
    /** Default locale for the store. Default: 'en' */
    defaultLocale: string;
    /** Supported locales for this store. Default: ['en', 'zh-Hant'] */
    supportedLocales: string[];
  }>> => apiClient.get('/mall/context', { params }),
};

// Payment Gateway API - Unified payment interface
export const paymentApi = {
  /**
   * Get available payment methods
   * Only returns methods that are installed and have sufficient quota
   */
  getAvailableMethods: (): Promise<ApiResponse<Array<{
    pluginSlug: string;
    name: string;
    displayName: string;
    icon: string;
    supportedCurrencies: string[];
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
};

// Export convenience functions
export const getShopApiClient = () => getShopClient();

// Export default apiClient instance
export default apiClient;
