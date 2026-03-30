import type { ThemeConfig } from 'shared/src/types/theme';

export interface VaultSiteConfig {
  brandName: string;
  eyebrow: string;
  headline: string;
  subheadline: string;
  supportEmail: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
}

export function resolveVaultSiteConfig(config?: ThemeConfig): VaultSiteConfig {
  const brandName = config?.brand?.name?.trim() || 'Digital Vault';

  return {
    brandName,
    eyebrow: config?.site?.eyebrow?.trim() || 'Instant digital delivery storefront',
    headline:
      config?.site?.headline?.trim() ||
      'Sell gift cards, keys, accounts, and downloads with delivery built in.',
    subheadline:
      config?.site?.subheadline?.trim() ||
      'Set delivery expectations before payment, keep every result inside the order locker, and leave manual fallback ready for the ops team.',
    supportEmail: config?.site?.supportEmail?.trim() || 'support@example.com',
    primaryCtaLabel: config?.site?.primaryCtaLabel?.trim() || 'Browse digital goods',
    primaryCtaHref: config?.site?.primaryCtaHref?.trim() || '/products',
    secondaryCtaLabel: config?.site?.secondaryCtaLabel?.trim() || 'How delivery works',
    secondaryCtaHref: config?.site?.secondaryCtaHref?.trim() || '/help',
  };
}

export function isExternalHref(href?: string): boolean {
  if (!href) return false;
  return /^(https?:)?\/\//.test(href);
}
