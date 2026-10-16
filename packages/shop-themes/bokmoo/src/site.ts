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

// The theme's English defaultConfig is deep-merged into the store config
// before it reaches components, so those fields always carry a value. Treat
// a value equal to the English default as "not customized" so zh-Hant
// visitors get the zh defaults instead of the merged-in English copy.
function pickLocalized(configured: string | undefined, englishDefault: string, zhDefault: string, zhHant: boolean): string {
  const value = configured?.trim();
  if (value && value !== englishDefault) return value;
  return zhHant ? zhDefault : englishDefault;
}

export function resolveBokmooSiteConfig(config?: ThemeConfig, locale?: string): BokmooSiteConfig {
  const brandName = config?.brand?.name?.trim() || 'BOKMOO';
  const siteConfig = (config?.site || {}) as ThemeConfig['site'] & {
    apiBaseUrl?: string;
  };
  const zhHant = locale === 'zh-Hant';
  const englishSubheadline = `Use multiple eSIM profiles on your ${brandName} card. Stay connected in 200+ countries.`;

  return {
    brandName,
    eyebrow: pickLocalized(siteConfig.eyebrow, 'BOKMOO eSIM Card', 'BOKMOO eSIM 卡', zhHant),
    headline: pickLocalized(siteConfig.headline, 'One Card.\nGlobal Connection.', '一張卡。\n全球連線。', zhHant),
    subheadline: pickLocalized(
      siteConfig.subheadline,
      englishSubheadline,
      `在您的 ${brandName} 卡上使用多個 eSIM 設定檔，200+ 個國家/地區保持連線。`,
      zhHant
    ),
    supportEmail: siteConfig.supportEmail?.trim() || 'support@bokmoo.com',
    primaryCtaLabel: pickLocalized(siteConfig.primaryCtaLabel, 'Shop eSIM Plans', '選購 eSIM 方案', zhHant),
    primaryCtaHref: siteConfig.primaryCtaHref?.trim() || '/products',
    secondaryCtaLabel: pickLocalized(siteConfig.secondaryCtaLabel, 'How it works', '了解使用方式', zhHant),
    secondaryCtaHref: siteConfig.secondaryCtaHref?.trim() || '/#how-it-works',
    apiBaseUrl: siteConfig.apiBaseUrl?.trim() || 'https://api.bokmoo.com',
  };
}

export function isExternalHref(href?: string): boolean {
  if (!href) return false;
  return /^(https?:)?\/\//.test(href);
}
