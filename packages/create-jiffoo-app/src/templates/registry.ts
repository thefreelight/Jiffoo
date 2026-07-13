/**
 * Template Registry
 *
 * Maps vertical templates to:
 * - Theme artifact reference (npm package or published ZIP)
 * - Seed dataset (sample products tailored to the vertical)
 * - .env presets (storefront configuration overrides)
 *
 * Design principle: themes reference *published artifacts*, not source.
 * When a user selects a template, the CLI clones the monorepo then applies
 * the template's post-clone configuration (env overrides, theme activation,
 * seed dataset selection).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TemplateCategory =
  | 'general'
  | 'digital-goods'
  | 'esim'
  | 'travel';

export interface ThemeArtifactRef {
  /** Theme slug used in the registry (e.g. "digital-vault") */
  slug: string;
  /** Published npm package name or GitHub release asset URL */
  packageName: string;
  /** Semver range or exact version of the published artifact */
  version: string;
  /**
   * Artifact source type:
   * - `builtin` — already bundled in the monorepo (workspace package)
   * - `npm` — published to npm registry
   * - `url` — downloadable ZIP from a URL
   */
  source: 'builtin' | 'npm' | 'url';
}

export interface SeedDatasetRef {
  /** Dataset identifier (matches a file under seed-data/) */
  id: string;
  /** Human-readable description shown in CLI */
  description: string;
  /**
   * Seed profile name consumed by the seed script via
   * JIFFOO_SEED_PROFILE env var. The seed script reads this to
   * select which product catalog to insert.
   */
  profile: string;
}

export interface TemplateConfig {
  /** Template identifier used in --template flag */
  name: string;
  /** Display name shown in interactive prompt */
  displayName: string;
  /** Short description for the prompt */
  description: string;
  /** Category for grouping */
  category: TemplateCategory;
  /** Theme to activate after cloning */
  theme: ThemeArtifactRef;
  /** Seed dataset to use when --seed is passed */
  seedDataset: SeedDatasetRef;
  /** Environment variable presets applied to .env */
  envPresets: Record<string, string>;
  /** Tags for search/filter */
  tags: string[];
  /** Whether this template is stable (vs experimental) */
  stable: boolean;
}

// ---------------------------------------------------------------------------
// Template Definitions
// ---------------------------------------------------------------------------

export const TEMPLATES: TemplateConfig[] = [
  {
    name: 'default',
    displayName: 'Standard Store',
    description:
      'General-purpose e-commerce storefront with sample physical products. Best for getting started.',
    category: 'general',
    theme: {
      slug: 'builtin-default',
      packageName: '@shop-themes/default',
      version: '1.0.0',
      source: 'builtin',
    },
    seedDataset: {
      id: 'default',
      description: 'Mixed catalog: apparel, electronics, home goods',
      profile: 'default',
    },
    envPresets: {},
    tags: ['general', 'physical-goods', 'starter'],
    stable: true,
  },
  {
    name: 'digital-goods',
    displayName: 'Digital Goods Store',
    description:
      'Sell gift cards, redemption codes, software licenses, and downloadable products with instant digital fulfillment.',
    category: 'digital-goods',
    theme: {
      slug: 'digital-vault',
      packageName: '@shop-themes/digital-vault',
      version: '1.0.0',
      source: 'builtin',
    },
    seedDataset: {
      id: 'digital-goods',
      description:
        'Digital catalog: gift cards, game codes, software licenses, e-books',
      profile: 'digital-goods',
    },
    envPresets: {
      JIFFOO_SEED_PROFILE: 'digital-goods',
      JIFFOO_ACTIVE_THEME_SLUG: 'digital-vault',
      JIFFOO_DIGITAL_FULFILLMENT_ENABLED: 'true',
    },
    tags: ['digital', 'gift-cards', 'codes', 'downloads', 'instant-fulfillment'],
    stable: true,
  },
  {
    name: 'esim',
    displayName: 'eSIM Mall',
    description:
      'eSIM marketplace with travel data plans, QR code delivery, and regional coverage. Ideal for telecom / travel-tech.',
    category: 'esim',
    theme: {
      slug: 'esim-mall',
      packageName: '@shop-themes/esim-mall',
      version: '1.0.0',
      source: 'builtin',
    },
    seedDataset: {
      id: 'esim',
      description:
        'eSIM catalog: regional plans, global plans, country-specific data packages',
      profile: 'esim',
    },
    envPresets: {
      JIFFOO_SEED_PROFILE: 'esim',
      JIFFOO_ACTIVE_THEME_SLUG: 'esim-mall',
      JIFFOO_DIGITAL_FULFILLMENT_ENABLED: 'true',
    },
    tags: ['esim', 'travel', 'connectivity', 'qr-delivery'],
    stable: true,
  },
];

// ---------------------------------------------------------------------------
// Registry API
// ---------------------------------------------------------------------------

/** Get a template by name (case-insensitive) */
export function getTemplate(name: string): TemplateConfig | undefined {
  const lower = name.toLowerCase();
  return TEMPLATES.find((t) => t.name.toLowerCase() === lower);
}

/** Get all template names */
export function getTemplateNames(): string[] {
  return TEMPLATES.map((t) => t.name);
}

/** Get all stable templates (for interactive prompt) */
export function getStableTemplates(): TemplateConfig[] {
  return TEMPLATES.filter((t) => t.stable);
}

/** Get templates by category */
export function getTemplatesByCategory(
  category: TemplateCategory,
): TemplateConfig[] {
  return TEMPLATES.filter((t) => t.category === category);
}

/** Validate that a template name exists */
export function isValidTemplate(name: string): boolean {
  return getTemplate(name) !== undefined;
}

/** Default template (used when --template is not specified) */
export const DEFAULT_TEMPLATE = 'default';
