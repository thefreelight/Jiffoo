import { cache } from 'react';
import { buildServerApiUrl } from './server-api-url';
import { getConfiguredFallbackStoreContext } from './store-context';

/**
 * Server-side Store Context Helper (Single Store)
 */

export interface ServerStoreContext {
  storeId: string;
  storeName: string;
  logo: string | null;
  platformBranding?: {
    mode: 'oss' | 'managed';
    showPoweredByJiffoo: boolean;
    poweredByHref: string | null;
    poweredByLabel: string;
  };
  theme: {
    slug: string;
    config?: Record<string, any>;
    version?: string;
    pluginSlug?: string;
  } | null;
  settings: Record<string, unknown> | null;
  status: string;
  defaultLocale?: string;
  supportedLocales?: string[];
  checkout?: {
    countriesRequireStatePostal?: string[];
  };
}

export interface ServerStoreContextOptions {
  cache?: RequestCache;
  revalidate?: number | false;
}

const DEFAULT_STORE_CONTEXT_TIMEOUT_MS = 2000;

function resolveServerStoreContextTimeoutMs(): number {
  const rawValue = process.env.SERVER_STORE_CONTEXT_TIMEOUT_MS;
  if (!rawValue) {
    return DEFAULT_STORE_CONTEXT_TIMEOUT_MS;
  }

  const parsedValue = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return DEFAULT_STORE_CONTEXT_TIMEOUT_MS;
  }

  return parsedValue;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch store context from backend API (server-side)
 * Used in server components or for SSR optimization
 *
 * The no-store variant is wrapped in React cache(): generateViewport,
 * generateMetadata and RootLayout all request the context during a single
 * render pass, and cache() collapses those into one backend roundtrip per
 * request without introducing cross-request staleness.
 */
export async function getServerStoreContext(
  options: ServerStoreContextOptions = {},
): Promise<ServerStoreContext | null> {
  const cacheMode = options.cache ?? 'no-store';
  if (cacheMode === 'no-store') {
    return getServerStoreContextNoStoreDeduped();
  }
  return fetchServerStoreContext(options);
}

const getServerStoreContextNoStoreDeduped = cache(
  (): Promise<ServerStoreContext | null> => fetchServerStoreContext({ cache: 'no-store' }),
);

async function fetchServerStoreContext(
  options: ServerStoreContextOptions = {},
): Promise<ServerStoreContext | null> {
  const fallbackContext = getConfiguredFallbackStoreContext() as ServerStoreContext | null;

  try {
    const url = await buildServerApiUrl('/store/context');
    const cache = options.cache ?? 'no-store';
    const shouldBypassCache = cache === 'no-store';

    const response = await fetchWithTimeout(url, {
      // Theme / branding activation must reflect immediately after Admin changes.
      // The API already owns short-lived caching and invalidation via store-context versioning.
      cache,
      ...(shouldBypassCache
        ? {}
        : {
            next: {
              revalidate: options.revalidate === false ? 0 : (options.revalidate ?? 3600),
            },
          }),
      headers: {
        'Content-Type': 'application/json',
      },
    }, resolveServerStoreContextTimeoutMs());

    if (!response.ok) {
      console.error(`Failed to fetch store context: ${response.status}`);
      return fallbackContext;
    }

    const data = await response.json();

    if (data.success && data.data) {
      return data.data as ServerStoreContext;
    }

    return fallbackContext;
  } catch (error: any) {
    const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';
    const isAbort = error.name === 'AbortError';
    const isConnRefused = error.code === 'ECONNREFUSED' || error.message?.includes('fetch failed');

    // During build phase, if the API is unreachable, behave silently.
    // This is expected because the backend usually isn't running in the builder.
    if (!isBuildPhase && !isConnRefused && !isAbort) {
      console.error('Error fetching server store context:', error.message || error);
    }
    return fallbackContext;
  }
}
