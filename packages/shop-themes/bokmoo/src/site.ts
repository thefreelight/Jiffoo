import type { ThemeConfig } from 'shared/src/types/theme';

export interface BokmooSiteConfig {
  brandName: string;
  eyebrow: string;
  headline: string;
  subheadline: string;
  supportEmail: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  apiBaseUrl: string;
}

export function resolveBokmooSiteConfig(config?: ThemeConfig): BokmooSiteConfig {
  const brandName = config?.brand?.name?.trim() || 'BOKMOO';
  const siteConfig = (config?.site || {}) as ThemeConfig['site'] & {
    apiBaseUrl?: string;
  };

  return {
    brandName,
    eyebrow: siteConfig.eyebrow?.trim() || 'BOKMOO eSIM Card',
    headline:
      siteConfig.headline?.trim() ||
      'One Card.\nGlobal Connection.',
    subheadline:
      siteConfig.subheadline?.trim() ||
      `Use multiple eSIM profiles on your ${brandName} card. Stay connected in 200+ countries.`,
    supportEmail: siteConfig.supportEmail?.trim() || 'support@bokmoo.com',
    primaryCtaLabel: siteConfig.primaryCtaLabel?.trim() || 'Shop eSIM Plans',
    primaryCtaHref: siteConfig.primaryCtaHref?.trim() || '/products',
    secondaryCtaLabel: siteConfig.secondaryCtaLabel?.trim() || 'How it works',
    secondaryCtaHref: siteConfig.secondaryCtaHref?.trim() || '/#how-it-works',
    apiBaseUrl: siteConfig.apiBaseUrl?.trim() || 'https://api.bokmoo.com',
  };
}

export function isExternalHref(href?: string): boolean {
  if (!href) return false;
  return /^(https?:)?\/\//.test(href);
}
