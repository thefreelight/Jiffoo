import type { ThemeConfig, ThemePackage } from 'shared/src/types/theme';

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

export interface ModelsfindPreviewPortrait {
  name: string;
  region: string;
  cities?: string;
  mood: string;
  image: string;
  age?: string;
  height?: string;
  measurements?: string;
  badge?: string;
}

export interface ConciergeSuggestion {
  name: string;
  role: string;
  city: string;
  image: string;
}

export interface ConciergeMessage {
  role: 'assistant' | 'user';
  text: string;
}

export const defaultModelsfindThemeConfig = {
  brand: {
    name: 'modelsfind',
    primaryColor: '#e84fda',
    secondaryColor: '#9a6cff',
    fontFamily: '"Noto Serif", "Iowan Old Style", serif',
  },
  layout: {
    headerSticky: true,
    showFooterLinks: true,
    maxWidth: '1280px',
  },
  features: {
    showWishlist: true,
    showRatings: false,
    enableQuickView: false,
  },
  site: {
    archetype: 'product-site',
    eyebrow: 'Curated exclusivity',
    headline: 'modelsfind',
    subheadline: 'Curated exclusivity beyond the ordinary.',
    primaryCtaLabel: 'Browse collection',
    primaryCtaHref: '/products',
    secondaryCtaLabel: 'Private access',
    secondaryCtaHref: '/auth/register',
    docsHref: '/help',
    demoHref: '/products',
    supportEmail: 'concierge@modelsfind.com',
    installCommand: 'pnpm theme:add modelsfind',
  },
} satisfies NonNullable<ThemePackage['defaultConfig']>;

const DEFAULT_SITE_CONFIG: ModelsfindSiteConfig = {
  brandName: defaultModelsfindThemeConfig.brand.name,
  archetype: defaultModelsfindThemeConfig.site.archetype,
  eyebrow: defaultModelsfindThemeConfig.site.eyebrow,
  headline: defaultModelsfindThemeConfig.site.headline,
  subheadline: defaultModelsfindThemeConfig.site.subheadline,
  primaryCtaLabel: defaultModelsfindThemeConfig.site.primaryCtaLabel,
  primaryCtaHref: defaultModelsfindThemeConfig.site.primaryCtaHref,
  secondaryCtaLabel: defaultModelsfindThemeConfig.site.secondaryCtaLabel,
  secondaryCtaHref: defaultModelsfindThemeConfig.site.secondaryCtaHref,
  docsHref: defaultModelsfindThemeConfig.site.docsHref,
  demoHref: defaultModelsfindThemeConfig.site.demoHref,
  supportEmail: defaultModelsfindThemeConfig.site.supportEmail,
  installCommand: defaultModelsfindThemeConfig.site.installCommand,
};

