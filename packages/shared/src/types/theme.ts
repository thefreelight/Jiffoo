/**
 * Theme System Type Definitions
 * Defines theme packages, theme configuration, and page component Props interfaces
 */

import type { Product, ProductCategory } from './product';
import type { Cart, CartItem } from './cart';
import type { Order } from './order';
import type { Locale, TranslationFunction } from '../i18n/types';

// ============================================================================
// Theme Metadata Types (for registry and dynamic loading)
// ============================================================================

/**
 * Theme Target Platform
 */
export type ThemeTarget = 'shop' | 'admin';

/**
 * Theme Metadata (for registry)
 */
export interface ThemeMeta {
  /** Theme unique identifier */
  slug: string;
  /** Theme display name */
  name: string;
  /** Theme version */
  version: string;
  /** Theme description */
  description: string;
  /** Theme category */
  category?: string;
  /** Theme author */
  author?: string;
  /** Author website */
  authorUrl?: string;
  /** Preview image */
  thumbnail?: string;
  /** Screenshot list */
  screenshots?: string[];
  /** Tags */
  tags?: string[];
  /** Target platform */
  target: ThemeTarget;
}

/**
 * Theme Registry Entry
 */
export interface ThemeRegistryEntry {
  /** Theme metadata */
  meta: ThemeMeta;
  /** Dynamic load function */
  load: () => Promise<ThemePackage>;
}

/**
 * Theme Registry Type
 */
export type ThemeRegistry = Record<string, ThemeRegistryEntry>;

/**
 * Theme Context Value
 */
export interface ThemeContextValue {
  /** Current theme slug */
  currentTheme: string;
  /** Current theme package */
  themePackage: ThemePackage | null;
  /** Theme configuration */
  config: ThemeConfig;
  /** Is loading */
  isLoading: boolean;
  /** Load error */
  error: Error | null;
  /** Switch theme */
  setTheme: (slug: string) => Promise<void>;
  /** Update configuration */
  updateConfig: (config: Partial<ThemeConfig>) => void;
}

/**
 * Theme i18n Props
 * All theme components can receive these i18n-related props
 */
export interface ThemeI18nProps {
  /** Current locale */
  locale?: Locale;
  /** Translation function - t('key') or t('key', { param: value }) */
  t?: TranslationFunction;
}

/**
 * Theme Package Interface
 * Each theme must implement this interface
 */
export interface ThemePackage {
  // Page and block component dictionary
  components: {
    // Required page components
    HomePage: React.ComponentType<HomePageProps>;
    ProductsPage: React.ComponentType<ProductsPageProps>;
    ProductDetailPage: React.ComponentType<ProductDetailPageProps>;
    CartPage: React.ComponentType<CartPageProps>;
    CheckoutPage: React.ComponentType<CheckoutPageProps>;
    NotFound: React.ComponentType<NotFoundProps>;
    // Product list variant pages
    BestsellersPage: React.ComponentType<BestsellersPageProps>;
    NewArrivalsPage: React.ComponentType<NewArrivalsPageProps>;
    CategoriesPage: React.ComponentType<CategoriesPageProps>;
    SearchPage: React.ComponentType<SearchPageProps>;
    // Order-related pages
    OrdersPage: React.ComponentType<OrdersPageProps>;
    OrderDetailPage: React.ComponentType<OrderDetailPageProps>;
    OrderSuccessPage: React.ComponentType<OrderSuccessPageProps>;
    OrderCancelledPage: React.ComponentType<OrderCancelledPageProps>;
    // User center pages
    ProfilePage: React.ComponentType<ProfilePageProps>;
    ProfileSettingsPage: React.ComponentType<ProfileSettingsPageProps>;
    // Content pages
    ContactPage: React.ComponentType<ContactPageProps>;
    HelpPage: React.ComponentType<HelpPageProps>;
    PrivacyPage: React.ComponentType<PrivacyPageProps>;
    TermsPage: React.ComponentType<TermsPageProps>;
    // Special pages
    DealsPage: React.ComponentType<DealsPageProps>;
    AffiliateDashboardPage: React.ComponentType<AffiliateDashboardPageProps>;
    // Auth pages
    LoginPage: React.ComponentType<LoginPageProps>;
    RegisterPage: React.ComponentType<RegisterPageProps>;
    AuthCallbackPage: React.ComponentType<AuthCallbackPageProps>;
    // Layout components
    Header: React.ComponentType<HeaderProps>;
    Footer: React.ComponentType<FooterProps>;
  };

