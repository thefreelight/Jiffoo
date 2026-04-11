'use client';

import { useEffect, useState, useMemo } from 'react';
import * as React from 'react';
import { initializeStoreContext, type StoreContext } from '@/lib/store-context';
import { useAuthStore } from '@/store/auth';
import { useCartStore } from '@/store/cart';
import { useStoreStore } from '@/store/store';
import { ThemeProvider } from '@/lib/themes/provider';
import { ThemedLayout } from '@/components/themed-layout';
import { useThemePackOptional } from '@/lib/theme-pack';
import type { ThemeConfig } from 'shared/src/types/theme';
import { resolveThemeRendererSlug } from '@/lib/theme-pack/rendering-mode';

/**
 * Store Context Provider
 * Initializes store context when the app starts
 * 
 * @param initialContext - Optional server-side fetched context
 */
export function StoreContextProvider({
  children,
  initialContext
}: {
  children: React.ReactNode;
  initialContext?: StoreContext | null;
}) {
  // Hydrate from sessionStorage immediately to avoid flash and re-mounts
  const [isLoading, setIsLoading] = useState(() => {
    if (initialContext) return false;
    if (typeof window === 'undefined') return true;
    try {
      const cached = sessionStorage.getItem('store-context');
      return !cached;
    } catch {
      return true;
    }
  });

  const [context, setContext] = useState<StoreContext | null>(() => {
    if (initialContext) return initialContext;
    if (typeof window === 'undefined') return null;
    try {
      const cached = sessionStorage.getItem('store-context');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [error, setError] = useState<string | null>(null);

  // Get theme config from ThemePackProvider (authoritative source: GET /api/themes/active)
  // ThemePackProvider is already wrapping this component in conditional-layout.tsx
  const themePack = useThemePackOptional();

  const themeConfigFromThemePack: ThemeConfig | undefined = React.useMemo(() => {
    const merged = themePack?.mergedConfig;
    if (!merged || typeof merged !== 'object') return undefined;

    // Theme Pack config shape: { colors, typography, layout, ... }
    // Default theme renderer expects ThemeConfig: { brand, layout, features }
    const colors = (merged as any).colors as Record<string, unknown> | undefined;
    const typography = (merged as any).typography as Record<string, unknown> | undefined;
    const layout = (merged as any).layout as Record<string, unknown> | undefined;

    const config: ThemeConfig = {};

    const primary = colors?.primary as string | undefined;
    const secondary = colors?.secondary as string | undefined;
    const fontFamily = typography?.fontFamily as string | undefined;

    if (primary || secondary || fontFamily) {
      config.brand = {
        primaryColor: primary,
        secondaryColor: secondary,
        fontFamily,
      };
    }

    const maxWidth = layout?.containerWidth as string | undefined;
    if (maxWidth) {
      config.layout = {
        maxWidth,
      };
    }

    return Object.keys(config).length > 0 ? config : undefined;
  }, [themePack?.mergedConfig]);

  // Store state for global access
  const setStoreContext = useStoreStore((state) => state.setContext);
  const setStoreLoading = useStoreStore((state) => state.setLoading);
  const setStoreError = useStoreStore((state) => state.setError);

  const persistContext = React.useCallback((storeContext: StoreContext | null) => {
    if (!storeContext || typeof window === 'undefined') return;

    try {
      sessionStorage.setItem('store-context', JSON.stringify(storeContext));
    } catch {
      // Ignore storage write failures; runtime state still updates in memory.
    }
  }, []);

  const applyContext = React.useCallback(
    (storeContext: StoreContext | null) => {
      setContext((prev) => {
        const previousSnapshot = prev ? JSON.stringify(prev) : '';
        const nextSnapshot = storeContext ? JSON.stringify(storeContext) : '';
        return previousSnapshot === nextSnapshot ? prev : storeContext;
      });
      setStoreContext(storeContext);
      persistContext(storeContext);
    },
    [persistContext, setStoreContext]
  );

  // Removed unused authLogout and resetCart hooks that caused infinite rerenders

  // No-op useEffect as we now handle immediate hydration in the state initializer
  useEffect(() => { }, []);

  useEffect(() => {
    async function loadContext() {
      setStoreLoading(true);
      try {
        if (typeof window !== 'undefined' && window.location.pathname === '/store-not-found') {
          setIsLoading(false);
          setStoreLoading(false);
          return;
        }

        if (!initialContext) {
          const storeContext = await initializeStoreContext();
          applyContext(storeContext);
        } else {
          applyContext(initialContext);
        }
      } catch (err) {
        console.error('Failed to initialize store context:', err);
        const { DEFAULT_STORE_CONTEXT } = await import('@/lib/store-context');
        setContext(DEFAULT_STORE_CONTEXT);
        setStoreContext(DEFAULT_STORE_CONTEXT);
        setError(null);
        setStoreError(null);
      } finally {
        setIsLoading(false);
        setStoreLoading(false);
      }
    }

    loadContext();
  }, [applyContext, initialContext, setStoreLoading, setStoreError]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const revalidateContext = async () => {
      try {
        const latestContext = await initializeStoreContext();
        applyContext(latestContext);
        setError(null);
        setStoreError(null);
      } catch (err) {
        console.warn('Failed to refresh store context on window focus:', err);
      }
    };

    const handleFocus = () => {
      void revalidateContext();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void revalidateContext();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [applyContext, setStoreError]);

  // Resolve the storefront renderer from the active Theme Pack contract.
  // Downloaded Theme Packs may declare an embedded renderer slug in theme.json,
  // which lets package-managed themes drive the full storefront renderer.
  const themeSlug = React.useMemo(
    () =>
      resolveThemeRendererSlug({
        manifest: themePack?.manifest,
        activeThemeSlug: themePack?.activeTheme?.slug,
        serverThemeSlug: context?.theme?.slug,
      }),
    [themePack?.activeTheme?.slug, themePack?.manifest, context?.theme?.slug],
  );

  const themeConfig = React.useMemo(() =>
    themeConfigFromThemePack ?? (context?.theme?.config as ThemeConfig | undefined),
    [themeConfigFromThemePack, context?.theme?.config]
  );

  if (isLoading && !context) {
    return <div className="min-h-screen" />;
  }

  if (error) {
    const handleRetry = () => {
      setError(null);
      setIsLoading(true);
      setContext(null);
    };

    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md px-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Failed to load store</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{error}</p>
          <button
            onClick={handleRetry}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider slug={themeSlug} config={themeConfig}>
      <ThemedLayout>{children}</ThemedLayout>
    </ThemeProvider>
  );
}
