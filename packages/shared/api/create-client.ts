/**
 * 统一API客户端工厂
 * 为不同前端应用创建配置好的API客户端实例
 * 应用类型: shop (商城前台), tenant (租户后台), admin (平台管理后台)
 */

import { AuthClient } from './auth-client';
import { ApiClient, ApiClientConfig } from './client';
import { StorageAdapterFactory } from './storage-adapters';
import { envConfig } from '../config/env';

// 应用类型
export type AppType = 'shop' | 'tenant' | 'admin';

export interface CreateClientOptions {
  appId: AppType;
  basePath?: string;
  storageType?: 'browser' | 'cookie' | 'hybrid' | 'memory';
  cookies?: any; // Next.js cookies object
  customConfig?: Partial<ApiClientConfig>;
}

/**
 * 为不同应用创建统一的API客户端
 */
export function createApiClient(options: CreateClientOptions): AuthClient {
  const { appId, basePath, storageType, cookies, customConfig = {} } = options;

  // 根据应用类型确定基础配置
  const appConfigs: Record<AppType, Partial<ApiClientConfig>> = {
    shop: {
      baseURL: basePath || envConfig.getApiServiceBaseUrl(),
      withCredentials: true,
      loginPath: '/auth/login', // 商城前端登录页面
      defaultHeaders: {
        'X-App-Type': 'shop',
        'X-Client-Version': '1.0.0',
        'X-Tenant-ID': '1' // 商城前端使用租户ID 1
      }
    },
    tenant: {
      baseURL: basePath || envConfig.getApiServiceBaseUrl(),
      withCredentials: true,
      loginPath: '/auth/login', // 租户管理后台登录页面
      defaultHeaders: {
        'X-App-Type': 'tenant',
        'X-Client-Version': '1.0.0'
      }
    },
    admin: {
      baseURL: basePath || envConfig.getApiServiceBaseUrl(),
      withCredentials: true,
      loginPath: '/login', // 平台管理员登录页面
      defaultHeaders: {
        'X-App-Type': 'admin',
        'X-Client-Version': '1.0.0',
        'x-tenant-id': '0' // 平台管理员使用租户ID 0
      }
    }
  };

  // 合并配置
  const config: ApiClientConfig = {
    ...appConfigs[appId],
    ...customConfig,
    defaultHeaders: {
      ...appConfigs[appId].defaultHeaders,
      ...customConfig.defaultHeaders
    }
  };

  // 创建存储适配器
  const storage = StorageAdapterFactory.create(storageType, cookies);

  // 创建并返回AuthClient实例
  return new AuthClient(config, storage);
}

/**
 * 为Shop应用创建API客户端（商城前端）
 */
export function createShopClient(options: Omit<CreateClientOptions, 'appId'> = {}): AuthClient {
  return createApiClient({
    ...options,
    appId: 'shop',
    storageType: options.storageType || 'hybrid' // 前端优先使用混合存储
  });
}

/**
 * 为Tenant应用创建API客户端（租户管理后台）
 */
export function createTenantClient(options: Omit<CreateClientOptions, 'appId'> = {}): AuthClient {
  return createApiClient({
    ...options,
    appId: 'tenant',
    storageType: options.storageType || 'hybrid' // 管理端优先使用混合存储
  });
}

/**
 * 为Admin应用创建API客户端（平台管理员后台）
 */
export function createAdminClient(options: Omit<CreateClientOptions, 'appId'> = {}): AuthClient {
  return createApiClient({
    ...options,
    appId: 'admin',
    storageType: options.storageType || 'browser' // 平台管理员使用浏览器存储
  });
}

/**
 * 全局API客户端实例管理器
 */
class ApiClientManager {
  private static instances = new Map<string, AuthClient>();

  /**
   * 获取或创建API客户端实例
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
   * 清除所有实例（用于测试或重置）
   */
  static clearInstances(): void {
    this.instances.clear();
  }

  /**
   * 清除特定应用的实例
   */
  static clearInstance(appId: AppType): void {
    const keysToDelete = Array.from(this.instances.keys()).filter(key => key.startsWith(appId));
    keysToDelete.forEach(key => this.instances.delete(key));
  }
}

export { ApiClientManager };

/**
 * 便捷的全局实例获取函数
 */
export const getShopClient = (options?: Omit<CreateClientOptions, 'appId'>) =>
  ApiClientManager.getInstance('shop', options);

export const getTenantClient = (options?: Omit<CreateClientOptions, 'appId'>) =>
  ApiClientManager.getInstance('tenant', options);

export const getAdminClient = (options?: Omit<CreateClientOptions, 'appId'>) =>
  ApiClientManager.getInstance('admin', options);

/**
 * React Hook for API Client (可选，如果需要在React中使用)
 */
export function useApiClient(appId: AppType, options: Omit<CreateClientOptions, 'appId'> = {}): AuthClient {
  // 在React环境中，可以使用useMemo来优化
  if (typeof window !== 'undefined' && 'React' in window) {
    // @ts-ignore
    const { useMemo } = window.React;
    return useMemo(() => ApiClientManager.getInstance(appId, options), [appId, JSON.stringify(options)]);
  }

  // 非React环境直接返回实例
  return ApiClientManager.getInstance(appId, options);
}
