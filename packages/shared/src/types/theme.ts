/**
 * 主题系统类型定义
 * 定义主题包、主题配置和页面组件 Props 接口
 */

import type { Product, ProductCategory } from './product';
import type { Cart, CartItem } from './cart';
import type { Order } from './order';
import type { Locale, TranslationFunction } from '../i18n/types';

// ============================================================================
// 主题元数据类型（用于注册表和动态加载）
// ============================================================================

/**
 * 主题目标平台
 */
export type ThemeTarget = 'shop' | 'admin';

/**
 * 主题元数据（用于注册表）
 */
export interface ThemeMeta {
  /** 主题唯一标识 */
  slug: string;
  /** 主题显示名称 */
  name: string;
  /** 主题版本 */
  version: string;
  /** 主题描述 */
  description: string;
  /** 主题分类 */
  category?: string;
  /** 主题作者 */
  author?: string;
  /** 作者网站 */
  authorUrl?: string;
  /** 预览图 */
  thumbnail?: string;
  /** 截图列表 */
  screenshots?: string[];
  /** 标签 */
  tags?: string[];
  /** 目标平台 */
  target: ThemeTarget;
}

/**
 * 主题注册表条目
 */
export interface ThemeRegistryEntry {
  /** 主题元数据 */
  meta: ThemeMeta;
  /** 动态加载函数 */
  load: () => Promise<ThemePackage>;
}

/**
 * 主题注册表类型
 */
export type ThemeRegistry = Record<string, ThemeRegistryEntry>;

/**
 * 主题上下文值
 */
export interface ThemeContextValue {
  /** 当前主题 slug */
  currentTheme: string;
  /** 当前主题包 */
  themePackage: ThemePackage | null;
  /** 主题配置 */
  config: ThemeConfig;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 加载错误 */
  error: Error | null;
  /** 切换主题 */
  setTheme: (slug: string) => Promise<void>;
  /** 更新配置 */
  updateConfig: (config: Partial<ThemeConfig>) => void;
}

/**
 * 主题 i18n Props
 * 所有主题组件都可以接收这些 i18n 相关的 props
 */
export interface ThemeI18nProps {
  /** Current locale */
  locale?: Locale;
  /** Translation function - t('key') or t('key', { param: value }) */
  t?: TranslationFunction;
}

/**
 * 主题包接口
 * 每个主题必须实现此接口
 */
export interface ThemePackage {
  // 页面和区块组件字典
  components: {
    // 必需的页面组件
    HomePage: React.ComponentType<HomePageProps>;
    ProductsPage: React.ComponentType<ProductsPageProps>;
    ProductDetailPage: React.ComponentType<ProductDetailPageProps>;
    CartPage: React.ComponentType<CartPageProps>;
    CheckoutPage: React.ComponentType<CheckoutPageProps>;
    NotFound: React.ComponentType<NotFoundProps>;
    // 商品列表变体页面
    BestsellersPage: React.ComponentType<BestsellersPageProps>;
    NewArrivalsPage: React.ComponentType<NewArrivalsPageProps>;
    CategoriesPage: React.ComponentType<CategoriesPageProps>;
    SearchPage: React.ComponentType<SearchPageProps>;
    // 订单相关页面
    OrdersPage: React.ComponentType<OrdersPageProps>;
    OrderDetailPage: React.ComponentType<OrderDetailPageProps>;
    OrderSuccessPage: React.ComponentType<OrderSuccessPageProps>;
    OrderCancelledPage: React.ComponentType<OrderCancelledPageProps>;
    // 用户中心页面
    ProfilePage: React.ComponentType<ProfilePageProps>;
    ProfileSettingsPage: React.ComponentType<ProfileSettingsPageProps>;
    // 内容页面
    ContactPage: React.ComponentType<ContactPageProps>;
    HelpPage: React.ComponentType<HelpPageProps>;
    PrivacyPage: React.ComponentType<PrivacyPageProps>;
    TermsPage: React.ComponentType<TermsPageProps>;
    // 特殊页面
    DealsPage: React.ComponentType<DealsPageProps>;
    AffiliateDashboardPage: React.ComponentType<AffiliateDashboardPageProps>;
    // Auth 页面
    LoginPage: React.ComponentType<LoginPageProps>;
    RegisterPage: React.ComponentType<RegisterPageProps>;
    AuthCallbackPage: React.ComponentType<AuthCallbackPageProps>;
    // 布局组件
    Header: React.ComponentType<HeaderProps>;
    Footer: React.ComponentType<FooterProps>;
  };

