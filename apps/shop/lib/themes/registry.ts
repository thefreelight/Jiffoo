/**
 * Theme Registry
 * Maintains the mapping of all available themes and supports dynamic imports.
 *
 * Supports two theme sources:
 * 1. Built-in themes - Installed via npm packages, using static imports
 * 2. Installed themes - Installed via Extension Installer to extensions/themes/shop/
 */

import type { ThemePackage, ThemeMeta, ThemeRegistryEntry, ThemeRegistry } from 'shared/src/types/theme';
import digitalVaultTheme from '@shop-themes/digital-vault/src/runtime';
import esimMallTheme from '@shop-themes/esim-mall/src/runtime';
import yevbiTheme from '@shop-themes/yevbi/src/runtime';
import bokmooTheme from '@shop-themes/bokmoo/src/runtime';
import imagicStudioTheme from '@shop-themes/imagic-studio/src/runtime';
import navtoaiTheme from '@shop-themes/navtoai/src/runtime';

// ============================================================================
// Built-in Theme Constants
// ============================================================================

/**
 * Canonical builtin theme slug (as per PRD_FINAL_BLUEPRINT.md)
 */
const BUILTIN_DEFAULT_SLUG = 'builtin-default';

/**
 * Legacy slug for backwards compatibility
 */
const LEGACY_DEFAULT_SLUG = 'default';

// ============================================================================
// Built-in Theme Registry (Static)
// ============================================================================

/**
 * Built-in Theme Registry
 * Maps theme slug to dynamic import functions
 *
 * Note: Both 'builtin-default' (canonical) and 'default' (legacy) are supported.
 * The canonical slug is 'builtin-default' as per PRD_FINAL_BLUEPRINT.md.
 */
export const BUILTIN_THEMES: ThemeRegistry = {
  // Canonical builtin-default entry
  [BUILTIN_DEFAULT_SLUG]: {
    meta: {
      slug: BUILTIN_DEFAULT_SLUG,
      name: 'Default Theme',
      version: '1.0.0',
      description: 'The default Jiffoo Mall theme, optimized for instant digital fulfillment and operational clarity.',
      category: 'digital-goods',
      author: 'Jiffoo',
      target: 'shop',
      tags: ['digital', 'codes', 'credentials', 'responsive'],
    },
    load: async () => {
      const module = await import('@shop-themes/digital-vault');
      return module.default || module.theme;
    },
  },
  // Legacy 'default' alias for backwards compatibility
  [LEGACY_DEFAULT_SLUG]: {
    meta: {
      slug: LEGACY_DEFAULT_SLUG,
      name: 'Default Theme',
      version: '1.0.0',
      description: 'The default Jiffoo Mall theme, optimized for instant digital fulfillment and operational clarity.',
      category: 'digital-goods',
      author: 'Jiffoo',
      target: 'shop',
      tags: ['digital', 'codes', 'credentials', 'responsive'],
    },
    load: async () => {
      const module = await import('@shop-themes/digital-vault');
      return module.default || module.theme;
    },
  },
  // eSIM Mall theme - official embedded full theme
  'esim-mall': {
    meta: {
      slug: 'esim-mall',
      name: 'eSIM Mall Theme',
      version: '1.0.0',
      description: 'eSIM marketplace theme with modern travel-focused design for eSIM businesses.',
      category: 'esim',
      author: 'Jiffoo',
      target: 'shop',
      tags: ['esim', 'travel', 'connectivity', 'modern'],
    },
    load: async () => {
      try {
        const module = await import('@shop-themes/esim-mall');
        return module.default || module.theme;
      } catch {
        // Keep a stub fallback so local worktrees without this package still boot.
        return { components: {}, defaultConfig: {} } as any;
      }
    },
  },
  // Yevbi theme - official embedded full theme
  'yevbi': {
    meta: {
      slug: 'yevbi',
      name: 'Yevbi Theme',
      version: '1.0.0',
      description: 'Travel-focused e-commerce theme with modern design.',
      category: 'travel',
      author: 'Jiffoo',
      target: 'shop',
      tags: ['travel', 'modern', 'responsive'],
    },
    load: async () => {
      try {
        const module = await import('@shop-themes/yevbi');
        return module.default || module.theme;
      } catch {
        return { components: {}, defaultConfig: {} } as any;
      }
    },
  },
  'digital-vault': {
    meta: {
      slug: 'digital-vault',
      name: 'Digital Vault Theme',
      version: '1.0.0',
      description: 'Virtual goods storefront theme for codes, credentials, gift cards, and downloadable assets.',
      category: 'digital-goods',
      author: 'Jiffoo',
      target: 'shop',
      tags: ['digital', 'gift-card', 'codes', 'downloads', 'credentials'],
    },
    load: async () => {
      try {
        const module = await import('@shop-themes/digital-vault');
        return module.default || module.theme;
      } catch {
        return { components: {}, defaultConfig: {} } as any;
      }
    },
  },
  'bokmoo': {
    meta: {
      slug: 'bokmoo',
      name: 'Bokmoo Theme',
      version: '1.0.0',
      description: 'Premium black-and-gold travel eSIM storefront for Bokmoo official use.',
      category: 'esim',
      author: 'Jiffoo',
      target: 'shop',
      tags: ['bokmoo', 'esim', 'travel', 'premium', 'connectivity'],
    },
    load: async () => {
      try {
        const module = await import('@shop-themes/bokmoo');
        return module.default || module.theme;
      } catch {
        return { components: {}, defaultConfig: {} } as any;
      }
    },
  },
  'imagic-studio': {
    meta: {
      slug: 'imagic-studio',
      name: 'Imagic Studio',
      version: '0.1.0',
      description: 'Creator-focused image and video transformation storefront for imagic.art.',
      category: 'ai',
      author: 'Jiffoo',
      target: 'shop',
      tags: ['ai', 'creative', 'image', 'video', 'ghibli'],
    },
    load: async () => {
      try {
        const module = await import('@shop-themes/imagic-studio');
        return module.default || module.theme;
      } catch {
        return { components: {}, defaultConfig: {} } as any;
      }
    },
  },
  'navtoai': {
    meta: {
      slug: 'navtoai',
      name: 'NavToAI',
      version: '0.2.2',
      description: 'AI navigation storefront theme with editorial directory layouts for modern tool catalogs.',
      category: 'ai',
      author: 'Jiffoo',
      target: 'shop',
      tags: ['ai', 'directory', 'navigation', 'workflow', 'tooling'],
    },
    load: async () => {
      try {
        const module = await import('@shop-themes/navtoai');
        return module.default || module.theme;
      } catch {
        return { components: {}, defaultConfig: {} } as any;
      }
    },
  },
  // NOTE: Only 'builtin-default' is the canonical built-in theme.
  // 'default' is kept for backwards compatibility but maps to the same package.
  // Third-party themes should be installed as Theme Packs
  // via Extension Installer to extensions/themes/shop/
};

