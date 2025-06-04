import { prisma } from '@/config/database';
import { redisCache } from '@/core/cache/redis';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export interface LicenseRequest {
  userId: string;
  pluginName: string;
  licenseType: 'trial' | 'monthly' | 'yearly' | 'lifetime';
  features: string[];
  usageLimits?: Record<string, number>;
  expiresAt?: Date;
}

export interface LicenseValidation {
  valid: boolean;
  license?: any;
  reason?: string;
  features?: string[];
  usageLimits?: Record<string, number>;
  expiresAt?: Date;
  usageRemaining?: Record<string, number>;
}

export interface UsageTrackingRequest {
  licenseId: string;
  featureName: string;
  incrementBy?: number;
}

export class EnhancedLicenseManager {
  private readonly jwtSecret: string;
  private readonly encryptionKey: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'default-secret';
    this.encryptionKey = process.env.LICENSE_ENCRYPTION_KEY || 'default-encryption-key';
  }

  /**
   * 生成新的插件许可证
   */
  async generateLicense(request: LicenseRequest): Promise<string> {
    try {
      // 1. 创建许可证记录
      const license = await prisma.pluginLicense.create({
        data: {
          pluginName: request.pluginName,
          licenseKey: '', // 稍后生成
          userId: request.userId,
          licenseType: request.licenseType,
          features: JSON.stringify(request.features),
          usageLimits: request.usageLimits ? JSON.stringify(request.usageLimits) : null,
          expiresAt: request.expiresAt,
        },
      });

      // 2. 生成加密的许可证密钥
      const licenseData = {
        id: license.id,
        pluginName: request.pluginName,
        userId: request.userId,
        licenseType: request.licenseType,
        features: request.features,
        usageLimits: request.usageLimits,
        expiresAt: request.expiresAt?.toISOString(),
        issuedAt: new Date().toISOString(),
      };

      const licenseKey = this.generateSecureLicenseKey(licenseData);

      // 3. 更新许可证记录
      await prisma.pluginLicense.update({
        where: { id: license.id },
        data: { licenseKey },
      });

      // 4. 缓存许可证信息
      await this.cacheLicense(licenseKey, license.id);

      return licenseKey;
    } catch (error) {
      throw new Error(`Failed to generate license: ${error}`);
    }
  }

  /**
   * 验证插件许可证
   */
  async validateLicense(pluginName: string, userId: string): Promise<LicenseValidation> {
    try {
      // 1. 从数据库查找有效许可证
      const license = await prisma.pluginLicense.findFirst({
        where: {
          pluginName,
          userId,
          status: 'active',
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        },
        include: {
          usageRecords: true,
        },
      });

      if (!license) {
        return {
          valid: false,
          reason: 'No valid license found for this plugin',
        };
      }

      // 2. 验证许可证密钥
      const keyValidation = await this.validateLicenseKey(license.licenseKey);
      if (!keyValidation.valid) {
        return {
          valid: false,
          reason: 'Invalid license key',
        };
      }

      // 3. 检查使用限制
      const features = JSON.parse(license.features);
      const usageLimits = license.usageLimits ? JSON.parse(license.usageLimits) : {};
      const usageRemaining = await this.calculateUsageRemaining(license.id, usageLimits);

      return {
        valid: true,
        license,
        features,
        usageLimits,
        expiresAt: license.expiresAt,
        usageRemaining,
      };
    } catch (error) {
      return {
        valid: false,
        reason: `License validation error: ${error}`,
      };
    }
  }

  /**
   * 跟踪功能使用情况
   */
  async trackUsage(request: UsageTrackingRequest): Promise<boolean> {
    try {
      const { licenseId, featureName, incrementBy = 1 } = request;

      // 1. 检查许可证是否存在且有效
      const license = await prisma.pluginLicense.findUnique({
        where: { id: licenseId, status: 'active' },
      });

      if (!license) {
        return false;
      }

      // 2. 检查使用限制
      const usageLimits = license.usageLimits ? JSON.parse(license.usageLimits) : {};
      if (usageLimits[featureName]) {
        const currentUsage = await this.getCurrentUsage(licenseId, featureName);
        if (currentUsage + incrementBy > usageLimits[featureName]) {
          throw new Error(`Usage limit exceeded for feature: ${featureName}`);
        }
      }

      // 3. 更新使用记录
      await prisma.pluginUsage.upsert({
        where: {
          licenseId_featureName: {
            licenseId,
            featureName,
          },
        },
        update: {
          usageCount: { increment: incrementBy },
          lastUsedAt: new Date(),
        },
        create: {
          licenseId,
          featureName,
          usageCount: incrementBy,
          lastUsedAt: new Date(),
        },
      });

      // 4. 更新缓存
      await this.updateUsageCache(licenseId, featureName, incrementBy);

      return true;
    } catch (error) {
      throw new Error(`Failed to track usage: ${error}`);
    }
  }

  /**
   * 撤销许可证
   */
  async revokeLicense(licenseId: string): Promise<void> {
    try {
      await prisma.pluginLicense.update({
        where: { id: licenseId },
        data: { status: 'revoked' },
      });

      // 清除缓存
      const license = await prisma.pluginLicense.findUnique({
        where: { id: licenseId },
      });

      if (license) {
        await this.clearLicenseCache(license.licenseKey);
      }
    } catch (error) {
      throw new Error(`Failed to revoke license: ${error}`);
    }
  }

  /**
   * 续费许可证
   */
  async renewLicense(licenseId: string, newExpiryDate: Date): Promise<void> {
    try {
      await prisma.pluginLicense.update({
        where: { id: licenseId },
        data: {
          expiresAt: newExpiryDate,
          status: 'active',
        },
      });

      // 更新缓存
      const license = await prisma.pluginLicense.findUnique({
        where: { id: licenseId },
      });

      if (license) {
        await this.cacheLicense(license.licenseKey, licenseId);
      }
    } catch (error) {
      throw new Error(`Failed to renew license: ${error}`);
    }
  }

  /**
   * 生成安全的许可证密钥
   */
  private generateSecureLicenseKey(licenseData: any): string {
    // 1. 创建JWT令牌
    const token = jwt.sign(licenseData, this.jwtSecret, {
      expiresIn: licenseData.expiresAt ? undefined : '10y', // 如果没有过期时间，设置10年
    });

    // 2. 加密JWT令牌
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // 3. 添加校验和
    const checksum = crypto.createHash('sha256').update(encrypted).digest('hex').substring(0, 8);

    return `${encrypted}.${checksum}`;
  }

  /**
   * 验证许可证密钥
   */
  private async validateLicenseKey(licenseKey: string): Promise<{ valid: boolean; data?: any }> {
    try {
      const [encrypted, checksum] = licenseKey.split('.');
      
      // 验证校验和
      const expectedChecksum = crypto.createHash('sha256').update(encrypted).digest('hex').substring(0, 8);
      if (checksum !== expectedChecksum) {
        return { valid: false };
      }

      // 解密
      const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      // 验证JWT
      const decoded = jwt.verify(decrypted, this.jwtSecret);
      
      return { valid: true, data: decoded };
    } catch (error) {
      return { valid: false };
    }
  }

  /**
   * 缓存许可证信息
   */
  private async cacheLicense(licenseKey: string, licenseId: string): Promise<void> {
    const cacheKey = `license:${licenseKey}`;
    await redisCache.set(cacheKey, licenseId, 3600); // 缓存1小时
  }

  /**
   * 清除许可证缓存
   */
  private async clearLicenseCache(licenseKey: string): Promise<void> {
    const cacheKey = `license:${licenseKey}`;
    await redisCache.del(cacheKey);
  }

  /**
   * 计算剩余使用量
   */
  private async calculateUsageRemaining(licenseId: string, usageLimits: Record<string, number>): Promise<Record<string, number>> {
    const remaining: Record<string, number> = {};

    for (const [feature, limit] of Object.entries(usageLimits)) {
      const currentUsage = await this.getCurrentUsage(licenseId, feature);
      remaining[feature] = Math.max(0, limit - currentUsage);
    }

    return remaining;
  }

  /**
   * 获取当前使用量
   */
  private async getCurrentUsage(licenseId: string, featureName: string): Promise<number> {
    const usage = await prisma.pluginUsage.findUnique({
      where: {
        licenseId_featureName: {
          licenseId,
          featureName,
        },
      },
    });

    return usage?.usageCount || 0;
  }

  /**
   * 更新使用量缓存
   */
  private async updateUsageCache(licenseId: string, featureName: string, increment: number): Promise<void> {
    const cacheKey = `usage:${licenseId}:${featureName}`;
    const current = await redisCache.get(cacheKey);
    const newValue = (current ? parseInt(current) : 0) + increment;
    await redisCache.set(cacheKey, newValue.toString(), 3600);
  }
}

// 单例实例
export const enhancedLicenseManager = new EnhancedLicenseManager();
