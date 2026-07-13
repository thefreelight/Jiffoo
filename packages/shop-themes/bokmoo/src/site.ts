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
}

export function resolveBokmooSiteConfig(config?: ThemeConfig): BokmooSiteConfig {
  const brandName = config?.brand?.name?.trim() || 'Bokmoo';

  return {
    brandName,
    eyebrow: config?.site?.eyebrow?.trim() || 'Premium global connectivity',
    headline:
      config?.site?.headline?.trim() ||
      `${brandName} brings travel connectivity into a calmer, more premium ritual.`,
    subheadline:
      config?.site?.subheadline?.trim() ||
      'From instant QR delivery to destination-ready plan selection, Bokmoo is designed to feel like a welcome kit for modern international travel.',
    supportEmail: config?.site?.supportEmail?.trim() || 'support@bokmoo.com',
    primaryCtaLabel: config?.site?.primaryCtaLabel?.trim() || 'Browse eSIM plans',
    primaryCtaHref: config?.site?.primaryCtaHref?.trim() || '/products',
    secondaryCtaLabel: config?.site?.secondaryCtaLabel?.trim() || 'Check device support',
    secondaryCtaHref: config?.site?.secondaryCtaHref?.trim() || '/help',
  };
}

export function isExternalHref(href?: string): boolean {
  if (!href) return false;
  return /^(https?:)?\/\//.test(href);
}