function resolveText(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export function resolveModelsfindSiteConfig(config?: ThemeConfig): ModelsfindSiteConfig {
  return {
    ...DEFAULT_SITE_CONFIG,
    brandName: resolveText(config?.brand?.name, DEFAULT_SITE_CONFIG.brandName),
    archetype: config?.site?.archetype || DEFAULT_SITE_CONFIG.archetype,
    eyebrow: resolveText(config?.site?.eyebrow, DEFAULT_SITE_CONFIG.eyebrow),
    headline: resolveText(config?.site?.headline, DEFAULT_SITE_CONFIG.headline),
    subheadline: resolveText(config?.site?.subheadline, DEFAULT_SITE_CONFIG.subheadline),
    primaryCtaLabel: resolveText(config?.site?.primaryCtaLabel, DEFAULT_SITE_CONFIG.primaryCtaLabel),
    primaryCtaHref: resolveText(config?.site?.primaryCtaHref, DEFAULT_SITE_CONFIG.primaryCtaHref),
    secondaryCtaLabel: resolveText(config?.site?.secondaryCtaLabel, DEFAULT_SITE_CONFIG.secondaryCtaLabel),
    secondaryCtaHref: resolveText(config?.site?.secondaryCtaHref, DEFAULT_SITE_CONFIG.secondaryCtaHref),
    docsHref: resolveText(config?.site?.docsHref, DEFAULT_SITE_CONFIG.docsHref),
    demoHref: resolveText(config?.site?.demoHref, DEFAULT_SITE_CONFIG.demoHref),
    supportEmail: resolveText(config?.site?.supportEmail, DEFAULT_SITE_CONFIG.supportEmail),
    installCommand: resolveText(config?.site?.installCommand, DEFAULT_SITE_CONFIG.installCommand),
  };
}

export function isExternalHref(href?: string): boolean {
  return Boolean(href && (/^(https?:)?\/\//.test(href) || /^mailto:/.test(href)));
}

export const desktopNavItems = ['Models', 'Services', 'Booking'] as const;
export const frameNavItems = ['Models', 'Services', 'Booking'] as const;
export const heroRegions = ['China', 'Japan', 'Korea', 'Europe & US', 'SE Asia'] as const;

export const previewPortraits = [
  {
    name: 'Ximena',
    region: 'China',
    cities: 'Shanghai / Beijing',
    mood: 'Haute editorial',
    age: '27',
    height: '5′11″',
    measurements: '34B / 24 / 35',
    badge: 'Featured',
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1400&q=80',
  },
  {
    name: 'Kenji',
    region: 'Japan',
    cities: 'Tokyo / Kyoto',
    mood: 'Minimal tailoring',
    age: '29',
    height: '6′1″',
    measurements: 'Runway',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1400&q=80',
  },
  {
    name: 'Aria',
    region: 'Korea',
    cities: 'Seoul / Busan',
    mood: 'Midnight allure',
    age: '24',
    height: '5′9″',
    measurements: '34 / 24 / 35',
    badge: 'Private Match',
    image: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=1400&q=80',
  },
  {
    name: 'Soren',
    region: 'Europe & US',
    cities: 'Paris / Milan',
    mood: 'Sharp monochrome',
    age: '31',
    height: '6′0″',
    measurements: 'Editorial',
    image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1400&q=80',
  },
  {
    name: 'Mila',
    region: 'Europe & US',
    cities: 'Berlin / London',
    mood: 'Glass skin',
    age: '25',
    height: '5′10″',
    measurements: '33 / 23 / 34',
    image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1400&q=80',
  },
  {
    name: 'Dorian',
    region: 'SE Asia',
    cities: 'Bangkok / Singapore',
    mood: 'After-dark precision',
    age: '28',
    height: '6′1″',
    measurements: 'Campaign',
    image: 'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=1400&q=80',
  },
] satisfies ModelsfindPreviewPortrait[];

export function findPreviewPortraitByName(name?: string | null): ModelsfindPreviewPortrait | undefined {
  if (!name) {
    return undefined;
  }

  const normalized = name.trim().toLowerCase();
  return previewPortraits.find((portrait) => portrait.name.trim().toLowerCase() === normalized);
}

function hashPreviewSeed(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function resolvePreviewPortraitForProduct(
  product?: { id?: string | null; name?: string | null } | null,
  fallbackIndex = 0,
): ModelsfindPreviewPortrait {
  const matchedByName = findPreviewPortraitByName(product?.name);
  if (matchedByName) {
    return matchedByName;
  }

  const seed = `${product?.id || ''}:${product?.name || ''}`.trim();
  if (!seed) {
    return previewPortraits[fallbackIndex % previewPortraits.length];
  }

  return previewPortraits[hashPreviewSeed(seed) % previewPortraits.length];
}

export function getModelsfindDisplayName(
  product?: { id?: string | null; name?: string | null } | null,
  fallbackIndex = 0,
): string {
  return resolvePreviewPortraitForProduct(product, fallbackIndex).name;
}

export const conciergeSuggestions = [
  {
    name: 'Elena V.',
    role: 'Milan classic',
    city: 'St. Moritz',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Julian K.',
    role: 'High-fashion tailoring',
    city: 'Tokyo',
    image: 'https://images.unsplash.com/photo-1504257432389-52343af06ae3?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Sasha L.',
    role: 'Midnight allure',
    city: 'Paris',
    image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80',
  },
] satisfies ConciergeSuggestion[];

export const conciergePrompts = [
  'I need someone with an editorial look for a gallery opening in Roppongi Hills.',
  'Show me couture faces in Tokyo for a night editorial shoot.',
  'I want a discreet private-event profile with runway-level polish.',
];

export const conciergeConversation = [
  {
    role: 'assistant',
    text: 'Good evening. I have curated an exclusive selection of talent currently available in Tokyo for high-fashion commissions. Shall I refine by specific aesthetic or availability for next week?',
  },
  {
    role: 'user',
    text: 'Show me models in Tokyo for a night-time editorial shoot. High contrast, noir vibes.',
  },
  {
    role: 'assistant',
    text: 'I suggest a Tokyo editorial shortlist led by Sasha L. for noir contrast and Elena V. for sculpted evening polish. I can narrow by budget or booking window next.',
  },
] satisfies ConciergeMessage[];

export const conciergeQuickActions = [
  'Show me models in Tokyo',
  'Book Sasha V.',
  'Filter by available now',
];

export const platformSignals = [
  {
    title: 'Private boards',
    detail: 'Curate hidden shortlists for clients without flattening the public storefront into a generic catalog.',
  },
  {
    title: 'AI concierge',
    detail: 'Translate mood, city, and event brief into a shortlist that still feels editorial rather than mechanical.',
  },
  {
    title: 'Secure booking',
    detail: 'Support discreet requests, payment confirmation, and concierge follow-through from the same premium flow.',
  },
];
