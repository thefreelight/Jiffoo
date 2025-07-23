import { prisma } from '@/config/database';
import { redisCache } from '@/core/cache/redis';
import crypto from 'crypto';

export interface TenantRegistration {
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  agencyLevel: 'basic' | 'industry' | 'global';
  domain?: string;
  subdomain?: string;
  branding?: TenantBranding;
}

export interface TenantBranding {
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  companyName?: string;
  website?: string;
  supportEmail?: string;
  supportPhone?: string;
}

export interface PriceControlConfig {
  productType: 'plugin' | 'saas-app' | 'template';
  productId: string;
  productName: string;
  basePrice: number;
  currency: string;
  minMargin: number;
  maxDiscount: number;
}

export interface TenantPricingRequest {
  tenantId: string;
  priceControlId: string;
  sellingPrice: number;
}

export class TenantManager {
  private agencyFees = {
    basic: 10000,    // $10,000 - 区域代理
    industry: 25000, // $25,000 - 行业代理
    global: 100000   // $100,000 - 全球代理
  };

  /**
   * 注册新租户
   */
  async registerTenant(registration: TenantRegistration): Promise<{
    success: boolean;
    tenantId?: string;
    agencyFee?: number;
    error?: string;
  }> {
    try {
      // 1. 验证邮箱和域名唯一性
      const existingTenant = await prisma.tenant.findFirst({
        where: {
          OR: [
            { contactEmail: registration.contactEmail },
            ...(registration.domain ? [{ domain: registration.domain }] : []),
            ...(registration.subdomain ? [{ subdomain: registration.subdomain }] : [])
          ]
        }
      });

      if (existingTenant) {
        return { success: false, error: 'Email, domain, or subdomain already exists' };
      }

      // 2. 计算代理费
      const agencyFee = this.agencyFees[registration.agencyLevel];

      // 3. 创建租户记录
      const tenant = await prisma.tenant.create({
        data: {
          companyName: registration.companyName,
          contactName: registration.contactName,
          contactEmail: registration.contactEmail,
          contactPhone: registration.contactPhone,
          agencyFee,
          agencyLevel: registration.agencyLevel,
          domain: registration.domain,
          subdomain: registration.subdomain,
          branding: JSON.stringify(registration.branding || {}),
          settings: JSON.stringify({
            timezone: 'UTC',
            currency: 'USD',
            language: 'en'
          }),
          status: 'pending'
        }
      });

      return {
        success: true,
        tenantId: tenant.id,
        agencyFee
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed'
      };
    }
  }

