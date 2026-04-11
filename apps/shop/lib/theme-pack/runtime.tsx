'use client';

/**
 * Theme Pack Runtime
 *
 * The Theme Runtime is the platform's built-in "theme integration engine" that:
 * - Fetches and caches theme resources (CSS/JSON/assets)
 * - Injects CSS tokens (CSS variables, base styles)
 * - Maps Theme Pack configurations to internal Block/Slot Registry
 *
 * Key Principle: Theme Pack can only "select/arrange/configure" platform-provided
 * blocks/slots, it cannot add new logic.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import type {
  ActiveTheme,
  ThemePackManifest,
  PageTemplate,
  ThemePackConfig,
  ThemeRuntimeState,
} from './types';
import {
  fetchActiveTheme,
  fetchThemeManifest,
  fetchPageTemplate,
  getTokensCssUrl,
  resolveAssetUrl,
  clearThemeCache,
} from './loader';
import { shouldLoadThemePackResources } from './rendering-mode';

/**
 * Theme Pack Runtime Context
 */
interface ThemePackContextValue extends ThemeRuntimeState {
  /** Reload theme (useful after config changes) */
  reloadTheme: () => Promise<void>;
  /** Load a specific page template */
  loadPageTemplate: (page: string) => Promise<PageTemplate | null>;
  /** Resolve asset URL */
  resolveAsset: (assetPath: string) => string;
  /** Theme manifest */
  manifest: ThemePackManifest | null;
  /** Merged config (defaultConfig + tenant config) */
  mergedConfig: ThemePackConfig;
}

const ThemePackContext = createContext<ThemePackContextValue | null>(null);

/**
 * Hook to access Theme Pack runtime
 */
export function useThemePack(): ThemePackContextValue {
  const context = useContext(ThemePackContext);
  if (!context) {
    throw new Error('useThemePack must be used within a ThemePackProvider');
  }
  return context;
}

/**
 * Hook to check if we're inside a ThemePackProvider
 */
export function useThemePackOptional(): ThemePackContextValue | null {
  return useContext(ThemePackContext);
}

interface ThemePackProviderProps {
  children: ReactNode;
  /** Override the active theme slug (for preview) */
  previewSlug?: string;
  /** Fallback content while loading */
  fallback?: ReactNode;
}

/**
 * Theme Pack Provider
 *
 * Wraps the application and provides theme runtime context.
 * Handles tokens CSS injection and template loading.
 */
