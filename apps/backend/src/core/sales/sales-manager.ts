import { prisma } from '@/config/database';
import { enhancedLicenseManager } from '@/core/licensing/enhanced-license-manager';
import { tenantManager } from '@/core/tenant/tenant-manager';

export interface SaleRequest {
  productType: 'plugin' | 'saas-app' | 'template';
  productId: string;
  productName: string;
  customerId: string;
  customerEmail: string;
  licenseType: 'trial' | 'monthly' | 'yearly' | 'lifetime';
  
  // 销售渠道
  channel: 'direct' | 'oem-tenant';
  tenantId?: string; // 如果是租户销售
  
  // 支付信息
  paymentMethod?: string;
  paymentReference?: string;
}

export interface SaleResult {
  success: boolean;
  saleId?: string;
  licenseKey?: string;
  error?: string;
  pricing?: {
    sellingPrice: number;
    basePrice: number;
    marginAmount: number;
    jiffooRevenue: number;
    tenantRevenue?: number;
  };
}

export class SalesManager {
  /**
   * 处理产品销售 (统一直销和OEM销售)
   */
  async processSale(request: SaleRequest): Promise<SaleResult> {
    try {
      // 1. 获取产品定价信息
      const pricingInfo = await this.getPricingInfo(request);
      if (!pricingInfo.success) {
        return { success: false, error: pricingInfo.error };
      }

      // 2. 验证租户权限 (如果是OEM销售)
      if (request.channel === 'oem-tenant' && request.tenantId) {
        const tenantValidation = await this.validateTenantSale(request);
        if (!tenantValidation.valid) {
          return { success: false, error: tenantValidation.error };
        }
      }

      // 3. 创建销售记录
      const sale = await prisma.sale.create({
        data: {
          productType: request.productType,
          productId: request.productId,
          productName: request.productName,
          customerId: request.customerId,
          customerEmail: request.customerEmail,
          channel: request.channel,
          tenantId: request.tenantId,
          sellingPrice: pricingInfo.pricing!.sellingPrice,
          basePrice: pricingInfo.pricing!.basePrice,
          marginAmount: pricingInfo.pricing!.marginAmount,
          marginPercent: pricingInfo.pricing!.marginPercent,
          jiffooRevenue: pricingInfo.pricing!.jiffooRevenue,
          tenantRevenue: pricingInfo.pricing!.tenantRevenue,
          platformFee: pricingInfo.pricing!.platformFee,
          licenseType: request.licenseType,
          paymentMethod: request.paymentMethod,
          paymentReference: request.paymentReference,
          paymentStatus: 'completed' // 简化处理，实际需要支付验证
        }
      });

      // 4. 生成许可证
      const licenseKey = await this.generateLicense(request, sale.id);

      // 5. 创建分润记录 (如果是OEM销售)
      if (request.channel === 'oem-tenant' && request.tenantId) {
        await this.createRevenueSharing(sale.id, request.tenantId, pricingInfo.pricing!);
      }

      // 6. 更新销售记录的许可证ID
      await prisma.sale.update({
        where: { id: sale.id },
        data: { licenseId: licenseKey }
      });

      return {
        success: true,
        saleId: sale.id,
        licenseKey,
        pricing: {
          sellingPrice: pricingInfo.pricing!.sellingPrice,
          basePrice: pricingInfo.pricing!.basePrice,
          marginAmount: pricingInfo.pricing!.marginAmount,
          jiffooRevenue: pricingInfo.pricing!.jiffooRevenue,
          tenantRevenue: pricingInfo.pricing!.tenantRevenue
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sale processing failed'
      };
    }
  }

  /**
   * 获取产品定价信息
   */
  private async getPricingInfo(request: SaleRequest): Promise<{
    success: boolean;
    pricing?: any;
    error?: string;
  }> {
    try {
      if (request.channel === 'direct') {
        // 直销定价 - 从产品配置获取
        const directPricing = await this.getDirectPricing(request.productType, request.productId);
        if (!directPricing) {
          return { success: false, error: 'Product pricing not found' };
        }

        return {
          success: true,
          pricing: {
            sellingPrice: directPricing.price,
            basePrice: directPricing.price,
            marginAmount: 0,
            marginPercent: 0,
            jiffooRevenue: directPricing.price,
            tenantRevenue: 0,
            platformFee: 0
          }
        };
      } else {
        // OEM销售定价 - 从租户定价获取
        const tenantPricing = await this.getTenantPricing(request.tenantId!, request.productType, request.productId);
        if (!tenantPricing) {
          return { success: false, error: 'Tenant pricing not found' };
        }

        const platformFeeRate = 0.1; // 10% 平台手续费
        const platformFee = tenantPricing.marginAmount * platformFeeRate;
        const jiffooRevenue = tenantPricing.basePrice + platformFee;
        const tenantRevenue = tenantPricing.marginAmount - platformFee;

        return {
          success: true,
          pricing: {
            sellingPrice: tenantPricing.sellingPrice,
            basePrice: tenantPricing.basePrice,
            marginAmount: tenantPricing.marginAmount,
            marginPercent: tenantPricing.marginPercent,
            jiffooRevenue,
            tenantRevenue,
            platformFee
          }
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get pricing info'
      };
    }
  }

  /**
   * 获取直销定价
   */
  private async getDirectPricing(productType: string, productId: string): Promise<any | null> {
    // 这里应该从产品配置中获取直销价格
    // 暂时使用硬编码的价格
    const directPrices: Record<string, Record<string, number>> = {
      plugin: {
        'advanced-analytics': 99,
        'marketing-automation': 149,
        'enterprise-integration': 299
      },
      'saas-app': {
        'custom-ecommerce': 50000,
        'restaurant-management': 30000,
        'inventory-system': 25000
      },
      template: {
        'modern-ecommerce': 49,
        'minimalist-store': 39,
        'enterprise-store': 199
      }
    };

    const price = directPrices[productType]?.[productId];
    return price ? { price } : null;
  }

  /**
   * 获取租户定价
   */
  private async getTenantPricing(tenantId: string, productType: string, productId: string): Promise<any | null> {
    const pricing = await prisma.tenantPricing.findFirst({
      where: {
        tenantId,
        isActive: true,
        priceControl: {
          productType,
          productId,
          isActive: true
        }
      },
      include: {
        priceControl: true
      }
    });

    if (!pricing) return null;

    return {
      sellingPrice: pricing.sellingPrice,
      basePrice: pricing.priceControl.basePrice,
      marginAmount: pricing.marginAmount,
      marginPercent: pricing.marginPercent
    };
  }

  /**
   * 验证租户销售权限
   */
  private async validateTenantSale(request: SaleRequest): Promise<{
    valid: boolean;
    error?: string;
  }> {
    try {
      // 1. 验证租户状态
      const tenant = await tenantManager.getTenant(request.tenantId!);
      if (!tenant) {
        return { valid: false, error: 'Tenant not found' };
      }

      if (tenant.status !== 'active') {
        return { valid: false, error: 'Tenant is not active' };
      }

      if (!tenant.agencyFeePaid) {
        return { valid: false, error: 'Agency fee not paid' };
      }

      // 2. 验证产品许可证
      const licenseValidation = await tenantManager.validateTenantLicense(
        request.tenantId!,
        request.productType,
        request.productId
      );

      if (!licenseValidation.valid) {
        return { valid: false, error: licenseValidation.reason };
      }

      // 3. 验证转售权限
      if (!licenseValidation.license?.resaleRights) {
        return { valid: false, error: 'No resale rights for this product' };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Validation failed'
      };
    }
  }

  /**
   * 生成许可证
   */
  private async generateLicense(request: SaleRequest, saleId: string): Promise<string> {
    // 获取产品功能列表
    const features = await this.getProductFeatures(request.productType, request.productId);
    
    // 计算过期时间
    let expiresAt: Date | undefined;
    if (request.licenseType === 'monthly') {
      expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    } else if (request.licenseType === 'yearly') {
      expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else if (request.licenseType === 'trial') {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 14);
    }

    // 生成许可证
    const licenseKey = await enhancedLicenseManager.generateLicense({
      userId: request.customerId,
      pluginName: request.productId,
      licenseType: request.licenseType,
      features,
      expiresAt
    });

    return licenseKey;
  }

  /**
   * 获取产品功能列表
   */
  private async getProductFeatures(productType: string, productId: string): Promise<string[]> {
    // 这里应该从产品配置中获取功能列表
    // 暂时使用硬编码的功能
    const productFeatures: Record<string, Record<string, string[]>> = {
      plugin: {
        'advanced-analytics': [
          'real-time-dashboard',
          'predictive-analytics',
          'custom-reports',
          'data-export',
          'advanced-segmentation'
        ],
        'marketing-automation': [
          'email-automation',
          'customer-segmentation',
          'campaign-builder',
          'ab-testing'
        ]
      },
      'saas-app': {
        'custom-ecommerce': ['full-access'],
        'restaurant-management': ['full-access']
      },
      template: {
        'modern-ecommerce': ['template-access'],
        'minimalist-store': ['template-access']
      }
    };

    return productFeatures[productType]?.[productId] || [];
  }

  /**
   * 创建分润记录
   */
  private async createRevenueSharing(saleId: string, tenantId: string, pricing: any): Promise<void> {
    await prisma.revenueSharing.create({
      data: {
        saleId,
        tenantId,
        totalAmount: pricing.sellingPrice,
        jiffooShare: pricing.jiffooRevenue,
        tenantShare: pricing.tenantRevenue,
        platformFee: pricing.platformFee,
        settlementStatus: 'pending'
      }
    });
  }

  /**
   * 获取销售统计
   */
  async getSalesStats(tenantId?: string, startDate?: Date, endDate?: Date): Promise<any> {
    const whereClause: any = {};
    
    if (tenantId) {
      whereClause.tenantId = tenantId;
    }
    
    if (startDate || endDate) {
      whereClause.saleDate = {};
      if (startDate) whereClause.saleDate.gte = startDate;
      if (endDate) whereClause.saleDate.lte = endDate;
    }

    const [totalSales, totalRevenue, salesByChannel, salesByProduct] = await Promise.all([
      // 总销售数量
      prisma.sale.count({ where: whereClause }),
      
      // 总收入
      prisma.sale.aggregate({
        where: whereClause,
        _sum: { sellingPrice: true }
      }),
      
      // 按渠道分组
      prisma.sale.groupBy({
        by: ['channel'],
        where: whereClause,
        _count: true,
        _sum: { sellingPrice: true }
      }),
      
      // 按产品分组
      prisma.sale.groupBy({
        by: ['productType', 'productId'],
        where: whereClause,
        _count: true,
        _sum: { sellingPrice: true }
      })
    ]);

    return {
      totalSales,
      totalRevenue: totalRevenue._sum.sellingPrice || 0,
      salesByChannel,
      salesByProduct
    };
  }
}

// 单例实例
export const salesManager = new SalesManager();