  // Optional: Theme tokens (CSS variables)
  tokensCSS?: string | (() => Promise<string>);

  // Optional: Default configuration
  defaultConfig?: ThemeConfig;
}

/**
 * Theme Configuration Interface
 * Tenants can customize these configurations to brand the theme
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
 * Home Page Component Props
 */
export interface HomePageProps extends ThemeI18nProps {
  config?: ThemeConfig;
  onNavigate?: (path: string) => void;
}

/**
 * Products Page Component Props
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
 * Product Detail Page Component Props
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
 * Cart Page Component Props
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
 * Checkout Form Data
 * ✅ Aligned with backend OrderService.createOrder shippingAddress schema
 */
export interface CheckoutFormData {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;  // ✅ Required by backend
  addressLine1: string;  // ✅ Backend uses addressLine1, not address
  city: string;
  state: string;  // ✅ Required by backend
  postalCode: string;
  country: string;
  paymentMethod: string;
}

/**
 * Checkout Page Component Props
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
 * 404 Page Component Props
 */
export interface NotFoundProps extends ThemeI18nProps {
  route?: string;
  message?: string;
  config?: ThemeConfig;
  onGoHome: () => void;
}

/**
 * Bestsellers Page Component Props
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
 * New Arrivals Page Component Props
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
 * Categories Page Component Props
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
 * Search Page Component Props
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
 * Orders Page Component Props
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
  onCancelOrder: (orderId: string) => Promise<void>;
}

/**
 * Order Detail Page Component Props
 */
export interface OrderDetailPageProps extends ThemeI18nProps {
  order: Order | null;
  isLoading: boolean;
  config?: ThemeConfig;
  onBack?: () => void;
  onBackToOrders?: () => void;
  onCancelOrder?: () => Promise<void>;
}

/**
 * Order Success Page Component Props
 */
export interface OrderSuccessPageProps extends ThemeI18nProps {
  orderNumber: string;
  isVerifying?: boolean;
  config?: ThemeConfig;
  onContinueShopping: () => void;
  onViewOrders: () => void;
}

/**
 * Order Cancelled Page Component Props
 */
export interface OrderCancelledPageProps extends ThemeI18nProps {
  config?: ThemeConfig;
  onReturnToCart: () => void;
  onContinueShopping: () => void;
  onContactSupport?: () => void;
}

/**
 * Profile Page Component Props
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
 * Profile Settings Page Component Props
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
 * Contact Page Component Props
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
 * Help Page Component Props
 */
export interface HelpPageProps extends ThemeI18nProps {
  config?: ThemeConfig;
  onNavigateToCategory?: (categoryId: string) => void;
  onNavigateToContact?: () => void;
}

/**
 * Privacy Page Component Props
 */
export interface PrivacyPageProps extends ThemeI18nProps {
  config?: ThemeConfig;
}

/**
 * Terms Page Component Props
 */
export interface TermsPageProps extends ThemeI18nProps {
  config?: ThemeConfig;
}

/**
 * Deals Page Component Props
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
 * Affiliate Dashboard Page Component Props
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
 * Login Page Component Props
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
 * Register Page Component Props
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
 * Auth Callback Page Component Props
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
 * Header Layout Component Props
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
  // Navigation callbacks
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
 * Footer Layout Component Props
 */
export interface FooterProps extends ThemeI18nProps {
  config?: ThemeConfig;
  onNavigate?: (path: string) => void;
  // Navigation callbacks
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
