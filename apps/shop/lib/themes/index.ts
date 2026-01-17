/**
 * Theme System Module Entry
 * 
 * Exports all theme-related components, hooks, and utility functions
 */

// Provider
export { ThemeProvider, useShopTheme } from './provider';

// Hooks
export {
  useThemeComponents,
  useThemeComponent,
  useThemeConfig,
  useThemeStatus,
  useThemeBrand,
  useThemeLayout,
  useThemeFeatures,
  useThemedProps,
} from './hooks';

// Registry
export {
  BUILTIN_THEMES,
  THEME_REGISTRY,
  getThemeRegistry,
  registerInstalledTheme,
  unregisterInstalledTheme,
  clearInstalledThemes,
  isValidThemeSlug,
  getThemeImporter,
  getThemeMeta,
  getAvailableThemes,
  getAllThemeMetas,
  isBuiltinTheme,
  isInstalledTheme,
  type ThemeSlug,
} from './registry';

// Debug & Performance
export { setDebugCurrentTheme, getThemeDebugInfo, enableThemeDebug, disableThemeDebug, clearDebugData, validateTheme } from './debug';
export { recordThemeLoad, getThemePerformanceStats, measureThemeLoad, clearThemeMetrics, type ThemeLoadMetrics } from './performance';
export { logThemeError, getThemeErrorStats, clearThemeErrors } from './error-logger';

// Re-export types from shared
export type {
  ThemePackage,
  ThemeConfig,
  ThemeMeta,
  ThemeRegistryEntry,
  ThemeRegistry,
  ThemeContextValue,
  ThemeTarget,
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
  PrivacyPageProps,
  TermsPageProps,
  DealsPageProps,
  AffiliateDashboardPageProps,
  LoginPageProps,
  RegisterPageProps,
  AuthCallbackPageProps,
  HeaderProps,
  FooterProps,
} from 'shared/src/types/theme';

