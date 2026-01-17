/**
 * Jiffoo Theme SDK - Theme Definition
 *
 * Helpers for defining themes, components, and pages.
 */

import type {
  ThemeManifest,
  ThemeTokens,
  ThemeComponents,
  ThemeDefinition,
  ThemePageConfig,
  ThemeComponentConfig,
} from './types';
import { validateThemeManifest } from './validators';

/**
 * Define a theme with configuration
 *
 * @param config - Theme configuration
 * @returns Theme definition
 *
 * @example
 * ```typescript
 * const theme = defineTheme({
 *   slug: 'modern-shop',
 *   name: 'Modern Shop',
 *   version: '1.0.0',
 *   description: 'A modern, clean e-commerce theme',
 *   author: 'Your Name',
 *   category: 'general',
 *   thumbnail: '/themes/modern-shop/thumbnail.png',
 *   tokens: {
 *     colors: {
 *       primary: '#3b82f6',
 *       secondary: '#64748b',
 *       background: '#ffffff',
 *       foreground: '#0f172a',
 *     },
 *     typography: {
 *       fontFamily: {
 *         sans: 'Inter, sans-serif',
 *       },
 *     },
 *   },
 * });
 * ```
 */
export function defineTheme(config: Partial<ThemeManifest> & { slug: string; name: string; version: string; category: ThemeManifest['category'] }): ThemeDefinition {
  // Create manifest
  const manifest: ThemeManifest = {
    slug: config.slug,
    name: config.name,
    version: config.version,
    description: config.description || '',
    author: config.author || '',
    category: config.category,
    thumbnail: config.thumbnail || '',
    screenshots: config.screenshots || [],
    features: config.features || [],
    tags: config.tags || [],
    compatibility: config.compatibility,
    tokens: config.tokens || {},
    components: config.components || {},
  };

  // Validate manifest
  const validation = validateThemeManifest(manifest);
  if (!validation.valid) {
    const errors = validation.errors.map(e => `${e.path}: ${e.message}`).join(', ');
    throw new Error(`Invalid theme configuration: ${errors}`);
  }

  const pages: Map<string, ThemePageConfig> = new Map();
  const components: Map<string, ThemeComponentConfig> = new Map();

  const theme: ThemeDefinition = {
    manifest,
    pages,
    components,

    // Register a page
    registerPage(path: string, pageConfig: ThemePageConfig) {
      pages.set(path, pageConfig);
      return this;
    },

    // Register a component
    registerComponent(name: string, componentConfig: ThemeComponentConfig) {
      components.set(name, componentConfig);
      return this;
    },

    // Get manifest
    getManifest() {
      return manifest;
    },

    // Get tokens
    getTokens() {
      return manifest.tokens || {};
    },

    // Get all pages
    getPages() {
      return new Map(pages);
    },

    // Get all components
    getComponents() {
      return new Map(components);
    },

    // Merge with user config
    mergeConfig(userConfig: Partial<ThemeManifest>) {
      if (userConfig.tokens) {
        manifest.tokens = deepMerge(manifest.tokens || {}, userConfig.tokens);
      }
      if (userConfig.components) {
        manifest.components = deepMerge(manifest.components || {}, userConfig.components);
      }
      return this;
    },
  };

  return theme;
}

/**
 * Register a component for the theme
 *
 * @param name - Component name
 * @param component - React component
 * @param options - Component options
 * @returns Component configuration
 *
 * @example
 * ```typescript
 * const ProductCard = registerComponent('ProductCard', MyProductCard, {
 *   description: 'Product card component',
 *   props: {
 *     showRating: { type: 'boolean', default: true },
 *     imageAspectRatio: { type: 'string', default: '1:1' },
 *   },
 * });
 * ```
 */
export function registerComponent(
  name: string,
  component: React.ComponentType<any>,
  options: {
    description?: string;
    props?: Record<string, { type: string; default?: unknown; description?: string }>;
    slots?: string[];
  } = {}
): ThemeComponentConfig {
  return {
    name,
    component,
    description: options.description,
    props: options.props,
    slots: options.slots,
  };
}

/**
 * Register a page for the theme
 *
 * @param path - Page path (e.g., '/', '/products', '/product/[slug]')
 * @param page - React page component
 * @param options - Page options
 * @returns Page configuration
 *
 * @example
 * ```typescript
 * const HomePage = registerPage('/', MyHomePage, {
 *   title: 'Home',
 *   description: 'Home page',
 *   layout: 'default',
 * });
 * ```
 */
export function registerPage(
  path: string,
  page: React.ComponentType<any>,
  options: {
    title?: string;
    description?: string;
    layout?: string;
    meta?: Record<string, string>;
  } = {}
): ThemePageConfig {
  return {
    path,
    component: page,
    title: options.title,
    description: options.description,
    layout: options.layout || 'default',
    meta: options.meta,
  };
}

/**
 * Deep merge objects
 */
function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result: Record<string, unknown> = { ...(target as Record<string, unknown>) };

  for (const [key, sourceValue] of Object.entries(source as Record<string, unknown>)) {
    if (sourceValue === undefined) continue;
    const targetValue = result[key];

    if (isObject(sourceValue) && isObject(targetValue)) {
      result[key] = deepMerge(targetValue, sourceValue);
    } else {
      result[key] = sourceValue;
    }
  }

  return result as T;
}

function isObject(item: unknown): item is Record<string, unknown> {
  return item !== null && typeof item === 'object' && !Array.isArray(item);
}
