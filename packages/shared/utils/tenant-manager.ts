/**
 * 统一的租户管理器
 * 为所有前端应用提供一致的租户上下文管理
 */

import { TenantInfo } from '../api/client';

// 存储适配器接口
interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// 浏览器localStorage适配器
class LocalStorageAdapter implements StorageAdapter {
  getItem(key: string): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(key);
  }

  setItem(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, value);
  }

  removeItem(key: string): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
  }
}

// Cookie适配器
class CookieAdapter implements StorageAdapter {
  getItem(key: string): string | null {
    if (typeof document === 'undefined') return null;
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === key) {
        return decodeURIComponent(value);
      }
    }
    return null;
  }

  setItem(key: string, value: string): void {
    if (typeof document === 'undefined') return;
    const expires = new Date();
    expires.setDate(expires.getDate() + 30); // 30天过期
    document.cookie = `${key}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; SameSite=Strict`;
  }

  removeItem(key: string): void {
    if (typeof document === 'undefined') return;
    document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  }
}

// 租户变更事件类型
interface TenantChangeEvent {
  previousTenant: TenantInfo | null;
  currentTenant: TenantInfo | null;
  timestamp: Date;
}

// 事件监听器类型
type TenantChangeListener = (event: TenantChangeEvent) => void;

// 统一租户管理器类
export class UnifiedTenantManager {
  private static instance: UnifiedTenantManager;
  private storage: StorageAdapter;
  private tenantKey: string = 'current_tenant';
  private tenantIdKey: string = 'tenant_id';
  private listeners: Set<TenantChangeListener> = new Set();
  private currentTenant: TenantInfo | null = null;

  private constructor(storage?: StorageAdapter) {
    this.storage = storage || new LocalStorageAdapter();
    this.initializeTenantContext();
  }

  public static getInstance(storage?: StorageAdapter): UnifiedTenantManager {
    if (!UnifiedTenantManager.instance) {
      UnifiedTenantManager.instance = new UnifiedTenantManager(storage);
    }
    return UnifiedTenantManager.instance;
  }

  // 初始化租户上下文
  private initializeTenantContext(): void {
    try {
      const storedTenant = this.storage.getItem(this.tenantKey);
      if (storedTenant) {
        this.currentTenant = JSON.parse(storedTenant);
      }
    } catch (error) {
      console.error('Failed to initialize tenant context:', error);
      this.clearTenantInfo();
    }
  }

  // 获取当前租户信息
  public getCurrentTenantInfo(): TenantInfo | null {
    return this.currentTenant;
  }

  // 获取当前租户ID
  public getCurrentTenantId(): string | null {
    return this.currentTenant?.id || this.storage.getItem(this.tenantIdKey);
  }

  // 设置当前租户信息
  public setCurrentTenantInfo(tenantInfo: TenantInfo | null): void {
    const previousTenant = this.currentTenant;
    this.currentTenant = tenantInfo;

    if (tenantInfo) {
      // 保存完整的租户信息
      this.storage.setItem(this.tenantKey, JSON.stringify(tenantInfo));
      this.storage.setItem(this.tenantIdKey, tenantInfo.id);
    } else {
      // 清除租户信息
      this.storage.removeItem(this.tenantKey);
      this.storage.removeItem(this.tenantIdKey);
    }

    // 触发租户变更事件
    this.notifyTenantChange(previousTenant, tenantInfo);
  }

  // 切换租户
  public switchTenant(tenantInfo: TenantInfo): void {
    this.setCurrentTenantInfo(tenantInfo);
  }

  // 清除租户信息
  public clearTenantInfo(): void {
    this.setCurrentTenantInfo(null);
  }

  // 检查是否有租户上下文
  public hasTenantContext(): boolean {
    return !!this.getCurrentTenantId();
  }

  // 获取租户设置
  public getTenantSetting<T = any>(key: string, defaultValue?: T): T {
    const tenant = this.getCurrentTenantInfo();
    if (!tenant || !tenant.settings) {
      return defaultValue as T;
    }
    return tenant.settings[key] ?? defaultValue;
  }

