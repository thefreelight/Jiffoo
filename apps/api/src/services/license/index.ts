/**
 * License Service
 * 许可证服务 - 管理商业插件的许可证验证、激活和停用
 */

import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import {
  License,
  LicenseType,
  LicenseStatus,
  LicenseValidationResult,
  LicenseActivationRequest,
  LicenseActivationResult,
  LicenseCheckResult,
  CachedLicense,
  LicenseServiceConfig,
  DEFAULT_LICENSE_CONFIG,
} from './types';
import { LoggerService } from '@/core/logger/unified-logger';

// 内存缓存
const licenseCache = new Map<string, CachedLicense>();

export class LicenseService {
  private prisma: PrismaClient;
  private config: LicenseServiceConfig;

  constructor(prisma: PrismaClient, config?: Partial<LicenseServiceConfig>) {
    this.prisma = prisma;
    this.config = { ...DEFAULT_LICENSE_CONFIG, ...config };
  }

  /**
   * 验证许可证密钥
   */
  async validate(pluginSlug: string, licenseKey: string): Promise<LicenseValidationResult> {
    try {
      // 1. 先检查本地数据库
      const dbLicense = await this.prisma.pluginLicense.findFirst({
        where: {
          pluginId: pluginSlug,
          status: { in: ['ACTIVE', 'GRACE'] },
        },
        include: { plugin: true },
      });

      if (!dbLicense) {
        return { valid: false, error: 'License not found', errorCode: 'LICENSE_NOT_FOUND' };
      }

      // 2. 验证许可证密钥
      const keyHash = this.hashLicenseKey(licenseKey);
      // 简化验证：在实际实现中应该比对加密后的密钥
      
      // 3. 检查过期
      const now = new Date();
      const license = this.mapDbLicense(dbLicense);
      
      if (license.expiryDate < now) {
        const gracePeriodEnd = new Date(license.expiryDate);
        gracePeriodEnd.setDate(gracePeriodEnd.getDate() + license.gracePeriodDays);
        
        if (now > gracePeriodEnd) {
          return { valid: false, error: 'License expired', errorCode: 'LICENSE_EXPIRED' };
        }
        
        return {
          valid: true,
          license,
          gracePeriodDays: Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        };
      }

      // 4. 更新最后验证时间
      await this.prisma.pluginLicense.update({
        where: { id: dbLicense.id },
        data: { updatedAt: now },
      });

      // 5. 缓存许可证
      this.cacheLicense(pluginSlug, license);

      return {
        valid: true,
        license,
        remainingDays: Math.ceil((license.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        features: license.features,
      };
    } catch (error) {
      LoggerService.logError(error as Error, { context: 'LicenseService.validate', pluginSlug });
      return { valid: false, error: 'Validation failed', errorCode: 'VALIDATION_ERROR' };
    }
  }

  /**
   * 激活许可证
   */
  async activate(request: LicenseActivationRequest): Promise<LicenseActivationResult> {
    const { pluginSlug, licenseKey, customerEmail, customerName } = request;

    try {
      // 检查插件是否存在
      const plugin = await this.prisma.plugin.findUnique({ where: { slug: pluginSlug } });
      if (!plugin) {
        return { success: false, error: 'Plugin not found', errorCode: 'PLUGIN_NOT_FOUND' };
      }

      // 检查是否已有激活的许可证
      const existing = await this.prisma.pluginLicense.findFirst({
        where: { pluginId: pluginSlug, status: 'ACTIVE' },
      });
      if (existing) {
        return { success: false, error: 'License already activated', errorCode: 'ALREADY_ACTIVATED' };
      }

      // 创建许可证记录
      const now = new Date();
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1); // 默认1年有效期

      const dbLicense = await this.prisma.pluginLicense.create({
        data: {
          pluginId: pluginSlug,
          status: 'ACTIVE',
          purchaseDate: now,
          activatedAt: now,
          amount: 0, // 由外部系统设置
          currency: 'USD',
        },
      });

      const license = this.mapDbLicense(dbLicense);
      this.cacheLicense(pluginSlug, license);

      LoggerService.logSystem(`License activated for plugin: ${pluginSlug}`);
      return { success: true, license };
    } catch (error) {
      LoggerService.logError(error as Error, { context: 'LicenseService.activate', pluginSlug });
      return { success: false, error: 'Activation failed', errorCode: 'ACTIVATION_ERROR' };
    }
  }

  /**
   * 停用许可证
   */
  async deactivate(pluginSlug: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.prisma.pluginLicense.updateMany({
        where: { pluginId: pluginSlug, status: 'ACTIVE' },
        data: { status: 'REVOKED', deactivatedAt: new Date() },
      });

      licenseCache.delete(pluginSlug);
      LoggerService.logSystem(`License deactivated for plugin: ${pluginSlug}`);
      return { success: true };
    } catch (error) {
      LoggerService.logError(error as Error, { context: 'LicenseService.deactivate', pluginSlug });
      return { success: false, error: 'Deactivation failed' };
    }
  }

