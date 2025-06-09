export enum SupportedLanguage {
  ZH_CN = 'zh-CN',  // 简体中文
  ZH_TW = 'zh-TW',  // 繁体中文
  EN_US = 'en-US',  // 美式英语
  EN_GB = 'en-GB',  // 英式英语
  JA_JP = 'ja-JP',  // 日语
  KO_KR = 'ko-KR',  // 韩语
  ES_ES = 'es-ES',  // 西班牙语
  FR_FR = 'fr-FR',  // 法语
  DE_DE = 'de-DE',  // 德语
  IT_IT = 'it-IT',  // 意大利语
  PT_BR = 'pt-BR',  // 巴西葡萄牙语
  RU_RU = 'ru-RU',  // 俄语
  AR_SA = 'ar-SA',  // 阿拉伯语
  TH_TH = 'th-TH',  // 泰语
  VI_VN = 'vi-VN',  // 越南语
}

export interface LanguageInfo {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  region: string;
  flag: string;
  enabled: boolean;
}

export interface TranslationKey {
  key: string;
  namespace: string;
  defaultValue?: string;
  description?: string;
  context?: string;
}

export interface Translation {
  id: string;
  key: string;
  namespace: string;
  language: SupportedLanguage;
  value: string;
  pluralForm?: string;
  context?: string;
  isApproved: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

export interface TranslationRequest {
  key: string;
  namespace?: string;
  language?: SupportedLanguage;
  defaultValue?: string;
  interpolations?: Record<string, any>;
  count?: number;
}

export interface TranslationResponse {
  key: string;
  value: string;
  language: SupportedLanguage;
  namespace: string;
  interpolated: boolean;
  fallback: boolean;
}

export interface I18nConfig {
  defaultLanguage: SupportedLanguage;
  fallbackLanguage: SupportedLanguage;
  supportedLanguages: SupportedLanguage[];
  autoDetect: boolean;
  cacheEnabled: boolean;
  cacheTTL: number;
  pluralRules: boolean;
  interpolation: boolean;
  namespaces: string[];
}

export interface PluralRule {
  language: SupportedLanguage;
  rule: (count: number) => string;
  forms: string[];
}

export interface LocaleData {
  language: SupportedLanguage;
  currency: {
    code: string;
    symbol: string;
    position: 'before' | 'after';
  };
  dateFormat: {
    short: string;
    medium: string;
    long: string;
    full: string;
  };
  timeFormat: {
    short: string;
    medium: string;
    long: string;
  };
  numberFormat: {
    decimal: string;
    thousands: string;
    grouping: number[];
  };
  timezone: string;
}

export interface I18nMiddlewareOptions {
  headerName: string;
  queryParam: string;
  cookieName: string;
  defaultLanguage: SupportedLanguage;
  supportedLanguages: SupportedLanguage[];
}

export interface TranslationStats {
  totalKeys: number;
  translatedKeys: number;
  missingKeys: number;
  completionRate: number;
  languageStats: Array<{
    language: SupportedLanguage;
    totalKeys: number;
    translatedKeys: number;
    completionRate: number;
  }>;
}

export interface TranslationImportRequest {
  language: SupportedLanguage;
  namespace: string;
  format: 'json' | 'csv' | 'xlsx';
  data: any;
  overwrite: boolean;
}

export interface TranslationExportRequest {
  languages?: SupportedLanguage[];
  namespaces?: string[];
  format: 'json' | 'csv' | 'xlsx';
  includeEmpty: boolean;
}

// 常用命名空间
export enum TranslationNamespace {
  COMMON = 'common',
  AUTH = 'auth',
  USER = 'user',
  PRODUCT = 'product',
  ORDER = 'order',
  PAYMENT = 'payment',
  INVENTORY = 'inventory',
  NOTIFICATION = 'notification',
  ERROR = 'error',
  VALIDATION = 'validation',
  EMAIL = 'email',
  SMS = 'sms',
  ADMIN = 'admin',
  DASHBOARD = 'dashboard',
  SEARCH = 'search',
  CART = 'cart',
  CHECKOUT = 'checkout',
  SHIPPING = 'shipping',
  REVIEW = 'review',
  CATEGORY = 'category',
  BRAND = 'brand',
  PROMOTION = 'promotion',
  COUPON = 'coupon',
  ANALYTICS = 'analytics',
  REPORT = 'report',
  SETTINGS = 'settings',
  HELP = 'help',
  LEGAL = 'legal',
  MARKETING = 'marketing',
  SOCIAL = 'social',
  MOBILE = 'mobile',
  API = 'api'
}

// 预定义的翻译键
export enum CommonTranslationKeys {
  // 通用操作
  SAVE = 'common.save',
  CANCEL = 'common.cancel',
  DELETE = 'common.delete',
  EDIT = 'common.edit',
  CREATE = 'common.create',
  UPDATE = 'common.update',
  SUBMIT = 'common.submit',
  CONFIRM = 'common.confirm',
  CLOSE = 'common.close',
  BACK = 'common.back',
  NEXT = 'common.next',
  PREVIOUS = 'common.previous',
  SEARCH = 'common.search',
  FILTER = 'common.filter',
  SORT = 'common.sort',
  EXPORT = 'common.export',
  IMPORT = 'common.import',
  DOWNLOAD = 'common.download',
  UPLOAD = 'common.upload',
  REFRESH = 'common.refresh',
  RESET = 'common.reset',
  CLEAR = 'common.clear',
  
