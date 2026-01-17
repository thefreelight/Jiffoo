/**
 * Storage Adapter Strategy
 * Provides unified storage interface for different frontend environments
 */

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}

/**
 * Browser localStorage adapter
 * Suitable for client-side rendering environments
 */
export class BrowserStorageAdapter implements StorageAdapter {
  getItem(key: string): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn('localStorage access failed:', error);
      return null;
    }
  }

  setItem(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.warn('localStorage write failed:', error);
    }
  }

  removeItem(key: string): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('localStorage remove failed:', error);
    }
  }

  clear(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.clear();
    } catch (error) {
      console.warn('localStorage clear failed:', error);
    }
  }
}

/**
 * Next.js Cookie adapter
 * Suitable for Next.js 13+ App Router environment
 */
export class NextCookieAdapter implements StorageAdapter {
  private cookies: any;

  constructor(cookies?: any) {
    // Use passed cookies on server, use document.cookie on client
    this.cookies = cookies;
  }

  getItem(key: string): string | null {
    if (typeof window !== 'undefined') {
      // Client-side: read from document.cookie
      const name = key + '=';
      const decodedCookie = decodeURIComponent(document.cookie);
      const ca = decodedCookie.split(';');
      for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') {
          c = c.substring(1);
        }
        if (c.indexOf(name) === 0) {
          return c.substring(name.length, c.length);
        }
      }
      return null;
    } else {
      // Server-side: read from passed cookies
      return this.cookies?.get(key)?.value || null;
    }
  }

  setItem(key: string, value: string): void {
    // 🔒 Security Fix: NextCookieAdapter should not write script-readable cookies
    // httpOnly cookies can only be set by server, changed to read-only mode here
    console.warn('NextCookieAdapter.setItem: Security policy prohibits client-side cookie writing, please use server-side httpOnly cookies');
    // Do not execute any write operations, maintain httpOnly security policy
  }

  removeItem(key: string): void {
    if (typeof window !== 'undefined') {
      document.cookie = `${key}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    }
  }

  clear(): void {
    // Cookie cleanup needs individual deletion, not implemented here
    console.warn('Cookie clear not implemented');
  }
}

/**
 * OAuth2 SPA Standard Storage Adapter
 * Follows OAuth2 SPA Best Practices: Store tokens in localStorage
 *
 * Security Note:
 * - OAuth2 SPA standard recommends using localStorage for tokens
 * - While XSS risk exists, this is a standard trade-off for SPA architecture
 * - Mitigation via CSP, HTTPS, Token Expiry, etc.
 */
export class OAuth2SPAAdapter implements StorageAdapter {
  private browserAdapter: BrowserStorageAdapter;

  constructor() {
    this.browserAdapter = new BrowserStorageAdapter();
  }

  getItem(key: string): string | null {
    // OAuth2 SPA Standard: Read directly from localStorage
    return this.browserAdapter.getItem(key);
  }

  setItem(key: string, value: string): void {
    // OAuth2 SPA Standard: Store directly to localStorage
    this.browserAdapter.setItem(key, value);
  }

  removeItem(key: string): void {
    // OAuth2 SPA Standard: Remove from localStorage
    this.browserAdapter.removeItem(key);
  }

  clear(): void {
    // OAuth2 SPA Standard: Clear localStorage
    this.browserAdapter.clear();
  }
}

/**
 * Hybrid Storage Adapter (Deprecated, kept for backward compatibility)
 * @deprecated Use OAuth2SPAAdapter instead
 */
export class HybridAdapter implements StorageAdapter {
  private oauth2Adapter: OAuth2SPAAdapter;

  constructor(cookies?: any) {
    // Ignore cookies param, consolidate to OAuth2 SPA standard
    this.oauth2Adapter = new OAuth2SPAAdapter();
  }

  getItem(key: string): string | null {
    return this.oauth2Adapter.getItem(key);
  }

  setItem(key: string, value: string): void {
    return this.oauth2Adapter.setItem(key, value);
  }

  removeItem(key: string): void {
    return this.oauth2Adapter.removeItem(key);
  }

  clear(): void {
    return this.oauth2Adapter.clear();
  }
}

/**
 * Memory Storage Adapter
 * Suitable for test environments or temporary storage
 */
export class MemoryStorageAdapter implements StorageAdapter {
  private storage = new Map<string, string>();

  getItem(key: string): string | null {
    return this.storage.get(key) || null;
  }

  setItem(key: string, value: string): void {
    this.storage.set(key, value);
  }

  removeItem(key: string): void {
    this.storage.delete(key);
  }

  clear(): void {
    this.storage.clear();
  }
}

/**
 * Storage Adapter Factory
 * Automatically selects appropriate storage strategy based on environment
 *
 * OAuth2 SPA Standard: Defaults to localStorage for tokens
 */
export class StorageAdapterFactory {
  static create(type?: 'browser' | 'cookie' | 'hybrid' | 'memory' | 'oauth2-spa', cookies?: any): StorageAdapter {
    if (type) {
      switch (type) {
        case 'browser':
          return new BrowserStorageAdapter();
        case 'cookie':
          return new NextCookieAdapter(cookies);
        case 'hybrid':
          // hybrid is deprecated, redirect to oauth2-spa
          return new OAuth2SPAAdapter();
        case 'oauth2-spa':
          return new OAuth2SPAAdapter();
        case 'memory':
          return new MemoryStorageAdapter();
      }
    }

    // Auto-detect environment
    if (typeof window === 'undefined') {
      // Server-side environment, use cookie adapter (SSR only)
      return new NextCookieAdapter(cookies);
    } else {
      // Client-side environment, use OAuth2 SPA standard adapter
      return new OAuth2SPAAdapter();
    }
  }
}
