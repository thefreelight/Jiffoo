/**
 * Shop API Client - 商城前台 API 客户端
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
 * 延迟初始化 API 客户端，避免模块加载时的环境变量问题
 * Uses OAuth2 SPA standard storage (localStorage)
 */
let _apiClient: ReturnType<typeof createShopClient> | null = null;

const getApiClient = () => {
  if (!_apiClient) {
    _apiClient = createShopClient({
      storageType: 'browser', // OAuth2 SPA标准：使用localStorage存储tokens
      customConfig: {
        timeout: 10000,
        loginPath: '/auth/login', // 商城前端登录页面路径
      }
    });
  }
  return _apiClient;
};

// 导出 Proxy 以延迟初始化
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

  // 🆕 邮箱验证码相关API
  sendRegistrationCode: (email: string): Promise<ApiResponse<any>> =>
    apiClient.post('/auth/send-registration-code', { email }),

  resendVerificationCode: (email: string): Promise<ApiResponse<any>> =>
    apiClient.post('/auth/resend-verification-code', { email }),

  verifyEmail: (email: string, code: string, referralCode?: string): Promise<ApiResponse<any>> =>
    apiClient.post('/auth/verify-email', { email, code, referralCode }),
};

// 🆕 Auth Gateway API - 获取可用认证方式
export const authGatewayApi = {
  /**
   * 获取可用的认证方式
   * 只返回租户已安装且额度充足的认证方式
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

// 🆕 Google OAuth API - 直接调用插件端点
export const googleOAuthApi = {
  /**
   * 生成 Google OAuth 授权 URL
   * @param state - 可选的自定义 state 数据
   * @param scope - 可选的 OAuth scope 列表
   * @param returnUrl - 🆕 OAuth 完成后返回的 URL（支持多域名场景）
   */
  generateAuthUrl: (state?: string, scope?: string[], returnUrl?: string): Promise<ApiResponse<{ authUrl: string }>> =>
    apiClient.post('/plugins/google/api/auth/url', { state, scope, returnUrl }),

  /**
   * Mall 前端 OAuth 登录
   * @param code - Google 返回的授权码
   * @param state - OAuth state 参数
   * @param redirectUrl - 🆕 必须与生成 auth URL 时使用的 redirect_uri 一致
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
// Note: locale parameter should be explicitly passed when calling these methods
// to ensure correct translated product data is returned
// 🆕 Agent Mall 场景：传递 agentId 参数以获取授权商品和有效价格
export const productsApi = {
  /**
   * Get products list with optional locale for translated data
   * @param params - Search filters including optional locale for i18n
   * @param agentId - 🆕 Optional agent ID for Agent Mall context
   */
  getProducts: (params?: ProductSearchFilters & { agentId?: string }): Promise<ApiResponse<PaginatedResponse<Product>>> =>
    apiClient.get(API_ENDPOINTS.PRODUCTS.LIST, { params }),

  /**
   * Get single product by ID with optional locale
   * @param id - Product ID
   * @param locale - Optional language code for translated product data
   * @param agentId - 🆕 Optional agent ID for Agent Mall context
   */
  getProduct: (id: string, locale?: string, agentId?: string): Promise<ApiResponse<Product>> =>
    apiClient.get(API_ENDPOINTS.PRODUCTS.DETAIL.replace(':id', id), {
      params: { ...(locale ? { locale } : {}), ...(agentId ? { agentId } : {}) }
    }),

  /**
   * Get product categories
   * Note: Categories may support locale in future versions
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
// 🆕 Agent Mall 场景：支持 agentId 和 variantId
export const ordersApi = {
  getOrders: (params?: OrderFilters): Promise<ApiResponse<PaginatedResponse<Order>>> =>
    apiClient.get(API_ENDPOINTS.ORDERS.LIST, { params }),

  getOrder: (id: string): Promise<ApiResponse<Order>> =>
    apiClient.get(API_ENDPOINTS.ORDERS.DETAIL.replace(':id', id)),

  /**
   * 创建订单
   * 🆕 支持 Agent Mall 场景：
   * - agentId: Agent Mall 的代理 ID，用于授权验证和佣金计算
   * - variantId: 商品变体 ID，支持变体级定价
   */
  createOrder: (data: {
    items: Array<{
      productId: string;
      quantity: number;
      /** 🆕 商品变体 ID */
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
    /** 🆕 Agent ID，用于 Agent Mall 场景 */
    agentId?: string;
  }): Promise<ApiResponse<Order>> =>
    apiClient.post(API_ENDPOINTS.ORDERS.CREATE, data),

  // 🆕 重新支付订单
  retryPayment: (orderId: string, paymentMethod: string): Promise<ApiResponse<{
    sessionId: string;
    url: string;
    expiresAt: string;
  }>> =>
    apiClient.post(`/orders/${orderId}/retry-payment`, { paymentMethod }),

  // 🆕 取消订单
  cancelOrder: (orderId: string, reason?: string): Promise<ApiResponse<void>> =>
    apiClient.post(`/orders/${orderId}/cancel`, { reason }),
};

// Mall Context API - For tenant identification
export const mallContextApi = {
  getContext: (params: {
    domain?: string;
    subdomain?: string;
    tenant?: string;
    slug?: string;
    /** 🆕 Agent code 用于 Agent Mall 场景 */
    agent?: string;
  }): Promise<ApiResponse<{
    tenantId: string;
    tenantName: string;
    subdomain: string | null;
    domain: string | null;
    logo: string | null;
    theme: Record<string, unknown> | null;
    settings: Record<string, unknown> | null;
    status: string;
    /** Default locale for the tenant. Default: 'en' */
    defaultLocale: string;
    /** Supported locales for this tenant. Default: ['en', 'zh-Hant'] */
    supportedLocales: string[];
    /** 🆕 是否为 Agent Mall */
    isAgentMall?: boolean;
    /** 🆕 Agent 信息（仅当 isAgentMall=true 时有值） */
    agent?: {
      agentId: string;
      agentCode: string;
      agentName: string;
      agentLevel: number;
      theme: Record<string, unknown> | null;
      settings: Record<string, unknown> | null;
    };
  }>> => apiClient.get('/mall/context', { params }),
};

// Payment Gateway API - Unified payment interface
export const paymentApi = {
  /**
   * 获取可用的支付方式
   * 只返回租户已安装且额度充足的支付方式
   */
  getAvailableMethods: (): Promise<ApiResponse<Array<{
    pluginSlug: string;
    name: string;
    displayName: string;
    icon: string;
    supportedCurrencies: string[];
  }>>> => apiClient.get('/payments/available-methods'),

  /**
   * 创建支付会话
   * 使用统一支付网关,路由到对应的支付插件
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
