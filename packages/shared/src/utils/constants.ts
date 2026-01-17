export const API_ENDPOINTS = {
  // Auth - Unified auth endpoints (no /api prefix, provided by baseURL)
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    PROFILE: '/auth/me', // Get user profile
    UPDATE_PROFILE: '/user/profile', // Update user profile
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    CHANGE_PASSWORD: '/auth/change-password', // Update password endpoint
  },

  // Account - User account management endpoints
  ACCOUNT: {
    PROFILE: '/account/profile', // Get/Update profile
  },

  // Products
  PRODUCTS: {
    LIST: '/products',
    DETAIL: '/products/:id',
    SEARCH: '/products/search',
    CATEGORIES: '/products/categories',
    FEATURED: '/products/featured',
    REVIEWS: '/products/:id/reviews',
  },

  // Cart
  CART: {
    GET: '/cart',
    ADD: '/cart/items',
    UPDATE: '/cart/items/:id',
    REMOVE: '/cart/items/:id',
    CLEAR: '/cart',
  },

  // Orders
  ORDERS: {
    LIST: '/orders',
    DETAIL: '/orders/:id',
    CREATE: '/orders',
    UPDATE: '/orders/:id',
    CANCEL: '/orders/:id/cancel',
    TRACK: '/orders/:id/track',
  },

  // Users
  USERS: {
    LIST: '/users',
    DETAIL: '/users/:id',
    UPDATE: '/users/:id',
    DELETE: '/users/:id',
    ADDRESSES: '/users/:id/addresses',
  },

  // Admin
  ADMIN: {
    STATS: '/admin/stats',
    USERS: '/admin/users',
    ORDERS: '/admin/orders',
    PRODUCTS: '/admin/products',
  },

  // Upload
  UPLOAD: '/upload',

  // I18n endpoints removed - English only
} as const;

export const USER_ROLES = {
  USER: 'USER',
  ADMIN: 'ADMIN',
} as const;

export const ORDER_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  PROCESSING: 'PROCESSING',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
} as const;

export const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
} as const;

export const PRODUCT_VARIANT_TYPES = {
  COLOR: 'COLOR',
  SIZE: 'SIZE',
  MATERIAL: 'MATERIAL',
  STYLE: 'STYLE',
} as const;

export const CURRENCIES = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound' },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  CNY: { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  KRW: { code: 'KRW', symbol: '₩', name: 'Korean Won' },
} as const;

export const LANGUAGES = {
  EN: { code: 'en-US', name: 'English', nativeName: 'English' },
  ZH: { code: 'zh-CN', name: 'Chinese', nativeName: 'Simplified Chinese' },
  JA: { code: 'ja-JP', name: 'Japanese', nativeName: 'Japanese' },
  KO: { code: 'ko-KR', name: 'Korean', nativeName: 'Korean' },
  ES: { code: 'es-ES', name: 'Spanish', nativeName: 'Español' },
  FR: { code: 'fr-FR', name: 'French', nativeName: 'Français' },
} as const;

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: {
    IMAGES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    DOCUMENTS: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  },
} as const;

export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 8,
  NAME_MIN_LENGTH: 2,
  DESCRIPTION_MIN_LENGTH: 10,
  REVIEW_MIN_LENGTH: 10,
} as const;

export const CACHE_KEYS = {
  PRODUCTS: 'products',
  CATEGORIES: 'categories',
  USER_PROFILE: 'user_profile',
  CART: 'cart',
  TRANSLATIONS: 'translations',
} as const;

export const CACHE_TTL = {
  SHORT: 5 * 60, // 5 minutes
  MEDIUM: 30 * 60, // 30 minutes
  LONG: 60 * 60, // 1 hour
  VERY_LONG: 24 * 60 * 60, // 24 hours
} as const;
