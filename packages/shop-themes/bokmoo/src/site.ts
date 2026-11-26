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
  /** The brand film on the home page, or null when the store owner turned it off. */
  promoFilm: BokmooPromoFilm | null;
  /** What the catalog page lists. The official store carries cards only; plans live on the eSIM mall. */
  catalogProducts: BokmooCatalogProducts;
}

export type BokmooCatalogProducts = 'cards' | 'plans' | 'all';

const CATALOG_PRODUCTS: BokmooCatalogProducts[] = ['cards', 'plans', 'all'];

export interface BokmooPromoFilm {
  /** Poster for narrow screens */
  poster: string;
  /** A sharper poster for large screens; equal to `poster` when there is none */
  posterLarge: string;
  /** Muted loop for wide screens */
  muted: string;
  /** Muted loop for narrow screens */
  mutedSmall: string;
  /** The full film with its narration */
  sound: string;
}

// The film lives in the store's own asset bucket, under a path that carries its cut: the service worker
// keeps video files for a day, so a new cut must come under a new path to reach returning visitors.
const PROMO_FILM_PATH = '/extensions/media/promo/v3';
const PROMO_FILM_DEFAULTS = {
  poster: `${PROMO_FILM_PATH}/bokmoo-promo-poster-1280.jpg`,
  posterLarge: `${PROMO_FILM_PATH}/bokmoo-promo-poster-1920.jpg`,
  muted: `${PROMO_FILM_PATH}/bokmoo-promo-720p-muted.mp4`,
  mutedSmall: `${PROMO_FILM_PATH}/bokmoo-promo-540p-muted.mp4`,
  sound: `${PROMO_FILM_PATH}/bokmoo-promo-720p.mp4`,
};

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
  copy: { en: string; hans?: string; hant?: string; ja?: string; ko?: string; fr?: string; de?: string }
): string {
  if (locale === 'ja') return copy.ja ?? copy.en;
  if (locale === 'ko') return copy.ko ?? copy.en;
  if (locale === 'fr') return copy.fr ?? copy.en;
  if (locale === 'de') return copy.de ?? copy.en;
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

  // "none" (or nothing at all) in the poster setting turns the film off
  const posterSetting = siteConfig.promoPoster?.trim();
  const poster = posterSetting || PROMO_FILM_DEFAULTS.poster;
  const posterLarge = posterSetting && posterSetting !== PROMO_FILM_DEFAULTS.poster ? poster : PROMO_FILM_DEFAULTS.posterLarge;
  const promoFilm =
    posterSetting?.toLowerCase() === 'none' || siteConfig.promoPoster === ''
      ? null
      : {
          poster,
          posterLarge,
          muted: siteConfig.promoMutedVideo?.trim() || PROMO_FILM_DEFAULTS.muted,
          mutedSmall: siteConfig.promoMutedVideoSmall?.trim() || PROMO_FILM_DEFAULTS.mutedSmall,
          sound: siteConfig.promoSoundVideo?.trim() || PROMO_FILM_DEFAULTS.sound,
        };
  // A setting the theme does not know falls back to cards, the official store's assortment
  const catalogSetting = String(siteConfig.catalogProducts ?? '').trim().toLowerCase();
  const catalogProducts = ((CATALOG_PRODUCTS as string[]).includes(catalogSetting) ? catalogSetting : 'cards') as BokmooCatalogProducts;

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
    promoFilm,
    catalogProducts,
  };
}

export function isExternalHref(href?: string): boolean {
  if (!href) return false;
  return /^(https?:)?\/\//.test(href);
}
