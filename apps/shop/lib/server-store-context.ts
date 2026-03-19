import { buildServerApiUrl } from './server-api-url';

/**
 * Server-side Store Context Helper (Single Store)
 */

export interface ServerStoreContext {
  storeId: string;
  storeName: string;
  logo: string | null;
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

/**
 * Fetch store context from backend API (server-side)
 * Used in server components or for SSR optimization
 */
export async function getServerStoreContext(): Promise<ServerStoreContext | null> {
  try {
    const url = await buildServerApiUrl('/store/context');

    const response = await fetch(url, {
      cache: 'force-cache',
      next: { revalidate: 3600 }, // Cache for 1 hour
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch store context: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.success && data.data) {
      return data.data as ServerStoreContext;
    }

    return null;
  } catch (error: any) {
    const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';
    const isConnRefused = error.code === 'ECONNREFUSED' || error.message?.includes('fetch failed');

    // During build phase, if the API is unreachable, behave silently.
    // This is expected because the backend usually isn't running in the builder.
    if (!isBuildPhase && !isConnRefused) {
      console.error('Error fetching server store context:', error.message || error);
    }
    return null;
  }
}
