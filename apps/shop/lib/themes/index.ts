/**
 * Theme Renderer System Module Entry
 *
 * This module provides the theme renderer loading system, which loads
 * React components from @shop-themes/default for rendering pages.
 *
 * Note: This is separate from Theme Pack Runtime (lib/theme-pack) which
 * handles CSS tokens and JSON templates for installed themes.
 */

// Provider
export { ThemeProvider, useShopTheme } from './provider';

// Registry
export {
  BUILTIN_THEMES,
  THEME_REGISTRY,
  getThemeRegistry,
  getSynchronousBuiltinTheme,
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
export {
  MINIMUM_REQUIRED_THEME_COMPONENTS,
  OFFICIAL_EMBEDDED_THEME_SLUGS,
  OFFICIAL_FULL_THEME_COMPONENTS,
  getMissingThemeComponents,
  assertThemeComponents,
  isOfficialEmbeddedThemeSlug,
} from './contract';

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
  LoginPageProps,
  RegisterPageProps,
  AuthCallbackPageProps,
  HeaderProps,
  FooterProps,
} from 'shared/src/types/theme';
