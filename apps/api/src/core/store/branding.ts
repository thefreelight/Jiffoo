export type StoreThemeConfigLike = {
  config?: {
    brand?: {
      name?: string | null;
    } | null;
  } | null;
} | null;

export function resolvePublicStoreName(
  platformName: string | null | undefined,
  activeTheme?: StoreThemeConfigLike,
): string {
  const configuredPlatformName = platformName?.trim();
  if (configuredPlatformName) {
    return configuredPlatformName;
  }

  const configuredThemeBrandName = activeTheme?.config?.brand?.name?.trim();
  if (configuredThemeBrandName) {
    return configuredThemeBrandName;
  }

  return 'Jiffoo Store';
}
