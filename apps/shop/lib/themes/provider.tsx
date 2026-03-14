'use client';

/**
 * Theme Renderer Provider
 *
 * Loads and provides theme renderer packages (React components).
 * This is the renderer-loading layer that loads UI components from @shop-themes/default.
 *
 * Note: This is separate from Theme Pack Runtime which handles tokens/templates.
 * - Theme Renderer (this): Loads React components for rendering pages
 * - Theme Pack Runtime: Loads CSS tokens and JSON templates for styling
 */

import React, { createContext, useContext, useEffect, useState, useRef, useMemo } from 'react';
import type { ThemePackage, ThemeConfig } from 'shared/src/types/theme';
import { THEME_REGISTRY, type ThemeSlug, isValidThemeSlug } from './registry';
import { assertThemeComponents } from './contract';

// Module-level theme cache shared across all ThemeProvider instances
const themeCache = new Map<ThemeSlug, ThemePackage>();

/**
 * Theme Context Value
 */
interface ThemeContextValue {
  theme: ThemePackage | null;
  config: ThemeConfig;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Theme Context
 */
const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * ThemeProvider Props
 */
interface ThemeProviderProps {
  slug: string;
  config?: ThemeConfig;
  children: React.ReactNode;
}

/**
 * Deep merge two objects
 */
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(
        result[key] || {} as any,
        source[key] as any
      );
    } else if (source[key] !== undefined) {
      result[key] = source[key] as any;
    }
  }

  return result;
}

/**
 * Theme provider component
 * @param slug - Theme identifier
 * @param config - Tenant specific theme configuration
 * @param children - Child components
 */
