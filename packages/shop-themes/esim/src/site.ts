import type { ThemeConfig } from 'shared/src/types/theme';
import { themeMessage } from './i18n';

export interface EsimSiteConfig {
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

/**
 * Resolve a piece of theme copy for the storefront locale.
 *
 * zh-Hans / zh-Hant read their inline `hans` / `hant` entries. ja / ko / fr /
 * de take an explicit entry when the call site has one, otherwise the theme
 * message catalog (`src/i18n`) translates the English source — so a string
 * is translated once in the catalog instead of four times at every call
 * site. Anything unresolved falls back to English.
 */
/** Theme copy in every storefront locale; only `en` is mandatory. */
export type ThemeCopy = { en: string; hans?: string; hant?: string; ja?: string; ko?: string; fr?: string; de?: string };

export function pickCopy(locale: string | undefined, copy: ThemeCopy): string {
  const catalog = copy.en ? themeMessage(locale, copy.en) : null;
  if (locale === 'ja') return copy.ja ?? catalog ?? copy.en;
  if (locale === 'ko') return copy.ko ?? catalog ?? copy.en;
  if (locale === 'fr') return copy.fr ?? catalog ?? copy.en;
  if (locale === 'de') return copy.de ?? catalog ?? copy.en;
  const mode = zhModeOf(locale);
  if (mode === 'zh-Hant') return copy.hant ?? copy.en;
  if (mode === 'zh-Hans') return copy.hans ?? copy.hant ?? copy.en;
  return copy.en;
}

function pickLocalized(configured: string | undefined, englishDefault: string, zhHans: string, zhHant: string, locale?: string): string {
  const value = configured?.trim();
  if (value && value !== englishDefault) return value;
  const mode = zhModeOf(locale);
  if (mode === 'zh-Hant') return zhHant;
  if (mode === 'zh-Hans') return zhHans;
  return themeMessage(locale, englishDefault) ?? englishDefault;
}

export function resolveEsimSiteConfig(config?: ThemeConfig, locale?: string): EsimSiteConfig {
  const brandName = config?.brand?.name?.trim() || 'BOKMOO';
  const siteConfig = (config?.site || {}) as ThemeConfig['site'] & {
    apiBaseUrl?: string;
  };
  const englishSubheadline = `Use multiple eSIM profiles on your ${brandName} card. Stay connected in 200+ countries.`;
  // The subheadline embeds the brand name, so it cannot be keyed by a fixed
  // English source in the catalog; translate the frame and keep the brand.
  const SUBHEADLINE_FRAMES: Record<string, (brand: string) => string> = {
    ja: (brand) => `${brand} カードで複数の eSIM プロファイルを利用。200 以上の国・地域でつながり続けられます。`,
    ko: (brand) => `${brand} 카드에서 여러 eSIM 프로필을 사용하세요. 200개 이상의 국가·지역에서 연결을 유지할 수 있습니다.`,
    fr: (brand) => `Utilisez plusieurs profils eSIM sur votre carte ${brand}. Restez connecté dans plus de 200 pays.`,
    de: (brand) => `Nutzen Sie mehrere eSIM-Profile auf Ihrer ${brand}-Karte. Bleiben Sie in über 200 Ländern verbunden.`,
  };
  const subheadlineFrame = locale && locale in SUBHEADLINE_FRAMES ? SUBHEADLINE_FRAMES[locale](brandName) : null;
  const zhMode = zhModeOf(locale);
  const defaultSubheadline =
    subheadlineFrame
    ?? (zhMode === 'zh-Hant'
      ? `在您的 ${brandName} 卡上使用多個 eSIM 設定檔，200+ 個國家/地區保持連線。`
      : zhMode === 'zh-Hans'
        ? `在您的 ${brandName} 卡上使用多个 eSIM 配置文件，200+ 个国家/地区保持连接。`
        : englishSubheadline);
  // A merchant-customized subheadline is used as written in every locale.
  const customizedSubheadline = siteConfig.subheadline?.trim();
  const subheadline = customizedSubheadline && customizedSubheadline !== englishSubheadline ? customizedSubheadline : defaultSubheadline;

  return {
    brandName,
    eyebrow: pickLocalized(siteConfig.eyebrow, 'BOKMOO eSIM Card', 'BOKMOO eSIM 卡', 'BOKMOO eSIM 卡', locale),
    headline: pickLocalized(siteConfig.headline, 'One Card.\nGlobal Connection.', '一张卡。\n全球连接。', '一張卡。\n全球連線。', locale),
    subheadline,
    supportEmail: siteConfig.supportEmail?.trim() || 'support@bokmoo.com',
    primaryCtaLabel: pickLocalized(siteConfig.primaryCtaLabel, 'Shop eSIM Plans', '选购 eSIM 方案', '選購 eSIM 方案', locale),
    primaryCtaHref: siteConfig.primaryCtaHref?.trim() || '/products',
    secondaryCtaLabel: pickLocalized(siteConfig.secondaryCtaLabel, 'How it works', '了解使用方式', '瞭解使用方式', locale),
    secondaryCtaHref: siteConfig.secondaryCtaHref?.trim() || '/#how-it-works',
    apiBaseUrl: siteConfig.apiBaseUrl?.trim() || 'https://api.bokmoo.com',
  };
}

/**
 * Pure eSIM mall filter (PRD: 独立纯 eSIM 商城). The shared instance catalog
 * also carries Bokmoo physical cards for bokmoo.com — those never belong in
 * this storefront's plan lists, search results, or collection pages.
 */
export function isEsimPlanProduct(product: unknown): boolean {
  const source = product as { id?: string; typeData?: { esim?: unknown } };
  if (source?.typeData?.esim) return true;
  return typeof source?.id === 'string' && source.id.startsWith('boss-');
}

export function filterEsimPlans<T>(products: T[] | undefined | null): T[] {
  return (products || []).filter((product) => isEsimPlanProduct(product));
}

export function isExternalHref(href?: string): boolean {
  if (!href) return false;
  return /^(https?:)?\/\//.test(href);
}
