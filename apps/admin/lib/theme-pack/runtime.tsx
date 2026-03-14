'use client';

/**
 * Admin Theme Pack Runtime
 *
 * Provides theme runtime context for the admin application.
 * Admin themes are simpler than shop themes - they focus on:
 * - tokens (CSS variables) for colors, typography, layout
 * - layout options (sidebar width, density, etc.)
 *
 * Admin v1 does NOT implement page templates/blocks.
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
  ActiveAdminTheme,
  AdminThemePackManifest,
  AdminThemePackConfig,
  AdminThemeRuntimeState,
} from './types';
import { apiClient } from '@/lib/api';

/** Base URL for admin theme assets */
const EXTENSIONS_BASE = '/extensions/themes/admin';

/**
 * Admin Theme Pack Context
 */
interface AdminThemePackContextValue extends AdminThemeRuntimeState {
  /** Reload theme */
  reloadTheme: () => Promise<void>;
  /** Theme manifest */
  manifest: AdminThemePackManifest | null;
  /** Merged config (defaultConfig + tenant config) */
  mergedConfig: AdminThemePackConfig;
}

const AdminThemePackContext = createContext<AdminThemePackContextValue | null>(null);

/**
 * Hook to access Admin Theme Pack runtime
 */
export function useAdminThemePack(): AdminThemePackContextValue {
  const context = useContext(AdminThemePackContext);
  if (!context) {
    throw new Error('useAdminThemePack must be used within an AdminThemePackProvider');
  }
  return context;
}

/**
 * Hook to check if we're inside an AdminThemePackProvider
 */
export function useAdminThemePackOptional(): AdminThemePackContextValue | null {
  return useContext(AdminThemePackContext);
}

interface AdminThemePackProviderProps {
  children: ReactNode;
  /** Override the active theme slug (for preview) */
  previewSlug?: string;
}

/**
 * Admin Theme Pack Provider
 *
 * Wraps the admin application and provides theme runtime context.
 */