export function ThemeProvider({ slug, config = {}, children }: ThemeProviderProps) {
  // Theme package cache (shared across component instances via module-level ref)
  const cacheRef = useRef(themeCache);

  // Synchronously check cache to avoid loading flash on re-mounts
  const normalizedSlugInit = slug === 'default' ? 'builtin-default' : slug;
  const validSlugInit = isValidThemeSlug(normalizedSlugInit) ? normalizedSlugInit : 'builtin-default';
  const cachedTheme = cacheRef.current.get(validSlugInit) ?? null;

  const [theme, setTheme] = useState<ThemePackage | null>(cachedTheme);
  const [isLoading, setIsLoading] = useState(!cachedTheme);
  const [error, setError] = useState<Error | null>(null);

  // Load theme
  useEffect(() => {
    let mounted = true;

    async function loadTheme() {
      const startTime = performance.now();

      try {
        setIsLoading(true);
        setError(null);

        // Normalize slug: both 'default' and 'builtin-default' are valid
        // 'builtin-default' is the canonical slug as per PRD_FINAL_BLUEPRINT.md
        const normalizedSlug = slug === 'default' ? 'builtin-default' : slug;
        const validSlug = isValidThemeSlug(normalizedSlug) ? normalizedSlug : 'builtin-default';

        if (validSlug !== normalizedSlug) {
          console.warn(`Invalid theme slug "${slug}", falling back to "builtin-default"`);
        }

        // Check cache
        if (cacheRef.current.has(validSlug)) {
          if (mounted) {
            setTheme(cacheRef.current.get(validSlug)!);
            setIsLoading(false);

            if (process.env.NODE_ENV === 'development') {
              console.log(`⚡ Theme "${validSlug}" loaded in ${(performance.now() - startTime).toFixed(2)}ms (cached)`);
            }
          }
          return;
        }

        // Dynamically import theme package
        const importer = THEME_REGISTRY[validSlug];
        const result = await importer();

        // registry.load() already returns module.default || module.theme
        // So result may be ThemePackage directly, or a module containing default/theme
        let themePkg: ThemePackage;
        if (result && result.components) {
          // result is already ThemePackage
          themePkg = result;
        } else if (result && (result.default || result.theme)) {
          // result is module, needs unpacking
          themePkg = (result.default || result.theme) as ThemePackage;
        } else {
          throw new Error(`Invalid theme package: ${validSlug}`);
        }

        if (!themePkg || !themePkg.components) {
          throw new Error(`Invalid theme package structure: ${validSlug}`);
        }

        assertThemeComponents(themePkg, validSlug);

        // Cache theme package
        cacheRef.current.set(validSlug, themePkg);

        if (mounted) {
          setTheme(themePkg);

          if (process.env.NODE_ENV === 'development') {
            console.log(`✅ Theme "${validSlug}" loaded in ${(performance.now() - startTime).toFixed(2)}ms (fresh)`);
          }
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        console.error('Failed to load theme:', err);

        if (mounted) {
          setError(error);

          // Try loading builtin-default theme as fallback
          const isAlreadyDefault = slug === 'default' || slug === 'builtin-default';
          if (!isAlreadyDefault) {
            try {
              const defaultResult = await THEME_REGISTRY['builtin-default']();
              let defaultTheme: ThemePackage;
              if (defaultResult && defaultResult.components) {
                defaultTheme = defaultResult;
              } else if (defaultResult && (defaultResult.default || defaultResult.theme)) {
                defaultTheme = (defaultResult.default || defaultResult.theme) as ThemePackage;
              } else {
                throw new Error('Invalid builtin-default theme package');
              }
              assertThemeComponents(defaultTheme, 'builtin-default');
              cacheRef.current.set('builtin-default', defaultTheme);
              setTheme(defaultTheme);
              setError(null); // Clear error because fallback succeeded
            } catch (fallbackErr) {
              console.error('Failed to load builtin-default theme:', fallbackErr);
            }
          }
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadTheme();

    return () => {
      mounted = false;
    };
  }, [slug]);

  // Merge configuration and inject CSS variables
  useEffect(() => {
    if (!theme) return;

    const mergedConfig = deepMerge(
      theme.defaultConfig || {},
      config
    );

    // Inject CSS variables
    const root = document.documentElement;

    if (mergedConfig.brand?.primaryColor) {
      root.style.setProperty('--theme-primary', mergedConfig.brand.primaryColor);
    }
    if (mergedConfig.brand?.secondaryColor) {
      root.style.setProperty('--theme-secondary', mergedConfig.brand.secondaryColor);
    }
    if (mergedConfig.brand?.fontFamily) {
      root.style.setProperty('--theme-font', mergedConfig.brand.fontFamily);
    }

    return () => {
      // Cleanup CSS variables
      root.style.removeProperty('--theme-primary');
      root.style.removeProperty('--theme-secondary');
      root.style.removeProperty('--theme-font');
    };
  }, [theme, config]);

  const value = useMemo(
    () => ({
      theme,
      config: theme ? deepMerge(theme.defaultConfig || {}, config) : config,
      isLoading,
      error,
    }),
    [theme, config, isLoading, error]
  );

  // Simplify loading state: no more full-screen mask, only show skeleton in content area
  // Do not show loading if theme is already cached
  if (isLoading && !theme) {
    return (
      <ThemeContext.Provider value={value}>
        <div className="min-h-screen" />
      </ThemeContext.Provider>
    );
  }

  // Error state: simplified display, provide retry instead of page refresh
  if (error && !theme) {
    const handleRetry = () => {
      setError(null);
      setIsLoading(true);
      // Clear theme cache to trigger reload
      setTheme(null);
    };

    return (
      <ThemeContext.Provider value={value}>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center max-w-md p-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Theme Load Failed</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{error.message}</p>
            <button
              onClick={handleRetry}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Retry
            </button>
          </div>
        </div>
      </ThemeContext.Provider>
    );
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Custom hook for using the shop theme
 * @returns Theme context value
 * @throws If used outside of ThemeProvider
 */
export function useShopTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useShopTheme must be used within ThemeProvider');
  }

  return context;
}
