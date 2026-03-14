/**
 * Jiffoo Plugin SDK - Core API Client
 *
 * Provides authenticated access to Core API endpoints using Service Tokens.
 * Features:
 * - Automatic token refresh (5 minutes before expiry)
 * - Built-in retry with exponential backoff
 * - Type-safe API methods
 */

export interface CoreApiClientOptions {
  /** Base URL of the Core API (e.g., http://localhost:3001) */
  baseUrl: string;
  /** Function that returns the current service token */
  tokenProvider: () => string | Promise<string>;
  /** Optional: Function to refresh the token when expired */
  tokenRefresher?: () => Promise<string>;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
  /** Max retries (default: 3) */
  maxRetries?: number;
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface CoreApiClient {
  request<T = unknown>(options: ApiRequestOptions): Promise<T>;
  get<T = unknown>(path: string): Promise<T>;
  post<T = unknown>(path: string, body?: unknown): Promise<T>;
  put<T = unknown>(path: string, body?: unknown): Promise<T>;
  patch<T = unknown>(path: string, body?: unknown): Promise<T>;
  delete<T = unknown>(path: string): Promise<T>;
}

/**
 * Create an authenticated Core API client for plugin-to-platform communication.
 *
 * @param options - Client configuration
 * @returns CoreApiClient instance with type-safe HTTP methods
 *
 * @example
 * ```typescript
 * const client = createCoreApiClient({
 *   baseUrl: 'http://localhost:3001',
 *   tokenProvider: () => process.env.SERVICE_TOKEN!,
 *   tokenRefresher: async () => {
 *     const res = await fetch('/auth/refresh');
 *     return (await res.json()).token;
 *   },
 * });
 *
 * const products = await client.get<Product[]>('/api/products');
 * await client.post('/api/orders', { items: [{ sku: 'ABC', qty: 1 }] });
 * ```
 */
export function createCoreApiClient(options: CoreApiClientOptions): CoreApiClient {
  const {
    baseUrl,
    tokenProvider,
    tokenRefresher,
    timeout = 30000,
    maxRetries = 3,
  } = options;

  let currentToken: string | null = null;
  let tokenExpiresAt: number = 0;

  async function getToken(): Promise<string> {
    // If token is expiring within 5 minutes, try to refresh
    const now = Date.now();
    if (currentToken && tokenExpiresAt > 0 && (tokenExpiresAt - now < 5 * 60 * 1000)) {
      if (tokenRefresher) {
        try {
          currentToken = await tokenRefresher();
          // Try to decode expiry from JWT (simple base64 decode of payload)
          tokenExpiresAt = decodeTokenExpiry(currentToken);
        } catch {
          // Fall through to use existing token if refresh fails
        }
      }
    }

    if (!currentToken) {
      const token = await tokenProvider();
      currentToken = token;
      tokenExpiresAt = decodeTokenExpiry(token);
    }

    return currentToken;
  }

  function decodeTokenExpiry(token: string): number {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return 0;
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      return (payload.exp || 0) * 1000;
    } catch {
      return 0;
    }
  }

  async function request<T>(opts: ApiRequestOptions): Promise<T> {
    const { method = 'GET', path, body, headers = {}, timeout: reqTimeout } = opts;
    const effectiveTimeout = reqTimeout ?? timeout;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        // Exponential backoff: 1s, 2s, 4s
        await new Promise(r => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
      }

      try {
        const token = await getToken();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);

        const url = `${baseUrl.replace(/\/$/, '')}${path}`;
        const fetchHeaders: Record<string, string> = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...headers,
        };

        const response = await fetch(url, {
          method,
          headers: fetchHeaders,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.status === 401 && tokenRefresher && attempt < maxRetries) {
          // Token expired, clear and retry with a fresh token
          currentToken = null;
          continue;
        }

        if (!response.ok) {
          const errorBody = await response.text().catch(() => '');
          throw new Error(`API error ${response.status}: ${errorBody}`);
        }

        const data = await response.json();
        return data as T;
      } catch (error: any) {
        lastError = error;
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout after ${effectiveTimeout}ms`);
        }
        if (attempt === maxRetries) break;
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  return {
    request,
    get: <T>(path: string) => request<T>({ method: 'GET', path }),
    post: <T>(path: string, body?: unknown) => request<T>({ method: 'POST', path, body }),
    put: <T>(path: string, body?: unknown) => request<T>({ method: 'PUT', path, body }),
    patch: <T>(path: string, body?: unknown) => request<T>({ method: 'PATCH', path, body }),
    delete: <T>(path: string) => request<T>({ method: 'DELETE', path }),
  };
}
