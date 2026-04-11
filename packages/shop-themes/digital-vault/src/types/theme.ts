import type { Cart } from './cart';
import type { Locale, TranslationFunction } from './i18n';
import type { Order } from './order';
import type { Product } from './product';

export interface ThemeI18nProps {
  locale?: Locale;
  t?: TranslationFunction;
}

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
  i18n?: {
    locale?: Locale;
  };
  site?: {
    archetype?: 'storefront' | 'landing-commerce' | 'product-site';
    eyebrow?: string;
    headline?: string;
    subheadline?: string;
    primaryCtaLabel?: string;
    primaryCtaHref?: string;
    secondaryCtaLabel?: string;
    secondaryCtaHref?: string;
    installCommand?: string;
    docsHref?: string;
    demoHref?: string;
    supportEmail?: string;
    heroBanners?: Array<{
      id?: string;
      badge?: string;
      title?: string;
      subtitle?: string;
      imageUrl?: string;
      primaryLabel?: string;
      primaryHref?: string;
      secondaryLabel?: string;
      secondaryHref?: string;
    }>;
  };
}

export interface ThemePackage {
  components: {
    HomePage: React.ComponentType<HomePageProps>;
    ProductsPage: React.ComponentType<ProductsPageProps>;
    ProductDetailPage: React.ComponentType<ProductDetailPageProps>;
    CartPage: React.ComponentType<CartPageProps>;
    CheckoutPage: React.ComponentType<CheckoutPageProps>;
    NotFound: React.ComponentType<NotFoundProps>;
    BestsellersPage: React.ComponentType<BestsellersPageProps>;
    NewArrivalsPage: React.ComponentType<NewArrivalsPageProps>;
    CategoriesPage: React.ComponentType<CategoriesPageProps>;
    SearchPage: React.ComponentType<SearchPageProps>;
    OrdersPage: React.ComponentType<OrdersPageProps>;
    OrderDetailPage: React.ComponentType<OrderDetailPageProps>;
    OrderSuccessPage: React.ComponentType<OrderSuccessPageProps>;
    OrderCancelledPage: React.ComponentType<OrderCancelledPageProps>;
    GuestOrderLookupPage?: React.ComponentType<GuestOrderLookupPageProps>;
    ProfilePage: React.ComponentType<ProfilePageProps>;
    ProfileSettingsPage: React.ComponentType<ProfileSettingsPageProps>;
    ContactPage: React.ComponentType<ContactPageProps>;
    HelpPage: React.ComponentType<HelpPageProps>;
    PrivacyPage: React.ComponentType<PrivacyPageProps>;
    TermsPage: React.ComponentType<TermsPageProps>;
    DealsPage: React.ComponentType<DealsPageProps>;
    LoginPage: React.ComponentType<LoginPageProps>;
    RegisterPage: React.ComponentType<RegisterPageProps>;
    AuthCallbackPage: React.ComponentType<AuthCallbackPageProps>;
    Header: React.ComponentType<HeaderProps>;
    Footer: React.ComponentType<FooterProps>;
  };
  tokensCSS?: string | (() => Promise<string>);
  defaultConfig?: ThemeConfig;
}

export interface CheckoutFormData {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  paymentMethod: string;
}

export interface HomePageProps extends ThemeI18nProps {
  config?: ThemeConfig;
  onNavigate?: (path: string) => void;
}

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
  onSearch?: (query: string) => void;
}

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

export interface CartPageProps extends ThemeI18nProps {
  cart: Cart;
  isLoading: boolean;
  config?: ThemeConfig;
  onUpdateQuantity: (itemId: string, quantity: number) => Promise<void>;
  onRemoveItem: (itemId: string) => Promise<void>;
  onCheckout: () => void;
  onContinueShopping: () => void;
}

export interface CheckoutPageProps extends ThemeI18nProps {
  cart: Cart;
  isLoading: boolean;
  isProcessing: boolean;
  config?: ThemeConfig;
  requireShippingAddress?: boolean;
  countriesRequireStatePostal?: string[];
  currentUserEmail?: string;
  availablePaymentMethods?: Array<{
    name: string;
    displayName: string;
    icon?: string;
  }>;
  onSubmit: (data: CheckoutFormData) => Promise<void>;
  onBack: () => void;
}

export interface NotFoundProps extends ThemeI18nProps {
  route?: string;
  message?: string;
  config?: ThemeConfig;
  onGoHome: () => void;
}

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
  onFilterChange: (filters: Record<string, unknown>) => void;
  onAddToCart: (productId: string) => Promise<void>;
  onProductClick: (productId: string) => void;
}

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

export interface GuestOrderLookupPageProps extends ThemeI18nProps {
  orderId: string;
  email: string;
  isLoading: boolean;
  error?: string | null;
  config?: ThemeConfig;
  onOrderIdChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onLookup: () => Promise<void> | void;
  onContinueShopping?: () => void;
}

export interface OrderDetailPageProps extends ThemeI18nProps {
  order: Order | null;
  isLoading: boolean;
  config?: ThemeConfig;
  onBack?: () => void;
  onBackToOrders?: () => void;
  onCancelOrder?: () => Promise<void>;
}

export interface OrderSuccessPageProps extends ThemeI18nProps {
  orderNumber: string;
  order?: Order | null;
  isVerifying?: boolean;
  config?: ThemeConfig;
  onContinueShopping: () => void;
  onViewOrders: () => void;
}

export interface OrderCancelledPageProps extends ThemeI18nProps {
  config?: ThemeConfig;
  onReturnToCart: () => void;
  onContinueShopping: () => void;
  onContactSupport?: () => void;
}

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

export interface ContactPageProps extends ThemeI18nProps {
  config?: ThemeConfig;
  onSubmitForm: (data: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }) => Promise<void>;
}

export interface HelpPageProps extends ThemeI18nProps {
  config?: ThemeConfig;
  onNavigateToCategory?: (categoryId: string) => void;
  onNavigateToContact?: () => void;
}

export interface PrivacyPageProps extends ThemeI18nProps {
  config?: ThemeConfig;
}

export interface TermsPageProps extends ThemeI18nProps {
  config?: ThemeConfig;
}

export interface DealsPageProps extends ThemeI18nProps {
  products: Product[];
  isLoading: boolean;
  error?: string | null;
  config?: ThemeConfig;
  onAddToCart: (productId: string) => Promise<void>;
  onProductClick: (productId: string) => void;
}

export interface LoginPageProps extends ThemeI18nProps {
  isLoading: boolean;
  error?: string | null;
  config?: ThemeConfig;
  onSubmit: (email: string, password: string) => Promise<void>;
  onOAuthClick: (provider: 'google') => Promise<void>;
  onNavigateToRegister: () => void;
  onNavigateToForgotPassword: () => void;
}

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

export interface AuthCallbackPageProps extends ThemeI18nProps {
  provider: string;
  isLoading: boolean;
  error?: string | null;
  config?: ThemeConfig;
  onRetry: () => void;
  onNavigateToHome: () => void;
}

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
  onNavigateToCart: () => void;
  onNavigateToProfile: () => void;
  onNavigateToLogin: () => void;
  onNavigateToRegister: () => void;
  onNavigateToHome: () => void;
  onNavigateToProducts: () => void;
  onNavigateToCategories: () => void;
  onNavigateToDeals: () => void;
}

export interface FooterProps extends ThemeI18nProps {
  config?: ThemeConfig;
  platformBranding?: {
    mode?: 'oss' | 'managed';
    showPoweredByJiffoo?: boolean;
    poweredByHref?: string | null;
    poweredByLabel?: string | null;
  };
  onNavigate?: (path: string) => void;
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
