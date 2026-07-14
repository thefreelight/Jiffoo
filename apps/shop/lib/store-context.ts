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
  platformBranding?: {
    mode: 'oss' | 'managed';
    showPoweredByJiffoo: boolean;
    poweredByHref: string | null;
    poweredByLabel: string;
  };
  settings: Record<string, unknown> | null;
  status: string;
  defaultLocale: string;
  supportedLocales: string[];
  checkout?: {
    countriesRequireStatePostal?: string[];
  };
}

const BASE_DEFAULT_STORE_CONTEXT: StoreContext = {
  storeId: '1',
  storeName: 'Jiffoo Store',
  logo: null,
  theme: { slug: 'default', config: undefined },
  platformBranding: {
    mode: 'oss',
    showPoweredByJiffoo: true,
    poweredByHref: 'https://jiffoo.com',
    poweredByLabel: 'Jiffoo',
  },
  settings: {},
  status: 'active',
  defaultLocale: 'en',
  supportedLocales: ['en', 'zh-Hant'],
  checkout: {
    countriesRequireStatePostal: ['US', 'CA', 'AU', 'CN', 'GB'],
  },
};

function getOptionalEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getBooleanEnv(name: string): boolean | undefined {
  const value = getOptionalEnv(name);
  if (!value) return undefined;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function getLocaleListEnv(name: string): string[] | undefined {
  const value = getOptionalEnv(name);
  if (!value) return undefined;
  const locales = value
    .split(',')
    .map((locale) => locale.trim())
    .filter(Boolean);
  return locales.length > 0 ? locales : undefined;
}

function createDefaultStoreContext(): StoreContext {
  const storeName = getOptionalEnv('NEXT_PUBLIC_FALLBACK_STORE_NAME');
  const themeSlug = getOptionalEnv('NEXT_PUBLIC_FALLBACK_THEME_SLUG');
  const themeVersion = getOptionalEnv('NEXT_PUBLIC_FALLBACK_THEME_VERSION');
  const defaultLocale = getOptionalEnv('NEXT_PUBLIC_FALLBACK_DEFAULT_LOCALE');
  const supportedLocales = getLocaleListEnv('NEXT_PUBLIC_FALLBACK_SUPPORTED_LOCALES');
  const showPoweredByJiffoo = getBooleanEnv('NEXT_PUBLIC_FALLBACK_POWERED_BY_JIFFOO');

  return {
    ...BASE_DEFAULT_STORE_CONTEXT,
    storeName: storeName || BASE_DEFAULT_STORE_CONTEXT.storeName,
    theme: {
      slug: themeSlug || BASE_DEFAULT_STORE_CONTEXT.theme?.slug || 'default',
      config: BASE_DEFAULT_STORE_CONTEXT.theme?.config,
      version: themeVersion || BASE_DEFAULT_STORE_CONTEXT.theme?.version,
    },
    platformBranding: {
      ...BASE_DEFAULT_STORE_CONTEXT.platformBranding!,
      showPoweredByJiffoo:
        showPoweredByJiffoo ?? BASE_DEFAULT_STORE_CONTEXT.platformBranding!.showPoweredByJiffoo,
    },
    defaultLocale: defaultLocale || BASE_DEFAULT_STORE_CONTEXT.defaultLocale,
    supportedLocales: supportedLocales || BASE_DEFAULT_STORE_CONTEXT.supportedLocales,
  };
}

/**
 * Default store context (Fallback)
 */
export const DEFAULT_STORE_CONTEXT: StoreContext = createDefaultStoreContext();

export function getConfiguredFallbackStoreContext(): StoreContext | null {
  if (
    !getOptionalEnv('NEXT_PUBLIC_FALLBACK_STORE_NAME') &&
    !getOptionalEnv('NEXT_PUBLIC_FALLBACK_THEME_SLUG')
  ) {
    return null;
  }

  return createDefaultStoreContext();
}

/**
 * Fetch store context from backend API
 */
export async function fetchStoreContext(): Promise<{ context: StoreContext | null; error?: string }> {
  try {
    const { storeContextApi } = await import('./api');
    const response = await storeContextApi.getContext();

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
      error: response.error?.message || 'Store not found'
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