  /**
   * 检查许可证状态 (用于路由 preHandler)
   */
  async checkLicense(pluginSlug: string, feature?: string): Promise<LicenseCheckResult> {
    // 1. 先检查缓存
    const cached = this.getCachedLicense(pluginSlug);
    if (cached && this.isCacheValid(cached)) {
      const license = cached.license;

      // 检查功能权限
      if (feature && !license.features.includes(feature) && !license.features.includes('*')) {
        return {
          valid: false,
          reason: `Feature "${feature}" not included in license`,
          upgradeUrl: `/plugins/${pluginSlug}/upgrade`,
        };
      }

      return {
        valid: true,
        features: license.features,
        expiresAt: license.expiryDate,
        gracePeriod: license.status === 'grace',
      };
    }

    // 2. 从数据库查询
    const dbLicense = await this.prisma.pluginLicense.findFirst({
      where: {
        pluginId: pluginSlug,
        status: { in: ['ACTIVE', 'GRACE'] },
      },
    });

    if (!dbLicense) {
      return {
        valid: false,
        reason: 'No active license found',
        upgradeUrl: `/plugins/${pluginSlug}/purchase`,
      };
    }

    const license = this.mapDbLicense(dbLicense);
    this.cacheLicense(pluginSlug, license);

    // 检查功能权限
    if (feature && !license.features.includes(feature) && !license.features.includes('*')) {
      return {
        valid: false,
        reason: `Feature "${feature}" not included in license`,
        upgradeUrl: `/plugins/${pluginSlug}/upgrade`,
      };
    }

    return {
      valid: true,
      features: license.features,
      expiresAt: license.expiryDate,
      gracePeriod: license.status === 'grace',
    };
  }

  /**
   * 获取许可证状态
   */
  async getStatus(pluginSlug: string): Promise<{ status: LicenseStatus | 'none'; license?: License }> {
    const dbLicense = await this.prisma.pluginLicense.findFirst({
      where: { pluginId: pluginSlug },
      orderBy: { createdAt: 'desc' },
    });

    if (!dbLicense) {
      return { status: 'none' };
    }

    return {
      status: dbLicense.status.toLowerCase() as LicenseStatus,
      license: this.mapDbLicense(dbLicense),
    };
  }

  /**
   * 获取所有许可证
   */
  async getAllLicenses(): Promise<License[]> {
    const dbLicenses = await this.prisma.pluginLicense.findMany({
      include: { plugin: true },
      orderBy: { createdAt: 'desc' },
    });

    return dbLicenses.map(l => this.mapDbLicense(l));
  }

  // ============================================
  // 私有方法
  // ============================================

  private getCachedLicense(pluginSlug: string): CachedLicense | null {
    return licenseCache.get(pluginSlug) || null;
  }

  private cacheLicense(pluginSlug: string, license: License): void {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.config.offlineCacheDays);

    licenseCache.set(pluginSlug, {
      license,
      cachedAt: new Date(),
      expiresAt,
    });
  }

  private isCacheValid(cached: CachedLicense): boolean {
    return cached.expiresAt > new Date();
  }

  private hashLicenseKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  private mapDbLicense(dbLicense: any): License {
    const now = new Date();
    const expiryDate = new Date(dbLicense.purchaseDate);
    expiryDate.setFullYear(expiryDate.getFullYear() + 1); // 默认1年有效期

    return {
      id: dbLicense.id,
      pluginSlug: dbLicense.pluginId,
      licenseKey: '****-****-****', // 不返回实际密钥
      type: 'perpetual' as LicenseType,
      status: dbLicense.status.toLowerCase() as LicenseStatus,
      startDate: dbLicense.purchaseDate,
      expiryDate,
      gracePeriodDays: 7,
      features: ['*'], // 默认所有功能
      customerEmail: '',
      customerName: '',
      activatedAt: dbLicense.activatedAt,
      lastValidatedAt: dbLicense.updatedAt,
      createdAt: dbLicense.createdAt,
      updatedAt: dbLicense.updatedAt,
    };
  }
}

// 单例实例
let licenseServiceInstance: LicenseService | null = null;

export function getLicenseService(prisma: PrismaClient): LicenseService {
  if (!licenseServiceInstance) {
    licenseServiceInstance = new LicenseService(prisma);
  }
  return licenseServiceInstance;
}

export * from './types';