// ============================================================================
// Dynamic Theme Registry (Runtime)
// ============================================================================

/**
 * Installed themes registry (dynamically added at runtime)
 */
const installedThemes: ThemeRegistry = {};
const builtinRuntimeThemes: Record<string, ThemePackage> = {
  [BUILTIN_DEFAULT_SLUG]: digitalVaultTheme,
  [LEGACY_DEFAULT_SLUG]: digitalVaultTheme,
  'digital-vault': digitalVaultTheme,
  'esim-mall': esimMallTheme,
  'yevbi': yevbiTheme,
  'bokmoo': bokmooTheme,
  'imagic-studio': imagicStudioTheme,
  'navtoai': navtoaiTheme,
};

/**
 * Get the complete combined theme registry
 */
export function getThemeRegistry(): ThemeRegistry {
  return {
    ...BUILTIN_THEMES,
    ...installedThemes,
  };
}

export function getSynchronousBuiltinTheme(slug: string): ThemePackage | null {
  return builtinRuntimeThemes[slug] ?? null;
}

/**
 * Register an installed theme
 * @param slug - Theme identifier
 * @param entry - Theme registry entry
 */
export function registerInstalledTheme(slug: string, entry: ThemeRegistryEntry): void {
  installedThemes[slug] = entry;
}

/**
 * Unregister an installed theme
 * @param slug - Theme identifier
 */
export function unregisterInstalledTheme(slug: string): void {
  delete installedThemes[slug];
}

/**
 * Clear the installed themes registry
 */
export function clearInstalledThemes(): void {
  Object.keys(installedThemes).forEach(key => delete installedThemes[key]);
}

// ============================================================================
// Compatibility Exports
// ============================================================================

/**
 * Theme registry proxy for legacy support
 * @deprecated Use getThemeRegistry() instead
 */
export const THEME_REGISTRY = new Proxy({} as Record<string, () => Promise<any>>, {
  get(_, slug: string) {
    const registry = getThemeRegistry();
    const entry = registry[slug];
    return entry ? entry.load : undefined;
  },
  has(_, slug: string) {
    return slug in getThemeRegistry();
  },
  ownKeys() {
    return Object.keys(getThemeRegistry());
  },
  getOwnPropertyDescriptor(_, slug: string) {
    if (slug in getThemeRegistry()) {
      return { enumerable: true, configurable: true };
    }
    return undefined;
  },
});

/**
 * Theme Slug Type
 */
export type ThemeSlug = string;

/**
 * Validate theme slug
 * @param slug - Theme identifier to validate
 * @returns true if slug exists in the registry
 */
export function isValidThemeSlug(slug: string): boolean {
  return slug in getThemeRegistry();
}

/**
 * Get theme importer function
 * @param slug - Theme identifier
 * @returns Dynamic import function for the theme package
 */
export function getThemeImporter(slug: string): (() => Promise<any>) | undefined {
  const registry = getThemeRegistry();
  const entry = registry[slug];
  return entry?.load;
}

/**
 * Get theme metadata
 * @param slug - Theme identifier
 * @returns Theme metadata
 */
export function getThemeMeta(slug: string): ThemeMeta | undefined {
  const registry = getThemeRegistry();
  return registry[slug]?.meta;
}

/**
 * Get all available theme slugs
 * @returns Array of theme identifiers
 */
export function getAvailableThemes(): string[] {
  return Object.keys(getThemeRegistry());
}

/**
 * Get all theme metadata
 * @returns Array of theme metadata
 */
export function getAllThemeMetas(): ThemeMeta[] {
  const registry = getThemeRegistry();
  return Object.values(registry).map(entry => entry.meta);
}

/**
 * Check if a theme is built-in
 * @param slug - Theme identifier
 */
export function isBuiltinTheme(slug: string): boolean {
  return slug in BUILTIN_THEMES;
}

/**
 * Check if a theme is installed via Extension Installer
 * @param slug - Theme identifier
 */
export function isInstalledTheme(slug: string): boolean {
  return slug in installedThemes;
}
