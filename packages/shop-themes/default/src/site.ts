import type { ThemeConfig } from 'shared/src/types/theme';

export type SiteArchetype = NonNullable<ThemeConfig['site']>['archetype'];

export interface ResolvedSiteConfig {
  brandName: string;
  archetype: NonNullable<SiteArchetype>;
  eyebrow: string;
  headline: string;
  subheadline: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  docsHref: string;
  demoHref: string;
  installCommand: string;
  dockerComposeCommand: string;
  supportEmail: string;
}

const DEFAULT_INSTALL_COMMAND = 'curl -fsSL https://get.jiffoo.com | bash';
const DEFAULT_DOCKER_COMMAND =
  'curl -fsSL https://get.jiffoo.com/docker-compose.yml -o docker-compose.yml && docker compose up -d';

export function resolveSiteConfig(config?: ThemeConfig): ResolvedSiteConfig {
  const brandName = config?.brand?.name?.trim() || 'Jiffoo';
  const archetype = config?.site?.archetype || 'landing-commerce';
  const docsHref = config?.site?.docsHref?.trim() || '/help';
  const demoHref = config?.site?.demoHref?.trim() || '/products';
  const primaryCtaHref = config?.site?.primaryCtaHref?.trim() || 'https://get.jiffoo.com';
  const secondaryCtaHref = config?.site?.secondaryCtaHref?.trim() || docsHref;

  const defaultsByArchetype: Record<
    NonNullable<SiteArchetype>,
    Pick<
      ResolvedSiteConfig,
      'eyebrow' | 'headline' | 'subheadline' | 'primaryCtaLabel' | 'secondaryCtaLabel'
    >
  > = {
    storefront: {
      eyebrow: 'Storefront starter',
      headline: `${brandName} starts with a clear storefront, not an empty template shell.`,
      subheadline:
        'Lead with the collection, keep the brand sharp, and let built-in commerce flows stay close to the first click.',
      primaryCtaLabel: 'Browse products',
      secondaryCtaLabel: 'Read the guide',
    },
    'landing-commerce': {
      eyebrow: 'Landing-commerce starter',
      headline: `${brandName} can explain the product first, then route buyers into the cart when they are ready.`,
      subheadline:
        'Use one homepage to introduce the offer, explain the stack, and still keep catalog and checkout one click away.',
      primaryCtaLabel: 'One-click install',
      secondaryCtaLabel: 'See the stack',
    },
    'product-site': {
      eyebrow: 'Product-site starter',
      headline: `${brandName} should launch like a product site, not look like a blank catalog wearing a logo.`,
      subheadline:
        'Installation, deployment, docs, themes, plugins, and commerce flows can live in one surface when the default theme is designed as a launchpad.',
      primaryCtaLabel: 'One-click install',
      secondaryCtaLabel: 'Open docs',
    },
  };

  const defaults = defaultsByArchetype[archetype];

  return {
    brandName,
    archetype,
    eyebrow: config?.site?.eyebrow?.trim() || defaults.eyebrow,
    headline: config?.site?.headline?.trim() || defaults.headline,
    subheadline: config?.site?.subheadline?.trim() || defaults.subheadline,
    primaryCtaLabel: config?.site?.primaryCtaLabel?.trim() || defaults.primaryCtaLabel,
    primaryCtaHref,
    secondaryCtaLabel: config?.site?.secondaryCtaLabel?.trim() || defaults.secondaryCtaLabel,
    secondaryCtaHref,
    docsHref,
    demoHref,
    installCommand: config?.site?.installCommand?.trim() || DEFAULT_INSTALL_COMMAND,
    dockerComposeCommand: DEFAULT_DOCKER_COMMAND,
    supportEmail: config?.site?.supportEmail?.trim() || 'hello@jiffoo.com',
  };
}

export function isExternalHref(href?: string): boolean {
  if (!href) return false;
  return /^(https?:)?\/\//.test(href);
}
