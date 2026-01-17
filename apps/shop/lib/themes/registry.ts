/**
 * Theme Registry
 * Maintains the mapping of all available themes and supports dynamic imports.
 *
 * Supports two theme sources:
 * 1. Built-in themes - Installed via npm packages, using static imports
 * 2. Installed themes - Installed via Extension Installer to extensions/themes/shop/
 */

import type { ThemePackage, ThemeMeta, ThemeRegistryEntry, ThemeRegistry } from 'shared/src/types/theme';

// ============================================================================
// Built-in Theme Registry (Static)
// ============================================================================

/**
 * Built-in Theme Registry
 * Maps theme slug to dynamic import functions
 */
export const BUILTIN_THEMES: ThemeRegistry = {
  default: {
    meta: {
      slug: 'default',
      name: 'Default Theme',
      version: '1.0.0',
      description: 'The default Jiffoo Mall theme, modern and clean e-commerce style.',
      category: 'general',
      author: 'Jiffoo',
      target: 'shop',
      tags: ['modern', 'clean', 'responsive'],
    },
    load: async () => {
      const module = await import('@shop-themes/default');
      return module.default || module.theme;
    },
  },
  yevbi: {
    meta: {
      slug: 'yevbi',
      name: 'Yevbi Travel Theme',
      version: '1.0.0',
      description: 'Travel-focused e-commerce theme with purple-indigo gradient design for eSIM and travel packages.',
      category: 'travel',
      author: 'Yevbi',
      target: 'shop',
      tags: ['travel', 'esim', 'purple', 'gradient', 'modern'],
    },
    load: async () => {
      const module = await import('@shop-themes/yevbi/src/index');
      return module.default || module;
    },
  },
};

// ============================================================================
// Dynamic Theme Registry (Runtime)
// ============================================================================

/**
 * Installed themes registry (dynamically added at runtime)
 */
const installedThemes: ThemeRegistry = {};

/**
 * Get the complete combined theme registry
 */
export function getThemeRegistry(): ThemeRegistry {
  return {
    ...BUILTIN_THEMES,
    ...installedThemes,
  };
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
