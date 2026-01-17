'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { initializeStoreContext, type StoreContext } from '@/lib/store-context';
import { useAuthStore } from '@/store/auth';
import { useCartStore } from '@/store/cart';
import { useStoreStore } from '@/store/store';
import { ThemeProvider } from '@/lib/themes/provider';
import { ThemedLayout } from '@/components/themed-layout';
import type { ThemeConfig } from 'shared/src/types/theme';

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
  const [isLoading, setIsLoading] = useState(!initialContext);
  const [context, setContext] = useState<StoreContext | null>(initialContext || null);
  const [error, setError] = useState<string | null>(null);

  // Read theme override from URL query param - must be at top with other hooks
  const searchParams = useSearchParams();
  const themeOverride = searchParams.get('theme');

  // Store state for global access
  const setStoreContext = useStoreStore((state) => state.setContext);
  const setStoreLoading = useStoreStore((state) => state.setLoading);
  const setStoreError = useStoreStore((state) => state.setError);

  useEffect(() => {
    if (initialContext) return;
    if (typeof window === 'undefined') return;

    const hostname = window.location.hostname;
    const cacheKey = `store-context:domain:${hostname}`;

    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        const age = Date.now() - (parsed.timestamp || 0);

        if (age < 60000) {
          setContext(parsed.data);
          setIsLoading(false);
          return;
        }
      }
    } catch (err) {
      console.error('Failed to load store context from cache:', err);
    }
  }, [initialContext]);

  const authLogout = useAuthStore(state => state.logout);
  const resetCart = useCartStore(state => state.resetCart);

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
          setContext(storeContext);
          setStoreContext(storeContext);

          if (storeContext) {
            const hostname = window.location.hostname;
            const cacheKey = `store-context:domain:${hostname}`;
            try {
              localStorage.setItem(cacheKey, JSON.stringify({
                data: storeContext,
                timestamp: Date.now()
              }));
            } catch (err) {
              console.error('Failed to cache store context:', err);
            }
          }
        } else {
          setStoreContext(initialContext);
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
  }, [authLogout, resetCart, initialContext, setStoreContext, setStoreLoading, setStoreError]);

  if (isLoading && !context) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em]" />
          <p className="mt-4 text-sm text-gray-600">Loading store...</p>
        </div>
      </div>
    );
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

  // URL param takes priority over context theme
  const themeSlug = themeOverride || context?.theme?.slug || 'default';
  const themeConfig = context?.theme?.config as ThemeConfig | undefined;

  return (
    <ThemeProvider slug={themeSlug} config={themeConfig}>
      <ThemedLayout>{children}</ThemedLayout>
    </ThemeProvider>
  );
}

