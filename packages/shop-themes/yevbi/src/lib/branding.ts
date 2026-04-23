import type { ThemeConfig } from '../types';

const DEFAULT_BRAND_NAME = 'YEVBI';
const DEFAULT_SUPPORT_EMAIL = 'support@yevbi.com';
const DEFAULT_SITE_HEADLINE = 'Stay connected\nseamlessly';
const DEFAULT_SITE_SUBHEADLINE =
  'Premium eSIM travel packages for 190+ countries. Zero contracts, instant activation, and unlimited global freedom.';
const DEFAULT_PRIMARY_CTA_LABEL = 'Browse Plans';
const DEFAULT_SECONDARY_CTA_LABEL = 'How it Works';

function getConfigString(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

export function getBrandName(config?: ThemeConfig): string {
  return getConfigString(config?.brand?.name) || DEFAULT_BRAND_NAME;
}

export function getSupportEmail(config?: ThemeConfig): string {
  return getConfigString(config?.site?.supportEmail) || DEFAULT_SUPPORT_EMAIL;
}

export function getHeroHeadline(config?: ThemeConfig): string {
  return getConfigString(config?.site?.headline) || DEFAULT_SITE_HEADLINE;
}

export function getHeroSubheadline(config?: ThemeConfig): string {
  return getConfigString(config?.site?.subheadline) || DEFAULT_SITE_SUBHEADLINE;
}

export function getPrimaryCtaLabel(config?: ThemeConfig): string {
  return getConfigString(config?.site?.primaryCtaLabel) || DEFAULT_PRIMARY_CTA_LABEL;
}

export function getSecondaryCtaLabel(config?: ThemeConfig): string {
  return getConfigString(config?.site?.secondaryCtaLabel) || DEFAULT_SECONDARY_CTA_LABEL;
}

export function replaceBrandTokens(text: string, brandName: string): string {
  const uppercaseBrandName = brandName.toUpperCase();

  return text
    .replace(/\bYEVBI\b/g, uppercaseBrandName)
    .replace(/\bYevbi\b/g, brandName);
}
