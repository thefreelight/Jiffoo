/**
 * Theme Registry
 * Maintains the mapping of all available themes and supports dynamic imports.
 *
 * Supports two theme sources:
 * 1. Built-in themes - Installed via npm packages, using static imports
 * 2. Installed themes - Installed via Extension Installer to extensions/themes/shop/
 */

import type { ThemePackage, ThemeMeta, ThemeRegistryEntry, ThemeRegistry } from 'shared/src/types/theme';
import bokmooTheme from '@shop-themes/bokmoo/src/runtime';
import esimMallTheme from '@shop-themes/esim-mall/src/runtime';
import yevbiTheme from '@shop-themes/yevbi/src/runtime';
import imagicStudioTheme from '@shop-themes/imagic-studio/src/runtime';
import appLandingpageTheme from '@shop-themes/app-landingpage/src/runtime';

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

/**
 * Second built-in base theme slug
 */
const BUILTIN_SERENE_SLUG = 'builtin-serene';

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
  // Canonical builtin-default entry — "Aurora" glass design
  [BUILTIN_DEFAULT_SLUG]: {
    meta: {
      slug: BUILTIN_DEFAULT_SLUG,
      name: 'Aurora (Default)',
      version: '0.0.1',
      description: 'The default Jiffoo Mall theme — airy light-blue storefront with a glassmorphism hero.',
      category: 'general',
      author: 'Jiffoo',
      target: 'shop',
      tags: ['modern', 'glassmorphism', 'responsive'],
    },
    load: async () => {
      const module = await import('@shop-themes/default');
      return module.default || module.theme;
    },
  },
  // Legacy 'default' alias for backwards compatibility
  [LEGACY_DEFAULT_SLUG]: {
    meta: {
      slug: LEGACY_DEFAULT_SLUG,
      name: 'Aurora (Default)',
      version: '0.0.1',
      description: 'The default Jiffoo Mall theme — airy light-blue storefront with a glassmorphism hero.',
      category: 'general',
      author: 'Jiffoo',
      target: 'shop',
      tags: ['modern', 'glassmorphism', 'responsive'],
    },
    load: async () => {
      const module = await import('@shop-themes/default');
      return module.default || module.theme;
    },
  },
  // Explicit Bokmoo fallback bridge for branded self-hosted deployments. The
  // packaged theme runtime remains authoritative whenever the API serves the
  // installed theme pack; this entry only lets an environment-configured
  // fallback render Bokmoo pages while the backend is temporarily unreachable.
  'bokmoo': {
    meta: {
      slug: 'bokmoo',
      name: 'Bokmoo',
      version: '1.0.0',
      description: 'Premium black-and-gold storefront renderer for Bokmoo eSIM products.',
      category: 'esim',
      author: 'Jiffoo',
      target: 'shop',
      tags: ['esim', 'travel', 'premium', 'connectivity'],
    },
    load: async () => bokmooTheme,
  },
  // Migration-only compatibility bridges. Official themes that publish a
  // packaged runtime must resolve from the installed artifact instead.
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
    load: async () => esimMallTheme,
  },
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
    load: async () => yevbiTheme,
  },
  'imagic-studio': {
    meta: {
      slug: 'imagic-studio',
      name: 'Imagic Studio',
      version: '0.1.0',
      description: 'AI image studio storefront theme for generative art businesses.',
      category: 'ai',
      author: 'Jiffoo',
      target: 'shop',
      tags: ['ai', 'studio', 'creative', 'modern'],
    },
    load: async () => imagicStudioTheme,
  },
  // App download landing page theme (EasyEUICC) — embedded compatibility bridge
  // so the storefront can render the download page without relying solely on the
  // packaged theme-pack manifest being served by the API.
  'app-landingpage': {
    meta: {
      slug: 'app-landingpage',
      name: 'App Landing Page',
      version: '0.1.0',
      description: 'High-conversion Android app download landing page theme with QR download, APK verification, and app screenshots.',
      category: 'app-download',
      author: 'Jiffoo',
      target: 'shop',
      tags: ['app-download', 'landing', 'easyeuicc', 'responsive'],
    },
    load: async () => appLandingpageTheme,
  },
  // Second built-in base theme — "Serene" calm indigo design
  [BUILTIN_SERENE_SLUG]: {
    meta: {
      slug: BUILTIN_SERENE_SLUG,
      name: 'Serene',
      version: '1.0.0',
      description: 'Calm indigo Jiffoo Mall theme with a botanical hero and editorial layout.',
      category: 'general',
      author: 'Jiffoo',
      target: 'shop',
      tags: ['calm', 'editorial', 'responsive'],
    },
    load: async () => {
      const module = await import('@shop-themes/serene');
      return module.default || module.theme;
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
