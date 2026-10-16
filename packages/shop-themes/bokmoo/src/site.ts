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
// a value equal to the English default as "not customized" so zh visitors
// get the zh defaults instead of the merged-in English copy.
type ZhMode = 'zh-Hans' | 'zh-Hant' | null;

function zhModeOf(locale: string | undefined | null): ZhMode {
  if (locale === 'zh-Hant') return 'zh-Hant';
  if (locale === 'zh-Hans') return 'zh-Hans';
  return null;
}

export function pickCopy(
  locale: string | undefined,
  copy: { en: string; hans?: string; hant?: string }
): string {
  const mode = zhModeOf(locale);
  if (mode === 'zh-Hant') return copy.hant ?? copy.en;
  if (mode === 'zh-Hans') return copy.hans ?? copy.hant ?? copy.en;
  return copy.en;
}

function pickLocalized(configured: string | undefined, englishDefault: string, zhHans: string, zhHant: string, mode: ZhMode): string {
  const value = configured?.trim();
  if (value && value !== englishDefault) return value;
  if (mode === 'zh-Hant') return zhHant;
  if (mode === 'zh-Hans') return zhHans;
  return englishDefault;
}

export function resolveBokmooSiteConfig(config?: ThemeConfig, locale?: string): BokmooSiteConfig {
  const brandName = config?.brand?.name?.trim() || 'BOKMOO';
  const siteConfig = (config?.site || {}) as ThemeConfig['site'] & {
    apiBaseUrl?: string;
  };
  const mode = zhModeOf(locale);
  const englishSubheadline = `Use multiple eSIM profiles on your ${brandName} card. Stay connected in 200+ countries.`;

  return {
    brandName,
    eyebrow: pickLocalized(siteConfig.eyebrow, 'BOKMOO eSIM Card', 'BOKMOO eSIM 卡', 'BOKMOO eSIM 卡', mode),
    headline: pickLocalized(siteConfig.headline, 'One Card.\nGlobal Connection.', '一张卡。\n全球连接。', '一張卡。\n全球連線。', mode),
    subheadline: pickLocalized(
      siteConfig.subheadline,
      englishSubheadline,
      `在您的 ${brandName} 卡上使用多个 eSIM 配置文件，200+ 个国家/地区保持连接。`,
      `在您的 ${brandName} 卡上使用多個 eSIM 設定檔，200+ 個國家/地區保持連線。`,
      mode
    ),
    supportEmail: siteConfig.supportEmail?.trim() || 'support@bokmoo.com',
    primaryCtaLabel: pickLocalized(siteConfig.primaryCtaLabel, 'Shop eSIM Plans', '选购 eSIM 方案', '選購 eSIM 方案', mode),
    primaryCtaHref: siteConfig.primaryCtaHref?.trim() || '/products',
    secondaryCtaLabel: pickLocalized(siteConfig.secondaryCtaLabel, 'How it works', '了解使用方式', '瞭解使用方式', mode),
    secondaryCtaHref: siteConfig.secondaryCtaHref?.trim() || '/#how-it-works',
    apiBaseUrl: siteConfig.apiBaseUrl?.trim() || 'https://api.bokmoo.com',
  };
}

export function isExternalHref(href?: string): boolean {
  if (!href) return false;
  return /^(https?:)?\/\//.test(href);
}