export function AdminThemePackProvider({
  children,
  previewSlug,
}: AdminThemePackProviderProps) {
  const [state, setState] = useState<AdminThemeRuntimeState>({
    activeTheme: null,
    tokensLoaded: false,
    isLoading: true,
    error: null,
  });

  const [manifest, setManifest] = useState<AdminThemePackManifest | null>(null);

  // Reload token: increment to trigger theme reload
  const [reloadToken, setReloadToken] = useState(0);

  // Effective slug for cache clearing
  const [effectiveSlug, setEffectiveSlug] = useState<string | null>(null);

  // Load active theme on mount or when reloadToken/previewSlug changes
  useEffect(() => {
    let mounted = true;

    async function loadTheme() {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        // 1. Fetch active admin theme info
        const activeTheme = await fetchActiveAdminTheme();
        if (!mounted) return;

        if (!activeTheme) {
          setState({
            activeTheme: null,
            tokensLoaded: false,
            isLoading: false,
            error: null,
          });
          setEffectiveSlug(null);
          return;
        }

        const slug = previewSlug || activeTheme.slug;
        setEffectiveSlug(slug);

        // 2. For builtin themes, skip Theme Pack loading
        if (activeTheme.source === 'builtin' && !previewSlug) {
          setState({
            activeTheme,
            tokensLoaded: false,
            isLoading: false,
            error: null,
          });
          return;
        }

        // 3. For installed themes, load manifest (with version in cache key)
        const themeManifest = await fetchAdminThemeManifest(slug, activeTheme.version);
        if (!mounted) return;

        setManifest(themeManifest);

        // 4. Inject tokens CSS and wait for it to load
        if (themeManifest?.entry?.tokensCSS) {
          const cssUrl = getAdminTokensCssUrl(slug, themeManifest, activeTheme.version);
          if (cssUrl) {
            try {
              await injectAdminTokensCSS(cssUrl, slug);
            } catch (cssError) {
              console.warn('[AdminThemePack] Failed to load tokens CSS:', cssError);
              // Continue anyway, theme can work without custom tokens
            }
          }
        }

        setState({
          activeTheme,
          tokensLoaded: true,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        if (!mounted) return;
        console.error('[AdminThemePack] Failed to load theme:', error);
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
    // Clear cache for the effective slug
    if (effectiveSlug) {
      clearAdminThemeCache(effectiveSlug);
    }
    // Increment reloadToken to trigger useEffect re-run
    setReloadToken((prev) => prev + 1);
  }, [effectiveSlug]);

  // Merge config (defaultConfig from manifest + tenant config from activeTheme)
  const mergedConfig = useMemo((): AdminThemePackConfig => {
    const defaultConfig = manifest?.defaultConfig || {};
    const tenantConfig = state.activeTheme?.config || {};
    return deepMerge(defaultConfig, tenantConfig);
  }, [manifest, state.activeTheme]);

  // Inject merged config as CSS variables
  useEffect(() => {
    if (!mergedConfig || Object.keys(mergedConfig).length === 0) return;

    const cssVars = generateAdminCSSVariables(mergedConfig);
    if (!cssVars) return;

    const styleId = 'admin-theme-pack-config-vars';
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

  const contextValue: AdminThemePackContextValue = {
    ...state,
    reloadTheme,
    manifest,
    mergedConfig,
  };

  return (
    <AdminThemePackContext.Provider value={contextValue}>
      {children}
    </AdminThemePackContext.Provider>
  );
}

/**
 * Fetch active admin theme from API
 */
async function fetchActiveAdminTheme(): Promise<ActiveAdminTheme | null> {
  try {
    const response = await apiClient.get('/admin/themes/admin/active');
    if (!response?.success) {
      const errorMessage = typeof response?.error === 'object' && response?.error
        ? response.error.message
        : response?.message;
      console.warn('[AdminThemePack] Failed to fetch active theme:', errorMessage || 'unknown error');
      return null;
    }
    return (response.data as ActiveAdminTheme) || null;
  } catch (error) {
    console.error('[AdminThemePack] Error fetching active theme:', error);
    return null;
  }
}

/** Cache for loaded resources */
const adminResourceCache = new Map<string, unknown>();

/**
 * Get cache key for a resource
 */
function getAdminCacheKey(slug: string, resource: string, version?: string): string {
  return `admin:${slug}:${resource}:${version || 'latest'}`;
}

/**
 * Clear cache for a specific admin theme
 */
function clearAdminThemeCache(slug: string): void {
  for (const key of adminResourceCache.keys()) {
    if (key.startsWith(`admin:${slug}:`)) {
      adminResourceCache.delete(key);
    }
  }
}

/**
 * Fetch admin theme manifest
 * @param slug - Theme slug
 * @param version - Theme version (for cache key to ensure upgrades get fresh data)
 */
async function fetchAdminThemeManifest(slug: string, version?: string): Promise<AdminThemePackManifest | null> {
  const cacheKey = getAdminCacheKey(slug, 'manifest', version);
  const cached = adminResourceCache.get(cacheKey);
  if (cached) return cached as AdminThemePackManifest;

  try {
    const url = `${EXTENSIONS_BASE}/${slug}/theme.json${version ? `?v=${version}` : ''}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[AdminThemePack] Failed to fetch manifest for ${slug}:`, response.status);
      return null;
    }
    const manifest = await response.json();
    adminResourceCache.set(cacheKey, manifest);
    return manifest;
  } catch (error) {
    console.error(`[AdminThemePack] Error fetching manifest for ${slug}:`, error);
    return null;
  }
}

/**
 * Get tokens CSS URL
 */
function getAdminTokensCssUrl(
  slug: string,
  manifest?: AdminThemePackManifest,
  version?: string
): string | null {
  const tokensPath = manifest?.entry?.tokensCSS || 'tokens.css';
  const url = `${EXTENSIONS_BASE}/${slug}/${tokensPath}`;
  if (version) {
    return `${url}?v=${version}`;
  }
  return url;
}

/**
 * Inject tokens CSS via link element
 * Returns a Promise that resolves when CSS is loaded or rejects on error
 */
function injectAdminTokensCSS(url: string, slug: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const linkId = `admin-theme-pack-tokens-${slug}`;

    // Remove any existing Admin Theme Pack token links to avoid accumulation when switching themes
    for (const el of Array.from(document.querySelectorAll<HTMLLinkElement>('link[data-admin-theme-pack]'))) {
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
    link.dataset.adminThemePack = slug;

    // Wait for CSS to load
    link.onload = () => {
      resolve();
    };

    link.onerror = () => {
      reject(new Error(`Failed to load admin theme CSS: ${url}`));
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
 * Generate CSS variables from admin theme config
 */
function generateAdminCSSVariables(config: AdminThemePackConfig): string {
  const vars: string[] = [];

  // Colors
  if (config.colors) {
    for (const [key, value] of Object.entries(config.colors)) {
      if (value) {
        vars.push(`  --admin-theme-color-${key}: ${value};`);
      }
    }
  }

  // Typography
  if (config.typography) {
    for (const [key, value] of Object.entries(config.typography)) {
      if (value) {
        vars.push(`  --admin-theme-typography-${camelToKebab(key)}: ${value};`);
      }
    }
  }

  // Layout
  if (config.layout) {
    for (const [key, value] of Object.entries(config.layout)) {
      if (value) {
        vars.push(`  --admin-theme-layout-${camelToKebab(key)}: ${value};`);
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
