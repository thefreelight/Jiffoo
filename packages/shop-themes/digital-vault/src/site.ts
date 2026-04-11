import type { ThemeConfig } from './types/theme';

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
  heroBanners: Array<{
    id: string;
    badge: string;
    title: string;
    subtitle: string;
    imageUrl?: string;
    primaryLabel: string;
    primaryHref: string;
    secondaryLabel?: string;
    secondaryHref?: string;
  }>;
}

function getDefaultHeroBanners(config?: ThemeConfig): VaultSiteConfig['heroBanners'] {
  const site = config?.site;

  return [
    {
      id: 'launch',
      badge: site?.eyebrow?.trim() || 'Instant digital goods storefront',
      title:
        site?.headline?.trim() ||
        'Sell card codes, accounts, and downloads with a storefront built for delivery.',
      subtitle:
        site?.subheadline?.trim() ||
        'Browse by category, confirm stock before payment, and keep every delivery inside the order center instead of losing it in support chat.',
      primaryLabel: site?.primaryCtaLabel?.trim() || 'Browse products',
      primaryHref: site?.primaryCtaHref?.trim() || '/products',
      secondaryLabel: site?.secondaryCtaLabel?.trim() || 'Help center',
      secondaryHref: site?.secondaryCtaHref?.trim() || '/help',
    },
    {
      id: 'guest-order',
      badge: 'Guest order access',
      title: 'Buy first, then reopen the order center with your checkout email.',
      subtitle:
        'Guest buyers can still reclaim codes, credentials, and download links from one delivery locker instead of chasing manual support.',
      primaryLabel: 'Track guest order',
      primaryHref: '/guest/orders',
      secondaryLabel: 'Open help center',
      secondaryHref: '/help',
    },
    {
      id: 'catalog',
      badge: 'Category-led browsing',
      title: 'Gift cards, redeem codes, accounts, and downloads stay separated by format.',
      subtitle:
        'The storefront keeps high-density category browsing so shoppers can narrow the exact delivery type before they ever hit checkout.',
      primaryLabel: 'Open catalog',
      primaryHref: '/products',
      secondaryLabel: 'View deals',
      secondaryHref: '/deals',
    },
  ];
}

export function resolveVaultSiteConfig(config?: ThemeConfig): VaultSiteConfig {
  const brandName = config?.brand?.name?.trim() || 'Digital Vault';
  const configuredBanners = Array.isArray(config?.site?.heroBanners)
    ? config?.site?.heroBanners
        ?.map((banner, index) => {
          const title = banner?.title?.trim();
          const primaryLabel = banner?.primaryLabel?.trim();
          const primaryHref = banner?.primaryHref?.trim();

          if (!title || !primaryLabel || !primaryHref) {
            return null;
          }

          return {
            id: banner?.id?.trim() || `banner-${index + 1}`,
            badge: banner?.badge?.trim() || 'Featured banner',
            title,
            subtitle: banner?.subtitle?.trim() || '',
            imageUrl: banner?.imageUrl?.trim() || undefined,
            primaryLabel,
            primaryHref,
            secondaryLabel: banner?.secondaryLabel?.trim() || undefined,
            secondaryHref: banner?.secondaryHref?.trim() || undefined,
          };
        })
        .filter(Boolean)
    : [];

  return {
    brandName,
    eyebrow: config?.site?.eyebrow?.trim() || 'Instant digital goods storefront',
    headline:
      config?.site?.headline?.trim() ||
      'Sell card codes, accounts, and downloads with a storefront built for delivery.',
    subheadline:
      config?.site?.subheadline?.trim() ||
      'Browse by category, confirm stock before payment, and keep every delivery inside the order center instead of losing it in support chat.',
    supportEmail: config?.site?.supportEmail?.trim() || 'support@example.com',
    primaryCtaLabel: config?.site?.primaryCtaLabel?.trim() || 'Browse products',
    primaryCtaHref: config?.site?.primaryCtaHref?.trim() || '/products',
    secondaryCtaLabel: config?.site?.secondaryCtaLabel?.trim() || 'Help center',
    secondaryCtaHref: config?.site?.secondaryCtaHref?.trim() || '/help',
    heroBanners: configuredBanners.length ? configuredBanners : getDefaultHeroBanners(config),
  };
}

export function isExternalHref(href?: string): boolean {
  if (!href) return false;
  return /^(https?:)?\/\//.test(href);
}
