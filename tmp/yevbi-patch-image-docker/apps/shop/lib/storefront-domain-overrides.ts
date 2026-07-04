type StorefrontContextLike = {
  storeName?: string;
  theme?: {
    slug?: string;
    version?: string;
    source?: 'builtin' | 'installed' | 'local-zip' | 'official-market';
    type?: 'pack' | 'app';
    config?: Record<string, any>;
  } | null;
};

type ActiveThemeLike = {
  slug?: string;
  version?: string;
  source?: 'builtin' | 'installed' | 'local-zip' | 'official-market';
  type?: 'pack' | 'app';
  config?: Record<string, any>;
} | null | undefined;

function normalizeHostname(hostname?: string | null): string {
  return (hostname || '').split(':')[0]?.trim().toLowerCase() || '';
}

function isYevbiHost(hostname?: string | null): boolean {
  const host = normalizeHostname(hostname);
  return host === 'yevbi.com' || host === 'www.yevbi.com';
}

function shouldUseYevbiOverride(slug?: string | null): boolean {
  const normalizedSlug = normalizeHostname(slug);
  return normalizedSlug === 'yevbi' || normalizedSlug === 'esim-mall';
}

function applyYevbiThemeConfig<T extends ActiveThemeLike>(theme: T): T {
  if (!theme) {
    return theme;
  }

  return {
    ...theme,
    slug: 'esim-mall',
    version: theme.version || '1.1.0',
    source: theme.source || 'official-market',
    type: theme.type || 'pack',
    config: {
      ...(theme.config || {}),
      brand: {
        ...(theme.config?.brand || {}),
        name: 'Yevbi',
        primaryColor: '#176bff',
        secondaryColor: '#0b4edb',
        fontFamily: '"Manrope", "Aptos", sans-serif',
      },
      colors: {
        ...(theme.config?.colors || {}),
        primary: '#176bff',
        secondary: '#0b4edb',
        background: '#f7faff',
        foreground: '#0b1220',
        muted: '#64748b',
        border: '#e2e8f0',
        accent: '#176bff',
      },
      site: {
        ...(theme.config?.site || {}),
        archetype: 'storefront',
        eyebrow: 'Web — Home',
        headline: 'Data that lands before you do.',
        subheadline: 'Global eSIM plans, selected with care.',
        supportEmail: 'support@yevbi.com',
        primaryCtaLabel: 'Find plans',
        secondaryCtaLabel: 'Explore destinations',
      },
    },
  } as T;
}

export function applyActiveThemeDomainOverride<T extends ActiveThemeLike>(
  theme: T,
  hostname?: string | null,
): T {
  if (!isYevbiHost(hostname) || !shouldUseYevbiOverride(theme?.slug)) {
    return theme;
  }

  return applyYevbiThemeConfig(theme);
}

export function applyStorefrontDomainOverride<T extends StorefrontContextLike>(
  context: T,
  hostname?: string | null,
): T {
  if (!isYevbiHost(hostname) || !shouldUseYevbiOverride(context.theme?.slug)) {
    return context;
  }

  return {
    ...context,
    storeName: 'Yevbi',
    theme: applyYevbiThemeConfig(context.theme),
  };
}
