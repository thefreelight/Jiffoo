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

export function resolveBokmooSiteConfig(config?: ThemeConfig, locale?: string): BokmooSiteConfig {
  const brandName = config?.brand?.name?.trim() || 'BOKMOO';
  const siteConfig = (config?.site || {}) as ThemeConfig['site'] & {
    apiBaseUrl?: string;
  };
  // Hero copy falls back per locale: the store-level config carries a single
  // language, so zh-Hant visitors need zh defaults when the store does not
  // override the field explicitly.
  const zhHant = locale === 'zh-Hant';

  return {
    brandName,
    eyebrow: siteConfig.eyebrow?.trim() || (zhHant ? 'BOKMOO eSIM 卡' : 'BOKMOO eSIM Card'),
    headline:
      siteConfig.headline?.trim() ||
      (zhHant ? '一張卡。\n全球連線。' : 'One Card.\nGlobal Connection.'),
    subheadline:
      siteConfig.subheadline?.trim() ||
      (zhHant
        ? `在您的 ${brandName} 卡上使用多個 eSIM 設定檔，200+ 個國家/地區保持連線。`
        : `Use multiple eSIM profiles on your ${brandName} card. Stay connected in 200+ countries.`),
    supportEmail: siteConfig.supportEmail?.trim() || 'support@bokmoo.com',
    primaryCtaLabel: siteConfig.primaryCtaLabel?.trim() || (zhHant ? '選購 eSIM 方案' : 'Shop eSIM Plans'),
    primaryCtaHref: siteConfig.primaryCtaHref?.trim() || '/products',
    secondaryCtaLabel: siteConfig.secondaryCtaLabel?.trim() || (zhHant ? '了解使用方式' : 'How it works'),
    secondaryCtaHref: siteConfig.secondaryCtaHref?.trim() || '/#how-it-works',
    apiBaseUrl: siteConfig.apiBaseUrl?.trim() || 'https://api.bokmoo.com',
  };
}

export function isExternalHref(href?: string): boolean {
  if (!href) return false;
  return /^(https?:)?\/\//.test(href);
}
