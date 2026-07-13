import type { ThemeConfig } from 'shared/src/types/theme';

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
}

export interface NavLane {
  label: string;
  caption: string;
  href: string;
}

export const navLaunchLanes: NavLane[] = [
  {
    label: 'Chat & Search',
    caption: 'LLM copilots, research assistants, retrieval stacks, and conversational workflows.',
    href: '/search?q=chat',
  },
  {
    label: 'Image & Design',
    caption: 'Image generation, prompt editing, mockup, layout, and visual production tooling.',
    href: '/search?q=image',
  },
  {
    label: 'Video & Audio',
    caption: 'Speech, dubbing, editing, clip generation, and media post-production pipelines.',
    href: '/search?q=video',
  },
  {
    label: 'Coding & Agents',
    caption: 'IDE copilots, autonomous agents, eval stacks, and workflow automation systems.',
    href: '/search?q=agent',
  },
];

export function resolveNavToAiSiteConfig(config?: ThemeConfig): NavToAiSiteConfig {
  const brandName = config?.brand?.name?.trim() || 'NavToAI';

  return {
    brandName,
    eyebrow: config?.site?.eyebrow?.trim() || 'Curated AI stack directory',
    headline:
      config?.site?.headline?.trim() ||
      `${brandName} helps teams find the right AI tools for the actual job, not just the loudest launch.`,
    subheadline:
      config?.site?.subheadline?.trim() ||
      'Package discovery like an editorial navigation site: clearer categories, calmer comparisons, and commerce-ready paths when a tool belongs in the stack.',
    supportEmail: config?.site?.supportEmail?.trim() || 'hello@navto.ai',
    primaryCtaLabel: config?.site?.primaryCtaLabel?.trim() || 'Browse the directory',
    primaryCtaHref: config?.site?.primaryCtaHref?.trim() || '/products',
    secondaryCtaLabel: config?.site?.secondaryCtaLabel?.trim() || 'Open buyer guide',
    secondaryCtaHref: config?.site?.secondaryCtaHref?.trim() || '/help',
    docsHref: config?.site?.docsHref?.trim() || '/help',
  };
}

export function isExternalHref(href?: string): boolean {
  if (!href) return false;
  return /^(https?:)?\/\//.test(href);
}
