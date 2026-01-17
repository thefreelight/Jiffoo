/**
 * Unified API Client Factory
 * Creates configured API client instances for different frontend applications
 * App types: shop (frontend), admin (admin dashboard)
 */

import { AuthClient } from './auth-client';
import { ApiClient, ApiClientConfig } from './client';
import { StorageAdapterFactory } from './storage-adapters';
import { envConfig } from '../config/env';

// Application type
export type AppType = 'shop' | 'admin';

export interface CreateClientOptions {
  appId: AppType;
  basePath?: string;
  storageType?: 'browser' | 'cookie' | 'hybrid' | 'memory';
  cookies?: any; // Next.js cookies object
  customConfig?: Partial<ApiClientConfig>;
}

/**
 * Create unified API client for different applications
 */
export function createApiClient(options: CreateClientOptions): AuthClient {
  const { appId, basePath, storageType, cookies, customConfig = {} } = options;

  // Determine base config based on app type
  const appConfigs: Record<AppType, Partial<ApiClientConfig>> = {
    shop: {
      baseURL: basePath || envConfig.getApiServiceBaseUrl(),
      withCredentials: true,
      loginPath: '/auth/login', // Shop login page
      defaultHeaders: {
        'X-App-Type': 'shop',
        'X-Client-Version': '1.0.0'
      }
    },

    admin: {
      baseURL: basePath || envConfig.getApiServiceBaseUrl(),
      withCredentials: true,
      loginPath: '/auth/login',
      defaultHeaders: {
        'X-App-Type': 'admin',
        'X-Client-Version': '1.0.0'
      }
    }
  };

  // Merge config
  const config: ApiClientConfig = {
    ...appConfigs[appId],
    ...customConfig,
    defaultHeaders: {
      ...appConfigs[appId].defaultHeaders,
      ...customConfig.defaultHeaders
    }
  };

  // Create storage adapter
  const storage = StorageAdapterFactory.create(storageType, cookies);

  // Create and return AuthClient instance
  return new AuthClient(config, storage);
}

/**
 * Create API client for Shop application (frontend)
 */
export function createShopClient(options: Omit<CreateClientOptions, 'appId'> = {}): AuthClient {
  return createApiClient({
    ...options,
    appId: 'shop',
    storageType: options.storageType || 'hybrid' // Frontend prioritizes hybrid storage
  });
}

/**
 * Create API client for Admin application (admin dashboard)
 */
export function createAdminClient(options: Omit<CreateClientOptions, 'appId'> = {}): AuthClient {
  return createApiClient({
    ...options,
    appId: 'admin',
    storageType: options.storageType || 'browser' // Admin uses browser storage
  });
}

/**
 * Global API Client Instance Manager
 */
class ApiClientManager {
  private static instances = new Map<string, AuthClient>();

  /**
   * Get or create API client instance
   */
  static getInstance(appId: AppType, options: Omit<CreateClientOptions, 'appId'> = {}): AuthClient {
    const key = `${appId}-${JSON.stringify(options)}`;

    if (!this.instances.has(key)) {
      const client = createApiClient({ ...options, appId });
      this.instances.set(key, client);
    }

    return this.instances.get(key)!;
  }

  /**
   * Clears all instances (for testing or reset purposes)
   */
  static clearInstances(): void {
    this.instances.clear();
  }

  /**
   * Clears instances for a specific application type
   */
  static clearInstance(appId: AppType): void {
    const keysToDelete = Array.from(this.instances.keys()).filter(key => key.startsWith(appId));
    keysToDelete.forEach(key => this.instances.delete(key));
  }
}

export { ApiClientManager };

/**
 * Helper function to get global instance
 */
export const getShopClient = (options?: Omit<CreateClientOptions, 'appId'>) =>
  ApiClientManager.getInstance('shop', options);



export const getAdminClient = (options?: Omit<CreateClientOptions, 'appId'>) =>
  ApiClientManager.getInstance('admin', options);

/**
 * React Hook for API Client (optional, for React usage)
 */
export function useApiClient(appId: AppType, options: Omit<CreateClientOptions, 'appId'> = {}): AuthClient {
  // Use useMemo optimization in React environment
  if (typeof window !== 'undefined' && 'React' in window) {
    // @ts-ignore
    const { useMemo } = window.React;
    return useMemo(() => ApiClientManager.getInstance(appId, options), [appId, JSON.stringify(options)]);
  }

  // Return instance directly in non-React environment
  return ApiClientManager.getInstance(appId, options);
}
