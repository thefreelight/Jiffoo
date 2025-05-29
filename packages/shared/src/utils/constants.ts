export const API_ENDPOINTS = {
  // Auth
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    LOGOUT: '/api/auth/logout',
    REFRESH: '/api/auth/refresh',
    PROFILE: '/api/auth/profile',
    FORGOT_PASSWORD: '/api/auth/forgot-password',
    RESET_PASSWORD: '/api/auth/reset-password',
    CHANGE_PASSWORD: '/api/auth/change-password',
  },
  
  // Products
  PRODUCTS: {
    LIST: '/api/products',
    DETAIL: '/api/products/:id',
    SEARCH: '/api/products/search',
    CATEGORIES: '/api/products/categories',
    FEATURED: '/api/products/featured',
    REVIEWS: '/api/products/:id/reviews',
  },
  
  // Cart
  CART: {
    GET: '/api/cart',
    ADD: '/api/cart/add',
    UPDATE: '/api/cart/update',
    REMOVE: '/api/cart/remove/:id',
    CLEAR: '/api/cart/clear',
  },
  
  // Orders
  ORDERS: {
    LIST: '/api/orders',
    DETAIL: '/api/orders/:id',
    CREATE: '/api/orders',
    UPDATE: '/api/orders/:id',
    CANCEL: '/api/orders/:id/cancel',
    TRACK: '/api/orders/:id/track',
  },
  
  // Users
  USERS: {
    LIST: '/api/users',
    DETAIL: '/api/users/:id',
    UPDATE: '/api/users/:id',
    DELETE: '/api/users/:id',
    ADDRESSES: '/api/users/:id/addresses',
  },
  
  // Admin
  ADMIN: {
    STATS: '/api/admin/stats',
    USERS: '/api/admin/users',
    ORDERS: '/api/admin/orders',
    PRODUCTS: '/api/admin/products',
  },
  
  // Upload
  UPLOAD: '/api/upload',
  
  // I18n
  I18N: {
    LANGUAGES: '/api/i18n/languages',
    TRANSLATE: '/api/i18n/translate/:key',
    BATCH: '/api/i18n/translate/batch',
    SWITCH: '/api/i18n/language/switch',
  },
} as const;

export const USER_ROLES = {
  USER: 'USER',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
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
  ZH: { code: 'zh-CN', name: 'Chinese', nativeName: '简体中文' },
  JA: { code: 'ja-JP', name: 'Japanese', nativeName: '日本語' },
  KO: { code: 'ko-KR', name: 'Korean', nativeName: '한국어' },
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
