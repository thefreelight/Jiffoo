import type { ThemeConfig } from 'shared/src/types/theme';

export interface ModelsfindSiteConfig {
  brandName: string;
  archetype: 'storefront' | 'landing-commerce' | 'product-site';
  eyebrow: string;
  headline: string;
  subheadline: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  docsHref: string;
  demoHref: string;
  supportEmail: string;
  installCommand: string;
}

const DEFAULT_SITE_CONFIG: ModelsfindSiteConfig = {
  brandName: 'modelsfind',
  archetype: 'product-site',
  eyebrow: 'Curated model directory',
  headline: 'Editorial model profiles, instant availability cues, and premium booking requests in one refined destination.',
  subheadline:
    'Built for operators presenting premium model portfolios. Filter by region, look, and access tier while keeping the storefront polished, discreet, and booking-ready.',
  primaryCtaLabel: 'Explore collection',
  primaryCtaHref: '/products',
  secondaryCtaLabel: 'Request access',
  secondaryCtaHref: '/auth/register',
  docsHref: '/help',
  demoHref: '/products',
  supportEmail: 'hello@modelsfind.com',
  installCommand: 'pnpm theme:add modelsfind',
};

export function resolveModelsfindSiteConfig(config?: ThemeConfig): ModelsfindSiteConfig {
  return {
    ...DEFAULT_SITE_CONFIG,
    brandName: DEFAULT_SITE_CONFIG.brandName,
    archetype: config?.site?.archetype || DEFAULT_SITE_CONFIG.archetype,
    eyebrow: config?.site?.eyebrow || DEFAULT_SITE_CONFIG.eyebrow,
    headline: config?.site?.headline || DEFAULT_SITE_CONFIG.headline,
    subheadline: config?.site?.subheadline || DEFAULT_SITE_CONFIG.subheadline,
    primaryCtaLabel: config?.site?.primaryCtaLabel || DEFAULT_SITE_CONFIG.primaryCtaLabel,
    primaryCtaHref: config?.site?.primaryCtaHref || DEFAULT_SITE_CONFIG.primaryCtaHref,
    secondaryCtaLabel: config?.site?.secondaryCtaLabel || DEFAULT_SITE_CONFIG.secondaryCtaLabel,
    secondaryCtaHref: config?.site?.secondaryCtaHref || DEFAULT_SITE_CONFIG.secondaryCtaHref,
    docsHref: config?.site?.docsHref || DEFAULT_SITE_CONFIG.docsHref,
    demoHref: config?.site?.demoHref || DEFAULT_SITE_CONFIG.demoHref,
    supportEmail: config?.site?.supportEmail || DEFAULT_SITE_CONFIG.supportEmail,
  };
}

export function isExternalHref(href?: string): boolean {
  return Boolean(href && /^(https?:)?\/\//.test(href));
}

export const heroRegions = ['China', 'Japan', 'Korea', 'Europe'] as const;

export const previewPortraits = [
  {
    name: 'Selene',
    region: 'China',
    mood: 'Private suite glow',
    image:
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: 'Bianca',
    region: 'Japan',
    mood: 'Bare-shoulder spotlight',
    image:
      'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: 'Aria',
    region: 'Korea',
    mood: 'After-hours allure',
    image:
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: 'Sienna',
    region: 'China',
    mood: 'Heatwave editorial',
    image:
      'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: 'Mila',
    region: 'Korea',
    mood: 'Velvet close-up',
    image:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: 'Dalia',
    region: 'Europe',
    mood: 'Runway after-dark',
    image:
      'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=1200&q=80',
  },
];

export const platformSignals = [
  {
    title: 'Private boards',
    detail: 'Separate public galleries from operator-only moodboards and client review rooms.',
  },
  {
    title: 'Metadata first',
    detail: 'Organize by look, region, lighting style, shoot status, and access level in seconds.',
  },
  {
    title: 'Fast retrieval',
    detail: 'Search model profiles quickly while keeping the storefront polished enough for premium presentation.',
  },
];