  /**
   * 激活租户 (支付代理费后)
   */
  async activateTenant(tenantId: string, paymentReference?: string): Promise<boolean> {
    try {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          agencyFeePaid: true,
          status: 'active',
          contractStart: new Date(),
          contractEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1年后
        }
      });

      // 清除缓存
      await this.clearTenantCache(tenantId);

      return true;
    } catch (error) {
      console.error('Failed to activate tenant:', error);
      return false;
    }
  }

  /**
   * 设置产品价格控制
   */
  async setPriceControl(config: PriceControlConfig): Promise<string> {
    const priceControl = await prisma.priceControl.upsert({
      where: {
        productType_productId: {
          productType: config.productType,
          productId: config.productId
        }
      },
      update: {
        productName: config.productName,
        basePrice: config.basePrice,
        currency: config.currency,
        minMargin: config.minMargin,
        maxDiscount: config.maxDiscount,
        effectiveDate: new Date()
      },
      create: {
        productType: config.productType,
        productId: config.productId,
        productName: config.productName,
        basePrice: config.basePrice,
        currency: config.currency,
        minMargin: config.minMargin,
        maxDiscount: config.maxDiscount
      }
    });

    // 清除相关缓存
    await redisCache.del(`price-control:${config.productType}:${config.productId}`);

    return priceControl.id;
  }

  /**
   * 验证租户定价
   */
  async validateTenantPricing(request: TenantPricingRequest): Promise<{
    valid: boolean;
    error?: string;
    priceControl?: any;
  }> {
    try {
      // 1. 获取价格控制信息
      const priceControl = await prisma.priceControl.findUnique({
        where: { id: request.priceControlId }
      });

      if (!priceControl) {
        return { valid: false, error: 'Price control not found' };
      }

      // 2. 验证最低价格
      if (request.sellingPrice < priceControl.basePrice) {
        return {
          valid: false,
          error: `Selling price ${request.sellingPrice} is below base price ${priceControl.basePrice}`
        };
      }

      // 3. 验证最低加价幅度
      const marginPercent = ((request.sellingPrice - priceControl.basePrice) / priceControl.basePrice) * 100;
      if (marginPercent < priceControl.minMargin) {
        return {
          valid: false,
          error: `Margin ${marginPercent.toFixed(2)}% is below minimum ${priceControl.minMargin}%`
        };
      }

      return { valid: true, priceControl };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Validation failed'
      };
    }
  }

  /**
   * 设置租户定价
   */
  async setTenantPricing(request: TenantPricingRequest): Promise<{
    success: boolean;
    pricingId?: string;
    error?: string;
  }> {
    try {
      // 1. 验证定价
      const validation = await this.validateTenantPricing(request);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const priceControl = validation.priceControl!;

      // 2. 计算加价信息
      const marginAmount = request.sellingPrice - priceControl.basePrice;
      const marginPercent = (marginAmount / priceControl.basePrice) * 100;

      // 3. 创建或更新租户定价
      const tenantPricing = await prisma.tenantPricing.upsert({
        where: {
          tenantId_priceControlId: {
            tenantId: request.tenantId,
            priceControlId: request.priceControlId
          }
        },
        update: {
          sellingPrice: request.sellingPrice,
          marginAmount,
          marginPercent
        },
        create: {
          tenantId: request.tenantId,
          priceControlId: request.priceControlId,
          sellingPrice: request.sellingPrice,
          marginAmount,
          marginPercent
        }
      });

      // 4. 清除缓存
      await this.clearTenantPricingCache(request.tenantId, request.priceControlId);

      return {
        success: true,
        pricingId: tenantPricing.id
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set pricing'
      };
    }
  }

  /**
   * 获取租户定价
   */
  async getTenantPricing(tenantId: string, productType?: string): Promise<any[]> {
    const cacheKey = `tenant-pricing:${tenantId}:${productType || 'all'}`;
    const cached = await redisCache.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached as string);
    }

    const pricing = await prisma.tenantPricing.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(productType && {
          priceControl: {
            productType
          }
        })
      },
      include: {
        priceControl: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const result = pricing.map(p => ({
      id: p.id,
      productType: p.priceControl.productType,
      productId: p.priceControl.productId,
      productName: p.priceControl.productName,
      basePrice: p.priceControl.basePrice,
      sellingPrice: p.sellingPrice,
      marginAmount: p.marginAmount,
      marginPercent: p.marginPercent,
      currency: p.priceControl.currency,
      updatedAt: p.updatedAt
    }));

    await redisCache.set(cacheKey, JSON.stringify(result), 3600);
    return result;
  }

  /**
   * 授权租户产品
   */
  async grantTenantLicense(
    tenantId: string,
    productType: string,
    productId: string,
    licenseConfig: {
      licenseType: 'oem' | 'reseller' | 'distributor';
      authorizedFeatures: string[];
      brandingRights: boolean;
      resaleRights: boolean;
      maxUsers?: number;
      maxInstances?: number;
      expiresAt?: Date;
    }
  ): Promise<string> {
    const license = await prisma.tenantLicense.upsert({
      where: {
        tenantId_productType_productId: {
          tenantId,
          productType,
          productId
        }
      },
      update: {
        licenseType: licenseConfig.licenseType,
        authorizedFeatures: JSON.stringify(licenseConfig.authorizedFeatures),
        brandingRights: licenseConfig.brandingRights,
        resaleRights: licenseConfig.resaleRights,
        maxUsers: licenseConfig.maxUsers,
        maxInstances: licenseConfig.maxInstances,
        expiresAt: licenseConfig.expiresAt,
        isActive: true
      },
      create: {
        tenantId,
        productType,
        productId,
        licenseType: licenseConfig.licenseType,
        authorizedFeatures: JSON.stringify(licenseConfig.authorizedFeatures),
        brandingRights: licenseConfig.brandingRights,
        resaleRights: licenseConfig.resaleRights,
        maxUsers: licenseConfig.maxUsers,
        maxInstances: licenseConfig.maxInstances,
        expiresAt: licenseConfig.expiresAt,
        isActive: true
      }
    });

    // 清除缓存
    await redisCache.del(`tenant-licenses:${tenantId}`);

    return license.id;
  }

  /**
   * 验证租户许可证
   */
  async validateTenantLicense(
    tenantId: string,
    productType: string,
    productId: string
  ): Promise<{
    valid: boolean;
    license?: any;
    reason?: string;
  }> {
    try {
      const license = await prisma.tenantLicense.findUnique({
        where: {
          tenantId_productType_productId: {
            tenantId,
            productType,
            productId
          }
        }
      });

      if (!license) {
        return { valid: false, reason: 'No license found' };
      }

      if (!license.isActive) {
        return { valid: false, reason: 'License is inactive' };
      }

      if (license.expiresAt && license.expiresAt < new Date()) {
        return { valid: false, reason: 'License has expired' };
      }

      return {
        valid: true,
        license: {
          id: license.id,
          licenseType: license.licenseType,
          authorizedFeatures: JSON.parse(license.authorizedFeatures),
          brandingRights: license.brandingRights,
          resaleRights: license.resaleRights,
          maxUsers: license.maxUsers,
          maxInstances: license.maxInstances,
          expiresAt: license.expiresAt
        }
      };
    } catch (error) {
      return {
        valid: false,
        reason: error instanceof Error ? error.message : 'Validation failed'
      };
    }
  }

  /**
   * 获取租户信息
   */
  async getTenant(tenantId: string): Promise<any | null> {
    const cacheKey = `tenant:${tenantId}`;
    const cached = await redisCache.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached as string);
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true
              }
            }
          }
        },
        licenses: {
          where: { isActive: true }
        },
        pricing: {
          where: { isActive: true },
          include: {
            priceControl: true
          }
        }
      }
    });

    if (!tenant) return null;

    const result = {
      id: tenant.id,
      companyName: tenant.companyName,
      contactName: tenant.contactName,
      contactEmail: tenant.contactEmail,
      contactPhone: tenant.contactPhone,
      agencyLevel: tenant.agencyLevel,
      agencyFee: tenant.agencyFee,
      agencyFeePaid: tenant.agencyFeePaid,
      status: tenant.status,
      domain: tenant.domain,
      subdomain: tenant.subdomain,
      branding: JSON.parse(tenant.branding),
      settings: JSON.parse(tenant.settings),
      contractStart: tenant.contractStart,
      contractEnd: tenant.contractEnd,
      users: tenant.users,
      licenses: tenant.licenses,
      pricing: tenant.pricing,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt
    };

    await redisCache.set(cacheKey, JSON.stringify(result), 3600);
    return result;
  }

  /**
   * 清除租户缓存
   */
  private async clearTenantCache(tenantId: string): Promise<void> {
    await Promise.all([
      redisCache.del(`tenant:${tenantId}`),
      redisCache.del(`tenant-licenses:${tenantId}`),
      redisCache.del(`tenant-pricing:${tenantId}:all`)
    ]);
  }

  /**
   * 清除租户定价缓存
   */
  private async clearTenantPricingCache(tenantId: string, priceControlId: string): Promise<void> {
    const priceControl = await prisma.priceControl.findUnique({
      where: { id: priceControlId }
    });

    if (priceControl) {
      await Promise.all([
        redisCache.del(`tenant-pricing:${tenantId}:all`),
        redisCache.del(`tenant-pricing:${tenantId}:${priceControl.productType}`)
      ]);
    }
  }
}

// 单例实例
export const tenantManager = new TenantManager();
