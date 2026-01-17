/**
 * Theme System Debug Tools
 * Enabled only in development mode
 */

import { getThemePerformanceStats, clearThemeMetrics } from './performance';
import { getThemeErrorStats, clearThemeErrors } from './error-logger';
import { THEME_REGISTRY, isValidThemeSlug } from './registry';

export interface ThemeDebugInfo {
  // Theme information
  currentTheme: string | null;
  availableThemes: string[];

  // Performance data
  performance: ReturnType<typeof getThemePerformanceStats>;

  // Error data
  errors: ReturnType<typeof getThemeErrorStats>;

  // Cache status
  cache: {
    size: number;
    themes: string[];
  };
}

// Debug state
let debugEnabled = false;
let currentThemeSlug: string | null = null;
let themeCache: Map<string, unknown> | null = null;

/**
 * Enable theme debug
 */
export function enableThemeDebug(): void {
  if (process.env.NODE_ENV !== 'development') {
    console.warn('Theme debug is only available in development mode');
    return;
  }

  debugEnabled = true;
  console.log('🔧 Theme debug enabled. Access via window.__THEME_DEBUG__');
}

/**
 * Disable theme debug
 */
export function disableThemeDebug(): void {
  debugEnabled = false;
  console.log('🔧 Theme debug disabled');
}

/**
 * Set current theme (called by ThemeProvider)
 */
export function setDebugCurrentTheme(slug: string, cache: Map<string, unknown>): void {
  currentThemeSlug = slug;
  themeCache = cache;
}

/**
 * Get debug info
 */
export function getThemeDebugInfo(): ThemeDebugInfo {
  return {
    currentTheme: currentThemeSlug,
    availableThemes: Object.keys(THEME_REGISTRY),
    performance: getThemePerformanceStats(),
    errors: getThemeErrorStats(),
    cache: {
      size: themeCache?.size ?? 0,
      themes: themeCache ? Array.from(themeCache.keys()) : []
    }
  };
}

/**
 * Clear all debug data
 */
export function clearDebugData(): void {
  clearThemeMetrics();
  clearThemeErrors();
  console.log('🧹 Theme debug data cleared');
}

/**
 * Validate theme package
 */
export async function validateTheme(slug: string): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if slug is valid
  if (!isValidThemeSlug(slug)) {
    errors.push(`Invalid theme slug: ${slug}`);
    return { valid: false, errors, warnings };
  }

  try {
    // Try to load theme
    const importer = THEME_REGISTRY[slug as keyof typeof THEME_REGISTRY];
    const module = await importer();
    const theme = module.default || (module as any).theme;

    // Check required fields
    if (!theme) {
      errors.push('Theme package not found');
    } else {
      if (!theme.components) errors.push('Missing components');
      if (!theme.defaultConfig) warnings.push('Missing defaultConfig');
      if (!theme.tokensCSS) warnings.push('Missing tokensCSS (optional)');

      // Check required components
      const requiredComponents = ['HomePage', 'ProductsPage', 'ProductDetailPage', 'CartPage'] as const;
      const components = theme.components as Record<string, unknown>;
      const missingComponents = requiredComponents.filter(
        c => !components[c]
      );

      if (missingComponents.length > 0) {
        errors.push(`Missing required components: ${missingComponents.join(', ')}`);
      }
    }
  } catch (err) {
    errors.push(`Failed to load theme: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// Expose debug interface in development mode
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__THEME_DEBUG__ = {
    enable: enableThemeDebug,
    disable: disableThemeDebug,
    getInfo: getThemeDebugInfo,
    clear: clearDebugData,
    validate: validateTheme,

    // Convenience methods
    get info() { return getThemeDebugInfo(); },
    get perf() { return getThemePerformanceStats(); },
    get errors() { return getThemeErrorStats(); },

    // Help info
    help() {
      console.log(`
🔧 Theme Debug Commands:
  __THEME_DEBUG__.info        - Get full debug info
  __THEME_DEBUG__.perf        - Get performance stats
  __THEME_DEBUG__.errors      - Get error stats
  __THEME_DEBUG__.clear()     - Clear all debug data
  __THEME_DEBUG__.validate(slug) - Validate a theme
      `);
    }
  };

  // Auto toggle
  enableThemeDebug();
}