  // 状态
  SUCCESS = 'common.success',
  ERROR = 'common.error',
  WARNING = 'common.warning',
  INFO = 'common.info',
  LOADING = 'common.loading',
  PENDING = 'common.pending',
  COMPLETED = 'common.completed',
  FAILED = 'common.failed',
  ACTIVE = 'common.active',
  INACTIVE = 'common.inactive',
  ENABLED = 'common.enabled',
  DISABLED = 'common.disabled',
  
  // 时间
  TODAY = 'common.today',
  YESTERDAY = 'common.yesterday',
  TOMORROW = 'common.tomorrow',
  THIS_WEEK = 'common.this_week',
  LAST_WEEK = 'common.last_week',
  THIS_MONTH = 'common.this_month',
  LAST_MONTH = 'common.last_month',
  THIS_YEAR = 'common.this_year',
  LAST_YEAR = 'common.last_year',
  
  // 数量
  TOTAL = 'common.total',
  COUNT = 'common.count',
  AMOUNT = 'common.amount',
  QUANTITY = 'common.quantity',
  PRICE = 'common.price',
  SUBTOTAL = 'common.subtotal',
  TAX = 'common.tax',
  DISCOUNT = 'common.discount',
  SHIPPING = 'common.shipping',
  
  // 用户相关
  LOGIN = 'auth.login',
  LOGOUT = 'auth.logout',
  REGISTER = 'auth.register',
  FORGOT_PASSWORD = 'auth.forgot_password',
  RESET_PASSWORD = 'auth.reset_password',
  CHANGE_PASSWORD = 'auth.change_password',
  PROFILE = 'user.profile',
  ACCOUNT = 'user.account',
  SETTINGS = 'user.settings',
  
  // 商品相关
  PRODUCT = 'product.product',
  PRODUCTS = 'product.products',
  CATEGORY = 'product.category',
  BRAND = 'product.brand',
  STOCK = 'product.stock',
  OUT_OF_STOCK = 'product.out_of_stock',
  IN_STOCK = 'product.in_stock',
  ADD_TO_CART = 'product.add_to_cart',
  
  // 订单相关
  ORDER = 'order.order',
  ORDERS = 'order.orders',
  ORDER_NUMBER = 'order.order_number',
  ORDER_STATUS = 'order.order_status',
  ORDER_DATE = 'order.order_date',
  SHIPPING_ADDRESS = 'order.shipping_address',
  BILLING_ADDRESS = 'order.billing_address',
  
  // 错误消息
  REQUIRED_FIELD = 'validation.required_field',
  INVALID_EMAIL = 'validation.invalid_email',
  INVALID_PASSWORD = 'validation.invalid_password',
  PASSWORD_TOO_SHORT = 'validation.password_too_short',
  PASSWORDS_NOT_MATCH = 'validation.passwords_not_match',
  INVALID_PHONE = 'validation.invalid_phone',
  INVALID_DATE = 'validation.invalid_date',
  INVALID_NUMBER = 'validation.invalid_number',
  
  // 成功消息
  SAVE_SUCCESS = 'success.save_success',
  DELETE_SUCCESS = 'success.delete_success',
  UPDATE_SUCCESS = 'success.update_success',
  CREATE_SUCCESS = 'success.create_success',
  LOGIN_SUCCESS = 'success.login_success',
  LOGOUT_SUCCESS = 'success.logout_success',
  REGISTER_SUCCESS = 'success.register_success',
  
  // 错误消息
  SAVE_ERROR = 'error.save_error',
  DELETE_ERROR = 'error.delete_error',
  UPDATE_ERROR = 'error.update_error',
  CREATE_ERROR = 'error.create_error',
  LOGIN_ERROR = 'error.login_error',
  NETWORK_ERROR = 'error.network_error',
  SERVER_ERROR = 'error.server_error',
  NOT_FOUND = 'error.not_found',
  UNAUTHORIZED = 'error.unauthorized',
  FORBIDDEN = 'error.forbidden',
}
