/**
 * License Service Types
 * 许可证服务类型定义
 */

// 许可证类型
export type LicenseType = 'subscription' | 'perpetual' | 'trial';

// 许可证状态
export type LicenseStatus = 'active' | 'expired' | 'revoked' | 'grace' | 'pending';

// 许可证接口
export interface License {
  id: string;
  pluginSlug: string;
  licenseKey: string;
  type: LicenseType;
  status: LicenseStatus;
  
  // 订阅详情
  startDate: Date;
  expiryDate: Date;
  gracePeriodDays: number;
  
  // 限制
  maxTenants?: number;
  maxDistributors?: number;
  maxAgents?: number;
  maxUsers?: number;
  
  // 功能列表
  features: string[];
  
  // 客户信息
  customerEmail: string;
  customerName: string;
  
  // 时间戳
  activatedAt?: Date;
  lastValidatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 许可证验证结果
export interface LicenseValidationResult {
  valid: boolean;
  license?: License;
  error?: string;
  errorCode?: string;
  gracePeriodDays?: number;
  remainingDays?: number;
  features?: string[];
}

// 许可证激活请求
export interface LicenseActivationRequest {
  pluginSlug: string;
  licenseKey: string;
  customerEmail?: string;
  customerName?: string;
}

// 许可证激活结果
export interface LicenseActivationResult {
  success: boolean;
  license?: License;
  error?: string;
  errorCode?: string;
}

// 许可证检查结果 (用于路由 preHandler)
export interface LicenseCheckResult {
  valid: boolean;
  reason?: string;
  upgradeUrl?: string;
  features?: string[];
  expiresAt?: Date;
  gracePeriod?: boolean;
}

// 使用量限制检查结果
export interface UsageLimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  percentage: number;
  metric: string;
  resetAt?: Date;
}

// 缓存的许可证数据
export interface CachedLicense {
  license: License;
  cachedAt: Date;
  expiresAt: Date;
}

// 许可证服务配置
export interface LicenseServiceConfig {
  // 许可证服务器 URL (用于在线验证)
  licenseServerUrl?: string;
  
  // 离线缓存有效期 (天)
  offlineCacheDays: number;
  
  // 宽限期 (天)
  defaultGracePeriodDays: number;
  
  // 验证间隔 (小时)
  validationIntervalHours: number;
  
  // 是否启用离线模式
  enableOfflineMode: boolean;
}

// 默认配置
export const DEFAULT_LICENSE_CONFIG: LicenseServiceConfig = {
  licenseServerUrl: undefined,
  offlineCacheDays: 7,
  defaultGracePeriodDays: 7,
  validationIntervalHours: 24,
  enableOfflineMode: true,
};

