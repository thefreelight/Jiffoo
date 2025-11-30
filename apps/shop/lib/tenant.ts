/**
 * 租户管理工具函数
 * 重构为委托给共享的租户管理器，避免重复逻辑
 */

import { UnifiedTenantManager, type TenantInfo } from 'shared';

// 导出类型以保持兼容性
export type { TenantInfo };

/**
 * 租户管理类 - 委托给共享的UnifiedTenantManager
 */
export class TenantManager {
  private static sharedManager = UnifiedTenantManager.getInstance();

  /**
   * 获取当前租户ID
   */
  static getCurrentTenantId(): string | null {
    return this.sharedManager.getCurrentTenantId();
  }

  /**
   * 设置当前租户ID
   */
  static setCurrentTenantId(tenantId: string | null): void {
    // 🔧 修复方法调用：UnifiedTenantManager没有setCurrentTenantId方法
    // 需要构造TenantInfo对象或清除租户信息
    if (tenantId) {
      // 如果只有ID，构造最小的TenantInfo对象
      const tenantInfo = { id: tenantId, name: '', domain: '', settings: {} };
      this.sharedManager.setCurrentTenantInfo(tenantInfo);
    } else {
      this.sharedManager.clearTenantInfo();
    }
  }

  /**
   * 获取当前租户信息
   */
  static getCurrentTenantInfo(): TenantInfo | null {
    // 🔧 修复方法调用：使用正确的方法名
    return this.sharedManager.getCurrentTenantInfo();
  }

  /**
   * 设置当前租户信息
   */
  static setCurrentTenantInfo(tenantInfo: TenantInfo | null): void {
    // 🔧 修复方法调用：使用正确的方法名
    this.sharedManager.setCurrentTenantInfo(tenantInfo);
  }

  /**
   * 切换租户
   * @param tenantInfo 完整的租户信息对象
   */
  static switchTenant(tenantInfo: TenantInfo): void {
    this.sharedManager.switchTenant(tenantInfo);
  }

  /**
   * 通过租户ID切换租户（便捷方法）
   * @param tenantId 租户ID
   */
  static async switchTenantById(tenantId: string): Promise<boolean> {
    try {
      // 首先获取租户信息
      const apiClient = (await import('./api')).default;
      const response = await apiClient.get(`/api/tenants/${tenantId}`);

      if (response.success && response.data) {
        this.switchTenant(response.data as unknown as TenantInfo);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to switch tenant:', error);
      return false;
    }
  }

  /**
   * 清除租户信息
   */
  static clearTenantInfo(): void {
    // 🔧 修复方法调用：使用正确的方法名
    this.sharedManager.clearTenantInfo();
  }

  /**
   * 监听租户变化
   */
  static onTenantChange(listener: (tenant: TenantInfo | null) => void): () => void {
    // 🔧 修复方法调用：使用正确的方法名和参数格式
    const wrappedListener = (event: { currentTenant: TenantInfo | null }) => {
      listener(event.currentTenant);
    };
    this.sharedManager.addTenantChangeListener(wrappedListener);

    // 返回取消监听的函数
    return () => {
      this.sharedManager.removeTenantChangeListener(wrappedListener);
    };
  }

  /**
   * 检查是否在多租户环境中
   */
  static isMultiTenant(): boolean {
    return this.getCurrentTenantId() !== null;
  }

  /**
   * 从域名推断租户ID（如果使用子域名模式）
   */
  static inferTenantFromDomain(): string | null {
    if (typeof window === 'undefined') return null;
    
    const hostname = window.location.hostname;
    
    // 检查是否是子域名模式 (tenant.example.com)
    const parts = hostname.split('.');
    if (parts.length >= 3) {
      const subdomain = parts[0];
      // 排除常见的非租户子域名
      if (!['www', 'api', 'admin', 'app'].includes(subdomain)) {
        return subdomain;
      }
    }
    
    return null;
  }

  /**
   * 初始化租户上下文
   * 在应用启动时调用，尝试从域名或存储中获取租户信息
   */
  static initializeTenantContext(): void {
    if (typeof window === 'undefined') return;
    
    // 首先尝试从域名推断
    const domainTenantId = this.inferTenantFromDomain();
    if (domainTenantId) {
      const currentTenantId = this.getCurrentTenantId();
      // 如果域名中的租户ID与存储的不同，更新存储
      if (currentTenantId !== domainTenantId) {
        this.setCurrentTenantId(domainTenantId);
      }
    }
  }

  /**
   * 构建租户感知的API URL
   * 统一使用Header方式传递租户ID，不再使用路径参数
   * @deprecated 路径方式已废弃，请使用Header方式
   */
  static buildTenantAwareUrl(baseUrl: string, path: string): string {
    // 统一使用原始路径，租户ID通过Header传递
    return `${baseUrl}${path}`;
  }

  /**
   * 获取租户感知的请求头
   * 返回包含X-Tenant-ID的请求头对象
   */
  static getTenantHeaders(): Record<string, string> {
    const tenantId = this.getCurrentTenantId();
    const headers: Record<string, string> = {};

    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }

    return headers;
  }
}

/**
 * React Hook for tenant management
 */
export function useTenant() {
  const getCurrentTenantId = () => TenantManager.getCurrentTenantId();
  const getCurrentTenantInfo = () => TenantManager.getCurrentTenantInfo();
  const setCurrentTenantInfo = (info: TenantInfo | null) => TenantManager.setCurrentTenantInfo(info);
  const clearTenantInfo = () => TenantManager.clearTenantInfo();
  const isMultiTenant = () => TenantManager.isMultiTenant();

  return {
    tenantId: getCurrentTenantId(),
    tenantInfo: getCurrentTenantInfo(),
    setTenantInfo: setCurrentTenantInfo,
    clearTenantInfo,
    isMultiTenant: isMultiTenant(),
  };
}

/**
 * 租户上下文提供者的类型定义
 */
export interface TenantContextType {
  tenantId: string | null;
  tenantInfo: TenantInfo | null;
  setTenantInfo: (info: TenantInfo | null) => void;
  clearTenantInfo: () => void;
  isMultiTenant: boolean;
}
