'use client';

/**
 * Theme Provider
 * Responsible for loading, caching, and providing theme packages
 */

import React, { createContext, useContext, useEffect, useState, useRef, useMemo } from 'react';
import type { ThemePackage, ThemeConfig } from 'shared/src/types/theme';
import { THEME_REGISTRY, type ThemeSlug, isValidThemeSlug } from './registry';
import { recordThemeLoad } from './performance';
import { logThemeError } from './error-logger';
import { setDebugCurrentTheme } from './debug';

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
  // Theme package cache (shared across component instances)
  const cacheRef = useRef(new Map<ThemeSlug, ThemePackage>());

  const [theme, setTheme] = useState<ThemePackage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load theme
  useEffect(() => {
    let mounted = true;

    async function loadTheme() {
      const startTime = performance.now();

      try {
        setIsLoading(true);
        setError(null);

        // Validate and fall back to default theme
        const validSlug = isValidThemeSlug(slug) ? slug : 'default';

        if (validSlug !== slug) {
          console.warn(`Invalid theme slug "${slug}", falling back to "default"`);
        }

        // Check cache
        if (cacheRef.current.has(validSlug)) {
          if (mounted) {
            setTheme(cacheRef.current.get(validSlug)!);
            setIsLoading(false);

            // Log cache hit
            recordThemeLoad({
              slug: validSlug,
              loadTime: performance.now() - startTime,
              cacheHit: true,
              timestamp: Date.now()
            });

            // Update debug info
            setDebugCurrentTheme(validSlug, cacheRef.current);
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

        // Cache theme package
        cacheRef.current.set(validSlug, themePkg);

        if (mounted) {
          setTheme(themePkg);

          // Log successful load
          recordThemeLoad({
            slug: validSlug,
            loadTime: performance.now() - startTime,
            cacheHit: false,
            timestamp: Date.now()
          });

          // Update debug info
          setDebugCurrentTheme(validSlug, cacheRef.current);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        console.error('Failed to load theme:', err);

        // Log error
        logThemeError(error, { slug, action: 'load' }, 'high');
        recordThemeLoad({
          slug,
          loadTime: performance.now() - startTime,
          cacheHit: false,
          timestamp: Date.now(),
          error: error.message
        });

        if (mounted) {
          setError(error);

          // Try loading default theme as fallback
          if (slug !== 'default') {
            try {
              const defaultResult = await THEME_REGISTRY.default();
              let defaultTheme: ThemePackage;
              if (defaultResult && defaultResult.components) {
                defaultTheme = defaultResult;
              } else if (defaultResult && (defaultResult.default || defaultResult.theme)) {
                defaultTheme = (defaultResult.default || defaultResult.theme) as ThemePackage;
              } else {
                throw new Error('Invalid default theme package');
              }
              cacheRef.current.set('default', defaultTheme);
              setTheme(defaultTheme);
              setError(null); // Clear error because fallback succeeded
              setDebugCurrentTheme('default', cacheRef.current);
            } catch (fallbackErr) {
              console.error('Failed to load default theme:', fallbackErr);
              logThemeError(
                fallbackErr instanceof Error ? fallbackErr : new Error('Default theme fallback failed'),
                { slug: 'default', action: 'fallback' },
                'critical'
              );
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
        <div className="min-h-screen bg-gray-50">
          {/* Simple skeleton, not a full-screen mask */}
          <div className="container mx-auto px-4 py-8">
            <div className="animate-pulse space-y-4">
              <div className="h-12 bg-gray-200 rounded w-1/4"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
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