  // 可选：主题令牌（CSS 变量）
  tokensCSS?: string | (() => Promise<string>);

  // 可选：默认配置
  defaultConfig?: ThemeConfig;
}

/**
 * 主题配置接口
 * 租户可以自定义这些配置来品牌化主题
 */
export interface ThemeConfig {
  brand?: {
    logoUrl?: string;
    name?: string;
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
  };
  layout?: {
    headerSticky?: boolean;
    showFooterLinks?: boolean;
    maxWidth?: string;
  };
  features?: {
    showWishlist?: boolean;
    showRatings?: boolean;
    enableQuickView?: boolean;
  };
  /** i18n configuration */
  i18n?: {
    /** Current locale */
    locale?: Locale;
  };
}

/**
 * 首页组件 Props
 */
export interface HomePageProps extends ThemeI18nProps {
  config?: ThemeConfig;
  onNavigate?: (path: string) => void;
}

/**
 * 商品列表页组件 Props
 */
export interface ProductsPageProps extends ThemeI18nProps {
  products: Product[];
  isLoading: boolean;
  totalProducts: number;
  currentPage: number;
  totalPages: number;
  sortBy: string;
  viewMode: 'grid' | 'list';
  config?: ThemeConfig;
  onSortChange: (sortBy: string) => void;
  onViewModeChange: (mode: 'grid' | 'list') => void;
  onPageChange: (page: number) => void;
  onAddToCart: (productId: string) => Promise<void>;
  onProductClick: (productId: string) => void;
}

/**
 * 商品详情页组件 Props
 */
export interface ProductDetailPageProps extends ThemeI18nProps {
  product: Product | null;
  isLoading: boolean;
  selectedVariant?: string;
  quantity: number;
  config?: ThemeConfig;
  onVariantChange: (variantId: string) => void;
  onQuantityChange: (quantity: number) => void;
  onAddToCart: () => Promise<void>;
  onBack: () => void;
}

/**
 * 购物车页组件 Props
 */
export interface CartPageProps extends ThemeI18nProps {
  cart: Cart;
  isLoading: boolean;
  config?: ThemeConfig;
  onUpdateQuantity: (itemId: string, quantity: number) => Promise<void>;
  onRemoveItem: (itemId: string) => Promise<void>;
  onCheckout: () => void;
  onContinueShopping: () => void;
}

/**
 * 结账表单数据
 */
export interface CheckoutFormData {
  email: string;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  phone: string;
  paymentMethod: string;
}

/**
 * 结账页组件 Props
 */
export interface CheckoutPageProps extends ThemeI18nProps {
  cart: Cart;
  isLoading: boolean;
  isProcessing: boolean;
  config?: ThemeConfig;
  onSubmit: (data: CheckoutFormData) => Promise<void>;
  onBack: () => void;
}

/**
 * 404 页面组件 Props
 */
export interface NotFoundProps extends ThemeI18nProps {
  route?: string;
  message?: string;
  config?: ThemeConfig;
  onGoHome: () => void;
}

/**
 * 畅销品页面组件 Props
 */
export interface BestsellersPageProps extends ThemeI18nProps {
  products: Product[];
  isLoading: boolean;
  totalProducts: number;
  currentPage: number;
  totalPages: number;
  sortBy: string;
  config?: ThemeConfig;
  onSortChange: (sortBy: string) => void;
  onPageChange: (page: number) => void;
  onAddToCart: (productId: string) => Promise<void>;
  onProductClick: (productId: string) => void;
}

/**
 * 新品上市页面组件 Props
 */
