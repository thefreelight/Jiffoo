import type { ThemePackage } from 'shared';

export const MINIMUM_REQUIRED_THEME_COMPONENTS = [
  'HomePage',
  'ProductsPage',
  'ProductDetailPage',
  'CartPage',
  'CheckoutPage',
  'NotFound',
  'OrdersPage',
  'OrderDetailPage',
  'OrderSuccessPage',
  'OrderCancelledPage',
  'ProfilePage',
  'ContactPage',
  'HelpPage',
  'PrivacyPage',
  'TermsPage',
  'LoginPage',
  'RegisterPage',
  'AuthCallbackPage',
  'Header',
  'Footer',
] as const satisfies ReadonlyArray<keyof ThemePackage['components']>;

export const OFFICIAL_FULL_THEME_COMPONENTS = [
  ...MINIMUM_REQUIRED_THEME_COMPONENTS,
  'BestsellersPage',
  'NewArrivalsPage',
  'CategoriesPage',
  'SearchPage',
  'DealsPage',
  'ProfileSettingsPage',
] as const satisfies ReadonlyArray<keyof ThemePackage['components']>;

export const OFFICIAL_EMBEDDED_THEME_SLUGS = ['esim-mall', 'yevbi'] as const;

type ThemeComponentName = keyof ThemePackage['components'];

export function getMissingThemeComponents(
  themePackage: ThemePackage,
  requiredComponents: readonly ThemeComponentName[]
): ThemeComponentName[] {
  const components = themePackage?.components ?? {};

  return requiredComponents.filter((componentName) => !components[componentName]);
}

export function assertThemeComponents(
  themePackage: ThemePackage,
  slug: string,
  requiredComponents: readonly ThemeComponentName[] = MINIMUM_REQUIRED_THEME_COMPONENTS
): void {
  const missing = getMissingThemeComponents(themePackage, requiredComponents);

  if (missing.length > 0) {
    throw new Error(
      `Theme "${slug}" is missing required components: ${missing.join(', ')}`
    );
  }
}

export function isOfficialEmbeddedThemeSlug(slug: string): slug is (typeof OFFICIAL_EMBEDDED_THEME_SLUGS)[number] {
  return OFFICIAL_EMBEDDED_THEME_SLUGS.includes(slug as (typeof OFFICIAL_EMBEDDED_THEME_SLUGS)[number]);
}
