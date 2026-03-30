/**
 * Yevbi Theme - Type Definitions Index
 * Re-exports all types for convenient importing
 */

// i18n types
export type { Locale, TranslationFunction } from './i18n';

// Product types
export type {
  Product,
  ProductCategory,
  ProductImage,
  ProductVariant,
  ProductInventory,
  ProductSpecification,
} from './product';

// Cart types
export type { Cart, CartItem } from './cart';

// Order types
export type { OrderStatus, PaymentStatus, Order, OrderItem, OrderAddress } from './order';

// Theme types
export type {
  ThemeI18nProps,
  ThemeConfig,
  ThemePackage,
  CheckoutFormData,
  // Page Props
  HomePageProps,
  ProductsPageProps,
  ProductDetailPageProps,
  CartPageProps,
  CheckoutPageProps,
  NotFoundProps,
  BestsellersPageProps,
  NewArrivalsPageProps,
  CategoriesPageProps,
  SearchPageProps,
  OrdersPageProps,
  OrderDetailPageProps,
  OrderSuccessPageProps,
  OrderCancelledPageProps,
  ProfilePageProps,
  ProfileSettingsPageProps,
  ContactPageProps,
  HelpPageProps,
  HowItWorksPageProps,
  PrivacyPageProps,
  TermsPageProps,
  DealsPageProps,
  LoginPageProps,
  RegisterPageProps,
  AuthCallbackPageProps,
  HeaderProps,
  FooterProps,
} from './theme';