export interface NewArrivalsPageProps extends ThemeI18nProps {
  products: Product[];
  isLoading: boolean;
  totalProducts: number;
  currentPage: number;
  totalPages: number;
  sortBy: string;
  config?: ThemeConfig;
  onSortChange: (sortBy: string) => void;
  onPageChange: (page: number) => void;
  onAddToCart: (productId: string) => Promise<void>;
  onProductClick: (productId: string) => void;
}

/**
 * 分类页面组件 Props
 */
export interface CategoriesPageProps extends ThemeI18nProps {
  categories: Array<{
    id: string;
    name: string;
    description: string;
    image: string;
    productCount: number;
    featured?: boolean;
  }>;
  isLoading: boolean;
  error?: string | null;
  config?: ThemeConfig;
  onCategoryClick: (categoryId: string) => void;
  onNavigateToHome?: () => void;
}

/**
 * 搜索结果页面组件 Props
 */
export interface SearchPageProps extends ThemeI18nProps {
  products: Product[];
  isLoading: boolean;
  searchQuery: string;
  sortBy: string;
  viewMode: 'grid' | 'list';
  filters: {
    category: string;
    priceRange: string;
    brand: string;
    rating: string;
    inStock: boolean;
  };
  config?: ThemeConfig;
  onSortChange: (sortBy: string) => void;
  onViewModeChange: (mode: 'grid' | 'list') => void;
  onFilterChange: (filters: any) => void;
  onAddToCart: (productId: string) => Promise<void>;
  onProductClick: (productId: string) => void;
}

/**
 * 订单列表页面组件 Props
 */
export interface OrdersPageProps extends ThemeI18nProps {
  orders: Order[];
  isLoading: boolean;
  error?: string | null;
  currentPage: number;
  totalPages: number;
  config?: ThemeConfig;
  onPageChange: (page: number) => void;
  onOrderClick: (orderId: string) => void;
  onRetryPayment: (orderId: string) => Promise<void>;
  onCancelOrder: (orderId: string) => Promise<void>;
}

/**
 * 订单详情页面组件 Props
 */
export interface OrderDetailPageProps extends ThemeI18nProps {
  order: Order | null;
  isLoading: boolean;
  config?: ThemeConfig;
  onBack?: () => void;
  onBackToOrders?: () => void;
  onRetryPayment?: (paymentMethod: string) => Promise<void>;
  onCancelOrder?: () => Promise<void>;
}

/**
 * 订单成功页面组件 Props
 */
export interface OrderSuccessPageProps extends ThemeI18nProps {
  orderNumber: string;
  isVerifying?: boolean;
  config?: ThemeConfig;
  onContinueShopping: () => void;
  onViewOrders: () => void;
}

/**
 * 订单取消页面组件 Props
 */
export interface OrderCancelledPageProps extends ThemeI18nProps {
  config?: ThemeConfig;
  onReturnToCart: () => void;
  onContinueShopping: () => void;
  onContactSupport?: () => void;
}

/**
 * 用户个人资料页面组件 Props
 */
export interface ProfilePageProps extends ThemeI18nProps {
  user: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    createdAt: string;
  } | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  config?: ThemeConfig;
  onNavigateToSettings: () => void;
  onNavigateToOrders: () => void;
  onNavigateToLogin: () => void;
}

/**
 * 用户设置页面组件 Props
 */
export interface ProfileSettingsPageProps extends ThemeI18nProps {
  user: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    phone?: string;
    dateOfBirth?: string;
    gender?: 'MALE' | 'FEMALE' | 'OTHER';
    preferredLanguage?: string;
    timezone?: string;
  } | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  config?: ThemeConfig;
  onSaveProfile: (data: {
    name?: string;
    phone?: string;
    dateOfBirth?: string;
    gender?: 'MALE' | 'FEMALE' | 'OTHER';
    preferredLanguage?: string;
    timezone?: string;
  }) => Promise<void>;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  onNavigateBack: () => void;
  onNavigateToLogin: () => void;
}

/**
 * 联系我们页面组件 Props
 */
export interface ContactPageProps extends ThemeI18nProps {
  config?: ThemeConfig;
  onSubmitForm: (data: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }) => Promise<void>;
}

/**
 * 帮助中心页面组件 Props
 */