export function ThemePackProvider({
  children,
  previewSlug,
  fallback,
}: ThemePackProviderProps) {
  const [state, setState] = useState<ThemeRuntimeState>({
    activeTheme: null,
    tokensLoaded: false,
    currentTemplate: null,
    isLoading: true,
    error: null,
  });

  const [manifest, setManifest] = useState<ThemePackManifest | null>(null);

  // Reload token: increment to trigger theme reload
  const [reloadToken, setReloadToken] = useState(0);

  // Effective slug: the actual slug to use for loading resources
  // This handles previewSlug taking priority over activeTheme.slug
  const [effectiveSlug, setEffectiveSlug] = useState<string | null>(null);

  // Load active theme on mount or when reloadToken/previewSlug changes
  useEffect(() => {
    let mounted = true;

    async function loadTheme() {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        // 1. Fetch active theme info
        const activeTheme = await fetchActiveTheme();
        if (!mounted) return;

        if (!activeTheme) {
          // No active theme, use builtin default
          setState({
            activeTheme: null,
            tokensLoaded: false,
            currentTemplate: null,
            isLoading: false,
            error: null,
          });
          setEffectiveSlug(null);
          return;
        }

        // Determine effective slug (previewSlug takes priority)
        const slug = previewSlug || activeTheme.slug;
        setEffectiveSlug(slug);

        // 2. Builtin themes do not need Theme Pack resource loading unless we're previewing.
        //    Installed/official-market themes may intentionally reuse an embedded renderer slug,
        //    so we cannot skip loading just because the slug exists in the builtin registry.
        if (!shouldLoadThemePackResources(activeTheme, previewSlug)) {
          setState({
            activeTheme,
            tokensLoaded: false,
            currentTemplate: null,
            isLoading: false,
            error: null,
          });
          return;
        }

        // 3. For installed themes, load manifest (with version in cache key)
        const themeManifest = await fetchThemeManifest(slug, activeTheme.version);
        if (!mounted) return;

        setManifest(themeManifest);

        // 4. Inject tokens CSS and wait for it to load
        if (themeManifest?.entry?.tokensCSS) {
          const cssUrl = getTokensCssUrl(slug, themeManifest, activeTheme.version);
          if (cssUrl) {
            try {
              await injectTokensCSS(cssUrl, slug);
            } catch (cssError) {
              console.warn('[ThemePack] Failed to load tokens CSS:', cssError);
              // Continue anyway, theme can work without custom tokens
            }
          }
        }

        setState({
          activeTheme,
          tokensLoaded: true,
          currentTemplate: null,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        if (!mounted) return;
        console.error('[ThemePack] Failed to load theme:', error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error : new Error('Failed to load theme'),
        }));
      }
    }

    loadTheme();

    return () => {
      mounted = false;
    };
  }, [previewSlug, reloadToken]);

  // Reload theme
  const reloadTheme = useCallback(async () => {
    // Clear cache for the effective slug (could be preview or active)
    if (effectiveSlug) {
      clearThemeCache(effectiveSlug);
    }
    // Increment reloadToken to trigger useEffect re-run
    setReloadToken((prev) => prev + 1);
  }, [effectiveSlug]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleFocus = () => {
      void reloadTheme();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void reloadTheme();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [reloadTheme]);

  // Load page template - uses effectiveSlug to handle preview correctly
  const loadPageTemplate = useCallback(
    async (page: string): Promise<PageTemplate | null> => {
      // Use effectiveSlug instead of activeTheme.slug to support preview mode
      if (!effectiveSlug) {
        return null;
      }

      // Builtin themes without preview do not fetch Theme Pack templates.
      if (!shouldLoadThemePackResources(state.activeTheme, previewSlug)) {
        return null;
      }

      const template = await fetchPageTemplate(
        effectiveSlug,
        page,
        manifest || undefined,
        state.activeTheme?.version
      );

      if (template) {
        setState((prev) => ({ ...prev, currentTemplate: template }));
      }

      return template;
    },
    [effectiveSlug, state.activeTheme, manifest, previewSlug]
  );

  // Resolve asset URL - uses effectiveSlug to handle preview correctly
  const resolveAsset = useCallback(
    (assetPath: string): string => {
      // Use effectiveSlug instead of activeTheme.slug to support preview mode
      if (!effectiveSlug) {
        return assetPath;
      }
      return resolveAssetUrl(
        effectiveSlug,
        assetPath,
        manifest || undefined
      );
    },
    [effectiveSlug, manifest]
  );

  // Merge config (defaultConfig from manifest + tenant config from activeTheme)
  const mergedConfig = useMemo((): ThemePackConfig => {
    const defaultConfig = manifest?.defaultConfig || {};
    const tenantConfig = state.activeTheme?.config || {};
    return deepMerge(defaultConfig, tenantConfig);
  }, [manifest, state.activeTheme]);

  // Inject merged config as CSS variables
  useEffect(() => {
    if (!mergedConfig || Object.keys(mergedConfig).length === 0) return;

    const cssVars = generateCSSVariables(mergedConfig);
    if (!cssVars) return;

    const styleId = 'theme-pack-config-vars';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;

    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    styleEl.textContent = `:root {\n${cssVars}\n}`;

    return () => {
      // Don't remove on unmount to prevent flashing
    };
  }, [mergedConfig]);

  const contextValue: ThemePackContextValue = {
    ...state,
    reloadTheme,
    loadPageTemplate,
    resolveAsset,
    manifest,
    mergedConfig,
  };

  // Show fallback while loading
  if (state.isLoading && fallback) {
    return <>{fallback}</>;
  }

  return (
    <ThemePackContext.Provider value={contextValue}>
      {children}
    </ThemePackContext.Provider>
  );
}

/**
 * Inject tokens CSS via link element
 * Returns a Promise that resolves when CSS is loaded or rejects on error
 */
function injectTokensCSS(url: string, slug: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const linkId = `theme-pack-tokens-${slug}`;

    // Remove any existing Theme Pack token links to avoid accumulation when switching themes
    for (const el of Array.from(document.querySelectorAll<HTMLLinkElement>('link[data-theme-pack]'))) {
      el.remove();
    }

    // Remove same-id link if any (extra safety)
    const existing = document.getElementById(linkId);
    if (existing) existing.remove();

    // Create new link element
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = url;
    link.dataset.themePack = slug;

    // Wait for CSS to load
    link.onload = () => {
      resolve();
    };

    link.onerror = () => {
      reject(new Error(`Failed to load theme CSS: ${url}`));
    };

    // Add to head
    document.head.appendChild(link);

    // Timeout fallback (in case onload doesn't fire for some reason)
    setTimeout(() => {
      resolve();
    }, 5000);
  });
}

/**
 * Generate CSS variables from theme config
 */
function generateCSSVariables(config: ThemePackConfig): string {
  const vars: string[] = [];

  // Colors
  if (config.colors) {
    for (const [key, value] of Object.entries(config.colors)) {
      if (value) {
        vars.push(`  --theme-color-${key}: ${value};`);
      }
    }
  }

  // Typography
  if (config.typography) {
    for (const [key, value] of Object.entries(config.typography)) {
      if (value) {
        vars.push(`  --theme-typography-${camelToKebab(key)}: ${value};`);
      }
    }
  }

  // Layout
  if (config.layout) {
    for (const [key, value] of Object.entries(config.layout)) {
      if (value) {
        vars.push(`  --theme-layout-${camelToKebab(key)}: ${value};`);
      }
    }
  }

  return vars.join('\n');
}

/**
 * Convert camelCase to kebab-case
 */
function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Deep merge two objects
 */
function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key of Object.keys(source) as (keyof T)[]) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      ) as T[keyof T];
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as T[keyof T];
    }
  }

  return result;
}
