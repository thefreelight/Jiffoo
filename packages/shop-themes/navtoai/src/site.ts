import type { ThemeConfig, ThemePackage } from 'shared/src/types/theme';
import { getNavCopy } from './i18n';

export interface NavToAiSiteConfig {
  brandName: string;
  eyebrow: string;
  headline: string;
  subheadline: string;
  supportEmail: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  docsHref: string;
  demoHref: string;
}

export const defaultNavToAiThemeConfig = {
  brand: {
    name: 'NavtoAI',
    primaryColor: '#6a6cff',
    secondaryColor: '#7bc9ff',
    fontFamily:
      '"Plus Jakarta Sans", "SF Pro Display", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  },
  layout: {
    headerSticky: true,
    showFooterLinks: true,
    maxWidth: '1440px',
  },
  features: {
    showWishlist: true,
    showRatings: true,
    enableQuickView: false,
  },
  site: {
    archetype: 'product-site',
    primaryCtaHref: '/products',
    secondaryCtaHref: '/help',
    docsHref: '/help',
    demoHref: '/products',
    supportEmail: 'hello@navto.ai',
  },
} satisfies NonNullable<ThemePackage['defaultConfig']>;

function resolveText(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export function resolveNavToAiSiteConfig(config?: ThemeConfig, locale?: string | null): NavToAiSiteConfig {
  const copy = getNavCopy(locale);
  const brandName = resolveText(config?.brand?.name, defaultNavToAiThemeConfig.brand.name);

  return {
    brandName,
    eyebrow: resolveText(config?.site?.eyebrow, copy.home.eyebrow),
    headline: resolveText(config?.site?.headline, copy.home.title),
    subheadline: resolveText(config?.site?.subheadline, copy.home.subtitle),
    supportEmail: resolveText(config?.site?.supportEmail, defaultNavToAiThemeConfig.site.supportEmail),
    primaryCtaLabel: resolveText(config?.site?.primaryCtaLabel, copy.common.browseAll),
    primaryCtaHref: resolveText(
      config?.site?.primaryCtaHref,
      defaultNavToAiThemeConfig.site.primaryCtaHref,
    ),
    secondaryCtaLabel: resolveText(config?.site?.secondaryCtaLabel, copy.footer.docs),
    secondaryCtaHref: resolveText(
      config?.site?.secondaryCtaHref,
      defaultNavToAiThemeConfig.site.secondaryCtaHref,
    ),
    docsHref: resolveText(config?.site?.docsHref, defaultNavToAiThemeConfig.site.docsHref),
    demoHref: resolveText(config?.site?.demoHref, defaultNavToAiThemeConfig.site.demoHref),
  };
}

export function isExternalHref(href?: string): boolean {
  return Boolean(href && (/^(https?:)?\/\//.test(href) || /^mailto:/.test(href)));
}
