/**
 * 存储适配器策略
 * 为不同前端环境提供统一的存储接口
 */

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}

/**
 * 浏览器localStorage适配器
 * 适用于客户端渲染环境
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
 * Next.js Cookie适配器
 * 适用于Next.js 13+ App Router环境
 */
export class NextCookieAdapter implements StorageAdapter {
  private cookies: any;

  constructor(cookies?: any) {
    // 在服务端使用传入的cookies，在客户端使用document.cookie
    this.cookies = cookies;
  }

  getItem(key: string): string | null {
    if (typeof window !== 'undefined') {
      // 客户端：从document.cookie读取
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
      // 服务端：从传入的cookies读取
      return this.cookies?.get(key)?.value || null;
    }
  }

  setItem(key: string, value: string): void {
    // 🔒 安全修复：NextCookieAdapter不应该写入脚本可读的cookie
    // httpOnly cookie只能由服务端设置，这里改为只读模式
    console.warn('NextCookieAdapter.setItem: 安全策略禁止客户端写入cookie，请使用服务端设置httpOnly cookie');
    // 不执行任何写入操作，保持httpOnly安全策略
  }

  removeItem(key: string): void {
    if (typeof window !== 'undefined') {
      document.cookie = `${key}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    }
  }

  clear(): void {
    // Cookie清理需要逐个删除，这里不实现
    console.warn('Cookie clear not implemented');
  }
}

/**
 * OAuth2 SPA标准存储适配器
 * 符合OAuth2 SPA最佳实践：使用localStorage存储tokens
 *
 * 安全说明：
 * - OAuth2 SPA标准推荐使用localStorage存储tokens
 * - 虽然存在XSS风险，但这是SPA架构的标准权衡
 * - 通过CSP、HTTPS、Token过期等机制降低风险
 */
export class OAuth2SPAAdapter implements StorageAdapter {
  private browserAdapter: BrowserStorageAdapter;

  constructor() {
    this.browserAdapter = new BrowserStorageAdapter();
  }

  getItem(key: string): string | null {
    // OAuth2 SPA标准：直接从localStorage读取
    return this.browserAdapter.getItem(key);
  }

  setItem(key: string, value: string): void {
    // OAuth2 SPA标准：直接存储到localStorage
    this.browserAdapter.setItem(key, value);
  }

  removeItem(key: string): void {
    // OAuth2 SPA标准：从localStorage删除
    this.browserAdapter.removeItem(key);
  }

  clear(): void {
    // OAuth2 SPA标准：清除localStorage
    this.browserAdapter.clear();
  }
}

/**
 * 混合存储适配器（已废弃，保留用于向后兼容）
 * @deprecated 使用 OAuth2SPAAdapter 代替
 */
export class HybridAdapter implements StorageAdapter {
  private oauth2Adapter: OAuth2SPAAdapter;

  constructor(cookies?: any) {
    // 忽略cookies参数，统一使用OAuth2 SPA标准
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
 * 内存存储适配器
 * 适用于测试环境或临时存储
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
 * 存储适配器工厂
 * 根据环境自动选择合适的存储策略
 *
 * OAuth2 SPA标准：默认使用localStorage存储tokens
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
          // hybrid已废弃，重定向到oauth2-spa
          return new OAuth2SPAAdapter();
        case 'oauth2-spa':
          return new OAuth2SPAAdapter();
        case 'memory':
          return new MemoryStorageAdapter();
      }
    }

    // 自动检测环境
    if (typeof window === 'undefined') {
      // 服务端环境，使用cookie适配器（仅用于SSR）
      return new NextCookieAdapter(cookies);
    } else {
      // 客户端环境，使用OAuth2 SPA标准适配器
      return new OAuth2SPAAdapter();
    }
  }
}