export interface HelpPageProps extends ThemeI18nProps {
  config?: ThemeConfig;
  onNavigateToCategory?: (categoryId: string) => void;
  onNavigateToContact?: () => void;
}

/**
 * 隐私政策页面组件 Props
 */
export interface PrivacyPageProps extends ThemeI18nProps {
  config?: ThemeConfig;
}

/**
 * 服务条款页面组件 Props
 */
export interface TermsPageProps extends ThemeI18nProps {
  config?: ThemeConfig;
}

/**
 * 特价商品页面组件 Props
 */
export interface DealsPageProps extends ThemeI18nProps {
  products: Product[];
  isLoading: boolean;
  error?: string | null;
  config?: ThemeConfig;
  onAddToCart: (productId: string) => Promise<void>;
  onProductClick: (productId: string) => void;
}

/**
 * 联盟仪表板页面组件 Props
 */
export interface AffiliateDashboardPageProps extends ThemeI18nProps {
  referralCode: string;
  stats: {
    totalReferrals: number;
    totalCommissions: number;
    availableBalance: number;
    pendingBalance: number;
  };
  commissions: Array<{
    id: string;
    orderId: string;
    amount: number;
    status: string;
    createdAt: string;
  }>;
  payouts: Array<{
    id: string;
    amount: number;
    status: string;
    requestedAt: string;
    processedAt?: string;
  }>;
  isLoading: boolean;
  isLoadingCommissions: boolean;
  isLoadingPayouts: boolean;
  config?: ThemeConfig;
  onRequestPayout: (amount: number) => Promise<void>;
  onLoadMoreCommissions: (page: number) => Promise<void>;
  onLoadMorePayouts: (page: number) => Promise<void>;
}

/**
 * 登录页面组件 Props
 */
export interface LoginPageProps extends ThemeI18nProps {
  isLoading: boolean;
  error?: string | null;
  config?: ThemeConfig;
  onSubmit: (email: string, password: string) => Promise<void>;
  onOAuthClick: (provider: 'google') => Promise<void>;
  onNavigateToRegister: () => void;
  onNavigateToForgotPassword: () => void;
}

/**
 * 注册页面组件 Props
 */
export interface RegisterPageProps extends ThemeI18nProps {
  isLoading: boolean;
  error?: string | null;
  config?: ThemeConfig;
  onSubmit: (data: {
    email: string;
    password: string;
    confirmPassword: string;
    firstName: string;
    lastName: string;
  }) => Promise<void>;
  onOAuthClick: (provider: 'google') => Promise<void>;
  onNavigateToLogin: () => void;
}

/**
 * Auth 回调页面组件 Props
 */
export interface AuthCallbackPageProps extends ThemeI18nProps {
  provider: string;
  isLoading: boolean;
  error?: string | null;
  config?: ThemeConfig;
  onRetry: () => void;
  onNavigateToHome: () => void;
}

/**
 * Header 布局组件 Props
 */
export interface HeaderProps extends ThemeI18nProps {
  isAuthenticated: boolean;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  cartItemCount: number;
  config?: ThemeConfig;
  onSearch: (query: string) => void;
  onNavigate?: (path: string) => void;
  onLogout: () => void;
  onLogin?: () => void;
  // 导航回调
  onNavigateToCart: () => void;
  onNavigateToProfile: () => void;
  onNavigateToLogin: () => void;
  onNavigateToRegister: () => void;
  onNavigateToHome: () => void;
  onNavigateToProducts: () => void;
  onNavigateToCategories: () => void;
  onNavigateToDeals: () => void;
}

/**
 * Footer 布局组件 Props
 */
export interface FooterProps extends ThemeI18nProps {
  config?: ThemeConfig;
  onNavigate?: (path: string) => void;
  // 导航回调
  onNavigateToProducts: () => void;
  onNavigateToCategories: () => void;
  onNavigateToDeals: () => void;
  onNavigateToNewArrivals: () => void;
  onNavigateToBestsellers: () => void;
  onNavigateToHelp: () => void;
  onNavigateToContact: () => void;
  onNavigateToPrivacy: () => void;
  onNavigateToTerms: () => void;
}
