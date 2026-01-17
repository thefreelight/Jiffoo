/**
 * Store Context Manager (Single Store)
 * Handles store configuration and context loading for the shop frontend.
 */

import type { ThemeConfig } from 'shared/src/types/theme';

export interface ThemeInfo {
  slug: string;
  config?: ThemeConfig;
  version?: string;
  pluginSlug?: string;
}

export interface StoreContext {
  storeId: string;
  storeName: string;
  logo: string | null;
  theme: ThemeInfo | null;
  settings: Record<string, unknown> | null;
  status: string;
  defaultLocale: string;
  supportedLocales: string[];
}

/**
 * Default store context (Fallback)
 */
export const DEFAULT_STORE_CONTEXT: StoreContext = {
  storeId: '1',
  storeName: 'Jiffoo Store',
  logo: null,
  theme: { slug: 'default', config: undefined },
  settings: {},
  status: 'active',
  defaultLocale: 'en',
  supportedLocales: ['en', 'zh-Hant'],
};

/**
 * Fetch store context from backend API
 */
export async function fetchStoreContext(): Promise<{ context: StoreContext | null; error?: string }> {
  try {
    const { mallContextApi } = await import('./api');
    const response = await mallContextApi.getContext({});

    if (response.success && response.data) {
      const data = response.data as any;
      const context: StoreContext = {
        ...data,
        storeId: data.storeId || '1',
        storeName: data.storeName || 'Jiffoo Store',
        theme: data.theme as ThemeInfo | null,
      };
      return { context };
    }

    return {
      context: null,
      error: response.error || response.message || 'Store not found'
    };
  } catch (error) {
    console.error('Failed to fetch store context:', error);
    return { context: null, error: 'Network error' };
  }
}

/**
 * Initialize store context
 */
export async function initializeStoreContext(): Promise<StoreContext | null> {
  const result = await fetchStoreContext();

  if (result.error || !result.context) {
    console.warn(`[StoreContext] Failed to load context: ${result.error || 'Unknown error'}`);
    return DEFAULT_STORE_CONTEXT;
  }

  return result.context;
}

/**
 * Clear store context
 */
export function clearStoreContext(): void {
  // Clear any store-related state if necessary
}