  // 更新租户设置
  public updateTenantSetting(key: string, value: any): void {
    const tenant = this.getCurrentTenantInfo();
    if (!tenant) {
      console.warn('No current tenant to update settings for');
      return;
    }

    const updatedTenant: TenantInfo = {
      ...tenant,
      settings: {
        ...tenant.settings,
        [key]: value
      }
    };

    this.setCurrentTenantInfo(updatedTenant);
  }

  // 批量更新租户设置
  public updateTenantSettings(settings: Record<string, any>): void {
    const tenant = this.getCurrentTenantInfo();
    if (!tenant) {
      console.warn('No current tenant to update settings for');
      return;
    }

    const updatedTenant: TenantInfo = {
      ...tenant,
      settings: {
        ...tenant.settings,
        ...settings
      }
    };

    this.setCurrentTenantInfo(updatedTenant);
  }

  // 添加租户变更监听器
  public addTenantChangeListener(listener: TenantChangeListener): void {
    this.listeners.add(listener);
  }

  // 移除租户变更监听器
  public removeTenantChangeListener(listener: TenantChangeListener): void {
    this.listeners.delete(listener);
  }

  // 通知租户变更
  private notifyTenantChange(previousTenant: TenantInfo | null, currentTenant: TenantInfo | null): void {
    const event: TenantChangeEvent = {
      previousTenant,
      currentTenant,
      timestamp: new Date()
    };

    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in tenant change listener:', error);
      }
    });
  }

  // 验证租户ID格式
  public isValidTenantId(tenantId: string): boolean {
    if (!tenantId || typeof tenantId !== 'string') {
      return false;
    }
    
    // 基本格式验证：只允许字母数字、连字符和下划线
    const tenantIdRegex = /^[a-zA-Z0-9_-]+$/;
    return tenantIdRegex.test(tenantId) && tenantId.length >= 1 && tenantId.length <= 50;
  }

  // 从URL中提取租户ID（如果使用子域名）
  public extractTenantIdFromUrl(url?: string): string | null {
    const targetUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
    if (!targetUrl) return null;

    try {
      const urlObj = new URL(targetUrl);
      const hostname = urlObj.hostname;
      
      // 检查是否为子域名格式（如：tenant.example.com）
      const parts = hostname.split('.');
      if (parts.length >= 3) {
        const subdomain = parts[0];
        // 排除常见的非租户子域名
        const excludedSubdomains = ['www', 'api', 'admin', 'app', 'cdn', 'static'];
        if (!excludedSubdomains.includes(subdomain) && this.isValidTenantId(subdomain)) {
          return subdomain;
        }
      }
    } catch (error) {
      console.error('Failed to extract tenant ID from URL:', error);
    }

    return null;
  }

  // 生成租户特定的缓存键
  public getTenantCacheKey(baseKey: string): string {
    const tenantId = this.getCurrentTenantId();
    return tenantId ? `${baseKey}:${tenantId}` : baseKey;
  }

  // 检查当前用户是否可以访问指定租户
  public canAccessTenant(tenantId: string): boolean {
    const currentTenantId = this.getCurrentTenantId();
    
    // 如果没有当前租户，则不能访问任何租户
    if (!currentTenantId) {
      return false;
    }

    // 如果是同一个租户，则可以访问
    if (currentTenantId === tenantId) {
      return true;
    }

    // 这里可以添加更复杂的权限检查逻辑
    // 例如：检查用户是否有跨租户访问权限
    return false;
  }

  // 重置管理器状态（主要用于测试）
  public reset(): void {
    this.clearTenantInfo();
    this.listeners.clear();
  }
}

// 导出默认实例（使用localStorage）
export const tenantManager = UnifiedTenantManager.getInstance();

// 导出Cookie版本的实例
export const cookieTenantManager = UnifiedTenantManager.getInstance(new CookieAdapter());

// 导出类型
export type { TenantChangeEvent, TenantChangeListener };
