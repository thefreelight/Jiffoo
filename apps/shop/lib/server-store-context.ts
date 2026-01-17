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
}

/**
 * Fetch store context from backend API (server-side)
 * Used in server components or for SSR optimization
 */
export async function getServerStoreContext(): Promise<ServerStoreContext | null> {
  try {
    const apiServiceUrl = process.env.API_SERVICE_URL || 'http://localhost:3001';
    // Using /mall/context for compatibility until API is updated to /store/context
    const url = `${apiServiceUrl}/api/mall/context`;

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
  } catch (error) {
    console.error('Error fetching server store context:', error);
    return null;
  }
}
